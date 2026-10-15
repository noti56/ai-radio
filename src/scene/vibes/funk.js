// FUNK: 70s club. Wood-panel wall with animated wavy retro stripes, marquee "FUNK" sign, mirror-tile disco ball
// throwing light dots, lit checker floor, lava lamps, wooden speakers that pump, striped sunset behind, dancing crowd.
// Deterministic: pure functions of `f`; build-time randomness only through ctx.rng.
const ORANGE = 0xff7a1a, BURNT = 0xc8461a, MUSTARD = 0xf2b01e, PURPLE = 0x7a2cc0, PLUM = 0x4a1a6e, MAGENTA = 0xe0308a, CREAM = 0xffe6b8, BROWN = 0x5a3214, TEAK = 0x8a5228, WHITE = 0xffffff;

export default {
  id: 'funk',
  label: 'Funk',
  idleBpm: 104,
  palette: { skyTop: 0x2a0d3e, skyBottom: 0xb8481e, glow: 0xff9a3a, accent: ORANGE, flash: 0xffc070 },
  lights: { hemi: [0xffe0c0, 0x3a1830, 0.8], key: [0xffd9a8, 1.9], rim: [0xb060ff, 1.4] },
  fog: { color: 0x3a1430, near: 26, far: 80 },
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.86 },
  exposure: 1.0,
  cam: { punch: 0.5, shake: 0.25, dist: 1, height: 1 },
  band: {
    guitar: 'electric', bass: 'bass', drums: 'kit',
    colors: { guitar: ORANGE, bass: PURPLE, kit: 0x8a2cc8, accent: MUSTARD },
    costumes: {
      guitar: [['afro', 0x7a4220], ['shades', 0xffa000]],
      bass: [['afro', 0xa0562a], ['bandana', MAGENTA], ['chain', MUSTARD]],
      drums: [['afro', 0x5a2e16], ['stars', MAGENTA], ['chain', MUSTARD]],
    },
    moves: { guitar: 'groove', bass: 'groove', drums: 'groove', intensity: 1.15 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, voxelText, hash } = V;
    const group = new THREE.Group();
    const r = rng(1970);
    const TAU = Math.PI * 2;
    const tc = new THREE.Color();
    const place = (b, s, opts, x = 0, y = 0, z = 0) => {
      const m = b.build({ anchor: 'none', pivot: [0, 0, 0], ...opts });
      m.group.scale.setScalar(s); m.group.position.set(x, y, z); group.add(m.group); return m;
    };

    // ---- wooden deck, marquee bulb lip, crowd pit, lit floor
    place(new Builder().box(-22, 0, -17, 44, 1, 31, (x, y, z) => ((x >> 1) & 1 ? TEAK : 0x74431f)), 2, { jitter: 0.06, seed: 3 }, 0.2, -0.4, 0.2);
    const lipB = new Builder();
    for (let x = -22; x < 22; x++) lipB.cell(x, 0, 0, (x & 1) ? MUSTARD : 0x3a2010);
    const lip = place(lipB, 2, { jitter: 0, emissive: 1.0, castShadow: false }, 0.2, -0.3, 5.6);
    place(new Builder().box(-20, 0, 0, 40, 1, 10, (x, y, z) => ((x + z) & 1 ? 0x3a1830 : 0x2e1428)), 3, { jitter: 0.05, seed: 4 }, 0.3, -0.9, 6.0);
    const floor = H.dancefloor({ w: 20, d: 14, tile: 4, y: -0.1, z0: -0.8, palette: [ORANGE, PURPLE, MUSTARD, MAGENTA], base: 0x24101e, emissive: 0.8, mode: 'checker' });
    group.add(floor.group);

    // ---- back wall: wood panels below, wavy 70s stripes above (animated per instance)
    const WW = 48, WH = 21;
    const wallB = new Builder();
    for (let i = 0; i < WW; i++) for (let j = 0; j < WH; j++) wallB.cell(i, j, 0, WHITE);
    const wall = place(wallB, 2, { jitter: 0, emissive: 0.0, hollow: false, castShadow: false }, -9.4, 0.1, -7.0);
    const wallIJ = wall.cells.map((c) => [c[0], c[1]]);
    const plank = [TEAK, 0x7a4520, 0x93592b, 0x6a3a1a].map((h) => new THREE.Color(h));
    const STRIPES = [BURNT, ORANGE, MUSTARD, CREAM, MAGENTA, PURPLE].map((h) => new THREE.Color(h));
    const railC = new THREE.Color(MUSTARD), darkC = new THREE.Color(0x2a140a);
    const plankShade = new Float32Array(WW);
    for (let i = 0; i < WW; i++) plankShade[i] = 0.85 + r() * 0.3;

    // ---- FUNK sign with chasing marquee bulbs
    const signB = voxelText('FUNK', { color: (ci) => [ORANGE, MUSTARD, MAGENTA, ORANGE][ci], depth: 2 });
    const sign = signB.build({ anchor: 'center', emissive: 0.9, castShadow: false, jitter: 0 });
    const SS = 1.55;
    sign.group.scale.setScalar(SS); sign.group.position.set(0, 5.35, -6.2); group.add(sign.group);
    const bulbB = new Builder(), panelB = new Builder();
    const bw = 29, bh = 13;
    for (let x = 0; x < bw; x++) for (let y = 0; y < bh; y++) {
      const edge = x === 0 || y === 0 || x === bw - 1 || y === bh - 1;
      if (edge) { if ((x + y) % 2 === 0) bulbB.cell(x, y, 0, CREAM); panelB.cell(x, y, -1, MUSTARD); }
      else panelB.cell(x, y, -1, 0x2a0f22);
    }
    const bulbs = bulbB.build({ anchor: 'center', emissive: 1.0, castShadow: false, jitter: 0 });
    bulbs.group.scale.setScalar(SS); bulbs.group.position.set(0, 5.35, -6.2 - 0.0); group.add(bulbs.group);
    const panel = panelB.build({ anchor: 'center', jitter: 0.03, castShadow: false });
    panel.group.scale.setScalar(SS); panel.group.position.set(0, 5.35, -6.45); group.add(panel.group);
    // bulb order around the rectangle for the chase
    const bulbOrd = new Float32Array(bulbs.count);
    bulbs.cells.forEach(([x, y], k) => {
      const per = 2 * (bw + bh);
      const d = y === 0 ? x : x === bw - 1 ? bw + y : y === bh - 1 ? bw + bh + (bw - 1 - x) : 2 * bw + bh + (bh - 1 - y);
      bulbOrd[k] = d / per;
    });

    // ---- mirror disco ball (+ chain)
    const ballG = new THREE.Group(); ballG.position.set(0, 5.7, 2.6); group.add(ballG);
    const ball = new Builder().ball(0, 0, 0, 5.2, 0xc8c8d0).build({ anchor: 'center', jitter: 0.08, emissive: 0.7, castShadow: false, seed: 9 });
    ballG.add(ball.group);
    const chain = new Builder().box(0, 0, 0, 1, 20, 1, 0x8a8a96).build({ anchor: 'base', jitter: 0, castShadow: false });
    chain.group.position.set(0, 6.7, 2.6); group.add(chain.group);
    const ballN = new Float32Array(ball.count * 3);
    for (let k = 0; k < ball.count; k++) { const x = ball.home[k * 3], y = ball.home[k * 3 + 1], z = ball.home[k * 3 + 2], l = Math.hypot(x, y, z) || 1; ballN[k * 3] = x / l; ballN[k * 3 + 1] = y / l; ballN[k * 3 + 2] = z / l; }

    // light dots thrown by the ball (on the back wall and floor)
    const NDOT = 110;
    const dots = H.instanced(NDOT, { emissive: 1.6 });
    const DOT = [];
    for (let i = 0; i < NDOT; i++) {
      DOT.push({ wall: i < 60, u: r(), v: r(), sp: 0.7 + r() * 0.6, s: 0.8 + r() * 0.7 });
      dots.setColorAt(i, tc.setHex([WHITE, CREAM, MUSTARD, 0xff9ad0][i % 4]));
    }
    dots.instanceColor.needsUpdate = true;
    group.add(dots);

    // ---- 70s striped sunset behind the wall
    const SUN = [0xffd23a, 0xffa020, 0xff7a1a, 0xf0502a, 0xd0305a, 0xa02a7a];
    const sunB = new Builder();
    const SR = 26;
    for (let x = -SR; x <= SR; x++) for (let y = -SR; y <= SR; y++) {
      if (x * x + y * y > SR * SR) continue;
      const band = Math.floor((SR - y) / (SR * 2 / 6.5));
      if (y < 4 && ((y + 40) % 5 < 1 + Math.floor((4 - y) / 9))) continue;            // retro gaps widening downward
      sunB.cell(x, y, 0, SUN[Math.min(5, band)]);
    }
    const sun = place(sunB, 2.6, { jitter: 0.02, emissive: 0.65, castShadow: false, receiveShadow: false }, 0, 4, -24);
    const stars = H.starfield({ count: 70, radius: 50, colors: [CREAM, 0xffc0e0, WHITE], yMin: 10, size: 0.3, seed: 77 });
    group.add(stars.group);

    // ---- lava lamps
    const lampB = new Builder();
    for (let y = 0; y < 7; y++) lampB.flatDisc(0, 0, y, 3.4 - y * 0.25, 1, y < 2 ? 0x2a1a10 : MUSTARD);   // base cone
    for (let y = 7; y < 9; y++) lampB.flatDisc(0, 0, y, 2.2, 1, 0xd8d8e0);                              // collar
    for (let y = 9; y < 23; y++) lampB.flatDisc(0, 0, y, 2.6, 1, (x, yy, z) => ((y === 9 || y === 22) && x * x + z * z >= 4 ? 0xd8d8e0 : null));
    for (let y = 23; y < 26; y++) lampB.flatDisc(0, 0, y, 2.0 - (y - 23) * 0.4, 1, MUSTARD);            // cap
    lampB.map.forEach((v, k) => { if (v[3] === null) lampB.map.delete(k); });
    const LS = 1.0, CS = 0.2 * LS;   // lamp cube size in world units
    const lampDefs = [[-7.4, -5.4, MAGENTA, 0x8a3ad0], [7.4, -5.4, ORANGE, 0x8a3ad0], [-8.3, 2.6, MUSTARD, 0xc0306a], [8.3, 2.6, MAGENTA, 0x6a2cc0]];
    const lamps = lampDefs.map(([x, z, blob, liquid]) => {
      const m = lampB.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.04, seed: 12 }); m.group.scale.setScalar(LS); m.group.position.set(x, 0, z); group.add(m.group);
      const gl = new Builder();
      for (let y = 10; y < 22; y++) gl.flatDisc(0, 0, y, 2.6, 1, (xx, yy, zz) => (zz <= 0 && xx * xx + zz * zz >= 3.2 ? liquid : null));
      gl.map.forEach((v, k2) => { if (v[3] === null) gl.map.delete(k2); });
      const gm = gl.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.06, emissive: 0.7, castShadow: false, seed: 13 }); gm.group.scale.setScalar(LS); gm.group.position.set(x, 0, z); group.add(gm.group);
      return { x, z, blob };
    });
    // blobs: clusters of cubes moving up and down inside the glass
    const OFF = [];
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) if (x * x + y * y + z * z <= 3.2) OFF.push([x, y, z]);
    const BPL = 3, NB = lampDefs.length * BPL;
    const blobs = H.instanced(NB * OFF.length, { emissive: 1.1 });
    const BL = [];
    for (let b = 0; b < NB; b++) {
      const L = lamps[Math.floor(b / BPL)];
      BL.push({ x: L.x, z: L.z, k: 1 + ((b * 7) % 4), ph: r() * TAU, s: 0.8 + r() * 0.45, dx: (r() - 0.5) * 0.18 });
      for (let o = 0; o < OFF.length; o++) blobs.setColorAt(b * OFF.length + o, tc.setHex(L.blob).multiplyScalar(0.85 + 0.3 * hash(b * 100 + o)));
    }
    blobs.instanceColor.needsUpdate = true;
    group.add(blobs);

    // ---- wooden speakers with pumping woofers
    const spkB = new Builder().box(-4, 0, -3, 8, 17, 6, (x, y, z) => (y === 0 || y === 16 ? 0x3a2010 : TEAK));
    spkB.box(-3, 1, 3, 6, 15, 1, 0x2a1408);
    const wfB = new Builder().disc(0, 0, 0, 2.6, 1, 0x3a3030).disc(0, 0, 1, 1.6, 1, 0x1a1414).disc(0, 0, 2, 0.8, 1, MUSTARD);
    const woofers = [];
    for (const sx of [-1, 1]) {
      const m = spkB.build({ anchor: 'base', jitter: 0.04, seed: 14 }); m.group.scale.setScalar(1.25); m.group.position.set(sx * 8.7, 0, -1.4); m.group.rotation.y = -sx * 0.35; group.add(m.group);
      for (const [wy, ws] of [[2.6, 1.0], [1.15, 0.75]]) {
        const w = wfB.build({ anchor: 'center', jitter: 0.02, seed: 15, emissive: 0.15 });
        const holder = new THREE.Group(); holder.position.set(sx * 8.7, 0, -1.4); holder.rotation.y = -sx * 0.35; group.add(holder);
        w.group.position.set(0, wy, 1.0); w.group.scale.setScalar(1.25 * ws); holder.add(w.group);
        woofers.push({ g: w.group, s: 1.25 * ws });
      }
    }

    // ---- spot beams (no truss: lenses hang from the dark ceiling)
    const beamCols = [ORANGE, PURPLE, MUSTARD, MAGENTA, ORANGE, PURPLE];
    const beams = beamCols.map((c, i) => {
      const bm = H.beam({ color: c, length: 11, radius: 1.4, opacity: 0.15 });
      bm.group.position.set(-6.5 + i * 2.6, 8.8, i % 2 ? 3.2 : -3.8); group.add(bm.group); return bm;
    });

    // ---- gold glitter from the ball in choruses
    const glitter = H.confetti({ count: 90, colors: [MUSTARD, WHITE, ORANGE, CREAM], origin: [0, 7.8, 1.5], spread: [14, 9], mode: 'fall', life: 3.6, size: 0.11, emissive: 1.4, seed: 23, sway: 0.4 });
    group.add(glitter.group);

    // ---- crowd
    const crowd = H.crowd({ rows: 4, cols: 19, spacing: 0.92, z0: 7.4, y0: -0.6, palette: [ORANGE, PURPLE, MUSTARD, MAGENTA, 0x2a8a8a, BROWN, CREAM], skin: [0xf2c09a, 0xc88a5a, 0x8a5a3a, 0x5a3a24], style: 'dance', hands: 0.6, seed: 71, rowStep: 0.95, rise: 0.14 });
    group.add(crowd.group);

    const wash1 = new THREE.PointLight(ORANGE, 6, 15, 1.6); wash1.position.set(-4.5, 4.5, 3.5);
    const wash2 = new THREE.PointLight(0xa040ff, 6, 15, 1.6); wash2.position.set(4.5, 4.5, 3.5);
    group.add(wash1, wash2);

    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.14), snare = f.env('drums', ['s', 'cl'], 0.12), crash = f.env('drums', 'c', 0.6), bassHit = f.env('bass', undefined, 0.2);
        const sec = f.section, chorus = sec === 'chorus' ? 1 : sec === 'bridge' ? 0.45 : 0.12;
        const E = f.energy, lp = f.loopP, beat = f.beat;

        // wall: planks + wavy stripes that roll with the groove
        const wph = beat * Math.PI * 0.5;
        for (let k = 0; k < wall.count; k++) {
          const i = wallIJ[k][0], j = wallIJ[k][1];
          if (j < 9) { tc.copy(plank[(i >> 1) & 3]).multiplyScalar(plankShade[i] * ((i & 1) ? 1 : 0.86)); if (j === 0) tc.copy(darkC); }
          else if (j === 9) { tc.copy(railC).multiplyScalar(0.9 + 0.8 * kick); }
          else {
            const w = (j - 10) + 2.2 * Math.sin(i * 0.22 + wph) + 1.2 * Math.sin(i * 0.09 - lp * TAU * 2);
            const si = ((Math.floor(w / 2.4) % 6) + 6) % 6;
            tc.copy(STRIPES[si]).multiplyScalar(0.55 + 0.25 * E + 0.25 * kick * chorus);
          }
          wall.setRGB(k, tc.r, tc.g, tc.b);
        }
        wall.commitColor();

        // marquee chase
        const chase = beat * 0.5;
        for (let k = 0; k < bulbs.count; k++) {
          const on = (((bulbOrd[k] * 24 - chase * 4) % 3) + 3) % 3 < 1;
          const b = on ? 1.6 + 0.8 * kick : 0.35;
          tc.setHex(CREAM); bulbs.setRGB(k, tc.r * b, tc.g * b * 0.92, tc.b * b * 0.75);
        }
        bulbs.commitColor();
        sign.group.scale.setScalar(SS * (1 + 0.05 * kick));

        // disco ball spin + mirror sparkle
        const rot = lp * TAU * 6;
        ballG.rotation.y = rot;
        const sb = Math.floor(beat * 4);
        const cr = Math.cos(rot), sr = Math.sin(rot);
        for (let k = 0; k < ball.count; k++) {
          const nx = ballN[k * 3], ny = ballN[k * 3 + 1], nz = ballN[k * 3 + 2];
          const wz = -nx * sr + nz * cr;                                   // world-z of the facet normal
          const facing = Math.max(0, wz * 0.6 + ny * 0.2 + 0.4);
          const h = hash(k * 13 + sb * 7919);
          let b = 0.3 + 0.45 * facing;
          if (h > 0.9 - 0.08 * E - 0.1 * kick) b = 1.5 + 0.9 * kick;
          const tint = (k + sb) % 5;
          const rr = tint === 0 ? 1.0 : 0.85, gg = tint === 0 ? 0.75 : 0.85, bbb = tint === 1 ? 1.0 : 0.9;
          ball.setRGB(k, rr * b, gg * b, bbb * b);
        }
        ball.commitColor();

        // dots sweep across the wall and floor with the ball rotation
        const amt = 0.35 + 0.65 * Math.max(chorus, E * 0.7);
        for (let i = 0; i < NDOT; i++) {
          const d = DOT[i];
          const u = (((d.u + lp * 6 * d.sp) % 1) + 1) % 1;
          const vis = (i / NDOT) < amt ? 1 : 0;
          const tw = 0.6 + 0.4 * Math.sin(lp * TAU * 30 + d.v * 40);
          const s = d.s * vis * tw * (1 + 0.5 * kick) * Math.min(1, Math.sin(u * Math.PI) * 4);
          if (d.wall) H.put(dots, i, -9 + u * 18, 0.6 + d.v * 8.6, -6.55, s, s, 0.2);
          else H.put(dots, i, -8 + u * 16, 0.03, -6 + d.v * 10.5, s, 0.2, s);
        }
        dots.instanceMatrix.needsUpdate = true;

        // lava blobs
        for (let b = 0; b < NB; b++) {
          const o = BL[b];
          const ph = lp * TAU * o.k + o.ph;
          const y = CS * 11 + CS * 9.5 * (0.5 - 0.5 * Math.cos(ph));
          const vel = Math.abs(Math.sin(ph));
          const s = CS * 0.62 * o.s * (1 + 0.25 * bassHit);
          const sy = s * (1 + 0.45 * vel), sxz = s / Math.sqrt(1 + 0.45 * vel);
          for (let q = 0; q < OFF.length; q++) {
            const of = OFF[q];
            H.put(blobs, b * OFF.length + q, o.x + o.dx + of[0] * sxz, y + of[1] * sy, o.z + of[2] * sxz, sxz * 5.4, sy * 5.4, sxz * 5.4);
          }
        }
        blobs.instanceMatrix.needsUpdate = true;

        woofers.forEach((w, i) => { const p = i & 1 ? snare : kick; w.g.scale.set(w.s * (1 + 0.08 * p), w.s * (1 + 0.08 * p), w.s * (1 + 0.6 * p)); });

        floor.update(f, chorus > 0.9 ? 'rainbow' : sec === 'bridge' ? 'wave' : 'checker', 0.35 + 0.35 * E);

        beams.forEach((bm, i) => {
          const sw = Math.sin(lp * TAU * (2 + (i % 3)) + i * 1.7);
          bm.group.rotation.set((i % 2 ? -0.4 : 0.35) + 0.12 * sw, 0, 0.5 * sw * (i < 3 ? 1 : -1));
          bm.setOpacity(0.04 + 0.06 * E + 0.12 * kick * chorus + 0.06 * crash);
        });
        // lip bulbs alternate on every beat
        const alt = Math.floor(beat) & 1;
        for (let k = 0; k < lip.count; k++) {
          const x = lip.cells[k][0];
          const on = ((x >> 1) & 1) === alt;
          const b = (x & 1) ? (on ? 1.8 : 0.3) : 0.2;
          lip.setRGB(k, 1.0 * b, 0.72 * b, 0.25 * b);
        }
        lip.commitColor();

        sun.group.scale.setScalar(2.6 * (1 + 0.015 * kick));
        stars.update(f);
        glitter.update(f, chorus > 0.9 ? 1 : 0.15 + 0.5 * crash);
        wash1.intensity = 2 + 6 * kick * (0.4 + E); wash2.intensity = 2 + 6 * snare * (0.4 + E);
        crowd.update(f, 'dance', 0.6);
      },
    };
  },
};
