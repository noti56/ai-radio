// The Claude band: three voxel characters (Sonnet = guitar, Haiku = bass, Opus = drums) playing from real note events.
// Deterministic: every pose is a pure function of the frame object `f` (see timeline.js).
import { THREE, Builder, U, clamp, lerp, smoothstep, easeOutBack, shade, mixHex, voxelText, rng } from './voxel.js';
import { makeStringed, makeKit, makeDarbuka, makePads, makeDecks } from './instruments.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const wrap = (b, o = {}) => b.build({ anchor: 'none', pivot: [-0.5, -0.5, -0.5], jitter: 0.03, ...o });

export const CHARS = {
  guitar: { name: 'SONNET', body: 0xe8664a, dark: 0xb94a33, belly: 0xf7c9a8 },
  bass: { name: 'HAIKU', body: 0x4fb6e8, dark: 0x2f86b8, belly: 0xd3f0ff },
  drums: { name: 'OPUS', body: 0x8c6cf0, dark: 0x5f43c4, belly: 0xe0d7ff },
};
const INK = 0x2b2b30, WHITE = 0xffffff, LIME = 0xc6ff3d;

/* ------------------------------------------------------------------ costumes (torso cell grid: x -6..5, y 0..9, z -5..4, face at z 5) */
const COSTUMES = {
  mohawk: (b, g, c1, c2) => { b.box(-1, 10, -4, 2, 2, 9, c1); for (let z = -4; z <= 4; z += 2) b.box(-1, 12, z, 2, 2 + (z % 4 === 0 ? 1 : 0), 1, c2 ?? c1); },
  spikes: (b, g, c1) => { for (let x = -5; x <= 4; x += 3) for (let z = -4; z <= 3; z += 3) b.box(x, 10, z, 2, 2 + ((x + z) & 1) * 2, 2, c1); },
  afro: (b, g, c1) => { b.ball(-0.5, 10, -0.5, 6.4, c1); },
  cap: (b, g, c1, c2) => { b.box(-6, 10, -5, 12, 2, 10, c1); b.box(-6, 10, 5, 12, 1, 3, c2 ?? c1); },
  capBack: (b, g, c1, c2) => { b.box(-6, 10, -5, 12, 2, 10, c1); b.box(-6, 10, -8, 12, 1, 3, c2 ?? c1); },
  beanie: (b, g, c1, c2) => { b.box(-6, 10, -5, 12, 3, 10, c1); b.box(-6, 10, -5, 12, 1, 10, c2 ?? c1); b.ball(-0.5, 14, -0.5, 1.6, c2 ?? c1); },
  headphones: (b, g, c1, c2) => {
    b.box(-6, 10, -1, 12, 1, 2, c1); b.box(-7, 5, -1, 1, 6, 2, c1); b.box(6, 5, -1, 1, 6, 2, c1);
    g.box(-8, 4, -3, 2, 5, 6, c2 ?? LIME); g.box(6, 4, -3, 2, 5, 6, c2 ?? LIME);
  },
  shades: (b, g, c1) => { b.box(-5, 5, 6, 4, 3, 1, c1).box(1, 5, 6, 4, 3, 1, c1).box(-1, 7, 6, 2, 1, 1, c1); },
  visor: (b, g, c1) => { g.box(-5, 5, 6, 10, 3, 1, c1); },
  keffiyeh: (b, g, c1, c2) => {
    b.box(-6, 10, -5, 12, 1, 10, (x, y, z) => ((x + z) & 1 ? c1 : c2 ?? 0xd0262a));
    b.box(-7, 6, -5, 1, 4, 9, c1).box(6, 6, -5, 1, 4, 9, c1).box(-6, 5, -6, 12, 5, 1, c1);
    b.box(-6, 11, -5, 12, 1, 10, INK);                                              // agal ring
  },
  fez: (b, g, c1, c2) => { b.box(-3, 10, -3, 6, 4, 6, c1); b.box(-2, 14, -2, 4, 1, 4, c1); b.cell(1, 15, 0, c2 ?? 0xffd24a).cell(1, 14, 3, c2 ?? 0xffd24a).cell(1, 13, 3, c2 ?? 0xffd24a); },
  crown: (b, g, c1) => { b.box(-5, 10, -4, 10, 1, 8, c1); for (let x = -5; x <= 3; x += 2) b.box(x, 11, -4, 1, 2, 8, c1); },
  bow: (b, g, c1, c2) => { b.box(-5, 10, 1, 3, 3, 2, c1); b.box(0, 10, 1, 3, 3, 2, c1); b.box(-2, 10, 1, 2, 2, 2, c2 ?? c1); },
  tophat: (b, g, c1, c2) => { b.box(-7, 10, -6, 14, 1, 12, c1); b.box(-4, 11, -3, 8, 6, 6, c1); b.box(-4, 12, -3, 8, 1, 6, c2 ?? c1); },
  bandana: (b, g, c1) => { b.box(-6, 9, -5, 12, 1, 10, c1); b.box(-6, 10, -5, 12, 1, 10, c1); b.box(-6, 8, -7, 3, 3, 2, c1); },
  chain: (b, g, c1) => { for (let i = 0; i < 6; i++) b.cell(-3 + i, 2 - (i === 2 || i === 3 ? 1 : 0) + (i === 0 || i === 5 ? 1 : 0), 5, c1); b.box(-1, 0, 5, 2, 2, 1, c1); },
  scarf: (b, g, c1, c2) => { b.box(-6, 0, -5, 12, 2, 10, c1); b.box(1, -3, 4, 3, 5, 1, c2 ?? c1); },
  tie: (b, g, c1) => { b.box(0, 0, 5, 1, 5, 1, c1).box(-1, 4, 5, 3, 1, 1, c1); },
  stars: (b, g, c1) => { b.box(-6, 5, 6, 5, 3, 1, c1).box(1, 5, 6, 5, 3, 1, c1); b.cell(-4, 8, 6, c1).cell(3, 8, 6, c1); },
  flower: (b, g, c1, c2) => { b.box(3, 9, 3, 2, 2, 1, c1).cell(3, 10, 3, c2 ?? WHITE).cell(4, 9, 3, c2 ?? WHITE); },
};

/* ------------------------------------------------------------------ player */
function createPlayer(key) {
  const ch = CHARS[key];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legH = 3 * U;
  body.position.y = legH;

  const tb = new Builder();
  tb.box(-6, 0, -5, 12, 10, 10, (x, y) => (y === 0 ? ch.dark : ch.body));
  tb.box(-3, 1, 4, 6, 2, 1, ch.belly);
  [[-5, 4], [4, 4], [-5, 3], [4, 3]].forEach(([x, y]) => tb.cell(x, y, 4, ch.belly));
  [[-3, 5], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 5]].forEach(([x, y]) => tb.cell(x, y - 1, 5, INK));
  const torso = wrap(tb, { seed: 11 });
  body.add(torso.group);

  const eb = new Builder();
  eb.box(-4, 5, 5, 2, 3, 1, INK).box(1, 5, 5, 2, 3, 1, INK).cell(-4, 7, 5, WHITE).cell(1, 7, 5, WHITE);
  const eyes = wrap(eb, { jitter: 0, hollow: false, castShadow: false });
  body.add(eyes.group);

  const ab = new Builder().box(-1, 10, -1, 2, 3, 2, INK).box(-1, 13, -1, 2, 2, 2, LIME);
  const antenna = wrap(ab, { emissive: 0.4, jitter: 0 });
  const antG = new THREE.Group(); antG.add(antenna.group); antG.position.y = 0; body.add(antG);

  // arms: two-segment with a mitt hand, pivot at the top of each segment
  const mkSeg = (withHand) => {
    const b = new Builder().box(0, -4, 0, 2, 5, 2, ch.dark);
    if (withHand) b.box(0, -6, 0, 2, 2, 2, ch.belly);
    return b.build({ anchor: 'none', pivot: [0.5, 0.5, 0.5], jitter: 0.03 });
  };
  const arms = {};
  for (const side of ['R', 'L']) {
    const upper = new THREE.Group(), fore = new THREE.Group();
    upper.add(mkSeg(false).group);
    fore.add(mkSeg(true).group);
    fore.position.y = -1.0;
    upper.add(fore);
    body.add(upper);
    const sx = side === 'R' ? -1 : 1;                      // character faces +z: its right is -x
    arms[side] = { upper, fore, sx, shoulder: new THREE.Vector3(sx * 7 * U, 8.5 * U, 0), l1: 1.0, l2: 1.2 };
    upper.position.copy(arms[side].shoulder);
  }
  // legs
  const legs = {};
  for (const [side, sx] of [['L', 3], ['R', -3]]) {
    const b = new Builder().box(0, -2, 0, 3, 3, 3, INK).box(0, -2, 3, 3, 1, 2, INK);
    const m = b.build({ anchor: 'none', pivot: [1, 0.5, 1], jitter: 0.02 });
    const g = new THREE.Group(); g.add(m.group); g.position.set(sx * U, 0, 0); body.add(g);
    legs[side] = g;
  }
  // head dressing mount
  const dress = new THREE.Group(); body.add(dress);
  const dressModels = [];
  const tag = voxelText(ch.name, { color: (i) => (i % 2 ? WHITE : ch.belly), depth: 1 }).build({ anchor: 'center', emissive: 0.5, castShadow: false, jitter: 0 });
  tag.group.scale.setScalar(0.26); tag.group.position.set(0, 3.75, 0.2);
  root.add(tag.group);

  const player = {
    key, root, body, torso, eyes, antG, arms, legs, dress, tag,
    legH,
    setCostume(items) {
      dressModels.forEach((m) => { dress.remove(m.group); m.dispose(); });
      dressModels.length = 0;
      for (const it of items || []) {
        const [name, c1, c2] = Array.isArray(it) ? it : [it];
        const fn = COSTUMES[name];
        if (!fn) continue;
        const main = new Builder(), glow = new Builder();
        fn(main, glow, c1 ?? INK, c2);
        if (main.map.size) { const m = wrap(main, { seed: 5 }); dress.add(m.group); dressModels.push(m); }
        if (glow.map.size) { const m = wrap(glow, { seed: 6, emissive: 1.5, castShadow: false, jitter: 0 }); dress.add(m.group); dressModels.push(m); }
      }
    },
    setBody(key2) { const c = CHARS[key2] || ch; torso.tint(c.body, 0); },
    /** body-local target -> pose the arm with 2-bone IK. pole = elbow bend direction (body-local) */
    reach(side, target, pole) {
      const A = arms[side];
      const S = A.shoulder;
      _a.copy(target).sub(S);
      let d = _a.length();
      const maxR = A.l1 + A.l2 - 0.002;
      if (d > maxR) { _a.multiplyScalar(maxR / d); d = maxR; }
      if (d < 0.25) { _a.multiplyScalar(0.25 / Math.max(d, 1e-4)); d = 0.25; }
      const dir = _b.copy(_a).divideScalar(d);
      const aa = (A.l1 * A.l1 - A.l2 * A.l2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, A.l1 * A.l1 - aa * aa));
      _c.copy(pole).addScaledVector(dir, -pole.dot(dir));
      if (_c.lengthSq() < 1e-6) _c.set(0, -1, 0);
      _c.normalize();
      const E = new THREE.Vector3().copy(S).addScaledVector(dir, aa).addScaledVector(_c, h);
      A.upper.quaternion.setFromUnitVectors(DOWN, _a.copy(E).sub(S).normalize());
      const fdir = _a.copy(S).addScaledVector(dir, d).sub(E).normalize();
      fdir.applyQuaternion(_q.copy(A.upper.quaternion).invert());
      A.fore.quaternion.setFromUnitVectors(DOWN, fdir);
    },
    /** same, with a target given in the player's ROOT frame (static world stuff like the drum kit) */
    reachRoot(side, target, pole) {
      body.updateMatrix();
      _m.copy(body.matrix).invert();
      const t = new THREE.Vector3().copy(target).applyMatrix4(_m);
      const p = new THREE.Vector3().copy(pole).transformDirection(_m);
      this.reach(side, t, p);
    },
    blink(t) { const bl = t % 3.4; const s = bl < 0.11 ? 0.12 : 1; eyes.group.scale.y = s; eyes.group.position.y = 6.5 * U * (1 - s); },
  };
  return player;
}

/* ------------------------------------------------------------------ hand path through timed targets */
function bsearch(times, t) { // last index with times[i] <= t, or -1
  let lo = 0, hi = times.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}
class HitTrack {
  constructor() { this.t = []; this.p = []; this.meta = []; }
  push(t, p, meta) { this.t.push(t); this.p.push(p); this.meta.push(meta); }
  /** position at time t between hits, lifting off after a hit and landing exactly on the next one */
  at(t, rest, hover, out, { approach = 0.3, rise = 0.06, lift = new THREE.Vector3(0, 1, 0) } = {}) {
    const i = bsearch(this.t, t), j = i + 1;
    const pi = i >= 0 ? this.p[i] : rest;
    const pj = j < this.t.length ? this.p[j] : (i >= 0 ? this.p[i] : rest);
    const dtIn = i >= 0 ? t - this.t[i] : 9, dtOut = j < this.t.length ? this.t[j] - t : 9;
    const gap = Math.min(approach, i >= 0 && j < this.t.length ? this.t[j] - this.t[i] : approach);
    const w = smoothstep(1 - dtOut / Math.max(gap, 0.05));
    out.copy(pi).lerp(pj, w);
    const up = hover * Math.min(1 - Math.exp(-dtIn / rise), Math.min(1, Math.pow(Math.min(dtOut, 9) / 0.16, 0.85)));
    out.addScaledVector(lift, up);
    return { i, dtIn, dtOut };
  }
}

/* ------------------------------------------------------------------ motion styles (body groove) */
function groove(style, f, I, out) {
  const b = f.beat, ph = f.beatPhase;
  const bb = Math.abs(Math.sin(Math.PI * b));          // 0 on the beat, 1 between
  const low = Math.pow(1 - bb, 2.2);
  const k = f.env('drums', 'k', 0.2);
  out.y = 0; out.rx = 0; out.ry = 0; out.rz = 0; out.sq = 0;
  switch (style) {
    case 'headbang': out.rx = 0.34 * I * low; out.y = -0.1 * I * low; out.rz = 0.05 * I * Math.sin(Math.PI * b / 2); break;
    case 'bounce': out.y = 0.16 * I * bb - 0.02; out.sq = 0.5 * I * low; out.rz = 0.04 * Math.sin(Math.PI * b); break;
    case 'sway': out.rz = 0.13 * I * Math.sin(Math.PI * b / 2); out.ry = 0.16 * I * Math.sin(Math.PI * b / 4); out.y = 0.03 * I * bb; break;
    case 'hop': { const u = ph; out.y = 0.5 * I * (4 * u * (1 - u)); out.sq = 0.9 * I * Math.pow(1 - u, 6) - 0.3 * 4 * u * (1 - u) * I; out.rz = 0.05 * Math.sin(Math.PI * b); break; }
    case 'groove': out.ry = 0.22 * I * Math.sin(Math.PI * b); out.rz = 0.09 * I * Math.sin(Math.PI * b / 2); out.y = 0.07 * I * Math.abs(Math.sin(2 * Math.PI * b)); out.rx = 0.05 * I * Math.sin(2 * Math.PI * b); break;
    case 'nod': out.rx = 0.2 * I * k; out.y = -0.06 * I * k; out.rz = 0.03 * Math.sin(Math.PI * b / 2); break;
    case 'pound': out.y = 0.06 * I * bb; out.rx = 0.14 * I * low; break;
    default: out.y = 0.03 * bb;
  }
}

/* ------------------------------------------------------------------ the band */
export function createBand() {
  const group = new THREE.Group();
  const players = {};
  for (const k of ['guitar', 'bass', 'drums']) { players[k] = createPlayer(k); group.add(players[k].root); }
  const state = {
    cfg: null, tl: null,
    inst: { guitar: null, bass: null, drums: null },
    mounts: { guitar: new THREE.Group(), bass: new THREE.Group() },
    hits: {},
    layout: { spread: 3.5, drumsZ: -2.6 },
    pop: 1,
  };
  players.guitar.body.add(state.mounts.guitar);
  players.bass.body.add(state.mounts.bass);
  const rest = {
    R: new THREE.Vector3(-1.5, 1.1, 0.9), L: new THREE.Vector3(1.5, 1.1, 0.9),
  };
  const poleR = new THREE.Vector3(-0.7, -1, -0.4), poleL = new THREE.Vector3(0.7, -1, -0.4);
  const out = {}, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const mo = { y: 0, rx: 0, ry: 0, rz: 0, sq: 0 };

  function disposeInst(k) {
    const it = state.inst[k];
    if (!it) return;
    it.group.parent && it.group.parent.remove(it.group);
    it.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    state.inst[k] = null;
  }

  function placeRoles() {
    const s = state.layout.spread;
    players.guitar.root.position.set(-s, 0, 0.7); players.guitar.root.rotation.y = 0.28;
    players.bass.root.position.set(s, 0, 0.7); players.bass.root.rotation.y = -0.28;
    players.drums.root.position.set(0, 0, state.layout.drumsZ); players.drums.root.rotation.y = 0;
  }

  function mountHeld(role, inst, kind) {
    const m = state.mounts[role];
    m.clear();
    m.add(inst.group);
    m.scale.setScalar(0.82);
    if (kind === 'keytar') { m.position.set(0.1, 0.55, 1.25); m.rotation.set(0, 0, 0.1); }
    else if (kind === 'oud') { m.position.set(-0.1, 0.4, 1.2); m.rotation.set(0, 0, 0.34); }
    else if (role === 'bass') { m.position.set(-0.1, 0.32, 1.2); m.rotation.set(0, 0, 0.3); }
    else { m.position.set(-0.15, 0.36, 1.15); m.rotation.set(0, 0, 0.36); }
    m.updateMatrix();
  }

  function configure(cfg) {
    state.cfg = cfg;
    state.layout = { spread: 3.5, drumsZ: -2.6, ...(cfg.layout || {}) };
    placeRoles();
    const col = cfg.colors || {};
    // guitar role
    disposeInst('guitar');
    const gk = cfg.guitar || 'electric';
    const gi = makeStringed(gk, { body: col.guitar ?? 0xd33a2c, accent: col.accent ?? 0xffe9a8, glow: col.glow });
    state.inst.guitar = gi; mountHeld('guitar', gi, gk);
    // bass role
    disposeInst('bass');
    const bk = cfg.bass || 'bass';
    const bi = makeStringed(bk === 'keytar' ? 'keytar' : 'bass', { body: col.bass ?? 0x2a5fd0, accent: col.accent ?? 0xffe9a8, glow: col.glow });
    state.inst.bass = bi; mountHeld('bass', bi, bk === 'keytar' ? 'keytar' : 'bass');
    // drums role
    disposeInst('drums');
    const dk = cfg.drums || 'kit';
    let di;
    if (dk === 'kit') di = makeKit({ shell: col.kit ?? 0x2b6cb0, ring: col.accent });
    else if (dk === 'darbuka') di = makeDarbuka({ body: col.kit });
    else if (dk === 'pads') di = makePads({ pad: col.glow ?? col.accent });
    else di = makeDecks({ accent: col.glow ?? col.accent });
    state.inst.drums = di;
    const dm = players.drums;
    if (dk === 'darbuka') {
      state.mounts.drumsHeld = state.mounts.drumsHeld || new THREE.Group();
      dm.body.add(state.mounts.drumsHeld); state.mounts.drumsHeld.clear(); state.mounts.drumsHeld.add(di.group);
      state.mounts.drumsHeld.position.set(0.1, 0.55, 1.15); state.mounts.drumsHeld.rotation.set(-0.5, 0, 0); state.mounts.drumsHeld.updateMatrix();
    } else {
      if (state.mounts.drumsHeld && state.mounts.drumsHeld.parent) state.mounts.drumsHeld.parent.remove(state.mounts.drumsHeld);
      dm.root.add(di.group);
      if (dk === 'pads' || dk === 'decks') { di.group.position.set(0, 1.35, 1.35); }
      if (dk === 'pads') di.group.rotation.x = -0.2;
    }
    // costumes
    const cs = cfg.costumes || {};
    for (const k of ['guitar', 'bass', 'drums']) players[k].setCostume(cs[k] || []);
    state.moves = { guitar: 'headbang', bass: 'bounce', drums: 'pound', intensity: 1, ...(cfg.moves || {}) };
    if (state.tl) setTimeline(state.tl);
  }

  /* ---- timeline -> hit tracks */
  function setTimeline(tl) {
    state.tl = tl;
    const cfg = state.cfg || {};
    const ev = tl.events || {};
    // GUITAR
    const gi = state.inst.guitar;
    const gh = { strum: new HitTrack(), fret: new HitTrack() };
    if (gi) {
      const keys = gi.kind === 'keytar';
      (ev.guitar || []).forEach(([t, root, dur, vel, dir], n) => {
        const d = dir || (n % 2 ? -1 : 1);
        const p = keys ? gi.strumPoint(0).clone().add(tmp2.set((((root % 12) / 11) - 0.5) * 2.4, 0, 0)) : gi.strumPoint(d > 0 ? 1 : -1).clone();
        gh.strum.push(t, p, { dir: d, vel });
        const u = clamp(((root - 36) % 12) / 11, 0.05, 0.95);
        gh.fret.push(t, gi.neck(u).clone(), { u });
      });
    }
    // BASS
    const bi = state.inst.bass;
    const bh = { pluck: new HitTrack(), fret: new HitTrack() };
    if (bi) {
      const keys = bi.kind === 'keytar';
      (ev.bass || []).forEach(([t, midi, dur, vel], n) => {
        const u = clamp((midi - 28) / 16, 0.05, 0.95);
        const p = keys ? bi.strumPoint(0).clone().add(tmp2.set((u - 0.5) * 2.6, 0, 0)) : bi.strumPoint(n % 2 ? 0.8 : -0.1).clone().add(tmp2.set(n % 2 ? 0.35 : 0, 0, 0));
        bh.pluck.push(t, p, { vel });
        bh.fret.push(t, bi.neck(u).clone(), { u });
      });
    }
    // DRUMS
    const di = state.inst.drums;
    const dh = { R: new HitTrack(), L: new HitTrack(), kick: [], all: [] };
    if (di) {
      let flip = 0;
      (ev.drums || []).forEach(([t, code, vel]) => {
        dh.all.push(t);
        if (code === 'k' && di.kind !== 'darbuka') { dh.kick.push(t); if (di.kind === 'kit') return; }
        let hand = 'R', target;
        if (di.kind === 'kit') {
          const pc = di.pieces[code] || di.pieces.s;
          target = pc.target;
          if (code === 's' || code === 'cl') hand = 'L';
          else if (code === 't2' || code === 't3') hand = (flip++ & 1) ? 'L' : 'R';
          else if (code === 'o' || code === 'h') hand = 'R';
          else if (code === 'c') hand = 'R';
          else hand = (flip++ & 1) ? 'L' : 'R';
          if (code === 'h' || code === 'o') {
            // quick closed-hat 8ths alternate with snare on the left; keep right hand on the hat unless snare is free
          }
        } else if (di.kind === 'darbuka') {
          if (code === 'k') { hand = 'R'; target = di.center; }
          else if (code === 's') { hand = 'L'; target = di.edgeL; }
          else { hand = (flip++ & 1) ? 'L' : 'R'; target = hand === 'R' ? di.edge : di.edgeL; }
        } else if (di.kind === 'pads') {
          const idx = ({ k: 0, s: 5, h: 2, o: 3, c: 7, cl: 6, p: 9, t1: 10, t2: 11, t3: 12 })[code] ?? 8;
          hand = idx % 4 < 2 ? 'R' : 'L';
          if (idx === 0) hand = 'L'; if (idx === 5) hand = 'R';
          di.group.updateMatrix();
          target = di.targets[idx].clone().applyMatrix4(di.group.matrix);
          (dh.padHits ||= []).push([t, idx]);
        } else { // decks
          if (code === 'h' || code === 'o') { hand = (flip++ & 1) ? 'L' : 'R'; target = (hand === 'L' ? di.left : di.right).clone().add(tmp2.set(0, 0, (flip & 2) ? 0.25 : -0.2)); }
          else { hand = code === 'k' ? 'L' : 'R'; target = di.mixerPt; }
          di.group.updateMatrix(); target = target.clone().applyMatrix4(di.group.matrix);
        }
        (hand === 'R' ? dh.R : dh.L).push(t, target.clone(), { code, vel });
      });
    }
    state.hits = { gh, bh, dh };
  }

  /* ---- per-frame animation */
  function update(f) {
    const cfg = state.cfg; if (!cfg) return;
    const I = (state.moves.intensity || 1) * (0.4 + 0.6 * f.energy);
    const { gh, bh, dh } = state.hits;
    const t = f.t;
    const pop = state.pop;
    for (const k of ['guitar', 'bass', 'drums']) {
      const p = players[k];
      groove(state.moves[k], f, I, mo);
      const sit = k === 'drums' && (state.inst.drums?.kind === 'kit');
      const baseY = p.legH + (sit ? -0.25 : 0);
      p.body.position.y = baseY + mo.y;
      p.body.rotation.set(mo.rx, mo.ry, mo.rz);
      p.body.scale.set(1 + mo.sq * 0.1, 1 - mo.sq * 0.12, 1 + mo.sq * 0.1);
      p.body.updateMatrix();
      const lg = sit ? -1.35 : 0;
      p.legs.L.rotation.x = lg; p.legs.R.rotation.x = lg;
      p.legs.L.position.set(3 * U, 0, 0); p.legs.R.position.set(-3 * U, 0, 0);
      p.antG.position.y = 0; p.antG.rotation.z = Math.sin(t * 3.1) * 0.12 + mo.rz; p.antG.rotation.x = Math.sin(t * 2.3) * 0.08;
      p.blink(t);
      const s = Math.max(1e-3, easeOutBack(clamp(pop), 1.6));
      p.root.scale.setScalar(s);
      p.tag.group.position.y = 3.7 + 0.04 * Math.sin(t * 2 + k.length);
    }

    /* guitarist */
    {
      const p = players.guitar, gi = state.inst.guitar;
      const m = state.mounts.guitar;
      m.updateMatrix();
      if (gi) {
        gh.strum.at(t, gi.strumPoint(0), 0.16, out.a ||= new THREE.Vector3(), { approach: 0.12, rise: 0.04, lift: new THREE.Vector3(0, 0, 1) });
        const strumLocal = out.a.clone();
        gh.fret.at(t, gi.neck(0.3), 0.0, out.b ||= new THREE.Vector3(), { approach: 0.22 });
        const fretLocal = out.b.clone();
        const R = strumLocal.applyMatrix4(m.matrix), L = fretLocal.applyMatrix4(m.matrix);
        if (gi.kind === 'keytar') { p.reach('R', R, poleR); p.reach('L', L, poleL); }
        else { p.reach('R', R, poleR); p.reach('L', L, poleL); }
      } else { p.reach('R', rest.R, poleR); p.reach('L', rest.L, poleL); }
    }
    /* bassist */
    {
      const p = players.bass, bi = state.inst.bass;
      const m = state.mounts.bass; m.updateMatrix();
      if (bi) {
        bh.pluck.at(t, bi.strumPoint(0), 0.1, out.c ||= new THREE.Vector3(), { approach: 0.14, rise: 0.05, lift: new THREE.Vector3(0, 0, 1) });
        const pl = out.c.clone();
        bh.fret.at(t, bi.neck(0.3), 0.0, out.d ||= new THREE.Vector3(), { approach: 0.2 });
        const fl = out.d.clone();
        p.reach('R', pl.applyMatrix4(m.matrix), poleR); p.reach('L', fl.applyMatrix4(m.matrix), poleL);
      } else { p.reach('R', rest.R, poleR); p.reach('L', rest.L, poleL); }
    }
    /* drummer */
    {
      const p = players.drums, di = state.inst.drums;
      if (di) {
        const kind = di.kind;
        const hov = kind === 'kit' ? 0.5 : 0.28;
        const restR = kind === 'darbuka' ? tmp.set(-0.4, 0.9, 1.3) : tmp.set(-0.9, 2.1, 1.7);
        const rR = restR.clone();
        const rL = kind === 'darbuka' ? new THREE.Vector3(0.4, 0.9, 1.3) : new THREE.Vector3(0.9, 2.1, 1.7);
        const lift = kind === 'darbuka' ? new THREE.Vector3(0, 0.6, 0.8).normalize() : new THREE.Vector3(0, 1, 0);
        dh.R.at(t, rR, hov, out.e ||= new THREE.Vector3(), { approach: 0.22, lift });
        dh.L.at(t, rL, hov, out.f ||= new THREE.Vector3(), { approach: 0.22, lift });
        const tR = out.e.clone(), tL = out.f.clone();
        if (kind === 'darbuka') { // body-local (mount is on the body)
          const mm = state.mounts.drumsHeld; mm.updateMatrix();
          // targets were stored in di-local coords -> bring to body-local
          tR.applyMatrix4(mm.matrix); tL.applyMatrix4(mm.matrix);
          p.reach('R', tR, poleR); p.reach('L', tL, poleL);
        } else {
          p.reachRoot('R', tR, poleR); p.reachRoot('L', tL, poleL);
        }
        animateDrum(di, f, dh, t);
      }
    }
    // kit/pads/decks reacts
    state.lastF = f;
  }

  function animateDrum(di, f, dh, t) {
    if (di.kind === 'kit') {
      const P = di.pieces;
      const ek = f.env('drums', 'k', 0.14);
      P.k.group.scale.set(1 + 0.05 * ek, 1 + 0.05 * ek, 1 - 0.08 * ek);
      for (const c of ['s', 't1', 't2', 't3']) {
        const e = f.env('drums', c === 's' ? ['s', 'cl'] : c, 0.1);
        P[c].group.position.y = P[c].baseY - 0.05 * e;
      }
      for (const c of ['c', 'p']) {
        const dt = f.since('drums', c);
        const e = Math.exp(-dt / 0.6);
        P[c].group.rotation.x = P[c].baseRx + 0.22 * e * Math.sin(dt * 26);
        P[c].group.rotation.z = P[c].baseRz + 0.12 * e * Math.cos(dt * 21);
      }
      const dto = f.since('drums', ['o', 'h']);
      const eo = Math.exp(-dto / 0.12);
      P.o.group.position.y = 1.65 - 0.03 * eo; P.o.group.rotation.z = 0.1 * eo * Math.sin(dto * 40);
    } else if (di.kind === 'darbuka') {
      const e = f.env('drums', ['k', 's', 'h', 'p'], 0.1);
      di.group.scale.setScalar(1 + 0.03 * e);
    } else if (di.kind === 'pads') {
      const m = di.padModel;
      const hits = dh.padHits || [];
      const base = new THREE.Color(di.base);
      const col = new THREE.Color();
      const env = new Float32Array(16);
      // envelope per pad from the recent hits
      const ti = bsearch(hits.map((h) => h[0]), t);
      for (let j = Math.max(0, ti - 14); j <= ti; j++) { const dt = t - hits[j][0]; env[hits[j][1]] = Math.max(env[hits[j][1]], Math.exp(-dt / 0.18)); }
      for (let i = 0; i < m.count; i++) {
        const e = env[di.padIndex[i]];
        col.copy(base).multiplyScalar(0.18 + 1.3 * e);
        m.setRGB(i, col.r, col.g, col.b);
      }
      m.commitColor();
    } else if (di.kind === 'decks') {
      const sc = f.since('drums', ['h', 'o']);
      const scratch = Math.exp(-sc / 0.2) * Math.sin(sc * 38) * 0.9;
      di.platters[0].rotation.y = t * 3.2 + scratch;
      di.platters[1].rotation.y = -t * 3.2 - scratch;
    }
  }

  return {
    group, players, configure, setTimeline, update, state,
    /** 0..1 spawn-in animation for a vibe change */
    setPop(p) { state.pop = p; },
    get cfg() { return state.cfg; },
  };
}
