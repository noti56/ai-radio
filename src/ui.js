// DOM UI: welcome (name + avatar), role pick, top bar, now playing, agents, democratic vote buttons with live voter chips,
// host dock (play/pause), invite modal, splash + vote feed.
import { VIBES, VIBE_BY_ID } from '../shared/vibes.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const AVATARS = ['🦊', '🐼', '🐸', '🦄', '🐙', '🐵', '🦁', '🐧', '👾', '🤖', '🐯', '🐲'];
const NAMES = ['Disco Dan', 'Funky Fox', 'Bass Bandit', 'DJ Pixel', 'Neon Nina', 'Captain Groove', 'Echo', 'Riff Raff', 'Beat Bear', 'Lady Loop', 'Vinyl Vic', 'Synth Sam', 'Mic Check', 'Turbo Tia'];

export function createUI({ net, actions }) {
  const root = $('#ui');
  root.innerHTML = '';
  const el = {};
  const S = { avatar: net.avatar || AVATARS[0], name: net.name || '' };

  /* ---- top bar */
  el.top = h(`<div class="topbar">
    <div class="glass brand"><div class="logo"></div><span class="t">AI RADIO</span><span class="live" id="live"><i></i><span>LIVE</span></span></div>
    <div class="spacer"></div>
    <div class="glass pill" id="listeners">👥 <b>0</b></div>
    <button class="glass pill btn" id="me"><span id="meAv">🎧</span><b id="meName">you</b></button>
    <div class="glass pill" id="role"></div>
  </div>`);
  el.now = h(`<div class="glass now">
    <div class="row"><span class="chip" id="chip">—</span><span class="title" id="title">Warming up the band…</span></div>
    <div class="bar"><i id="prog"></i></div>
    <div class="row"><span class="meta" id="meta">waiting for the host to start the speakers</span><span class="meta" id="time" style="margin-left:auto"></span></div>
    <div class="upnext" id="upnext"></div>
  </div>`);
  el.agents = h('<div class="agents" id="agents"></div>');
  el.ticker = h('<div class="ticker" id="ticker"></div>');

  /* ---- host dock (play / pause) */
  el.dock = h(`<div class="dock" id="dock" style="display:none">
    <button class="playbtn" id="playpause" aria-label="play or pause"><span class="ic">⏸</span><span class="lb">PAUSE</span></button>
    <div class="dock-info glass"><b>👑 You're the speaker</b><span id="dockSub">keep this phone connected to the speaker</span></div>
    <button class="glass pill btn" id="inviteBtn">📲 Invite</button>
  </div>`);

  /* ---- vote panel */
  el.vote = h(`<div class="glass vote">
    <div class="vote-head" id="voteHead"><span>🗳️ Vote the next vibe</span><span class="sub" id="voteSub"></span><span class="count" id="voteCount"></span><span class="chev">▾</span></div>
    <div class="round-bar"><i id="roundBar"></i></div>
    <div class="who" id="who"></div>
    <div class="grid" id="grid"></div>
  </div>`);
  const grid = $('#grid', el.vote);
  const btns = {};
  for (const v of VIBES) {
    const b = h(`<button class="vbtn" style="--c:${v.color}" data-v="${v.id}">
      <i class="tally"></i><span class="shape">${v.shape}</span>
      <span class="lab"><span>${v.label}</span><small>${v.tagline}</small></span>
      <span class="emo">${v.emoji}</span><span class="n">0</span><span class="voters"></span></button>`);
    b.addEventListener('click', () => { navigator.vibrate?.(25); actions.vote(v.id); });
    grid.appendChild(b); btns[v.id] = b;
  }
  const spacer = h('<div class="spacer-flex"></div>');
  root.append(el.top, el.now, el.agents, spacer, el.ticker, el.dock, el.vote);

  /* ---- welcome (name + avatar), role, start, invite */
  el.splash = h('<div class="splash"><div></div></div>');
  el.toast = h('<div class="glass toast"></div>');
  el.welcome = h(`<div class="modal welcome hide" id="welcome"><div class="cubes"></div>
    <div class="glass card pop">
      <div class="wl-logo"><i></i></div>
      <h1>Welcome to <span class="grad">AI Radio</span></h1>
      <p id="wlSub">Pick your player name &amp; avatar. Your votes show up live for everyone on the Wi-Fi!</p>
      <div class="avatars" id="avatars"></div>
      <div class="namefield"><input id="nameIn" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Your name…" /><button class="dice" id="dice" title="surprise me" aria-label="random name">🎲</button></div>
      <button class="big" id="wlGo" disabled>Let's party →</button>
      <div class="tiny" id="wlHint"></div>
    </div></div>`);
  el.role = h(`<div class="modal hide" id="roleModal"><div class="cubes"></div><div class="glass card pop">
    <h1 id="roleTitle">Hey!</h1>
    <p>How do you want to join the party?</p>
    <button class="big" id="beGuest">🎉 Join &amp; vote<small>watch the band, pick the vibe</small></button>
    <button class="big alt" id="beHost">🔊 I'm the speaker (host)<small id="hostSub">this device plays the sound — connect it to the speakers</small></button>
    <div class="tiny" id="gateInfo"></div>
  </div></div>`);
  el.start = h(`<div class="modal hide" id="start"><div class="glass card pop">
    <h1>🔊 Start the party</h1>
    <p>Browsers need one tap before they may play sound. Connect this phone to the speaker, turn the volume up, then tap.</p>
    <button class="big" id="startBtn">▶ Start the radio</button>
  </div></div>`);
  el.invite = h(`<div class="modal hide" id="invite"><div class="glass card pop">
    <h1>📲 Invite the party</h1>
    <p>Everyone on this Wi-Fi: scan or open</p>
    <div class="qr" id="qr"></div><div class="url" id="urls"></div>
    <button class="big alt" id="closeInvite">Close</button>
  </div></div>`);
  document.body.append(el.splash, el.toast, el.welcome, el.role, el.start, el.invite);

  // avatars + name
  const avBox = $('#avatars', el.welcome);
  AVATARS.forEach((a) => { const b = h(`<button class="av" data-a="${a}">${a}</button>`); b.addEventListener('click', () => { S.avatar = a; paintAv(); navigator.vibrate?.(15); }); avBox.appendChild(b); });
  const paintAv = () => avBox.querySelectorAll('.av').forEach((b) => b.classList.toggle('sel', b.dataset.a === S.avatar));
  const nameIn = $('#nameIn', el.welcome), go = $('#wlGo', el.welcome);
  nameIn.addEventListener('input', () => { S.name = nameIn.value.trim(); go.disabled = S.name.length < 2; });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !go.disabled) go.click(); });
  $('#dice', el.welcome).addEventListener('click', () => { nameIn.value = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + Math.floor(Math.random() * 90 + 10); S.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]; nameIn.dispatchEvent(new Event('input')); paintAv(); });
  go.addEventListener('click', () => { navigator.vibrate?.(30); el.welcome.classList.add('hide'); actions.saveProfile({ name: S.name, avatar: S.avatar }); });
  const cubes = $('.cubes', el.welcome); const cubes2 = $('.cubes', el.role);
  for (const c of [cubes, cubes2]) for (let i = 0; i < 16; i++) { const q = document.createElement('i'); q.style.cssText = `left:${(i * 37) % 100}%;animation-delay:${-(i * 1.3) % 9}s;animation-duration:${9 + (i % 5) * 2}s;--s:${14 + (i % 4) * 10}px;--c:${VIBES[i % VIBES.length].color}`; c.appendChild(q); }

  $('#voteHead', el.vote).addEventListener('click', () => el.vote.classList.toggle('collapsed'));
  $('#beHost', el.role).addEventListener('click', () => { el.role.classList.add('hide'); actions.chooseRole('host'); });
  $('#beGuest', el.role).addEventListener('click', () => { el.role.classList.add('hide'); actions.chooseRole('guest'); });
  $('#startBtn', el.start).addEventListener('click', () => actions.startAudio());
  $('#inviteBtn', el.dock).addEventListener('click', () => showInvite());
  $('#closeInvite', el.invite).addEventListener('click', () => el.invite.classList.add('hide'));
  $('#me', el.top).addEventListener('click', () => showWelcome({ edit: true }));
  $('#playpause', el.dock).addEventListener('click', () => { navigator.vibrate?.(40); actions.togglePause(); });

  function showWelcome({ edit = false } = {}) {
    nameIn.value = S.name || ''; go.disabled = (S.name || '').length < 2; paintAv();
    $('#wlSub', el.welcome).innerHTML = edit ? 'Change your name or avatar.' : 'Pick your player name &amp; avatar. Your votes show up live for everyone on the Wi-Fi!';
    go.textContent = edit ? 'Save ✓' : "Let's party →";
    el.welcome.classList.remove('hide');
    setTimeout(() => nameIn.focus(), 350);
  }
  async function showInvite() {
    el.invite.classList.remove('hide');
    try {
      const r = await (await fetch('/api/invite')).json();
      $('#qr', el.invite).innerHTML = r.qr;
      $('#urls', el.invite).innerHTML = r.urls.map((u) => `<div>${u}</div>`).join('') || 'No LAN address found (are you on Wi-Fi?)';
    } catch { $('#urls', el.invite).textContent = 'Could not load invite'; }
  }

  let toastTimer;
  function toast(msg) { el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600); }
  function splash(kicker, text, color) {
    const d = $('div', el.splash);
    d.innerHTML = `<small>${kicker}</small>${text}`;
    d.style.color = color || '#fff';
    el.splash.classList.remove('show'); void el.splash.offsetWidth; el.splash.classList.add('show');
  }
  function feed(m) {
    const v = VIBE_BY_ID[m.vibe]; if (!v) return;
    const b = h(`<div class="glass bub" style="--c:${v.color}"><span class="a">${esc(m.avatar)}</span><b>${esc(m.name)}</b> voted <span class="vv">${v.emoji} ${v.label}</span></div>`);
    el.ticker.appendChild(b);
    while (el.ticker.children.length > 4) el.ticker.firstChild.remove();
    setTimeout(() => b.classList.add('out'), 3800); setTimeout(() => b.remove(), 4300);
  }
  function theme(vibeId) {
    const v = VIBE_BY_ID[vibeId]; if (!v) return;
    document.documentElement.style.setProperty('--accent', v.color);
    document.documentElement.style.setProperty('--accent2', v.glow);
    $('#chip', el.now).style.background = v.color;
  }

  let mine = null, lastWinnerTs = 0, lastState = null;
  const recent = [];
  function update(s, { role }) {
    lastState = s;
    const isHost = role === 'host';
    $('#role', el.top).innerHTML = isHost ? '<span>👑 HOST</span>' : '<span>🎧 GUEST</span>';
    $('#role', el.top).classList.toggle('host', isHost);
    el.dock.style.display = isHost ? 'flex' : 'none';
    $('#meAv', el.top).textContent = net.avatar; $('#meName', el.top).textContent = net.name || 'you';
    const pp = $('#playpause', el.dock);
    pp.classList.toggle('paused', !!s.paused);
    $('.ic', pp).textContent = s.paused ? '▶' : '⏸'; $('.lb', pp).textContent = s.paused ? 'PLAY' : 'PAUSE';
    $('#dockSub', el.dock).textContent = s.paused ? 'music is paused for everyone' : 'keep this phone connected to the speaker';
    $('#listeners b', el.top).textContent = s.listeners + (isHost ? 0 : 0);
    $('#live', el.top).classList.toggle('off', !s.playing || s.paused);
    const tr = s.playing && s.playing.track;
    $('#title', el.now).textContent = tr ? tr.title : (s.hostPresent ? 'Tuning the first song…' : 'Waiting for a host');
    $('#chip', el.now).textContent = tr ? VIBE_BY_ID[tr.vibe].emoji + ' ' + VIBE_BY_ID[tr.vibe].label : '—';
    $('#meta', el.now).textContent = s.paused ? '⏸ paused by the host' : tr ? `${tr.bpm} BPM · numpy synth · ${Math.floor(tr.duration / 60)}:${String(Math.round(tr.duration % 60)).padStart(2, '0')}` :
      (s.hostPresent ? (s.audioReady ? (s.agentMode === 'live' ? 'composing the first track' : 'loading the first track') : 'host: tap start to unlock the speakers') : 'open the app on the speaker phone and choose “I’m the speaker”');
    if (tr) theme(tr.vibe);

    let up = '';
    if (s.want) { const v = VIBE_BY_ID[s.want.vibe]; up = `⏭ Up next: <b>${v.emoji} ${v.label}</b> — mixing in…`; }
    else if (s.next) up = `⏭ Up next: <b>${VIBE_BY_ID[s.next.vibe].emoji} ${esc(s.next.title)}</b>`;
    else if (s.playing) up = `⏭ Next: more ${VIBE_BY_ID[s.currentVibe]?.label || ''} ${s.agentMode === 'live' ? '(composing)' : '(from the library)'}`;
    $('#upnext', el.now).innerHTML = up;

    const ag = el.agents;
    const seen = new Set();
    for (const j of s.jobs) {
      seen.add(j.id);
      const v = VIBE_BY_ID[j.vibe];
      let a = ag.querySelector(`[data-j="${j.id}"]`);
      if (!a) { a = h(`<div class="glass agent" data-j="${j.id}" style="--c:${v.color}"><i class="fill"></i><span class="bot">🤖</span><span class="txt"></span></div>`); ag.appendChild(a); }
      a.querySelector('.fill').style.width = Math.round(j.p * 100) + '%';
      const reason = j.reason === 'vote' ? 'voted' : j.reason === 'autopilot' ? 'next up' : 'warm-up';
      a.querySelector('.txt').innerHTML = j.status === 'failed' ? `${v.emoji} ${v.label}: failed` : j.status === 'done' ? `${v.emoji} ${v.label} ready ✓` : `${v.emoji} <b>${v.label}</b> · ${reason} · ${esc(j.stage)}${j.brief ? ' · “' + esc(j.brief) + '”' : ''}`;
      a.classList.toggle('done', j.status === 'done');
    }
    ag.querySelectorAll('[data-j]').forEach((n) => { if (!seen.has(n.dataset.j)) n.remove(); });

    // votes + who voted what
    const total = Math.max(1, Object.values(s.tally).reduce((a, b) => a + b, 0));
    const lines = [];
    for (const v of VIBES) {
      const n = s.tally[v.id] || 0;
      const b = btns[v.id];
      b.querySelector('.tally').style.width = (n / total) * 100 + '%';
      const nn = b.querySelector('.n'); nn.textContent = n; nn.classList.toggle('show', n > 0);
      b.classList.toggle('now-vibe', s.currentVibe === v.id);
      const people = (s.voted && s.voted[v.id]) || [];
      const vh = people.slice(0, 5).map((p) => `<span class="vc" title="${esc(p.n)}">${esc(p.a)}<em>${esc(p.n)}</em></span>`).join('') + (people.length > 5 ? `<span class="vc more">+${people.length - 5}</span>` : '');
      if (b.querySelector('.voters').dataset.k !== vh) { b.querySelector('.voters').innerHTML = vh; b.querySelector('.voters').dataset.k = vh; }
      for (const p of people) lines.push(`<span class="wl"><b>${esc(p.a)} ${esc(p.n)}</b> → ${v.emoji}</span>`);
    }
    $('#who', el.vote).innerHTML = lines.length ? lines.join('') : '<span class="wl dim">nobody voted yet — be the first!</span>';
    if (!s.round && !Object.values(s.tally).some((x) => x)) mine = null;
    for (const v of VIBES) btns[v.id].classList.toggle('mine', mine === v.id && !!s.round);
    $('#voteSub', el.vote).textContent = s.round ? `${s.voters} vote${s.voters === 1 ? '' : 's'} so far` : (s.want ? 'agent is mixing the winner…' : 'tap a vibe to start a round');
    if (s.lastResult && s.lastResult.ts !== lastWinnerTs) {
      const first = lastWinnerTs === 0; lastWinnerTs = s.lastResult.ts;
      const v = VIBE_BY_ID[s.lastResult.winner];
      if (!first || Date.now() - s.lastResult.ts < 15000) {
        toast(`${v.emoji} ${v.label} wins${s.lastResult.tie ? ' (coin flip!)' : ''}`);
        btns[v.id].classList.remove('winner'); void btns[v.id].offsetWidth; btns[v.id].classList.add('winner');
      }
    }
  }

  function tick(pos, nowServer) {
    const s = lastState; if (!s) return;
    if (s.playing) {
      const d = s.playing.track.duration;
      $('#prog', el.now).style.width = Math.min(100, (pos / d) * 100) + '%';
      $('#time', el.now).textContent = `${fmt(pos)} / ${fmt(d)}`;
    } else { $('#prog', el.now).style.width = '0'; $('#time', el.now).textContent = ''; }
    const rb = $('#roundBar', el.vote), cnt = $('#voteCount', el.vote);
    if (s.round) {
      const left = Math.max(0, s.round.endsAt - nowServer), tot = s.round.endsAt - s.round.startedAt;
      rb.style.transform = `scaleX(${left / tot})`; cnt.textContent = Math.ceil(left / 1000);
    } else { rb.style.transform = 'scaleX(0)'; cnt.textContent = ''; }
  }

  return {
    el, update, tick, toast, splash, theme, showInvite, feed, showWelcome,
    setMine(v) { mine = v; Object.entries(btns).forEach(([id, b]) => b.classList.toggle('mine', id === v)); },
    role: {
      show(name, info) { $('#roleTitle', el.role).textContent = `Hey ${name}! ${S.avatar}`; $('#gateInfo', el.role).textContent = info || ''; el.role.classList.remove('hide'); },
      hide() { el.role.classList.add('hide'); },
      hostTaken(t) { $('#beHost', el.role).disabled = t; $('#hostSub', el.role).textContent = t ? 'someone is already the speaker of this party' : 'this device plays the sound — connect it to the speakers'; },
    },
    startPrompt(v) { el.start.classList.toggle('hide', !v); },
  };
}
