// AI Radio server, mounted as a Vite plugin so `vite --host` is the only process you start.
// Rooms: ONE party room. Roles: exactly one HOST (plays audio), everybody else is a GUEST (votes + watches).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { VIBES, VIBE_IDS, VIBE_BY_ID } from '../shared/vibes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKS = path.join(ROOT, 'tracks');
const GEN = path.join(ROOT, 'music', 'gen.py');
const PYTHON = process.env.PYTHON || 'python';
// Live generation (python+numpy composes a new song per vote) is optional. RADIO_LIVE=0, or a missing python/numpy,
// puts the radio in library mode: it loops the pre-generated songs in ./tracks and switches vibe instantly on a vote.
const LIVE_WANTED = process.env.RADIO_LIVE !== '0';
const MAX_JOBS = Number(process.env.RADIO_JOBS || 3);
const ROUND_MS = Number(process.env.RADIO_ROUND_SECONDS || 12) * 1000;
const FADE_S = 6;                 // DJ crossfade length
const HOST_FADE_S = 1.2;          // quick crossfade when the host picks a vibe
const WANT_WAIT_MS = 50_000;      // wait this long for the freshly composed track before using the library
const rid = () => crypto.randomBytes(4).toString('hex');
const log = (...a) => console.log('\x1b[35m[radio]\x1b[0m', ...a);

export default function radioPlugin() {
  return {
    name: 'ai-radio',
    configureServer(server) { start(server.httpServer, server.middlewares); },
    configurePreviewServer(server) { start(server.httpServer, server.middlewares); },
  };
}

function start(httpServer, middlewares) {
  fs.mkdirSync(TRACKS, { recursive: true });

  /* ------------------------------------------------------------------ library */
  const library = new Map(); // id -> meta (no events)
  const played = new Map();  // id -> last played ms
  for (const f of fs.readdirSync(TRACKS)) {
    if (!f.endsWith('.json')) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(TRACKS, f), 'utf8'));
      delete m.events;
      if ((m.v || 1) < 2) continue; // early test tracks from before the styles were finished
      if (fs.existsSync(path.join(TRACKS, m.file))) library.set(m.id, m);
    } catch { /* ignore broken */ }
  }
  log(`library: ${library.size} tracks`);
  const libByVibe = (v) => [...library.values()].filter((t) => t.vibe === v);
  const pickLibrary = (vibe, excludeId) => {
    const c = libByVibe(vibe).filter((t) => t.id !== excludeId);
    c.sort((a, b) => (played.get(a.id) || 0) - (played.get(b.id) || 0) || b.createdAt - a.createdAt);
    return c[0] || null;
  };

  /* ------------------------------------------------------------------ state */
  const clients = new Map(); // ws -> {id, name, role}
  const room = { hostWs: null, hostToken: crypto.randomBytes(8).toString('hex'), hostLostAt: 0, audioReady: false };
  let currentVibe = null;
  let playing = null;        // {track, clock:{pos, ts}}  ts = server ms when pos was valid
  let nextTrack = null;      // meta for same-vibe autopilot follow-up
  let transition = null;     // {track, startAt}
  let want = null;           // {vibe, since, roundStart}
  let round = null;          // {startedAt, endsAt}
  const votes = new Map();   // clientId -> vibe
  let lastResult = null;
  const jobs = new Map();
  const queue = [];
  let lastStateSig = '';
  let paused = false;
  let live = false;          // true once the python/numpy probe succeeded
  const mode = () => (live ? 'live' : 'library');
  const failedAt = {};
  const now = () => Date.now();

  const curPos = () => (playing ? (paused ? playing.clock.pos : Math.max(0, playing.clock.pos + (now() - playing.clock.ts) / 1000)) : 0);
  const tally = () => {
    const t = Object.fromEntries(VIBE_IDS.map((v) => [v, 0]));
    for (const v of votes.values()) t[v.vibe]++;
    return t;
  };

  function votedByVibe() {
    const o = {};
    for (const v of votes.values()) (o[v.vibe] ||= []).push({ n: v.name, a: v.avatar });
    for (const k of Object.keys(o)) o[k] = o[k].slice(0, 14);
    return o;
  }
  const bcast = (o) => { const m = JSON.stringify(o); for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(m); };

  function publicState() {
    const jl = [...jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running' || now() - (j.endedAt || 0) < 8000);
    const lib = Object.fromEntries(VIBE_IDS.map((v) => [v, libByVibe(v).length]));
    return {
      serverTs: now(),
      hostPresent: !!room.hostWs,
      audioReady: room.audioReady,
      paused,
      voted: votedByVibe(),
      listeners: [...clients.values()].filter((c) => c.role === 'guest').length,
      currentVibe,
      agentMode: mode(),
      playing: playing ? { track: playing.track, pos: curPos() } : null,
      transition: transition ? { track: transition.track, startAt: transition.startAt } : null,
      next: nextTrack,
      want: want ? { vibe: want.vibe, since: want.since } : null,
      round: round ? { startedAt: round.startedAt, endsAt: round.endsAt } : null,
      tally: tally(),
      voters: votes.size,
      lastResult,
      jobs: jl.map((j) => ({ id: j.id, vibe: j.vibe, reason: j.reason, status: j.status, p: j.p, stage: j.stage, by: j.by, agent: j.agent, brief: j.briefTitle })),
      library: lib,
    };
  }
  function broadcast(force = false) {
    const s = publicState();
    const sig = JSON.stringify({ ...s, serverTs: 0, playing: s.playing && { id: s.playing.track.id } });
    if (!force && sig === lastStateSig) return;
    lastStateSig = sig;
    const msg = JSON.stringify({ type: 'state', state: s });
    for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(msg);
  }
  const send = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

  /* ------------------------------------------------------------------ agents (music generation jobs) */
  function spawnJob({ vibe, reason, by }) {
    if (!live) return null;
    if (reason === 'autopilot' && failedAt[vibe] && now() - failedAt[vibe] < 15_000) return null;
    // dedupe: a queued/running job for this vibe+reason family is reused
    for (const j of jobs.values()) {
      if (j.vibe === vibe && (j.status === 'queued' || j.status === 'running') && (reason === 'seed' || j.reason !== 'seed')) {
        if (by && !j.by.includes(by)) j.by.push(by);
        if (reason === 'vote' && j.reason !== 'vote') { j.reason = 'vote'; queue.sort((a, b) => prio(a) - prio(b)); }
        return j;
      }
    }
    const job = { id: rid(), vibe, reason, by: by ? [by] : [], status: 'queued', p: 0, stage: 'queued', startedAt: now(), agent: 'local' };
    jobs.set(job.id, job);
    queue.push(job);
    queue.sort((a, b) => prio(a) - prio(b));
    log(`agent queued: ${vibe} (${reason})`);
    pump();
    broadcast();
    return job;
  }
  const prio = (j) => ({ vote: 0, autopilot: 1, seed: 2 }[j.reason] ?? 3);
  const running = () => [...jobs.values()].filter((j) => j.status === 'running').length;
  function pump() {
    while (running() < MAX_JOBS && queue.length) runJob(queue.shift());
  }

  async function runJob(job) {
    job.status = 'running'; job.stage = 'starting'; broadcast();
    const args = [GEN, '--vibe', job.vibe, '--out', TRACKS];
    const p = spawn(PYTHON, args, { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf8' } });
    let buf = '', err = '';
    const onLine = (line) => {
      if (!line.startsWith('@@')) return;
      if (line.startsWith('@@DONE ')) {
        try { job.result = JSON.parse(line.slice(7)); } catch { /* */ }
        return;
      }
      try { const j = JSON.parse(line.slice(2)); job.p = j.p; job.stage = j.stage; broadcast(); } catch { /* */ }
    };
    p.on('error', (e) => { err += String(e); });
    p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      job.endedAt = now();
      if (code === 0 && job.result) {
        job.status = 'done'; job.p = 1; job.stage = 'ready';
        const meta = { ...job.result };
        library.set(meta.id, meta);
        job.track = meta;
        log(`agent done: ${meta.vibe} "${meta.title}" ${meta.bpm}bpm ${meta.duration}s in ${meta.genSeconds}s`);
        onTrackReady(meta, job);
      } else {
        job.status = 'failed'; job.stage = 'failed'; failedAt[job.vibe] = now();
        log(`agent FAILED ${job.vibe} code=${code}\n${err.slice(-800)}`);
      }
      pump(); broadcast();
    });
  }

  /* ------------------------------------------------------------------ playback orchestration */
  function sendHost(o) { send(room.hostWs, o); }

  function playTrack(meta, { fade = 0, delay = 0 } = {}) {
    paused = false;
    const startAt = now() + delay * 1000;
    played.set(meta.id, now());
    log(`play ${meta.vibe} "${meta.title}" fade=${fade}s delay=${delay.toFixed(1)}s`);
    sendHost({ type: 'play', track: meta, fade, delay });
    transition = fade > 0 ? { track: meta, startAt } : null;
    // clock switches at startAt; until then keep the old one so guests keep dancing to the outgoing song
    const apply = () => {
      playing = { track: meta, clock: { pos: Math.max(0, (now() - startAt) / 1000), ts: now() } };
      currentVibe = meta.vibe;
      if (nextTrack && nextTrack.vibe !== meta.vibe) nextTrack = null;
      if (nextTrack && nextTrack.id === meta.id) nextTrack = null;
      transition = null;
      broadcast(true);
      ensureNext();
    };
    if (delay > 0.05) setTimeout(apply, delay * 1000); else apply();
  }

  function ensureNext() {
    if (!playing || !currentVibe) return;
    const rem = playing.track.duration - curPos();
    if (!nextTrack && !want && !live) {
      // library mode: loop the vibe's songs, least recently played first
      nextTrack = pickLibrary(currentVibe, playing.track.id);
    } else if (!nextTrack && !want) {
      // keep the SAME vibe going: compose the follow-up while this one plays
      const lib = libByVibe(currentVibe).filter((t) => t.id !== playing.track.id && !played.has(t.id));
      if (lib.length && rem < 90) nextTrack = lib.sort((a, b) => b.createdAt - a.createdAt)[0];
      else if (!jobs.size || ![...jobs.values()].some((j) => j.vibe === currentVibe && (j.status === 'queued' || j.status === 'running'))) spawnJob({ vibe: currentVibe, reason: 'autopilot' });
    }
  }

  function onTrackReady(meta, job) {
    if (!playing && room.audioReady && !want) { currentVibe = currentVibe || meta.vibe; startPlayback(); return; }
    if (want && want.vibe === meta.vibe) return fulfillWant();
    if (meta.vibe === currentVibe && !nextTrack && job.reason !== 'seed') nextTrack = meta;
  }

  function startPlayback() {
    if (!room.hostWs || !room.audioReady || playing) return;
    const v = currentVibe || (want && want.vibe) || VIBE_IDS.find((id) => libByVibe(id).length) ;
    if (!v) { if (live) spawnJob({ vibe: 'rock', reason: 'vote' }); else log('library is empty: run `npm run seed`'); return; }
    currentVibe = v;
    const t = pickLibrary(v);
    if (t) playTrack(t); else if (live) spawnJob({ vibe: v, reason: 'vote' });
  }

  function crossfadeTo(meta, { atBar = true, fade = FADE_S } = {}) {
    let delay = 0;
    if (playing && atBar) {
      const bar = (60 / playing.track.bpm) * 4;
      const p = curPos();
      delay = bar - (p % bar);
      if (delay < 0.6) delay += bar;
      if (playing.track.duration - (p + delay) < FADE_S) delay = 0;
    }
    want = null; nextTrack = null;
    playTrack(meta, { fade: playing ? fade : 0, delay });
  }

  function fulfillWant() {
    if (paused) return;
    if (!want || !playing) { if (want && !playing) { const t = pickLibrary(want.vibe); if (t) { const v = want; want = null; currentVibe = v.vibe; playTrack(t); } } return; }
    const fresh = libByVibe(want.vibe).filter((t) => t.createdAt >= want.roundStart && !played.has(t.id));
    if (fresh.length) return crossfadeTo(fresh.sort((a, b) => b.createdAt - a.createdAt)[0]);
    const inflight = [...jobs.values()].some((j) => j.vibe === want.vibe && (j.status === 'queued' || j.status === 'running'));
    if (!inflight || now() - want.since > WANT_WAIT_MS) {
      const t = pickLibrary(want.vibe, playing.track.id);
      if (t) return crossfadeTo(t);
      if (!inflight && live) spawnJob({ vibe: want.vibe, reason: 'vote' });
      else if (!inflight) { log(`no songs for ${want.vibe} and live generation is off: staying on ${currentVibe}`); want = null; broadcast(true); }
    }
  }

  function setPaused(v) {
    if (!playing || paused === v) return;
    if (v) { playing.clock = { pos: curPos(), ts: now() }; paused = true; sendHost({ type: 'pause' }); }
    else { playing.clock.ts = now(); paused = false; sendHost({ type: 'resume' }); }
    log(v ? 'paused by host' : 'resumed by host');
    broadcast(true);
  }

  /* ------------------------------------------------------------------ voting (kahoot style rounds) */
  function castVote(c, vibe) {
    if (!VIBE_BY_ID[vibe]) return;
    const clientId = c.id;
    const changed = !votes.has(clientId) || votes.get(clientId).vibe !== vibe;
    votes.set(clientId, { vibe, name: c.name, avatar: c.avatar });
    if (changed) bcast({ type: 'feed', kind: 'vote', name: c.name, avatar: c.avatar, vibe });
    if (!round) round = { startedAt: now(), endsAt: now() + ROUND_MS };
    spawnJob({ vibe, reason: 'vote', by: clientId.slice(0, 4) }); // an agent per button press (deduped per vibe)
    broadcast();
  }

  function resolveRound() {
    const t = tally();
    const max = Math.max(...Object.values(t));
    const startedAt = round.startedAt;
    round = null;
    if (max === 0) { broadcast(); return; }
    const top = VIBE_IDS.filter((v) => t[v] === max);
    const winner = top[Math.floor(Math.random() * top.length)];
    lastResult = { winner, tally: t, ts: now(), tie: top.length > 1 };
    votes.clear();
    log(`round result: ${winner}`, t);
    if (winner === currentVibe && playing) { want = null; broadcast(true); return; }
    want = { vibe: winner, since: now(), roundStart: startedAt };
    fulfillWant();
    broadcast(true);
  }

  /* ------------------------------------------------------------------ tick */
  setInterval(() => {
    if (round && now() >= round.endsAt) resolveRound();
    if (want) fulfillWant();
    if (room.hostWs === null && room.hostLostAt && now() - room.hostLostAt > 60_000) { room.audioReady = false; }
    if (playing && room.hostWs && !transition && !paused) {
      const rem = playing.track.duration - curPos();
      if (!nextTrack && !want) ensureNext();
      if (!want && nextTrack && rem <= FADE_S + 1.5) crossfadeTo(nextTrack, { atBar: false });
      else if (rem <= -2) { // nothing was queued: keep the music going
        const t = nextTrack || pickLibrary(currentVibe, playing.track.id) || playing.track;
        crossfadeTo(t, { atBar: false });
      }
    }
    broadcast();
  }, 1000);
  setInterval(() => broadcast(true), 4000);

  /* ------------------------------------------------------------------ seed the library (>= 1 song per vibe) */
  function probeLive() {
    if (!LIVE_WANTED) return log('live generation disabled (RADIO_LIVE=0): library mode');
    const p = spawn(PYTHON, ['-c', 'import numpy, scipy, soundfile'], { stdio: 'ignore' });
    p.on('error', () => log('python not found: library mode (loops the songs in ./tracks)'));
    p.on('close', (code) => {
      if (code !== 0) return log('python/numpy missing: library mode (loops the songs in ./tracks)');
      live = true;
      for (const v of VIBE_IDS) if (libByVibe(v).length === 0 && fs.existsSync(path.join(ROOT, 'music', 'styles', v + '.py'))) spawnJob({ vibe: v, reason: 'seed' });
      if (playing) ensureNext();
    });
  }
  probeLive();

  /* ------------------------------------------------------------------ HTTP */
  const MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json' };
  middlewares.use((req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (url.startsWith('/tracks/')) {
      const f = path.join(TRACKS, path.basename(decodeURIComponent(url)));
      if (!f.startsWith(TRACKS) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('nope'); }
      const st = fs.statSync(f);
      const type = MIME[path.extname(f)] || 'application/octet-stream';
      const range = req.headers.range;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const s = m[1] ? parseInt(m[1], 10) : 0;
        const e = m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${s}-${e}/${st.size}`);
        res.setHeader('Content-Length', e - s + 1);
        return fs.createReadStream(f, { start: s, end: e }).pipe(res);
      }
      res.setHeader('Content-Length', st.size);
      return fs.createReadStream(f).pipe(res);
    }
    if (url === '/api/invite') {
      const port = httpServer.address()?.port || 5173;
      const urls = lanAddrs().map((ip) => `http://${ip}:${port}/`);
      return QRCode.toString(urls[0] || `http://localhost:${port}/`, { type: 'svg', margin: 1, color: { dark: '#10131a', light: '#ffffff' } }).then((svg) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ urls, qr: svg }));
      });
    }
    if (url === '/api/library') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([...library.values()].sort((a, b) => b.createdAt - a.createdAt)));
    }
    next();
  });

  /* ------------------------------------------------------------------ WebSocket */
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    if ((req.url || '').startsWith('/radio-ws')) wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  httpServer.once('listening', () => {
    const port = httpServer.address()?.port;
    setTimeout(() => {
      log(`party room ready -> ${lanAddrs().map((ip) => `http://${ip}:${port}/`).join('  ') || `http://localhost:${port}/`}`);
      log(`mode: ${mode()}  |  vote round: ${ROUND_MS / 1000}s  |  parallel generators: ${MAX_JOBS}`);
    }, 400);
  });

  wss.on('connection', (ws) => {
    const c = { id: rid(), name: 'Guest', avatar: '🎧', role: 'guest' };
    clients.set(ws, c);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      switch (m.type) {
        case 'hello': {
          c.id = String(m.clientId || c.id).slice(0, 32);
          c.name = String(m.name || 'Guest').replace(/[<>]/g, '').slice(0, 16) || 'Guest';
          c.avatar = String(m.avatar || '🎧').slice(0, 8);
          let granted = false;
          if (m.wantHost) {
            const seatFree = !room.hostWs || room.hostWs.readyState !== 1;
            if (seatFree || (m.hostToken && m.hostToken === room.hostToken)) {
              if (room.hostWs && room.hostWs !== ws) { send(room.hostWs, { type: 'kicked' }); const old = clients.get(room.hostWs); if (old) old.role = 'guest'; }
              room.hostWs = ws; room.hostLostAt = 0; c.role = 'host'; granted = true;
            }
          }
          send(ws, { type: 'welcome', clientId: c.id, role: c.role, hostToken: granted ? room.hostToken : undefined, hostTaken: !!m.wantHost && !granted, vibes: VIBES });
          broadcast(true);
          break;
        }
        case 'ping': send(ws, { type: 'pong', t: m.t, s: now() }); break;
        case 'vote': castVote(c, m.vibe); break;
        case 'audioReady':
          if (ws !== room.hostWs) break;
          room.audioReady = true;
          if (!playing) startPlayback(); else sendHost({ type: 'play', track: playing.track, fade: 0, delay: 0, startPos: curPos(), soft: true, paused });
          broadcast(true);
          break;
        case 'pos':
          if (ws !== room.hostWs || !playing || m.trackId !== playing.track.id) break;
          if (m.playing && !paused) playing.clock = { pos: Number(m.pos) || 0, ts: now() };
          break;
        case 'ended':
          if (ws === room.hostWs && playing && m.trackId === playing.track.id && !transition) {
            const t = nextTrack || pickLibrary(currentVibe, playing.track.id) || playing.track;
            crossfadeTo(t, { atBar: false });
          }
          break;
        case 'hostForce': // host override: the vibe changes right now (short crossfade, no vote, no waiting)
          if (ws === room.hostWs && VIBE_BY_ID[m.vibe]) {
            votes.clear(); round = null; want = null; nextTrack = null;
            const t = pickLibrary(m.vibe, playing?.track.id);
            if (t) { currentVibe = m.vibe; crossfadeTo(t, { atBar: false, fade: HOST_FADE_S }); }
            else if (live) { want = { vibe: m.vibe, since: now(), roundStart: now() - 1000 }; spawnJob({ vibe: m.vibe, reason: 'vote', by: 'host' }); }
            broadcast(true);
          }
          break;
        case 'setName': c.name = String(m.name || c.name).replace(/[<>]/g, '').slice(0, 16); c.avatar = String(m.avatar || c.avatar).slice(0, 8); break;
        case 'pause': if (ws === room.hostWs) setPaused(true); break;
        case 'resume': if (ws === room.hostWs) setPaused(false); break;
        case 'hostSkip':
          if (ws === room.hostWs && playing) {
            const t = nextTrack || pickLibrary(currentVibe, playing.track.id);
            if (t) crossfadeTo(t, { atBar: false });
          }
          break;
        default: break;
      }
    });
    ws.on('close', () => {
      clients.delete(ws);
      if (room.hostWs === ws) { room.hostWs = null; room.hostLostAt = now(); }
      broadcast(true);
    });
  });
}

function lanAddrs() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vethernet|wsl|virtual|vmware|vbox|docker|loopback|bluetooth/i.test(name)) continue;
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) out.push(i.address);
    }
  }
  return out;
}
