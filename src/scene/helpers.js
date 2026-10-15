// Reusable, deterministic scene dressing for vibe modules: crowd, confetti, dance floor, light beams, stars.
// Each factory returns { group, update(f, ...) } where update is a pure function of the frame object f.
import { THREE, U, Builder, rng, hash, clamp, lerp, smoothstep, tri, voxelGeometry, voxelMaterial } from './voxel.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

function instanced(count, { emissive = 0, castShadow = false } = {}) {
  const mesh = new THREE.InstancedMesh(voxelGeometry(), voxelMaterial(emissive), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = castShadow; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  for (let i = 0; i < count; i++) mesh.setColorAt(i, _c.setHex(0xffffff));
  return mesh;
}
/** raw instance transform: sx/sy/sz are multiples of the voxel cube (U wide) */
function put(mesh, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  _p.set(x, y, z); _q.setFromEuler(_e.set(rx, ry, rz)); _s.set(sx, sy, sz);
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
}
/** same, but sx/sy/sz are WORLD units */
function putW(mesh, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { put(mesh, i, x, y, z, sx / U, sy / U, sz / U, rx, ry, rz); }

/**
 * Crowd of tiny voxel people facing -z (towards the stage).
 * opts: rows, cols, spacing, x0,y0,z0 (centre of the first row), palette[] hex colours, skin[], style:
 *   'bounce' | 'sway' | 'headbang' | 'jump' | 'nod' | 'dance' | 'wave'; hands 0..1 (how often arms are up); seed; scale
 */
export function crowd({ rows = 3, cols = 12, spacing = 0.95, x0 = 0, y0 = 0, z0 = 8, palette = [0xe8664a, 0x4fb6e8, 0x8c6cf0, 0xf5c542], skin = [0xf7c9a8, 0xd9a07a, 0x9a6a4a], style = 'bounce', hands = 0.6, seed = 3, scale = 1, rowStep = 0.9, rise = 0.18 } = {}) {
  const n = rows * cols, r = rng(seed);
  const per = 4; // body, head, armL, armR
  const mesh = instanced(n * per, { castShadow: true });
  const group = new THREE.Group(); group.add(mesh);
  const P = [];
  for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
    const i = rr * cols + cc;
    P.push({
      x: x0 + (cc - (cols - 1) / 2) * spacing + (r() - 0.5) * 0.3, z: z0 + rr * rowStep + (r() - 0.5) * 0.25, y: y0 + rr * rise,
      ph: r() * 0.18, h: 0.8 + r() * 0.35, up: r(),
    });
    mesh.setColorAt(i * per, _c.setHex(palette[Math.floor(r() * palette.length)]));
    mesh.setColorAt(i * per + 1, _c.setHex(skin[Math.floor(r() * skin.length)]));
    const a = _c.setHex(skin[Math.floor(r() * skin.length)]);
    mesh.setColorAt(i * per + 2, a); mesh.setColorAt(i * per + 3, a);
  }
  mesh.instanceColor.needsUpdate = true;
  return {
    group, style, mesh,
    update(f, mode = style, handsAmt = hands) {
      const b = f.beat, e = 0.35 + 0.65 * f.energy;
      for (let i = 0; i < n; i++) {
        const p = P[i];
        const bt = b + p.ph;
        const bb = Math.abs(Math.sin(Math.PI * bt)), ph = ((bt % 1) + 1) % 1;
        let hop = 0, lean = 0, roll = 0, armUp = 0, headDip = 0;
        switch (mode) {
          case 'jump': hop = 0.55 * e * 4 * ph * (1 - ph); armUp = 1; break;
          case 'headbang': hop = 0.04 * bb; headDip = 0.5 * e * Math.pow(1 - bb, 2); armUp = p.up < handsAmt ? 1 : 0; break;
          case 'sway': roll = 0.22 * e * Math.sin(Math.PI * bt / 2); hop = 0.03 * bb; armUp = p.up < handsAmt ? 0.5 + 0.5 * Math.sin(Math.PI * bt / 2 + i) : 0; break;
          case 'nod': hop = 0.05 * bb; headDip = 0.35 * e * Math.pow(1 - bb, 3); armUp = p.up < handsAmt * 0.5 ? 1 : 0; break;
          case 'dance': hop = 0.2 * e * bb; roll = 0.25 * e * Math.sin(Math.PI * bt + p.up * 6); armUp = (i + Math.floor(bt)) % 2 ? 1 : 0.2; break;
          case 'wave': hop = 0.08 * bb; armUp = 0.5 + 0.5 * Math.sin(Math.PI * bt / 2 - p.x * 0.6); break;
          default: hop = 0.3 * e * bb; armUp = p.up < handsAmt ? 1 : 0.1;
        }
        const s = scale * p.h, x = p.x, z = p.z, y = p.y + hop * s;
        const k = i * per;
        putW(mesh, k, x, y + 0.42 * s, z, 0.62 * s, 0.7 * s, 0.4 * s, 0, 0, roll);                       // body
        putW(mesh, k + 1, x + Math.sin(roll) * -0.35 * s, y + (0.95 - headDip * 0.25) * s, z - headDip * 0.18 * s, 0.38 * s, 0.38 * s, 0.38 * s, headDip * 0.5, 0, roll); // head
        const raise = armUp * 2.7;                                                                         // arm rotation about z
        putW(mesh, k + 2, x - 0.4 * s, y + (0.55 + 0.32 * armUp) * s, z, 0.14 * s, 0.6 * s, 0.14 * s, 0, 0, -raise * 0.4 + roll * 0.5 + 0.1);
        putW(mesh, k + 3, x + 0.4 * s, y + (0.55 + 0.32 * armUp) * s, z, 0.14 * s, 0.6 * s, 0.14 * s, 0, 0, raise * 0.4 + roll * 0.5 - 0.1);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Looping confetti / sparks / embers. Pure function of f.t: particle i is alive for `life` seconds and re-launches forever.
 * opts: count, colors[], origin [x,y,z], spread [x,z], up (initial speed), gravity, life, size, emissive, shape 'fall'|'rise'|'burst'
 */
export function confetti({ count = 120, colors = [0xffffff], origin = [0, 6, 0], spread = [10, 6], up = 0, gravity = 2.2, life = 4, size = 0.12, emissive = 0.4, mode = 'fall', seed = 9, sway = 0.6 } = {}) {
  const r = rng(seed);
  const mesh = instanced(count, { emissive });
  const D = [];
  for (let i = 0; i < count; i++) {
    D.push({ ox: (r() - 0.5) * spread[0], oz: (r() - 0.5) * spread[1], ph: r(), vx: (r() - 0.5) * 2, vz: (r() - 0.5) * 2, rs: 1 + r() * 4, sz: 0.5 + r(), sw: r() * 6.28 });
    mesh.setColorAt(i, _c.setHex(colors[i % colors.length]));
  }
  mesh.instanceColor.needsUpdate = true;
  const group = new THREE.Group(); group.add(mesh);
  return {
    group,
    update(f, amount = 1) {
      for (let i = 0; i < count; i++) {
        const d = D[i];
        const u = ((f.t / life + d.ph) % 1 + 1) % 1, age = u * life;
        let x = origin[0] + d.ox, y, z = origin[2] + d.oz;
        if (mode === 'fall') { y = origin[1] - 0.5 * gravity * age * age * 0.25 - age * 0.6; x += Math.sin(age * 1.5 + d.sw) * sway; }
        else if (mode === 'rise') { y = origin[1] + age * (up || 1.2); x += Math.sin(age * 1.8 + d.sw) * sway; }
        else { x += d.vx * age * up * 0.6; z += d.vz * age * up * 0.6; y = origin[1] + up * age * (0.6 + d.ph) - 0.5 * gravity * age * age; }
        const vis = (i / count) < amount ? 1 : 0;
        const s = size * d.sz * vis * smoothstep(u * 8) * (1 - smoothstep((u - 0.85) / 0.15));
        putW(mesh, i, x, y, z, s, s * 0.6, s, age * d.rs, age * d.rs * 0.7, 0);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Tiled dance floor of 2x2-cell tiles whose colours are driven per frame.
 * opts: w,d (tiles), tile (cells), y, colorA, colorB, mode 'checker'|'ripple'|'rainbow'|'wave'|'static'
 * update(f, mode?) -> sets per-tile glow colours from palette[] (hex)
 */
export function dancefloor({ w = 14, d = 8, tile = 3, y = 0, z0 = 0, x0 = 0, palette = [0xff3d9a, 0x3dd5ff], base = 0x15151c, emissive = 0.9, mode = 'checker', gap = true, thickness = 1 } = {}) {
  const b = new Builder();
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    b.box(i * tile, 0, j * tile, tile - (gap ? 1 : 0), thickness, tile - (gap ? 1 : 0), 0xffffff);
  }
  const m = b.build({ anchor: 'none', pivot: [0, 0, 0], emissive, castShadow: false, jitter: 0, hollow: false });
  // tile index per instance
  const idx = new Int32Array(m.count);
  m.cells.forEach(([x, , z], k) => { idx[k] = Math.floor(x / tile) + Math.floor(z / tile) * w; });
  m.group.position.set(x0 - (w * tile * U) / 2, y, z0 - (d * tile * U) / 2);
  const pal = palette.map((h) => new THREE.Color(h));
  const baseC = new THREE.Color(base);
  const tmp = new THREE.Color();
  return {
    group: m.group, model: m,
    update(f, md = mode, gain = 1) {
      const bt = f.beat;
      const cache = (this._cache ||= new Float32Array(w * d * 3));
      for (let t = 0; t < w * d; t++) {
        const i = t % w, j = Math.floor(t / w);
        let lit = 0, ci = 0;
        switch (md) {
          case 'checker': lit = ((i + j + Math.floor(bt)) & 1) ? 1 : 0.12; ci = (i + j) & 1; break;
          case 'ripple': { const dd = Math.hypot(i - w / 2, (j - d / 2) * 1.4); lit = Math.max(0, 1 - Math.abs(((bt * 1.5 - dd * 0.45) % 4 + 4) % 4 - 0.5)); ci = Math.floor(dd) % pal.length; break; }
          case 'rainbow': lit = 0.55 + 0.45 * Math.sin(bt * Math.PI + i * 0.5 + j * 0.8); ci = (i + j + Math.floor(bt)) % pal.length; break;
          case 'wave': lit = 0.5 + 0.5 * Math.sin(bt * Math.PI * 0.5 - i * 0.5); ci = j % pal.length; break;
          default: lit = 0.35; ci = (i + j) % pal.length;
        }
        tmp.copy(baseC).lerp(pal[ci % pal.length], clamp(lit)).multiplyScalar(0.25 + 1.5 * lit * gain);
        cache[t * 3] = tmp.r; cache[t * 3 + 1] = tmp.g; cache[t * 3 + 2] = tmp.b;
      }
      for (let k = 0; k < m.count; k++) { const t = idx[k] * 3; m.setRGB(k, cache[t], cache[t + 1], cache[t + 2]); }
      m.commitColor();
    },
  };
}

/** Additive cone of light. Origin at the apex (top); points down -Y. Rotate/aim the returned `group`. */
export function beam({ color = 0xffffff, length = 14, radius = 1.4, opacity = 0.2 } = {}) {
  const geo = new THREE.ConeGeometry(radius, length, 16, 1, true);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const group = new THREE.Group(); group.add(mesh);
  // tiny lens cube at the apex so beams have a visible source
  const lens = new THREE.InstancedMesh(voxelGeometry(), voxelMaterial(1.5), 1);
  lens.setMatrixAt(0, _m.compose(_p.set(0, 0, 0), _q.identity(), _s.set(1.2, 1.2, 1.2))); lens.setColorAt(0, _c.setHex(color));
  group.add(lens);
  return { group, mesh, material: mat, setOpacity(o) { mat.opacity = o; }, setColor(h) { mat.color.setHex(h); lens.setColorAt(0, _c.setHex(h)); lens.instanceColor.needsUpdate = true; } };
}

/** Distant twinkling star cubes on a dome. */
export function starfield({ count = 120, radius = 60, colors = [0xffffff, 0xfff2c4, 0xc4e6ff], yMin = 4, size = 0.28, seed = 5, twinkle = 1 } = {}) {
  const r = rng(seed);
  const mesh = instanced(count, { emissive: 1.4 });
  const S = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, el = lerp(0.12, 1.1, r());
    S.push({ x: Math.cos(a) * Math.cos(el) * radius, y: yMin + Math.sin(el) * radius * 0.55, z: -Math.abs(Math.sin(a)) * Math.cos(el) * radius - 12, ph: r() * 6.28, sz: 0.4 + r() });
    mesh.setColorAt(i, _c.setHex(colors[i % colors.length]));
  }
  mesh.instanceColor.needsUpdate = true;
  const group = new THREE.Group(); group.add(mesh);
  return {
    group,
    update(f) {
      for (let i = 0; i < count; i++) { const s = S[i]; const k = size * s.sz * (0.7 + 0.3 * twinkle * Math.sin(f.loopP * Math.PI * 2 * 6 + s.ph)); putW(mesh, i, s.x, s.y, s.z, k, k, k, s.ph, s.ph, 0); }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export { instanced, put, putW };
