// Voxel instruments for the band. All coordinates are in world units (cell * U) in the instrument's own frame.
// Held instruments (guitar/bass/oud/keytar): neck along +x, face toward +z, origin = body centre.
import { THREE, Builder, U, shade, mixHex } from './voxel.js';

const V3 = (x, y, z) => new THREE.Vector3(x * U, y * U, z * U);
const wood = 0xc58a52, darkWood = 0x4a2e1c, chrome = 0xd7dbe2, black = 0x1d1d22, cream = 0xf3e6c8;

function wrap(builder, opts = {}) {
  const m = builder.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.03, ...opts });
  return m;
}

/* ------------------------------------------------------------------ guitar family */
export function makeStringed(kind, colors = {}) {
  const body = colors.body ?? 0xd33a2c, accent = colors.accent ?? 0xffe9a8;
  const b = new Builder();
  const glow = new Builder();
  let neckLen = 10, neckX0 = 2, headEnd = 15;
  let strum = V3(-1, -0.5, 3.2);
  if (kind === 'electric' || kind === 'bass') {
    const bass = kind === 'bass';
    neckLen = bass ? 13 : 10;
    b.disc(-1, -1.5, 0, bass ? 3.3 : 3.6, 2, body).disc(0.6, 1.3, 0, bass ? 2.4 : 2.7, 2, body);
    b.disc(1.9, bass ? 2.8 : 3.0, 0, 1.1, 2, body);                               // upper horn
    b.disc(-1, -1, 2, 2.4, 1, shade(body, 0.45));                                  // pickguard
    const pu = bass ? [1, -1.5] : [0, -2.5];
    b.box(pu[0], -2, 3, 1, 4, 1, black).box(pu[1], -2, 3, 1, 4, 1, black);        // pickups
    b.box(-4, -2, 3, 1, 4, 1, chrome);                                              // bridge
    b.cell(-2, -4, 3, chrome).cell(-3, -4, 3, chrome);                              // knobs
    b.box(neckX0, -1, 0, neckLen, 2, 2, wood);                                      // neck
    b.box(neckX0, -1, 2, neckLen, 2, 1, darkWood);                                  // fretboard
    for (let i = 1; i < neckLen; i += 2) b.cell(neckX0 + i, -1, 3, cream).cell(neckX0 + i, 0, 3, cream);
    headEnd = neckX0 + neckLen;
    b.box(headEnd, -1, 0, 3, 3, 2, shade(body, 0.8));                               // headstock
    for (let i = 0; i < (bass ? 2 : 3); i++) { b.cell(headEnd + i, 2, 1, chrome); b.cell(headEnd + i, -2, 1, chrome); }
    if (colors.glow) glow.box(neckX0 + 1, -1, 3, neckLen - 2, 1, 1, colors.glow);   // neon fret line
    strum = V3(-1.5, -0.5, 3.6);
  } else if (kind === 'acoustic') {
    b.disc(-1.2, -1.2, 0, 3.9, 3, body).disc(0.8, 1.0, 0, 3.0, 3, body);
    b.disc(0.2, -0.3, 3, 1.5, 1, black);                                            // sound hole
    b.disc(0.2, -0.3, 3, 2.2, 1, (x, y) => ((x - 0.2) ** 2 + (y + 0.3) ** 2 > 3.2 ? shade(body, 0.7) : black));
    b.box(-4, -2, 3, 1, 4, 1, darkWood);                                            // bridge
    b.box(neckX0 + 1, -1, 0, 10, 2, 2, wood).box(neckX0 + 1, -1, 2, 10, 2, 1, darkWood);
    for (let i = 1; i < 10; i += 2) b.cell(neckX0 + 1 + i, -1, 3, cream);
    headEnd = neckX0 + 11;
    b.box(headEnd, -1, 0, 3, 3, 2, darkWood);
    b.cell(headEnd, 2, 1, accent).cell(headEnd + 1, 2, 1, accent).cell(headEnd + 2, 2, 1, accent);
    neckX0 = 3; neckLen = 10;
    strum = V3(-0.2, -0.5, 4.2);
  } else if (kind === 'oud') {
    // deep pear-shaped bowl: stacked shrinking discs
    for (let k = 0; k < 6; k++) b.disc(-1.2 + k * 0.1, -0.6, -k, 4.0 - k * 0.45, 1, (x, y, z) => (k === 0 ? shade(body, 1.05) : body));
    b.disc(-1.4, -0.6, 1, 4.1, 1, shade(body, 1.1));
    b.disc(-0.8, -0.6, 2, 1.9, 1, black);                                           // sound rose
    b.disc(-0.8, -0.6, 2, 2.6, 1, (x, y) => ((x + 0.8) ** 2 + (y + 0.6) ** 2 > 3.4 ? accent : black));
    b.box(-4, -2, 2, 1, 4, 1, darkWood);
    b.box(2, -1, 0, 6, 3, 2, wood).box(2, -1, 2, 6, 3, 1, darkWood);               // short fretless neck
    headEnd = 8;
    b.box(headEnd, -1, -1, 3, 3, 2, darkWood);                                      // pegbox, bends back
    b.box(headEnd + 2, -1, -5, 3, 3, 5, darkWood);
    for (let i = 0; i < 3; i++) { b.cell(headEnd + 1, 2, -1 - i, accent); b.cell(headEnd + 1, -2, -1 - i, accent); }
    neckX0 = 2; neckLen = 7;
    strum = V3(-1, -0.6, 3.6);
  } else if (kind === 'keytar') {
    b.box(-9, -2, 0, 17, 5, 3, black);                                              // body
    for (let i = 0; i < 16; i++) b.box(-8 + i, -1, 3, 1, 3, 1, i % 2 ? cream : 0xffffff);
    for (const i of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14]) b.cell(-8 + i, 1, 4, black);
    glow.box(-9, 3, 1, 17, 1, 1, colors.glow ?? accent).box(-9, -3, 1, 17, 1, 1, colors.glow ?? accent);
    b.box(8, -1, 0, 6, 3, 2, shade(body, 0.7));                                     // neck stub
    b.box(14, -1, 0, 2, 4, 2, body);
    neckX0 = 3; neckLen = 10; headEnd = 12;
    strum = V3(-4, 0, 4.4);
  }
  const model = wrap(b);
  const g = new THREE.Group();
  g.add(model.group);
  let glowModel = null;
  if (glow.map.size) { glowModel = wrap(glow, { emissive: 1.6, castShadow: false }); g.add(glowModel.group); }
  const nx0 = neckX0, nlen = neckLen;
  const fretZ = kind === 'oud' ? 3.7 : kind === 'keytar' ? 4.8 : 3.9;
  return {
    kind, group: g, model, glowModel,
    /** fret-hand point at u 0..1 along the neck (body-local to the instrument group) */
    neck(u) { return V3(nx0 + 1 + u * (nlen - 2), kind === 'keytar' ? 0.5 : -0.3, fretZ); },
    strumPoint(v) { const p = strum.clone(); p.y += v * (kind === 'keytar' ? 0.35 : 0.8); return p; },
    kindOfHold: kind === 'keytar' ? 'keys' : 'string',
  };
}

/* ------------------------------------------------------------------ drum pieces */
function drumPiece(parts) { const g = new THREE.Group(); parts.forEach((p) => g.add(p)); return g; }

function cyl(r, h, color, opts = {}) {
  const b = new Builder();
  b.flatDisc(0, 0, 0, r, h, color);
  return wrap(b, opts);
}

/** full rock kit. Returns pieces keyed by code with .target (root-local, where a stick lands) and hit(env) animators */
export function makeKit(colors = {}) {
  const shell = colors.shell ?? 0x2b6cb0, ring = colors.ring ?? 0xffffff, brass = 0xe4b84a;
  const g = new THREE.Group();
  const pieces = {};

  // kick: disc in XY facing +z
  {
    const b = new Builder();
    b.disc(0, 0, 0, 4, 4, (x, y, z) => (z === 3 ? ((x * x + y * y) < 6 ? shade(shell, 1.35) : ring) : shell));
    b.disc(0, 0, 4, 1.2, 1, ring);
    const m = wrap(b);
    const holder = new THREE.Group(); holder.add(m.group);
    holder.position.set(0, 0.8, 2.4);
    g.add(holder);
    pieces.k = { group: holder, kind: 'kick', target: new THREE.Vector3(0, 1.0, 3.0) };
  }
  const drum = (code, x, y, z, r, h, tilt = 0.12) => {
    const m = cyl(r, h, (px, py) => (py === h - 1 ? 0xf5f1e6 : shell));
    const holder = new THREE.Group(); holder.add(m.group);
    holder.position.set(x, y, z); holder.rotation.x = tilt;
    g.add(holder);
    pieces[code] = { group: holder, kind: 'drum', target: new THREE.Vector3(x, y + h * U + 0.17, z + 0.04), baseY: y };
    return holder;
  };
  drum('s', 0.6, 1.2, 1.6, 3.0, 3, 0.05);
  drum('t1', 0.95, 1.65, 2.3, 2.4, 3, 0.35);
  drum('t2', -0.95, 1.65, 2.3, 2.6, 3, 0.35);
  drum('t3', -1.75, 1.0, 1.8, 3.2, 4, 0.08);
  for (const [x, y, z] of [[0.6, 0.7, 1.6], [-1.75, 0.4, 1.8]]) {
    const b = new Builder().box(0, 0, 0, 1, Math.round(y / U), 1, black);
    const m = wrap(b); m.group.position.set(x, 0, z); g.add(m.group);
  }
  const cym = (code, x, y, z, r, tiltX, tiltZ = 0) => {
    const pole = wrap(new Builder().box(0, 0, 0, 1, Math.round(y / U), 1, chrome)); pole.group.position.set(x, 0, z); g.add(pole.group);
    const m = cyl(r, 1, (px, py) => brass);
    const holder = new THREE.Group(); holder.add(m.group);
    holder.position.set(x, y, z); holder.rotation.x = tiltX; holder.rotation.z = tiltZ;
    g.add(holder);
    pieces[code] = { group: holder, kind: 'cymbal', baseRx: tiltX, baseRz: tiltZ, target: new THREE.Vector3(x, y + 0.2, z) };
    return holder;
  };
  cym('o', 1.75, 1.65, 1.3, 3.3, 0, 0);                 // hi-hat top cymbal (also used for 'h')
  pieces.h = pieces.o;
  cym('c', 1.5, 2.9, 2.6, 4.0, 0.18, -0.15);           // crash
  cym('p', -2.2, 2.4, 2.7, 4.2, 0.12, 0.2);            // ride
  // stool
  const stool = wrap(new Builder().box(-3, 0, -3, 6, 2, 6, black).box(-1, -3, -1, 2, 3, 2, chrome), { anchor: 'none', pivot: [0, 0, 0] });
  stool.group.position.set(0, 0.8, -0.4); g.add(stool.group);
  pieces.cl = pieces.s;
  return { group: g, pieces, kind: 'kit' };
}

/** darbuka / doumbek held on the lap. targets in body-local */
export function makeDarbuka(colors = {}) {
  const body = colors.body ?? 0xb9772e, rim = colors.rim ?? 0xe8d9a8, metal = 0xd2a64a;
  const b = new Builder();
  const prof = [3.2, 3.0, 2.6, 2.1, 1.7, 1.5, 1.5, 1.8, 2.3, 3.2, 3.6]; // goblet from top (head) down
  prof.forEach((r, i) => b.flatDisc(0, 0, -i, r, 1, i === 0 ? 0xf5ecd2 : (i % 3 === 0 ? metal : (i > 6 ? shade(body, 0.85) : body))));
  b.flatDisc(0, 0, 1, 3.6, 1, rim);
  const m = wrap(b);
  const g = new THREE.Group(); g.add(m.group);
  return {
    kind: 'darbuka', group: g, model: m,
    center: V3(0, 2.4, 0), edge: V3(-3.4, 2.4, 1.5), edgeL: V3(3.4, 2.4, 1.5),
  };
}

/** sample pad grid on a slanted table (MPC / launchpad) */
export function makePads(colors = {}) {
  const pad = colors.pad ?? 0xff4fa3;
  const g = new THREE.Group();
  const table = wrap(new Builder().box(-9, 0, -5, 18, 2, 10, 0x25252c).box(-8, -9, -1, 1, 9, 1, black).box(7, -9, -1, 1, 9, 1, black));
  g.add(table.group);
  const padB = new Builder();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) padB.box(-7 + c * 4, 2, -4 + r * 2 + (r > 1 ? 0 : 0), 3, 1, 2, 0xffffff);
  const padModel = wrap(padB, { emissive: 1.0, castShadow: false, jitter: 0 });
  g.add(padModel.group);
  const targets = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) targets.push(V3(-6 + c * 4, 3.4, -3 + r * 2));
  // map cell -> pad index
  const idx = new Array(padModel.count);
  padModel.cells.forEach(([x, , z], i) => { const c = Math.floor((x + 7) / 4), r = Math.floor((z + 4) / 2); idx[i] = clampi(r, 0, 3) * 4 + clampi(c, 0, 3); });
  return { kind: 'pads', group: g, padModel, padIndex: idx, targets, base: pad };
}
const clampi = (v, a, b) => Math.max(a, Math.min(b, v));

/** two turntables + mixer */
export function makeDecks(colors = {}) {
  const accent = colors.accent ?? 0x06b6d4;
  const g = new THREE.Group();
  g.add(wrap(new Builder().box(-13, 0, -5, 26, 2, 10, 0x20202a).box(-12, -9, -3, 2, 9, 2, black).box(10, -9, -3, 2, 9, 2, black)).group);
  const platters = [];
  for (const sx of [-7, 7]) {
    const b = new Builder();
    b.flatDisc(0, 0, 0, 4.3, 1, (x, y, z) => ((x === 0 && z > 0 && z < 4) || (z === 0 && x > 0 && x < 4) ? 0xffffff : 0x141418));
    b.flatDisc(0, 0, 1, 1.2, 1, accent);
    const m = wrap(b, { emissive: 0.25 });
    const holder = new THREE.Group(); holder.add(m.group); holder.position.set(sx * U, 2.5 * U, 0); g.add(holder);
    platters.push(holder);
  }
  const mixer = new Builder().box(-2, 0, -3, 5, 1, 7, 0x2e2e38);
  for (let i = 0; i < 3; i++) mixer.box(-1 + i * 1, 1, -2, 1, 1, 3, accent);
  const mm = wrap(mixer, { emissive: 0.6, castShadow: false }); mm.group.position.set(0, 2.5 * U, 0); g.add(mm.group);
  return { kind: 'decks', group: g, platters, left: V3(-7, 3.6, 0), right: V3(7, 3.6, 0), mixerPt: V3(0, 3.6, 0) };
}
