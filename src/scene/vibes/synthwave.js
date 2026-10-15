// SYNTHWAVE: 80s outrun. Striped retro sun setting behind wireframe mountains, a neon grid floor that scrolls
// toward the camera forever (seamless: offset = beat-locked, wrapped by the grid pitch), palm silhouettes,
// a parked voxel supercar, chrome SYNTHWAVE sign with a scanline sweep, floating wireframe shapes, searchlights.
// Deterministic: pure functions of `f`; ambient motion periodic with the 60 s loop.
const TAU = Math.PI * 2;
const LEVEL = { chorus: 1, verse: 0.6, intro: 0.45, outro: 0.45, bridge: 0.4 };

export default {
  id: 'synthwave',
  label: 'Synthwave',
  idleBpm: 100,
  palette: { skyTop: 0x0b0322, skyBottom: 0x5a1060, glow: 0xff5a3c, accent: 0xff3fd0, flash: 0xff8a3d },
  lights: { hemi: [0xd0b0ff, 0x2a0a3a, 0.8], key: [0xffe0ee, 2.0], rim: [0xff7a3c, 1.5] },
  fog: { color: 0x2a0838, near: 40, far: 150 },
  bloom: { strength: 0.9, radius: 0.65, threshold: 0.72 },
  exposure: 1.05,
  cam: { punch: 0.35, shake: 0.1 },
  band: {
    guitar: 'keytar', bass: 'bass', drums: 'pads',
    colors: { guitar: 0xff2e88, bass: 0x2b1b5a, kit: 0x16121e, accent: 0xffb347, glow: 0xff3fd0 },
    costumes: {
      guitar: [['visor', 0x00f0ff], ['chain', 0xffd36b]],
      bass: [['shades', 0x101018], ['scarf', 0xff6ec7, 0xffb347]],
      drums: [['visor', 0xff3fd0], ['headphones', 0x1a1a24, 0x00f0ff]],
    },
    moves: { guitar: 'sway', bass: 'bounce', drums: 'bounce', intensity: 1.0 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, voxelText, U, hash, clamp, smoothstep } = V;
    const group = new THREE.Group();
    const r = rng(1984);
    const PINK = 0xff2bd6, CYAN = 0x00e5ff, ORANGE = 0xff8a3d, YELLOW = 0xffe45c, PURPLE = 0x7b3cff, NIGHT = 0x0b0418;
    const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
    const LP = lin(PINK), LC = lin(CYAN), LO = lin(ORANGE);

    // ---- dark ground slabs (top at y = -0.05)
    const SX = 40, SZ = 28;
    const slabs = H.instanced(SX * SZ, { emissive: 0 });
    slabs.receiveShadow = true;
    for (let i = 0; i < SX; i++) for (let j = 0; j < SZ; j++) {
      const k = j * SX + i;
      H.put(slabs, k, -39 + i * 2, -0.25, -41 + j * 2, 10, 2, 10);
      slabs.setColorAt(k, new THREE.Color(((i + j) & 1) ? 0x0d0520 : NIGHT));
    }
    slabs.instanceMatrix.needsUpdate = true; slabs.instanceColor.needsUpdate = true;
    group.add(slabs);

    // ---- neon grid: z-lines (static) + x-lines (scroll toward the camera)
    const ZL = 41, ZB = 27, XL = 27, XB = 40, PITCH = 2, ZMIN = -40, SPAN = XL * PITCH;
    const zLines = H.instanced(ZL * ZB, { emissive: 1.3 });
    for (let l = 0; l < ZL; l++) for (let j = 0; j < ZB; j++) H.put(zLines, l * ZB + j, -40 + l * 2, -0.03, ZMIN + 1 + j * 2, 0.6, 0.35, 10);
    zLines.instanceMatrix.needsUpdate = true;
    const xLines = H.instanced(XL * XB, { emissive: 1.3 });
    group.add(zLines, xLines);
    const zFade = new Float32Array(ZL * ZB);
    for (let l = 0; l < ZL; l++) for (let j = 0; j < ZB; j++) { const z = ZMIN + 1 + j * 2; zFade[l * ZB + j] = 1 - smoothstep((z - 9) / 5); }

    // ---- retro sun (disc in XY, cells scaled x2), stripes animated per frame
    const sunB = new Builder();
    const SR = 20;
    sunB.disc(0, 0, 0, SR, 1, (x, y) => { const t = (y + SR) / (2 * SR); return t > 0.62 ? (t > 0.85 ? 0xffd84a : 0xffb238) : t > 0.4 ? 0xff7a2f : t > 0.2 ? 0xff3f6a : 0xe8239a; });
    const sun = sunB.build({ anchor: 'none', pivot: [0, 0, 0], emissive: 0.9, castShadow: false, receiveShadow: false, jitter: 0, hollow: false });
    sun.group.scale.setScalar(2);
    sun.group.position.set(0, 5.2, -40);
    group.add(sun.group);
    const sunY = new Int8Array(sun.count);
    sun.cells.forEach(([, y], i) => { sunY[i] = y; });

    // ---- wireframe mountains (dark fill + neon wire)
    const fill = new Builder(), wire = new Builder();
    const range = (x0, x1, z, peaks, cTop, cWire, seed) => {
      const rr = rng(seed);
      for (let x = x0; x <= x1; x++) {
        let h = 0;
        for (const [px, ph, pw] of peaks) h = Math.max(h, ph - Math.abs(x - px) * (ph / pw));
        h = Math.floor(h + (rr() < 0.3 ? 1 : 0));
        for (let y = 0; y < h; y++) {
          if (y === h - 1) wire.cell(x, y, z, cTop);
          else if (y % 3 === 0 || (x - x0) % 5 === 0) wire.cell(x, y, z, cWire);
          else fill.cell(x, y, z, 0x14062a);
        }
      }
    };
    range(-80, -13, 0, [[-17, 9, 6], [-28, 14, 9], [-42, 10, 7], [-56, 15, 10], [-72, 9, 6]], 0x18b8d8, 0x3a1070, 3);
    range(13, 80, 0, [[17, 8, 5], [27, 13, 8], [40, 11, 8], [53, 16, 10], [70, 10, 6]], 0x18b8d8, 0x3a1070, 4);
    const back = new Builder(), backW = new Builder();
    {
      const rr = rng(9);
      for (let x = -48; x <= 48; x++) {
        if (Math.abs(x) < 9) continue;
        let h = 0;
        for (const [px, ph, pw] of [[-14, 11, 8], [-30, 13, 9], [-42, 9, 6], [16, 12, 9], [29, 14, 9], [42, 10, 7]]) h = Math.max(h, ph - Math.abs(x - px) * (ph / pw));
        h = Math.floor(h + (rr() < 0.3 ? 1 : 0));
        for (let y = 0; y < h; y++) (y === h - 1 || y % 4 === 0 ? backW : back).cell(x, y, 0, y === h - 1 ? PINK : 0x4a1270);
      }
    }
    const mkRange = (b, emissive, scale, z) => { const m = b.build({ anchor: 'none', pivot: [0, 0.5, 0], emissive, castShadow: false, receiveShadow: false, jitter: emissive ? 0 : 0.05 }); m.group.scale.setScalar(scale); m.group.position.set(0, 0, z); group.add(m.group); return m; };
    mkRange(fill, 0, 3, -30); const wireM = mkRange(wire, 1.0, 3, -30);
    mkRange(back, 0, 5, -36); mkRange(backW, 1.1, 5, -36);

    // ---- palms (silhouettes)
    const palms = new Builder();
    const palm = (ox, oz, h, lean, seed) => {
      const pr = rng(seed);
      let tx = 0;
      for (let y = 0; y < h; y++) { tx = Math.round(lean * (y / h) ** 2); palms.box(ox + tx, y, oz, 2, 1, 2, y % 4 === 0 ? 0x2a1240 : 0x1d0b2e); }
      const top = h, cx = ox + tx, n = 8;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + pr() * 0.4, L = 9 + Math.floor(pr() * 4);
        for (let i = 1; i <= L; i++) {
          const y = top + Math.round(2.2 * Math.sin((i / L) * Math.PI * 0.8) - (i * i) / (L * 1.6));
          palms.cell(cx + Math.round(Math.cos(a) * i), y, oz + Math.round(Math.sin(a) * i), i % 3 ? 0x240c3a : 0x351457);
          if (i < L - 2) palms.cell(cx + Math.round(Math.cos(a) * i), y - 1, oz + Math.round(Math.sin(a) * i), 0x1a0828);
        }
      }
      palms.box(cx - 1, top - 1, oz - 1, 3, 2, 3, 0x1d0b2e);
    };
    palm(-45, -30, 30, 5, 1); palm(44, -29, 28, -5, 2); palm(-46, -12, 26, 4, 3); palm(45, -14, 32, -6, 4);
    palm(-60, -60, 36, 6, 5); palm(58, -62, 38, -6, 6); palm(-75, -100, 40, 5, 7); palm(74, -98, 42, -5, 8);
    const palmM = palms.build({ anchor: 'none', pivot: [0, 0.5, 0], jitter: 0.04, seed: 21 });
    group.add(palmM.group);

    // ---- supercar (wedge) with glowing tail bar, headlights and underglow
    const car = new Builder(), carGlow = new Builder();
    const body = 0xe0245e, glass = 0x1a1030, tire = 0x121218, chrome = 0xd7dbe2;
    car.box(0, 1, 0, 24, 2, 11, (x, y, z) => (y === 2 && (z === 0 || z === 10) ? 0xffffff : body));
    car.box(1, 3, 0, 20, 1, 11, body).box(20, 3, 1, 3, 1, 9, body);
    car.box(6, 4, 1, 11, 1, 9, body).box(8, 5, 2, 7, 1, 7, glass).box(14, 4, 1, 3, 1, 9, glass).box(9, 6, 3, 5, 1, 5, body);
    car.box(0, 5, 0, 3, 1, 11, body).box(1, 4, 1, 1, 1, 1, tire).box(1, 4, 9, 1, 1, 1, tire);
    for (const wx of [5, 18]) for (const wz of [-1, 11]) { car.disc(wx, 1.5, wz, 2.2, 1, (x, y) => ((x - wx) ** 2 + (y - 1.5) ** 2 < 1.3 ? chrome : tire)); }
    carGlow.box(-1, 2, 1, 1, 1, 9, PINK).box(24, 2, 1, 1, 1, 2, 0xfff6d8).box(24, 2, 8, 1, 1, 2, 0xfff6d8);
    carGlow.box(3, 0, 1, 18, 1, 9, CYAN);
    const carG = new THREE.Group();
    const carM = car.build({ anchor: 'none', pivot: [12, -1.5, 5], jitter: 0.03, seed: 5 });
    const carGM = carGlow.build({ anchor: 'none', pivot: [12, -1.5, 5], emissive: 1.6, castShadow: false, jitter: 0, hollow: false });
    carG.add(carM.group, carGM.group);
    carG.position.set(-6.9, 0, -4.6); carG.rotation.y = -0.55;
    group.add(carG);
    const carCells = carGM.cells.map(([x, y, z, c]) => [lin(c), y === 0 ? 2 : x < 0 ? 1 : 0]);

    // ---- neon triangle frame behind the band
    const tri = new Builder();
    const TW = 34, TH = 30;
    tri.line(-TW, 0, 0, 0, TH, 0, PINK, 2).line(0, TH, 0, TW, 0, 0, PINK, 2).line(-TW, 0, 0, TW, 0, 0, PINK, 2);
    tri.line(-TW + 6, 2, -2, 0, TH - 6, -2, CYAN, 1).line(0, TH - 6, -2, TW - 6, 2, -2, CYAN, 1);
    const triM = tri.build({ anchor: 'none', pivot: [0, 0, 0], emissive: 1.4, castShadow: false, jitter: 0, hollow: false });
    triM.group.position.set(0, 0, -7.4);
    group.add(triM.group);
    const triBase = triM.cells.map(([, y, , c]) => [lin(c), y]);

    // ---- chrome SYNTHWAVE sign (+ pink drop layer)
    const chromeRow = [0x3a2a9a, 0x6a6fd8, 0x9ec9ff, 0xe8f6ff, 0xffffff, 0xd8f4ff, 0xb0d8ff];
    const signM = voxelText('SYNTHWAVE', { color: (ci, x, y) => chromeRow[y], depth: 2 }).build({ anchor: 'center', emissive: 0.9, castShadow: false, jitter: 0 });
    const dropM = voxelText('SYNTHWAVE', { color: PINK, depth: 1 }).build({ anchor: 'center', emissive: 1.5, castShadow: false, jitter: 0 });
    const signG = new THREE.Group(); signG.add(signM.group, dropM.group);
    dropM.group.position.set(0.12, -0.14, -0.25);
    signG.scale.setScalar(0.62); signG.position.set(0, 7.5, -7.8);
    group.add(signG);
    const signBase = signM.cells.map(([, y, , c]) => [lin(c), y]);
    // under-bar
    const barB = new Builder().box(-26, 0, 0, 53, 1, 1, ORANGE);
    const barM = barB.build({ anchor: 'center', emissive: 1.6, castShadow: false, jitter: 0, hollow: false });
    barM.group.position.set(0, -1.05, 0); signG.add(barM.group);

    // ---- floating wireframe shapes
    const shapeDefs = [
      ['oct', [-7.2, 4.6, -4.2], CYAN, 1], ['cube', [7.4, 4.4, -4.4], PINK, -1], ['pyr', [-5.4, 8.3, -5.6], ORANGE, 2],
      ['oct', [5.6, 8.4, -6.0], PURPLE, -2], ['pyr', [8.4, 6.6, 0.6], CYAN, 1], ['cube', [-8.4, 6.9, 0.4], PINK, -1],
    ];
    const shapes = shapeDefs.map(([kind, pos, col, spin], i) => {
      const b = new Builder(), s = 6;
      let vs, es;
      if (kind === 'oct') { vs = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s]]; es = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]]; }
      else if (kind === 'cube') { const q = 4; vs = []; for (const x of [-q, q]) for (const y of [-q, q]) for (const z of [-q, q]) vs.push([x, y, z]); es = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]; }
      else { vs = [[0, s, 0], [-s, -4, -s], [s, -4, -s], [s, -4, s], [-s, -4, s]]; es = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]]; }
      es.forEach(([a, c]) => b.line(...vs[a], ...vs[c], col, 1));
      const m = b.build({ anchor: 'center', emissive: 1.4, castShadow: false, jitter: 0, hollow: false });
      m.group.position.set(...pos); group.add(m.group);
      return { m, pos, spin, ph: i * 1.3 };
    });

    // ---- player light rings (pulse on each player's notes)
    const ringB = new Builder();
    const ringPos = [[-18, 3.5], [18, 3.5], [0, -13.5]];
    ringPos.forEach(([cx, cz], k) => {
      for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) { const d = Math.hypot(x, z); if (d > 6.6 && d < 7.8) ringB.cell(Math.round(cx) + x, 0, Math.round(cz) + z, [PINK, CYAN, ORANGE][k]); }
    });
    const ringM = ringB.build({ anchor: 'none', pivot: [0, 0.5, 0], emissive: 1.5, castShadow: false, jitter: 0, hollow: false });
    ringM.group.position.y = 0.02;
    group.add(ringM.group);
    const ringOf = new Uint8Array(ringM.count), ringCol = new Float32Array(ringM.count * 3);
    ringM.cells.forEach(([x, , z, c], i) => {
      let best = 0, bd = 1e9; ringPos.forEach(([cx, cz], k) => { const d = (x - cx) ** 2 + (z - cz) ** 2; if (d < bd) { bd = d; best = k; } });
      ringOf[i] = best; const l = lin(c); ringCol[i * 3] = l[0]; ringCol[i * 3 + 1] = l[1]; ringCol[i * 3 + 2] = l[2];
    });

    // ---- searchlights, stars, neon dust, crowd
    const beams = [-1, 1].flatMap((s) => [0, 1].map((i) => {
      const bm = H.beam({ color: i ? CYAN : PINK, length: 34, radius: 2.4, opacity: 0.08 });
      bm.group.position.set(s * (6 + i * 3), 0.2, -10 - i * 3); group.add(bm.group);
      return { bm, s, i };
    }));
    const stars = H.starfield({ count: 170, radius: 70, colors: [0xffffff, 0xffc4ec, 0xc4e6ff, 0xffe9a8], yMin: 9, size: 0.45, seed: 33 });
    group.add(stars.group);
    const dust = H.confetti({ count: 60, colors: [PINK, CYAN, ORANGE], origin: [0, 0.1, 1], spread: [18, 12], mode: 'rise', up: 0.7, life: 6, size: 0.12, emissive: 1.8, seed: 12, sway: 0.4 });
    group.add(dust.group);
    const crowd = H.crowd({ rows: 3, cols: 18, spacing: 0.9, z0: 7.8, y0: -0.05, palette: [0x2b1b5a, 0xff2e88, 0x00a5c0, 0x1a1030, 0x7b3cff], style: 'sway', hands: 0.5, seed: 7, rise: 0.12 });
    group.add(crowd.group);

    const washP = new THREE.PointLight(PINK, 5, 15, 1.6); washP.position.set(-4.5, 3.6, 3);
    const washC = new THREE.PointLight(CYAN, 4, 15, 1.6); washC.position.set(4.5, 3.6, 3);
    group.add(washP, washC);

    const DOWN = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3();

    return {
      group,
      update(f) {
        const lp = f.loopP, bt = f.beat;
        const lvl = LEVEL[f.section] ?? 0.6;
        const I = lvl * (0.55 + 0.45 * f.energy);
        const chorus = f.section === 'chorus';
        const kick = f.env('drums', 'k', 0.16), snare = f.env('drums', ['s', 'cl'], 0.14);
        const gEnv = f.env('guitar', undefined, 0.3), bEnv = f.env('bass', undefined, 0.22);

        // ---- grid: x-lines scroll toward the camera (1 unit per beat, wraps by the pitch => seamless)
        const scroll = bt * 1.0;
        const gk = 0.45 + 0.55 * I + 0.9 * kick * I;
        const barCol = chorus && (f.bar & 1) ? LC : LP;
        for (let l = 0; l < XL; l++) {
          const z = ZMIN + ((((l * PITCH + scroll) % SPAN) + SPAN) % SPAN);
          const fade = smoothstep((z - ZMIN) / 6) * (1 - smoothstep((z - 9.5) / 4));
          const k = gk * fade;
          for (let j = 0; j < XB; j++) {
            const idx = l * XB + j;
            H.put(xLines, idx, -39 + j * 2, -0.03, z, 10, 0.35, 0.6);
            xLines.instanceColor.setXYZ(idx, barCol[0] * k, barCol[1] * k, barCol[2] * k);
          }
        }
        xLines.instanceMatrix.needsUpdate = true; xLines.instanceColor.needsUpdate = true;
        const zk = 0.35 + 0.45 * I + 0.5 * kick * I;
        const zc = chorus ? LP : LC;
        for (let i = 0; i < ZL * ZB; i++) { const k = zk * zFade[i]; zLines.instanceColor.setXYZ(i, zc[0] * k * 0.8 + LP[0] * k * 0.2, zc[1] * k, zc[2] * k); }
        zLines.instanceColor.needsUpdate = true;

        // ---- sun stripes slide down (15 periods per loop => seamless); breathe on the bar
        const shift = lp * 60;
        for (let i = 0; i < sun.count; i++) {
          const y = sunY[i];
          let s = 1;
          if (y < 6) {
            const depth = clamp((6 - y) / 26);
            const ph = (((y + shift) / 4) % 1 + 1) % 1;
            if (ph < 0.12 + 0.55 * depth) s = 0;
          }
          sun.set(i, sun.home[i * 3], sun.home[i * 3 + 1], sun.home[i * 3 + 2], s);
        }
        sun.commit();
        sun.group.scale.setScalar(2 * (1 + 0.012 * kick * I));

        // ---- wire mountains shimmer, triangle chase, car lights, rings
        wireM.group.position.y = 0;
        for (let i = 0; i < triM.count; i++) {
          const [c, y] = triBase[i];
          const k = 0.35 + 0.9 * Math.pow(0.5 + 0.5 * Math.sin(y * 0.35 - bt * Math.PI), 4) * (0.5 + I) + 0.6 * kick * I;
          triM.setRGB(i, c[0] * k, c[1] * k, c[2] * k);
        }
        triM.commitColor();
        for (let i = 0; i < carGM.count; i++) {
          const [c, kind] = carCells[i];
          const k = kind === 2 ? 0.6 + 0.8 * bEnv : kind === 1 ? 0.8 + 0.6 * snare : 1.2;
          carGM.setRGB(i, c[0] * k, c[1] * k, c[2] * k);
        }
        carGM.commitColor();
        const ringE = [gEnv, bEnv, kick];
        for (let i = 0; i < ringM.count; i++) {
          const k = 0.25 + 1.6 * ringE[ringOf[i]] * (0.5 + I);
          ringM.setRGB(i, ringCol[i * 3] * k, ringCol[i * 3 + 1] * k, ringCol[i * 3 + 2] * k);
        }
        ringM.commitColor();

        // ---- sign: scanline sweeps down once per bar
        const scan = 6.5 - (f.beatInBar / 4) * 9;
        for (let i = 0; i < signM.count; i++) {
          const [c, y] = signBase[i];
          const k = 0.55 + 1.2 * Math.exp(-((y - scan) ** 2) / 0.6) + 0.15 * kick;
          signM.setRGB(i, c[0] * k, c[1] * k, c[2] * k);
        }
        signM.commitColor();
        signG.position.y = 7.5 + 0.06 * Math.sin(lp * TAU * 4);

        // ---- floating shapes
        for (const s of shapes) {
          s.m.group.rotation.set(lp * TAU * 3 * s.spin + s.ph, lp * TAU * 4 * s.spin, 0.3);
          s.m.group.position.y = s.pos[1] + 0.3 * Math.sin(lp * TAU * 5 + s.ph);
          s.m.group.scale.setScalar(1 + 0.12 * kick * I);
        }

        // ---- searchlights
        for (const b of beams) {
          const a = b.s * 0.25 + 0.45 * Math.sin(lp * TAU * (3 + b.i) + b.s + b.i * 2);
          const e = 1.05 + 0.18 * Math.sin(lp * TAU * 4 + b.i);
          dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e) * 0.4);
          dir.normalize();
          b.bm.group.quaternion.setFromUnitVectors(DOWN, dir);
          b.bm.setOpacity(0.03 + 0.06 * I + (chorus ? 0.05 + 0.05 * kick : 0));
        }

        washP.intensity = 2.5 + 5 * kick * I; washC.intensity = 2 + 5 * snare * I;
        stars.update(f);
        dust.update(f, clamp(0.3 + 0.7 * I));
        crowd.update(f, chorus ? 'wave' : 'sway', 0.5 + 0.4 * I);
      },
    };
  },
};
