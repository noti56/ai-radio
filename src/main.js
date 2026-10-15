import './style.css';
import './style2.css';
import { Net, LS } from './net.js';
import { Stage } from './scene/stage.js';
import { Timeline } from './scene/timeline.js';
import { HostPlayer } from './audio/hostPlayer.js';
import { createUI } from './ui.js';
import { VIBE_BY_ID } from '../shared/vibes.js';

let last = performance.now();
const q = new URLSearchParams(location.search);
if (q.has('clean')) document.body.classList.add('clean');

/* ---------- quality tier */
function detectQuality() {
  const forced = q.get('q'); if (forced) return forced;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 8 ? 'mid' : 'low';
  return 'high';
}
const stage = new Stage(document.getElementById('stage'), { quality: detectQuality() });
window.__stage = stage;

function loop() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  stage.frame(dt);
  requestAnimationFrame(loop);
}

/* ---------- demo mode (no server logic): ?demo=<vibe>[&track=<id>][&at=<sec>][&freeze] ---------- */
if (q.has('demo')) {
  const vibe = q.get('demo') || 'rock';
  const at = parseFloat(q.get('at') || '0');
  const freeze = q.has('freeze');
  (async () => {
    let tl = null;
    if (q.get('track')) {
      const meta = await (await fetch(`/tracks/${q.get('track')}.json`)).json();
      tl = new Timeline(meta);
    }
    await stage.setVibe(vibe, { instant: true });
    stage.clock = () => ({ timeline: tl, t: at + (freeze ? 0 : stage.wallT) });
  })();
  loop();
} else {
  boot();
}

/* ---------- full app ---------- */
function boot() {
  const net = new Net();
  const host = new HostPlayer(net);
  const timelines = new Map();   // trackId -> Timeline
  const loading = new Set();
  let state = null, curTl = null, curTrackId = null, vibeShown = null, roleChosen = false;

  const ui = createUI({
    net,
    actions: {
      vote(v) { ui.setMine(v); net.send({ type: net.role === 'host' ? 'hostForce' : 'vote', vibe: v }); }, // host press = switch right now
      saveProfile({ name, avatar }) {
        net.setProfile(name, avatar);
        if (!roleChosen && !q.has('join')) ui.role.show(name, '');
      },
      chooseRole(r) {
        roleChosen = true;
        net.setWantHost(r === 'host');
      },
      startAudio() { host.unlock().then(() => ui.startPrompt(false)); },
      togglePause() { net.send({ type: state && state.paused ? 'resume' : 'pause' }); },
    },
  });

  net.on('welcome', (m) => {
    if (m.role === 'host') { if (!host.unlocked && net.name) ui.startPrompt(true); else if (host.unlocked) net.send({ type: 'audioReady' }); }
    else ui.startPrompt(false);
    if (m.hostTaken) ui.toast('A speaker is already connected - you joined as a guest');
  });
  net.on('kicked', () => { ui.toast('Another device took over as host'); net.setWantHost(false); });
  net.on('play', (m) => { host.play(m.track, m); });
  net.on('pause', () => host.pause());
  net.on('resume', () => host.resume());
  net.on('feed', (m) => ui.feed(m));
  net.on('state', (s) => {
    state = s;
    ui.update(s, { role: net.role });
    ui.role.hostTaken(s.hostPresent && net.role !== 'host');
    const tr = s.playing && s.playing.track;
    if (tr && tr.id !== curTrackId) ensureTimeline(tr);
    const vibe = tr ? tr.vibe : (s.currentVibe || 'rock');
    if (vibe !== vibeShown) {
      const first = vibeShown === null;
      vibeShown = vibe;
      stage.setVibe(vibe, { instant: first });
      ui.theme(vibe);
      if (!first && tr) ui.splash('NOW PLAYING', `${VIBE_BY_ID[vibe].emoji} ${VIBE_BY_ID[vibe].label.toUpperCase()}`, VIBE_BY_ID[vibe].glow);
    }
  });
  net.connect();

  // every visit: pick a name (first time) and then choose HOST or GUEST
  if (q.has('join')) { roleChosen = true; net.setWantHost(false); if (!net.name) ui.showWelcome(); }
  else if (!net.name) ui.showWelcome();
  else ui.role.show(net.name, '');

  async function ensureTimeline(tr) {
    if (timelines.has(tr.id)) { curTl = timelines.get(tr.id); curTrackId = tr.id; return; }
    if (loading.has(tr.id)) return;
    loading.add(tr.id);
    try {
      const meta = await (await fetch(`/tracks/${tr.id}.json`)).json();
      timelines.set(tr.id, new Timeline(meta));
      if (timelines.size > 6) timelines.delete(timelines.keys().next().value);
      if (state && state.playing && state.playing.track.id === tr.id) { curTl = timelines.get(tr.id); curTrackId = tr.id; }
    } catch (e) { console.warn('timeline load failed', e); }
    loading.delete(tr.id);
  }

  // the stage clock: host uses the real audio position, guests extrapolate the server clock (frozen while paused)
  stage.clock = () => {
    if (!state || !state.playing || !curTl || curTrackId !== state.playing.track.id) return null;
    let t;
    if (state.paused) t = state.playing.pos;
    else {
      const hp = net.role === 'host' && host.current && host.current.id === curTrackId ? host.position() : null;
      t = hp != null ? hp : state.playing.pos + (net.serverNow() - state.serverTs) / 1000;
    }
    return { timeline: curTl, t };
  };

  const tickUI = () => {
    if (state) {
      const c = stage.clock();
      ui.tick(c ? c.t : 0, net.serverNow());
    }
    setTimeout(tickUI, 100);
  };
  tickUI();
  window.__radio = { net, host, stage, ui, get state() { return state; } };
  loop();
}
