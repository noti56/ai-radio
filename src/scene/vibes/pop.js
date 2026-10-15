// POP: candy sunset sky with a voxel rainbow and clouds, giant LED wall (EQ / plasma / heart / POP text),
// pink-cyan dance floor, candy-cane truss pillars with gumballs, floating hearts/stars/notes, glitter + confetti cannons.
// Deterministic: pure functions of `f`; build-time randomness only through ctx.rng.
const HOT = 0xff3d9a, PINK = 0xff7ac8, LILAC = 0xb48cff, CYAN = 0x4fe3ff, MINT = 0x7dffc4, LEMON = 0xfff07a, PEACH = 0xffb38a, WHITE = 0xffffff;

const HEART = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
const STAR = ['000010000', '000111000', '000111000', '111111111', '011111110', '001111100', '001111100', '011101110', '110000011'];
const NOTE = ['0001110', '0001011', '0001001', '0001000', '0001000', '0111000', '1111000', '1111000', '0110000'];

export default {
  id: 'pop',
  label: 'Pop',
  idleBpm: 118,
  palette: { skyTop: 0x8a4fd8, skyBottom: 0xff9cc8, glow: 0xffc2ea, accent: HOT, flash: 0xffe3f3 },
  lights: { hemi: [0xfff0fa, 0x8a6aa8, 0.95], key: [0xfff4f8, 2.0], rim: [0x5fe6ff, 1.5] },
  fog: { color: 0xd98ad0, near: 28, far: 85 },
  bloom: { strength: 0.45, radius: 0.55, threshold: 0.88 },
  exposure: 0.95,
  cam: { punch: 0.6, shake: 0.2 },
  band: {
    guitar: 'electric', bass: 'bass', drums: 'kit',
    colors: { guitar: 0xff5fae, bass: 0x3fd0ff, kit: 0xf6f2ff, accent: HOT, glow: 0xffb3ea },
    costumes: {
      guitar: [['crown', 0xffd24a], ['stars', HOT]],
      bass: [['headphones', WHITE, CYAN], ['flower', PINK, WHITE]],
      drums: [['bow', HOT, WHITE], ['shades', 0x6a2cff]],
    },
    moves: { guitar: 'bounce', bass: 'sway', drums: 'bounce', intensity: 1.1 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, voxelText, hash } = V;
    const group = new THREE.Group();
    const r = rng(101);
    const TAU = Math.PI * 2;
    const PAL = [PINK, LILAC, CYAN, MINT, LEMON, PEACH].map((h) => new THREE.Color(h));
    const tc = new THREE.Color();
    const palAt = (t, out) => { t = (((t % 1) + 1) % 1) * PAL.length; const a = Math.floor(t); return out.copy(PAL[a]).lerp(PAL[(a + 1) % PAL.length], t - a); };
    /** build a Builder with cells scaled by s (fewer, bigger cubes) */
    const place = (b, s, opts, x = 0, y = 0, z = 0) => {
      const m = b.build({ anchor: 'none', pivot: [0, 0, 0], ...opts });
      m.group.scale.setScalar(s); m.group.position.set(x, y, z); group.add(m.group); return m;
    };

    // ---- deck slab, front light lip, crowd pit
    const deck = new Builder().box(-22, 0, -16, 44, 1, 30, (x, y, z) => ((x + z) & 1 ? 0xf1e4ff : 0xe2cff8));
    place(deck, 2, { jitter: 0.03, seed: 3 }, 0.2, -0.4, 0.2);
    const lip = place(new Builder().box(-22, 0, 0, 44, 1, 1, WHITE), 2, { jitter: 0, emissive: 1.2, castShadow: false }, 0.2, -0.3, 5.6);
    place(new Builder().box(-20, 0, 0, 40, 1, 10, (x, y, z) => ((x + z) & 1 ? 0x6a4890 : 0x5c3d80)), 3, { jitter: 0.04, seed: 4 }, 0.3, -0.9, 6.0);

    const floor = H.dancefloor({ w: 20, d: 14, tile: 4, y: -0.1, z0: -0.8, palette: [HOT, CYAN], base: 0x4a3070, emissive: 0.9, mode: 'checker' });
    group.add(floor.group);

    // ---- giant LED wall (40 x 18 pixels of 0.4 cubes)
    const LW = 40, LH = 18;
    const ledB = new Builder();
    for (let i = 0; i < LW; i++) for (let j = 0; j < LH; j++) ledB.cell(i, j, 0, WHITE);
    const led = place(ledB, 2, { jitter: 0, emissive: 0.45, castShadow: false, hollow: false }, -7.8, 1.0, -6.6);
    const lc = led.cells.map((c) => [c[0], c[1]]);
    // POP text mask (each glyph pixel = 2x2 LEDs)
    const mask = new Uint8Array(led.count);
    const txt = voxelText('POP', { depth: 1 });
    const tb = txt.bounds(), tw = (tb.max[0] - tb.min[0] + 1) * 2, ox = Math.floor((LW - tw) / 2), oy = 2;
    const tset = new Set(); txt.map.forEach(([x, y]) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) tset.add((ox + (x - tb.min[0]) * 2 + a) + ',' + (oy + y * 2 + b)); });
    lc.forEach(([i, j], k) => { mask[k] = tset.has(i + ',' + j) ? 1 : tset.has((i - 1) + ',' + (j + 1)) ? 2 : 0; });
    // frame + riser
    const fr = new Builder();
    fr.box(-1, -3, -1, 42, 2, 2, PINK);
    fr.box(-1, -1, -1, 42, 1, 1, WHITE).box(-1, LH, -1, 42, 1, 1, WHITE).box(-1, -1, -1, 1, LH + 2, 1, WHITE).box(LW, -1, -1, 1, LH + 2, 1, WHITE);
    fr.box(0, 0, -1, LW, LH, 1, 0x2a1840);
    place(fr, 2, { jitter: 0.02, seed: 6 }, -7.8, 1.0, -6.6);

    // ---- candy-cane pillars (truss legs) with gumballs + truss
    const pil = new Builder();
    for (let y = 0; y < 42; y++) pil.flatDisc(0, 0, y, 1.5, 1, (x, yy, z) => ((((yy + (x > 0 ? 1 : 0) * 2 + (z > 0 ? 1 : 0) * 4) >> 2) & 1) ? HOT : WHITE));
    const gums = [];
    for (const [x, z, c] of [[-9.6, -5.0, CYAN], [9.6, -5.0, LEMON], [-9.6, 1.2, MINT], [9.6, 1.2, LILAC]]) {
      const pm = pil.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.03, seed: 7 }); pm.group.position.set(x, 0, z); group.add(pm.group);
      const gb = new Builder().ball(0, 0, 0, 2.6, (xx, y, zz) => (y >= 1 && xx <= -1 && zz >= 0 ? WHITE : c));
      const gm = gb.build({ anchor: 'center', jitter: 0.02, emissive: 0.6, seed: 8 }); gm.group.position.set(x, 8.95, z); group.add(gm.group); gums.push(gm);
    }
    const truss = new Builder();
    for (const z of [-25, 6]) {
      truss.box(-48, 41, z, 97, 1, 1, WHITE).box(-48, 43, z, 97, 1, 1, WHITE);
      for (let x = -48; x <= 48; x += 3) truss.cell(x, 42, z, PINK);
    }
    place(truss, 1, { jitter: 0.02, seed: 9, castShadow: false }, 0, 0, 0);

    // ---- beams from the front truss
    const beamCols = [HOT, CYAN, WHITE, WHITE, CYAN, HOT];
    const beams = beamCols.map((c, i) => {
      const bm = H.beam({ color: c, length: 11, radius: 1.3, opacity: 0.16 });
      bm.group.position.set(-6.2 + i * 2.48, 8.2, i % 2 ? 1.2 : -5.0);
      group.add(bm.group); return bm;
    });

    // ---- floating giant hearts / stars / notes
    const shapeB = (rows, c, hi) => {
      const b = new Builder(), h = rows.length;
      rows.forEach((row, ry) => [...row].forEach((ch, x) => {
        if (ch !== '1') return;
        const y = h - 1 - ry, edge = !(rows[ry - 1]?.[x] === '1') || !(row[x - 1] === '1');
        for (let z = 0; z < 3; z++) b.cell(x, y, z, z === 2 && edge ? hi : c);
      }));
      return b;
    };
    const floatDefs = [
      [HEART, HOT, 0xffc2e2, -6.9, 6.7, -4.6, 1.9, 0.25], [STAR, LEMON, WHITE, 6.9, 6.9, -4.6, 1.8, -0.25],
      [NOTE, CYAN, WHITE, -7.4, 5.6, 2.2, 1.3, 0.5], [HEART, PINK, WHITE, 7.4, 5.4, 2.2, 1.2, -0.5],
      [STAR, MINT, WHITE, -4.4, 9.1, -3.4, 1.1, 0.1], [NOTE, LILAC, WHITE, 4.4, 9.0, -3.6, 1.2, -0.1],
      [HEART, CYAN, WHITE, -12.5, 6.2, -7.5, 2.3, 0.4], [STAR, HOT, 0xffc2e2, 12.5, 6.4, -7.5, 2.3, -0.4],
      [NOTE, PINK, WHITE, 0, 10.6, -7.8, 1.6, 0], [HEART, LEMON, WHITE, -9.6, 2.2, -6.2, 1.2, 0.5], [NOTE, MINT, WHITE, 9.6, 2.4, -6.2, 1.3, -0.5],
    ];
    const floaters = floatDefs.map(([rows, c, hi, x, y, z, s, ry], i) => {
      const m = shapeB(rows, c, hi).build({ anchor: 'center', jitter: 0.03, emissive: 0.55, seed: 20 + i, castShadow: false });
      m.group.position.set(x, y, z); m.group.scale.setScalar(s); m.group.rotation.y = ry; group.add(m.group);
      return { g: m.group, x, y, z, s, ry, ph: r() * TAU, k: 1 + (i % 3) };
    });

    // ---- candy sky: voxel rainbow, clouds, sparkles
    const RB = [0xff6f9a, 0xffa86a, 0xffe66a, 0x8af59a, 0x6ad8ff, 0xb48cff];
    const rbB = new Builder();
    for (let x = -34; x <= 34; x++) for (let y = 0; y <= 34; y++) { const band = Math.floor(Math.hypot(x, y) - 27); if (band >= 0 && band < 6) rbB.cell(x, y, 0, RB[5 - band]); }
    const rainbow = place(rbB, 2.5, { jitter: 0.02, emissive: 0.45, castShadow: false, receiveShadow: false }, 0, -2.5, -17);
    const rbAng = new Float32Array(rainbow.count), rbBase = new Float32Array(rainbow.count * 3);
    rainbow.cells.forEach(([x, y, , c], k) => { rbAng[k] = Math.atan2(y, x); tc.setHex(c); rbBase[k * 3] = tc.r; rbBase[k * 3 + 1] = tc.g; rbBase[k * 3 + 2] = tc.b; });

    const clB = new Builder();
    const cloud = (cx, cy, cz, w) => {
      const blobs = [[0, 0, 3.4], [w * 0.35, 1.4, 4.3], [w * 0.7, 0.3, 3.6], [w, -0.4, 2.8], [-w * 0.3, -0.6, 2.6]];
      for (const [dx, dy, rr] of blobs) {
        for (let x = Math.floor(-rr); x <= Math.ceil(rr); x++) for (let y = Math.floor(-rr); y <= Math.ceil(rr); y++) for (let z = Math.floor(-rr * 0.6); z <= Math.ceil(rr * 0.6); z++) {
          if (x * x + y * y + (z / 0.6) ** 2 > rr * rr + 0.25 || cy + dy + y < cy - 2) continue;
          const yy = Math.round(cy + dy + y);
          clB.cell(Math.round(cx + dx + x), yy, Math.round(cz + z), yy <= cy - 1 ? 0xf0d4ff : yy <= cy + 1 ? 0xfff0fb : WHITE);
        }
      }
    };
    cloud(-34, 15, -40, 9); cloud(26, 19, -44, 10); cloud(-16, 23, -46, 7); cloud(36, 9, -34, 7); cloud(-44, 6, -30, 8); cloud(6, 27, -50, 8);
    const clouds = place(clB, 3, { jitter: 0.03, seed: 31, castShadow: false, receiveShadow: false, emissive: 0.35 }, 0, 0, 0);
    const stars = H.starfield({ count: 90, radius: 46, colors: [WHITE, 0xffd6f0, 0xd6f6ff], yMin: 7, size: 0.32, seed: 41 });
    group.add(stars.group);

    // ---- glitter + confetti cannons
    const glitter = H.confetti({ count: 170, colors: [HOT, CYAN, LEMON, WHITE, LILAC, MINT], origin: [0, 9.2, -1], spread: [17, 11], mode: 'fall', life: 4.2, size: 0.13, emissive: 1.1, seed: 21, sway: 0.5 });
    group.add(glitter.group);
    const cannons = [-7.4, 7.4].map((x, i) => {
      const c = H.confetti({ count: 70, colors: [HOT, WHITE, CYAN, LEMON, PINK], origin: [x, 0.7, 4.2], spread: [0.5, 0.5], mode: 'burst', up: 5.2, gravity: 3.4, life: 2.4, size: 0.16, emissive: 0.9, seed: 50 + i });
      group.add(c.group); return c;
    });
    const canB = new Builder().box(-2, 0, -2, 4, 2, 4, WHITE).box(-1, 2, -1, 2, 2, 2, HOT).box(-2, 1, 2, 4, 1, 1, CYAN);
    for (const x of [-7.4, 7.4]) { const m = canB.build({ anchor: 'base', jitter: 0.02, emissive: 0.2 }); m.group.position.set(x, 0, 4.2); group.add(m.group); }

    // ---- crowd
    const crowd = H.crowd({ rows: 4, cols: 20, spacing: 0.88, z0: 7.4, y0: -0.6, palette: [PINK, CYAN, LILAC, LEMON, MINT, WHITE, HOT], style: 'jump', hands: 0.9, seed: 31, rowStep: 0.95, rise: 0.14 });
    group.add(crowd.group);

    // ---- colour wash
    const wash1 = new THREE.PointLight(HOT, 8, 15, 1.6); wash1.position.set(-4.5, 4.5, 4);
    const wash2 = new THREE.PointLight(CYAN, 8, 15, 1.6); wash2.position.set(4.5, 4.5, 4);
    group.add(wash1, wash2);

    let lastBar = -1;
    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.14), snare = f.env('drums', ['s', 'cl'], 0.12), crash = f.env('drums', 'c', 0.6);
        const sec = f.section, chorus = sec === 'chorus' ? 1 : sec === 'bridge' ? 0.45 : 0.12;
        const E = f.energy, lp = f.loopP, beat = f.beat, bar = f.bar;

        // LED wall
        const mode = chorus > 0.9 ? (bar % 4 < 2 ? 2 : 1) : sec === 'intro' || sec === 'outro' ? (bar % 2 ? 3 : 1) : [0, 3, 1, 0][bar % 4];
        const gain = 0.5 + 0.3 * E;
        const hs = 6.2 + 1.6 * kick + 0.6 * Math.sin(beat * Math.PI);
        const sweep = Math.floor(beat * 4);
        for (let k = 0; k < led.count; k++) {
          const i = lc[k][0], j = lc[k][1], x = i - 19.5, y = j - 8.5;
          let br = 0;
          if (mode === 0) {          // equaliser
            const band = i >> 1, h = LH * (0.12 + 0.8 * E * (0.35 + 0.65 * hash(band * 31 + Math.floor(beat * 2)))) + 4 * kick;
            palAt(0.55 - j / LH * 0.5, tc);
            br = j < h ? (j >= Math.floor(h) - 1 ? 2.2 : 1.1) : 0.06;
            if (j >= Math.floor(h) - 1 && j < h) tc.setHex(WHITE);
          } else if (mode === 1) {   // plasma
            const v = Math.sin(i * 0.31 + beat * 0.9) + Math.sin(j * 0.43 - beat * 0.7) + Math.sin((i + j) * 0.19 + lp * TAU * 4);
            palAt(v * 0.11 + beat * 0.0625, tc); br = 0.6 + 0.3 * v * v * 0.2 + 0.7 * kick;
          } else if (mode === 2) {   // heart + rings
            const nx = x / hs, ny = (y + 0.5) / hs, a = nx * nx + ny * ny - 1;
            if (a * a * a - nx * nx * ny * ny * ny <= 0) { tc.setHex(a > -0.25 ? WHITE : HOT); br = 1.5 + 0.8 * kick; }
            else { const d = Math.hypot(x, y * 1.25), ring = ((d * 0.14 - beat * 0.5) % 1 + 1) % 1; palAt(d * 0.03 + beat * 0.125, tc); br = ring < 0.3 ? 1.0 : 0.12; }
          } else {                   // POP text over scrolling candy stripes
            const m = mask[k];
            if (m === 1) { tc.setHex(WHITE); br = 1.6 + 0.8 * kick; }
            else if (m === 2) { tc.setHex(0x6a2cff); br = 0.9; }
            else { const s = ((i + j + sweep) >> 2) & 1; tc.setHex(s ? PINK : LILAC); br = s ? 0.55 : 0.25; }
          }
          br *= gain;
          led.setRGB(k, tc.r * br, tc.g * br, tc.b * br);
        }
        led.commitColor();

        // rainbow shimmer chase
        for (let k = 0; k < rainbow.count; k++) {
          const w = Math.pow(0.5 + 0.5 * Math.cos(rbAng[k] * 4 - beat * Math.PI * 0.5), 6);
          const b = 0.75 + (0.9 * w) * (0.4 + 0.6 * E) + 0.25 * kick;
          rainbow.setRGB(k, rbBase[k * 3] * b, rbBase[k * 3 + 1] * b, rbBase[k * 3 + 2] * b);
        }
        rainbow.commitColor();

        // stage lip chase
        const ch = Math.floor(beat * 2);
        for (let k = 0; k < lip.count; k++) {
          const on = ((lip.cells[k][0] + ch) & 3) === 0;
          tc.setHex(((lip.cells[k][0] >> 2) & 1) ? HOT : CYAN);
          const b = on ? 2.0 : 0.35;
          lip.setRGB(k, tc.r * b, tc.g * b, tc.b * b);
        }
        lip.commitColor();

        floor.update(f, chorus > 0.9 ? 'ripple' : sec === 'bridge' ? 'wave' : 'checker', 0.32 + 0.3 * E);

        // floaters bob + spin, pop on the kick
        for (let i = 0; i < floaters.length; i++) {
          const o = floaters[i];
          o.g.position.y = o.y + 0.28 * Math.sin(lp * TAU * o.k * 3 + o.ph);
          o.g.rotation.y = o.ry + 0.45 * Math.sin(lp * TAU * o.k * 2 + o.ph);
          o.g.rotation.z = 0.08 * Math.sin(lp * TAU * 5 + o.ph);
          o.g.scale.setScalar(o.s * (1 + (0.06 + 0.08 * chorus) * kick));
        }
        gums.forEach((g, i) => g.group.scale.setScalar(1 + 0.12 * (i & 1 ? snare : kick)));
        clouds.group.position.x = 0.8 * Math.sin(lp * TAU);

        // beams: sweep; colours rotate every bar
        if (bar !== lastBar) { lastBar = bar; beams.forEach((bm, i) => bm.setColor(beamCols[(i + bar) % beamCols.length])); }
        beams.forEach((bm, i) => {
          const sw = Math.sin(lp * TAU * (3 + (i % 3)) + i * 1.3);
          bm.group.rotation.set((i % 2 ? -0.35 : 0.3) + 0.15 * sw, 0, 0.45 * sw * (i < 3 ? 1 : -1));
          bm.setOpacity(0.04 + 0.05 * E + 0.12 * kick * chorus + 0.06 * crash);
        });

        wash1.intensity = 2 + 6 * kick * (0.4 + E); wash2.intensity = 2 + 6 * snare * (0.4 + E);
        stars.update(f);
        glitter.update(f, 0.3 + 0.7 * Math.max(chorus, E * 0.6));
        cannons.forEach((c) => c.update(f, chorus > 0.9 ? 1 : Math.min(1, crash * 1.5)));
        crowd.update(f, chorus > 0.9 ? 'jump' : 'wave', 0.9);
      },
    };
  },
};
