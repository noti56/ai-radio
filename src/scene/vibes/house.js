// HOUSE: nightclub / rave. The whole stage jumps on every four-on-the-floor kick: band, booth, speakers, crowd.
// Giant LED wall of voxel pixels (EQ bars, rings, checker, HOUSE text, plasma), laser fans, mirror ball,
// lit dance floor, low smoke, strobes on the off-beat in choruses only (<= ~2 flashes/s), drop bursts.
// Deterministic: pure functions of `f`; ambient motion periodic with the 60 s loop.
const TAU = Math.PI * 2;
const LEVEL = { chorus: 1, verse: 0.6, intro: 0.42, outro: 0.42, bridge: 0.22 };

export default {
  id: 'house',
  label: 'House',
  idleBpm: 124,
  palette: { skyTop: 0x14062a, skyBottom: 0x020108, glow: 0x5a1aa0, accent: 0x00e5ff, flash: 0xff2bd6 },
  lights: { hemi: [0xd8ccff, 0x2a1840, 0.85], key: [0xfff2ea, 2.3], rim: [0xff2bd6, 1.2] },
  fog: { color: 0x07040f, near: 24, far: 72 },
  bloom: { strength: 0.8, radius: 0.6, threshold: 0.75 },
  exposure: 1.05,
  cam: { punch: 1.5, shake: 0.55 },
  band: {
    guitar: 'keytar', bass: 'bass', drums: 'decks',
    colors: { guitar: 0x1a1a24, bass: 0x7a2cff, kit: 0x101016, accent: 0xff2bd6, glow: 0x00e5ff },
    costumes: {
      guitar: [['headphones', 0x15151a, 0xff2bd6], ['shades', 0x0b0b10]],
      bass: [['beanie', 0x2a1b4a, 0x00e5ff], ['shades', 0x0b0b10]],
      drums: [['headphones', 0x15151a, 0x00e5ff], ['chain', 0xffd24a]],
    },
    moves: { guitar: 'hop', bass: 'hop', drums: 'hop', intensity: 1.3 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, band, rng }) {
    const { Builder, voxelText, U, hash, clamp, smoothstep, voxelGeometry } = V;
    const group = new THREE.Group();
    const r = rng(424);
    const CY = 0x00e5ff, MG = 0xff2bd6, VI = 0x7b3cff, INK = 0x0c0b14, STEEL = 0x2c2a3a, CHROME = 0xb8bccb;
    const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
    const PAL = [lin(CY), lin(MG), lin(VI)];
    let cr = 0, cg = 0, cb = 0;
    /** palette gradient, m in [0,3) wraps cyan -> magenta -> violet -> cyan; writes cr,cg,cb */
    const pal = (m) => {
      m = ((m % 3) + 3) % 3; const i = Math.floor(m), k = m - i, a = PAL[i], b = PAL[(i + 1) % 3];
      cr = a[0] + (b[0] - a[0]) * k; cg = a[1] + (b[1] - a[1]) * k; cb = a[2] + (b[2] - a[2]) * k;
    };

    // ---- dark slabs: floor base, LED wall backing, riser (big scaled voxels, one draw call)
    const slabList = [];
    for (let i = 0; i < 40; i++) for (let j = 0; j < 30; j++) slabList.push([-15.6 + i * 0.8, -0.38, -10 + j * 0.8, 4, 1.4, 4, ((i + j) & 1) ? 0x0b0a12 : 0x0e0c17]);
    for (let i = 0; i < 13; i++) for (let j = 0; j < 7; j++) slabList.push([-8.4 + i * 1.4, 0.9 + j * 1.25, -7.15, 7, 6.25, 3, 0x07060c]);
    for (let i = 0; i < 12; i++) slabList.push([-8.25 + i * 1.5, 0.15, -6.0, 7.5, 2.5, 5, 0x15131f]);
    const slabs = H.instanced(slabList.length, { emissive: 0 });
    slabs.receiveShadow = true;
    slabList.forEach(([x, y, z, sx, sy, sz, c], i) => { H.put(slabs, i, x, y, z, sx, sy, sz); slabs.setColorAt(i, new THREE.Color(c)); });
    slabs.instanceMatrix.needsUpdate = true; slabs.instanceColor.needsUpdate = true;
    group.add(slabs);

    // ---- lit dance floor (top at y = -0.1)
    const floor = H.dancefloor({ w: 24, d: 20, tile: 4, y: -0.2, z0: 3, x0: 0, palette: [CY, MG, VI], base: 0x0d0b18, emissive: 0.9, mode: 'checker' });
    floor.model.mesh.receiveShadow = true;
    group.add(floor.group);

    // ---- LED wall of voxel pixels
    const COLS = 48, ROWS = 22, PITCH = 0.35, WX0 = -(COLS - 1) * PITCH / 2, WY0 = 0.75, WZ = -6.62;
    const led = H.instanced(COLS * ROWS, { emissive: 1.25 });
    group.add(led);
    // HOUSE text mask (each glyph pixel = 1 col x 2 rows)
    const mask = new Uint8Array(COLS * ROWS);
    voxelText('HOUSE', { depth: 1 }).map.forEach(([x, y]) => {
      const c = x + 9, r0 = 4 + y * 2;
      for (const rr of [r0, r0 + 1]) if (c >= 0 && c < COLS && rr < ROWS) mask[rr * COLS + c] = 1;
    });

    // ---- wall frame / truss (static) + neon strips (colour-driven)
    const frame = new Builder();
    for (const sx of [-1, 1]) {
      const x = sx > 0 ? 43 : -45;
      frame.box(x, 0, -35, 2, 44, 2, STEEL);
      for (let y = 0; y < 44; y += 4) frame.box(x, y, -33, 2, 1, 1, STEEL);
    }
    frame.box(-45, 42, -35, 90, 2, 2, STEEL).box(-45, 45, -35, 90, 1, 2, STEEL);
    for (let x = -45; x < 45; x += 3) frame.cell(x, 44, -34, STEEL);
    // strobe housings
    for (let i = 0; i < 8; i++) frame.box(-37 + i * 10, 40, -33, 4, 2, 2, INK);
    // speaker stacks (facing +z)
    const cones = new Builder();
    const speaker = (ox, oz) => {
      frame.box(ox, 0, oz, 12, 10, 8, INK).box(ox, 10, oz, 12, 14, 8, 0x14131c).box(ox + 1, 24, oz + 1, 10, 1, 6, STEEL);
      frame.disc(ox + 5.5, 5, oz + 8, 4.3, 1, 0x232230); cones.disc(ox + 5.5, 5, oz + 8, 3.3, 1, (x, y) => ((x - ox - 5.5) ** 2 + (y - 5) ** 2 < 1.6 ? CHROME : 0x1b1b22));
      for (const yy of [14, 20]) { frame.disc(ox + 5.5, yy, oz + 8, 2.8, 1, 0x232230); cones.disc(ox + 5.5, yy, oz + 8, 2.0, 1, (x, y) => ((x - ox - 5.5) ** 2 + (y - yy) ** 2 < 0.7 ? CHROME : 0x1b1b22)); }
    };
    speaker(-43, -9); speaker(31, -9);
    // mirror ball rod
    frame.box(0, 34, 11, 1, 13, 1, STEEL);
    const frameM = frame.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.04, seed: 9 });
    group.add(frameM.group);
    const conesM = cones.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02, seed: 10 });
    group.add(conesM.group);

    const neon = new Builder();
    // light tubes at the sides
    const tubes = [];
    for (const sx of [-1, 1]) for (const zc of [-23, -10, 3, 16]) { const x = sx > 0 ? 44 : -45; neon.box(x, 1, zc, 1, 40, 1, sx > 0 ? CY : MG); tubes.push([x, zc]); }
    for (const sx of [-1, 1]) for (const zc of [-23, -10, 3, 16]) { const x = sx > 0 ? 44 : -45; frame.box(x - 1, 0, zc - 1, 3, 1, 3, INK); }
    // speaker edge strips + wall top edge + booth face strip
    for (const ox of [-43, 31]) neon.box(ox, 24, -1, 12, 1, 1, VI).box(ox, 0, -1, 1, 24, 1, VI).box(ox + 11, 0, -1, 1, 24, 1, VI);
    neon.box(-43, 46, -34, 86, 1, 1, CY);
    const neonM = neon.build({ anchor: 'none', pivot: [0, 0, 0], emissive: 1.4, castShadow: false, jitter: 0, hollow: false });
    group.add(neonM.group);
    const neonBase = new Float32Array(neonM.count * 3);
    neonM.cells.forEach(([, , , c], i) => { const l = lin(c); neonBase[i * 3] = l[0]; neonBase[i * 3 + 1] = l[1]; neonBase[i * 3 + 2] = l[2]; });

    // booth pixels (VU meter) on the booth front face
    const BC = 26, BR = 2;
    const boothPix = H.instanced(BC * BR, { emissive: 1.3 });
    for (let i = 0; i < BC; i++) for (let j = 0; j < BR; j++) H.put(boothPix, j * BC + i, (-12.5 + i) * U, (2 + j * 2) * U, -0.25,0.85, 1.6, 0.6);
    boothPix.instanceMatrix.needsUpdate = true;
    // booth + pixels hop with the band: one rig
    const boothRig = new THREE.Group(); group.add(boothRig);
    boothRig.add(boothPix);
    // strobe lenses
    const strobes = H.instanced(8, { emissive: 1.8 });
    for (let i = 0; i < 8; i++) H.put(strobes, i, (-36 + i * 10) * U, 40.5 * U, -32 * U, 2.4, 1.2, 0.6);
    strobes.instanceMatrix.needsUpdate = true;
    group.add(strobes);

    // ---- mirror ball
    const ballB = new Builder();
    ballB.ball(0, 0, 0, 5, (x, y, z) => ((x + y + z) & 1 ? 0xd8dce6 : 0x9aa0b0));
    const ball = ballB.build({ anchor: 'center', emissive: 0.35, jitter: 0.05, seed: 31 });
    const ballG = new THREE.Group(); ballG.position.set(0, 6.25, 2.2); ballG.add(ball.group); group.add(ballG);
    const ballSeed = new Float32Array(ball.count);
    for (let i = 0; i < ball.count; i++) ballSeed[i] = hash(i * 7919 + 13);

    // ---- lasers: two floor fans + two top emitters
    const DOWN = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3();
    const lasers = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const bm = H.beam({ color: i % 2 ? MG : CY, length: 24, radius: 0.1, opacity: 0.3 });
      bm.group.position.set(s * 6.3, 0.6, -4.7); group.add(bm.group); lasers.push({ bm, s, i, top: false });
    }
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      const bm = H.beam({ color: VI, length: 22, radius: 0.12, opacity: 0.3 });
      bm.group.position.set(s * 7.6, 8.5, -6.3); group.add(bm.group); lasers.push({ bm, s, i, top: true });
    }
    const laserBox = new Builder();
    for (const s of [-1, 1]) laserBox.box(s * 31.5 - 2, 0, -26, 4, 2, 4, INK).box(s * 31.5 - 1, 2, -25, 2, 1, 2, STEEL);
    group.add(laserBox.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.03 }).group);

    // ---- low smoke (additive cube puffs)
    const SMK = 36;
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false });
    const smoke = new THREE.InstancedMesh(voxelGeometry(), smokeMat, SMK);
    smoke.frustumCulled = false;
    const SD = [];
    for (let i = 0; i < SMK; i++) {
      const front = i < 10;
      SD.push({ x: front ? (i & 1 ? 1 : -1) * (5.5 + r() * 3) : (r() - 0.5) * 17, z: front ? 1 + r() * 4 : -5.6 + r() * 4.5, y: 0.1 + r() * 0.35, s: 5 + r() * 7, ph: r() * TAU, k: 1 + Math.floor(r() * 3) });
      const l = lin([VI, MG, CY][i % 3]); smoke.setColorAt(i, new THREE.Color(l[0], l[1], l[2]));
    }
    const smokeCol = new Float32Array(SMK * 3);
    for (let i = 0; i < SMK; i++) { smokeCol[i * 3] = smoke.instanceColor.getX(i); smokeCol[i * 3 + 1] = smoke.instanceColor.getY(i); smokeCol[i * 3 + 2] = smoke.instanceColor.getZ(i); }
    group.add(smoke);

    // ---- crowd, confetti, haze specks
    const crowd = H.crowd({ rows: 4, cols: 20, spacing: 0.88, z0: 7.6, y0: -0.12, palette: [0x15121f, 0x2a1b4a, 0x00a5c0, 0xc0209f, 0x3b2a6b, 0x101018], style: 'jump', hands: 0.9, seed: 21, rowStep: 0.9, rise: 0.0 });
    group.add(crowd.group);
    const streamers = H.confetti({ count: 90, colors: [CY, MG, VI, 0xffffff], origin: [0, 9.5, 2.5], spread: [16, 9], mode: 'fall', life: 3.6, size: 0.13, emissive: 1.6, seed: 44 });
    group.add(streamers.group);
    const specks = H.starfield({ count: 140, radius: 55, colors: [CY, MG, VI, 0xffffff], yMin: 2, size: 0.3, seed: 17 });
    group.add(specks.group);

    // ---- lights (3 max)
    const washL = new THREE.PointLight(MG, 8, 16, 1.6); washL.position.set(-5.5, 4.5, 3);
    const washR = new THREE.PointLight(CY, 8, 16, 1.6); washR.position.set(5.5, 4.5, 3);
    const strobeL = new THREE.PointLight(0xffffff, 0, 18, 1.4); strobeL.position.set(0, 8, -3);
    group.add(washL, washR, strobeL);

    // DJ booth body (decks sit just behind/on top of it), hops with the band
    const boothB = new Builder();
    boothB.box(-14, 0, -3, 28, 5, 2, 0x14121e).box(-15, 5, -3, 30, 1, 3, CHROME);
    const boothM = boothB.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.03, seed: 12 });
    boothRig.add(boothM.group);

    // reset the band when this vibe leaves
    band.group.position.y = 0;
    group.addEventListener('removed', () => { band.group.position.y = 0; });

    const SC = { into: 0, left: 99, next: null };
    const secClock = (f) => {
      const s = f.track && f.track.sections;
      SC.into = f.t; SC.left = 99; SC.next = null;
      if (!s || !s.length) return SC;
      for (let i = 0; i < s.length; i++) if (f.t >= s[i].start && f.t < s[i].end) { SC.into = f.t - s[i].start; SC.left = s[i].end - f.t; SC.next = s[i + 1] ? s[i + 1].name : null; break; }
      return SC;
    };
    let lastBar = -1;

    return {
      group,
      update(f) {
        const bt = f.beat, spb = 60 / f.bpm, lp = f.loopP;
        const sc = secClock(f);
        const lvl = LEVEL[f.section] ?? 0.6;
        const I = lvl * (0.55 + 0.45 * f.energy);
        const chorus = f.section === 'chorus';
        const kick = f.env('drums', 'k', 0.13), hat = f.env('drums', ['h', 'o'], 0.07), snare = f.env('drums', ['s', 'cl'], 0.12);
        const drop = chorus ? Math.exp(-sc.into / 0.45) : 0;
        const build = sc.next === 'chorus' && sc.left < 4 ? 1 - sc.left / 4 : 0;
        const u = f.beatPhase;
        const jump = 4 * u * (1 - u);

        // ---- the whole stage jumps (lands on the kick)
        const hopH = (0.05 + 0.2 * I) * jump * (1 - 0.7 * build);
        band.group.position.y = hopH;
        boothRig.position.y = hopH;
        conesM.group.position.z = 0.07 * kick * (0.4 + I);
        conesM.group.scale.setScalar(1);
        ballG.rotation.y = lp * TAU * 6;
        ballG.position.y = 6.25 + 0.05 * Math.sin(lp * TAU * 30);

        // ---- LED wall
        let pat = Math.floor(f.bar / 2) % 5;
        if (f.section === 'bridge') pat = 1;
        const flash = 0.35 + 0.65 * (0.35 + 0.65 * kick);
        const wGain = (0.35 + 0.65 * I) * flash;
        const white = 0.35 * drop * drop;
        const ringSpeed = f.section === 'bridge' ? 0.25 : 1;
        const step = f.step;
        for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
          const idx = row * COLS + col;
          let v = 0, m = 0;
          if (build > 0) {
            const lim = build * ROWS;
            v = row < lim ? 1 : 0.04; m = row / ROWS * 1.5 + bt * 0.5;
            if (row < lim && row > lim - 1.5) v = 2;
          } else if (pat === 0) {
            const h = ROWS * clamp(0.12 + 0.55 * I * (0.5 + 0.5 * Math.sin(col * 0.55 + bt * Math.PI * 0.5)) * (0.6 + 0.4 * kick) + 0.3 * I * hash(col * 131 + step * 7));
            v = row < h ? 1 : row < h + 1 ? 0.3 : 0.03; m = row / ROWS * 1.1;
          } else if (pat === 1) {
            const d = Math.hypot(col - 23.5, (row - 10.5) * 1.25);
            const ph = d * 0.3 - bt * ringSpeed;
            v = Math.pow(0.5 + 0.5 * Math.cos(ph * TAU), 6) + 0.03; m = Math.floor(ph);
          } else if (pat === 2) {
            v = ((Math.floor(col / 4) + Math.floor(row / 4) + Math.floor(bt)) & 1) ? 1 : 0.05; m = Math.floor(bt / 4) + (Math.floor(col / 4) & 1) * 1.0;
          } else if (pat === 3) {
            v = mask[idx] ? 1.2 : 0.03 + 0.12 * Math.pow(0.5 + 0.5 * Math.sin((col + row) * 0.5 - bt * Math.PI), 4); m = col / COLS * 2 + bt * 0.25;
          } else {
            v = Math.pow(0.5 + 0.5 * Math.sin(col * 0.35 + row * 0.35 - bt * Math.PI) * Math.sin(col * 0.12 - row * 0.2 + bt * 0.5), 3) * 1.2 + 0.02; m = (row + col) / 30 + bt * 0.125;
          }
          pal(m);
          const g = v * wGain;
          led.instanceColor.setXYZ(idx, cr * g + white, cg * g + white, cb * g + white);
          const sz = 0.5 + 1.6 * clamp(v);
          H.put(led, idx, WX0 + col * PITCH, WY0 + row * PITCH, WZ + sz * U * 0.5, 1.5, 1.5, sz);
        }
        led.instanceMatrix.needsUpdate = true; led.instanceColor.needsUpdate = true;

        // ---- booth VU meter
        const vu = clamp((0.25 + 0.75 * kick) * (0.4 + 0.8 * I) + 0.15 * hat);
        for (let i = 0; i < BC; i++) for (let j = 0; j < BR; j++) {
          const d = Math.abs(i - (BC - 1) / 2) / (BC / 2);
          const on = d < vu ? 1 : 0.06;
          pal(d * 1.2 + j * 0.5);
          boothPix.instanceColor.setXYZ(j * BC + i, cr * on, cg * on, cb * on);
        }
        boothPix.instanceColor.needsUpdate = true;

        // ---- neon strips: upward chase on tubes, pulse elsewhere
        for (let i = 0; i < neonM.count; i++) {
          const y = neonM.cells[i][1];
          const tube = y > 0 && y <= 40 && (neonM.cells[i][0] === 44 || neonM.cells[i][0] === -45);
          let k;
          if (tube) k = 0.12 + 1.6 * Math.pow(0.5 + 0.5 * Math.sin(y * 0.32 - bt * Math.PI * (chorus ? 1 : 0.5) + neonM.cells[i][2] * 0.2), 6) * (0.4 + I) + 0.6 * drop;
          else k = 0.35 + 0.9 * kick * I + 0.6 * drop;
          neonM.setRGB(i, neonBase[i * 3] * k, neonBase[i * 3 + 1] * k, neonBase[i * 3 + 2] * k);
        }
        neonM.commitColor();

        // ---- strobes: off-beat flashes only in choruses (~2/s), plus the drop
        const off = ((bt + 0.5) % 1 + 1) % 1;
        const strobe = (chorus && f.energy > 0.7 ? Math.exp(-off * spb / 0.05) * 0.8 : 0) + drop * 0.5;
        for (let i = 0; i < 8; i++) {
          const on = chorus ? ((i + Math.floor(bt)) & 1 ? 1 : 0.35) : 1;
          const k = 0.12 + 3 * strobe * on;
          strobes.instanceColor.setXYZ(i, k, k, k);
        }
        strobes.instanceColor.needsUpdate = true;
        strobeL.intensity = 3 * strobe;
        washL.intensity = 1.2 + 4 * kick * I + 3 * drop; washR.intensity = 1.2 + 4 * snare * I + 1.5 * hat * I + 3 * drop;

        // ---- mirror ball sparkle
        const sp = Math.floor(f.t * 12);
        for (let i = 0; i < ball.count; i++) {
          const hsh = hash(i * 977 + sp * 31);
          let k = 0.45 + 0.25 * ballSeed[i];
          if (hsh > 0.93 - 0.05 * I) { pal(ballSeed[i] * 3); ball.setRGB(i, cr * 2.5 + 0.8, cg * 2.5 + 0.8, cb * 2.5 + 0.8); }
          else ball.setRGB(i, k, k, k * 1.08);
        }
        ball.commitColor();

        // ---- lasers
        const bar = f.bar;
        if (bar !== lastBar) {
          lastBar = bar;
          lasers.forEach((L, n) => L.bm.setColor(L.top ? ((bar >> 1) & 1 ? CY : VI) : ((n + bar) % 3 === 0 ? VI : (n + bar) & 1 ? MG : CY)));
        }
        const sweepB = chorus ? Math.sin(bt * Math.PI / 4) : Math.sin(lp * TAU * 8);
        for (const L of lasers) {
          let a, e;
          if (!L.top) {
            const spread = 0.16 + 0.1 * Math.sin(lp * TAU * 4) + 0.08 * build;
            a = -L.s * 0.25 + (L.i - 1.5) * spread * (1 - build * 0.8) + 0.35 * sweepB * L.s;
            e = 0.3 + 0.12 * Math.sin(lp * TAU * 10 + L.i) + 0.15 * build;
          } else {
            a = -L.s * 0.35 + 0.5 * Math.sin(lp * TAU * 6 + L.i * 1.7 + (L.s > 0 ? 0 : Math.PI));
            e = -0.32 - 0.1 * Math.sin(lp * TAU * 5 + L.i);
          }
          dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
          L.bm.group.quaternion.setFromUnitVectors(DOWN, dir);
          const on = chorus ? 1 : f.section === 'bridge' ? (L.top ? 0.6 : 0.1) : ((L.i + bar) & 1 ? 0.8 : 0.25);
          L.bm.setOpacity(clamp((0.06 + 0.22 * I + 0.25 * kick * I + 0.3 * drop + 0.25 * build) * on, 0, 0.75));
        }

        // ---- smoke drift (periodic with the loop)
        for (let i = 0; i < SMK; i++) {
          const d = SD[i];
          const x = d.x + 0.9 * Math.sin(lp * TAU * d.k + d.ph), z = d.z + 0.3 * Math.cos(lp * TAU * d.k + d.ph);
          const s = d.s * (0.9 + 0.1 * Math.sin(lp * TAU * 3 + d.ph));
          H.put(smoke, i, x, d.y, z, s, s * 0.45, s, 0, lp * TAU * d.k * (i & 1 ? 1 : -1) + d.ph, 0);
          const k = (0.5 + 0.8 * I + 0.6 * kick * I) * (f.section === 'bridge' ? 1.4 : 1);
          smoke.instanceColor.setXYZ(i, smokeCol[i * 3] * k, smokeCol[i * 3 + 1] * k, smokeCol[i * 3 + 2] * k);
        }
        smoke.instanceMatrix.needsUpdate = true; smoke.instanceColor.needsUpdate = true;

        // ---- floor, crowd, particles
        const fm = chorus ? 'ripple' : f.section === 'bridge' ? 'wave' : f.section === 'verse' ? 'checker' : 'rainbow';
        floor.update(f, fm, 0.18 + 0.3 * I + 0.3 * kick * I + 0.25 * drop);
        crowd.update(f, f.section === 'bridge' ? 'wave' : 'jump', 0.9);
        streamers.update(f, chorus ? clamp(0.5 + f.energy * 0.5) : build * 0.6);
        specks.update(f);
      },
    };
  },
};
