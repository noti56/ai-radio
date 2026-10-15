// Voxel engine for the radio stage. Adapted from the "video gen therejs" voxel reel core:
// EVERYTHING visible is built from rounded cubes (InstancedMesh). Deterministic: no Math.random / Date.now.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ determinism + easing */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** stable 0..1 hash of an integer (use for per-instance phases inside update) */
export const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (t, a, b) => clamp((t - a) / (b - a));
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => { t = clamp(t); return t * t * t; };
export const easeOutQuart = (t) => 1 - Math.pow(1 - clamp(t), 4);
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const easeInBack = (t, s = 1.70158) => { t = clamp(t); return (s + 1) * t * t * t - s * t * t; };
export const easeOutElastic = (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
/** triangle wave 0..1..0 with period 1 */
export const tri = (x) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1);

/* ------------------------------------------------------------------ colours (hex numbers in, hex numbers out) */
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export const mixHex = (a, b, t) => _c1.setHex(a).lerp(_c2.setHex(b), t).getHex();
export const shade = (hex, k) => _c1.setHex(hex).multiplyScalar(k).getHex();

/* ------------------------------------------------------------------ the shape primitive */
export const U = 0.2;
let _geo;
export function voxelGeometry() {
  if (!_geo) _geo = new RoundedBoxGeometry(U, U, U, 2, U * 0.09);
  return _geo;
}
const _mats = {};
export function voxelMaterial(emissive = 0) {
  const k = emissive.toFixed(2);
  if (_mats[k]) return _mats[k];
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uEmissive = { value: emissive };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uEmissive;')
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * uEmissive;\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'vox-' + k;
  return (_mats[k] = mat);
}

/* ------------------------------------------------------------------ Builder */
const key = (x, y, z) => x + ',' + y + ',' + z;
export class Builder {
  constructor() { this.map = new Map(); }
  cell(x, y, z, c) { this.map.set(key(x, y, z), [x, y, z, c]); return this; }
  box(x, y, z, w, h, d, c) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) this.cell(x + i, y + j, z + k, typeof c === 'function' ? c(x + i, y + j, z + k) : c);
    return this;
  }
  /** filled disc in the XY plane (centre cx,cy radius r), thickness d cells starting at z */
  disc(cx, cy, z, r, d, c) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.25) for (let k = 0; k < d; k++) this.cell(x, y, z + k, typeof c === 'function' ? c(x, y, z + k) : c);
    }
    return this;
  }
  /** filled disc in the XZ plane (floor-aligned), thickness h cells starting at y */
  flatDisc(cx, cz, y, r, h, c) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.25) for (let k = 0; k < h; k++) this.cell(x, y + k, z, typeof c === 'function' ? c(x, y + k, z) : c);
    }
    return this;
  }
  /** voxel "sphere" (it is still cubes) */
  ball(cx, cy, cz, r, c) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r + 0.25) this.cell(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
    return this;
  }
  /** straight line of cells (Bresenham-ish), thickness t cells */
  line(x0, y0, z0, x1, y1, z1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n);
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.cell(x + a, y + b, z, c);
    }
    return this;
  }
  has(x, y, z) { return this.map.has(key(x, y, z)); }
  merge(o, ox = 0, oy = 0, oz = 0) { o.map.forEach(([x, y, z, c]) => this.cell(x + ox, y + oy, z + oz, c)); return this; }
  bounds() {
    let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
    this.map.forEach(([x, y, z]) => { a = [Math.min(a[0], x), Math.min(a[1], y), Math.min(a[2], z)]; b = [Math.max(b[0], x), Math.max(b[1], y), Math.max(b[2], z)]; });
    return { min: a, max: b };
  }
  /** opts: anchor 'base'|'center'|'none', pivot [x,y,z] (cell units), hollow, jitter, seed, emissive, castShadow, receiveShadow */
  build(opts = {}) { return voxelModel(this, opts); }
}

export function voxelModel(builder, { anchor = 'base', pivot, hollow = true, jitter = 0.035, seed = 7, emissive = 0, castShadow = true, receiveShadow = true } = {}) {
  const r = rng(seed);
  const cells = [];
  builder.map.forEach((c) => {
    const [x, y, z] = c;
    if (hollow && builder.has(x + 1, y, z) && builder.has(x - 1, y, z) && builder.has(x, y + 1, z) && builder.has(x, y - 1, z) && builder.has(x, y, z + 1) && builder.has(x, y, z - 1)) return;
    cells.push(c);
  });
  const { min, max } = builder.map.size ? builder.bounds() : { min: [0, 0, 0], max: [0, 0, 0] };
  let pv = pivot;
  if (!pv) {
    if (anchor === 'base') pv = [(min[0] + max[0]) / 2, min[1] - 0.5, (min[2] + max[2]) / 2];
    else if (anchor === 'center') pv = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    else pv = [0, 0, 0];
  }
  const count = cells.length;
  const mesh = new THREE.InstancedMesh(voxelGeometry(), voxelMaterial(emissive), Math.max(1, count));
  mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const home = new Float32Array(count * 3);
  const rand = new Float32Array(count * 4);
  const base = new Float32Array(count * 3);
  const col = new THREE.Color();
  cells.forEach(([x, y, z, c], i) => {
    home[i * 3] = (x - pv[0]) * U; home[i * 3 + 1] = (y - pv[1]) * U; home[i * 3 + 2] = (z - pv[2]) * U;
    rand[i * 4] = r(); rand[i * 4 + 1] = r(); rand[i * 4 + 2] = r(); rand[i * 4 + 3] = r();
    col.setHex(c).multiplyScalar(1 + (r() - 0.5) * 2 * jitter);
    base[i * 3] = col.r; base[i * 3 + 1] = col.g; base[i * 3 + 2] = col.b;
    mesh.setColorAt(i, col);
  });
  mesh.count = count;
  const dummy = new THREE.Object3D();
  const group = new THREE.Group();
  group.add(mesh);
  let ymin = 1e9, ymax = -1e9;
  for (let i = 0; i < count; i++) { ymin = Math.min(ymin, home[i * 3 + 1]); ymax = Math.max(ymax, home[i * 3 + 1]); }
  const hy = new Float32Array(count);
  for (let i = 0; i < count; i++) hy[i] = (home[i * 3 + 1] - ymin) / Math.max(1e-6, ymax - ymin);

  const model = {
    group, mesh, count, home, rand, hy, cells, size: { x: (max[0] - min[0] + 1) * U, y: (max[1] - min[1] + 1) * U, z: (max[2] - min[2] + 1) * U },
    set(i, x, y, z, s = 1, rx = 0, ry = 0, rz = 0) {
      dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.setScalar(Math.max(1e-4, s)); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    },
    commit() { mesh.instanceMatrix.needsUpdate = true; },
    reset() { for (let i = 0; i < count; i++) model.set(i, home[i * 3], home[i * 3 + 1], home[i * 3 + 2], 1); model.commit(); },
    /** burst apart / reassemble. p: 0 assembled .. 1 gone */
    dissolve(p, { spread = 3, rise = 1.2, gravity = 0, spin = 4, stagger = 0.45, order = 'rand' } = {}) {
      for (let i = 0; i < count; i++) {
        const k = order === 'y' ? 1 - hy[i] : order === 'yup' ? hy[i] : rand[i * 4];
        const q = clamp((p - k * stagger) / (1 - stagger));
        const e = q * q * (3 - 2 * q) * 0.35 + q * 0.65 * q;
        const s = 1 - smoothstep((q - 0.55) / 0.45);
        model.set(i, home[i * 3] + ((rand[i * 4] - 0.5) * 2) * spread * e, home[i * 3 + 1] + rand[i * 4 + 1] * rise * e * 2 - gravity * q * q, home[i * 3 + 2] + ((rand[i * 4 + 2] - 0.5) * 2) * spread * e,
          s, q * spin * rand[i * 4 + 3], q * spin * rand[i * 4], q * spin * rand[i * 4 + 1]);
      }
      model.commit();
    },
    /** cubes pop into place. p: 0 nothing .. 1 built */
    pop(p, { order = 'y', stagger = 0.55, drop = 0.6, overshoot = 1.9 } = {}) {
      for (let i = 0; i < count; i++) {
        const k = order === 'y' ? hy[i] : order === 'rand' ? rand[i * 4] : order === 'x' ? (home[i * 3] / (model.size.x || 1) + 0.5) : i / Math.max(1, count - 1);
        const q = clamp((p - clamp(k) * stagger) / (1 - stagger));
        model.set(i, home[i * 3], home[i * 3 + 1] + (1 - q) * drop, home[i * 3 + 2], q <= 0 ? 0 : easeOutBack(q, overshoot));
      }
      model.commit();
    },
    setColorAll(hex, mul = 1) { const c = new THREE.Color(hex).multiplyScalar(mul); for (let i = 0; i < count; i++) mesh.setColorAt(i, c); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
    /** tint toward hex by amount 0..1 using stored base colours (reversible) */
    tint(hex, amount, mul = 1) {
      const t = new THREE.Color(hex); const c = new THREE.Color();
      for (let i = 0; i < count; i++) { c.setRGB(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).lerp(t, amount).multiplyScalar(mul); mesh.setColorAt(i, c); }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    /** write per-instance rgb directly (values may exceed 1 for bloom) */
    setRGB(i, r, g, b) { mesh.instanceColor.setXYZ(i, r, g, b); },
    commitColor() { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
    dispose() { mesh.dispose(); },
  };
  model.reset();
  return model;
}

/* ------------------------------------------------------------------ voxel font (5x7), faces +z */
const G = {
  A: '01110,10001,10001,11111,10001,10001,10001', B: '11110,10001,10001,11110,10001,10001,11110', C: '01110,10001,10000,10000,10000,10001,01110',
  D: '11110,10001,10001,10001,10001,10001,11110', E: '11111,10000,10000,11110,10000,10000,11111', F: '11111,10000,10000,11110,10000,10000,10000',
  G: '01110,10001,10000,10111,10001,10001,01111', H: '10001,10001,10001,11111,10001,10001,10001', I: '01110,00100,00100,00100,00100,00100,01110',
  J: '00111,00010,00010,00010,00010,10010,01100', K: '10001,10010,10100,11000,10100,10010,10001', L: '10000,10000,10000,10000,10000,10000,11111',
  M: '10001,11011,10101,10101,10001,10001,10001', N: '10001,11001,10101,10011,10001,10001,10001', O: '01110,10001,10001,10001,10001,10001,01110',
  P: '11110,10001,10001,11110,10000,10000,10000', Q: '01110,10001,10001,10001,10101,10010,01101', R: '11110,10001,10001,11110,10100,10010,10001',
  S: '01111,10000,10000,01110,00001,00001,11110', T: '11111,00100,00100,00100,00100,00100,00100', U: '10001,10001,10001,10001,10001,10001,01110',
  V: '10001,10001,10001,10001,10001,01010,00100', W: '10001,10001,10001,10101,10101,11011,10001', X: '10001,10001,01010,00100,01010,10001,10001',
  Y: '10001,10001,01010,00100,00100,00100,00100', Z: '11111,00001,00010,00100,01000,10000,11111',
  0: '01110,10001,10011,10101,11001,10001,01110', 1: '00100,01100,00100,00100,00100,00100,01110', 2: '01110,10001,00001,00010,00100,01000,11111',
  3: '11110,00001,00001,01110,00001,00001,11110', 4: '00010,00110,01010,10010,11111,00010,00010', 5: '11111,10000,11110,00001,00001,10001,01110',
  6: '00110,01000,10000,11110,10001,10001,01110', 7: '11111,00001,00010,00100,01000,01000,01000', 8: '01110,10001,10001,01110,10001,10001,01110',
  9: '01110,10001,10001,01111,00001,00010,01100',
  '.': '00000,00000,00000,00000,00000,00000,00100', '-': '00000,00000,00000,11111,00000,00000,00000', '/': '00001,00010,00010,00100,01000,01000,10000',
  '!': '00100,00100,00100,00100,00100,00000,00100', '?': '01110,10001,00001,00010,00100,00000,00100', ':': '00000,00100,00100,00000,00100,00100,00000',
  "'": '00100,00100,01000,00000,00000,00000,00000', ' ': '00000,00000,00000,00000,00000,00000,00000',
  '&': '01100,10010,10100,01000,10101,10010,01101', '+': '00000,00100,00100,11111,00100,00100,00000', '*': '00000,10101,01110,11111,01110,10101,00000',
  '#': '01010,01010,11111,01010,11111,01010,01010', ',': '00000,00000,00000,00000,00100,00100,01000',
};
/** Builder with the text on the XY plane facing +z. opts: color (hex | fn(charIdx,x,y)), depth, gap */
export function voxelText(str, { color = 0xffffff, depth = 2, gap = 1 } = {}) {
  const b = new Builder();
  let cx = 0;
  [...String(str).toUpperCase()].forEach((ch, ci) => {
    const g = (G[ch] || G['?']).split(',');
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (g[row][col] === '1') for (let d = 0; d < depth; d++) b.cell(cx + col, 6 - row, d, typeof color === 'function' ? color(ci, cx + col, 6 - row) : color);
    }
    cx += 5 + gap;
  });
  return b;
}

export { THREE };
