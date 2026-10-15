// HIP-HOP: night street corner. Brick wall with a big BOOM graffiti piece, chain-link fence, alley facades with lit windows,
// city skyline + sweeping searchlights, street lamp with a warm light pool, wet puddles that reflect the neon, speaker stacks,
// a boombox with a live EQ, vinyl crate, neon "AI FM" sign, nodding crowd. Drummer plays the DJ decks.
// Deterministic: build uses ctx.rng, update is a pure function of f.
export default {
  id: 'hiphop',
  label: 'Hip-Hop',
  idleBpm: 92,
  palette: { skyTop: 0x05071a, skyBottom: 0x2a1240, glow: 0x4a1660, accent: 0xff3d8b, flash: 0xffc23d },
  lights: { hemi: [0x8a96ff, 0x1a0f1c, 0.5], key: [0xffd2a8, 1.3], rim: [0xff3d8b, 1.0] },
  fog: { color: 0x140b24, near: 28, far: 85 },
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.78 },
  exposure: 1.08,
  cam: { punch: 1.35, shake: 0.25 },
  band: {
    guitar: 'keytar', bass: 'bass', drums: 'decks',
    colors: { guitar: 0xf5c542, bass: 0x1e1e26, kit: 0x1c1c22, accent: 0xffd24a, glow: 0xff3d8b },
    costumes: {
      guitar: [['capBack', 0xd9261c, 0xf2f2f2], ['chain', 0xffd24a]],
      bass: [['beanie', 0x1e1e26, 0xffc23d], ['shades', 0x0e0e12], ['chain', 0xe8e8f0]],
      drums: [['headphones', 0x222228, 0xff3d8b], ['shades', 0x0e0e12], ['chain', 0xffd24a]],
    },
    moves: { guitar: 'nod', bass: 'nod', drums: 'nod', intensity: 1.35 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, voxelText, U, mixHex, shade, hash, smoothstep } = V;
    const group = new THREE.Group();
    const r = rng(808);
    const PV = [0, -0.5, 0];                         // cell y=0 sits on the floor (y=0)
    const add = (b, { x = 0, y = 0, z = 0, s = 1, ry = 0, ...o } = {}) => {
      const m = b.build({ anchor: 'none', pivot: PV, jitter: 0.04, seed: 7, ...o });
      m.group.position.set(x, y, z); m.group.scale.setScalar(s); m.group.rotation.y = ry;
      group.add(m.group);
      return m;
    };
    const _c = new THREE.Color();
    /** per-instance base colours of a model so update() can relight it without allocating */
    const baseOf = (m) => { const a = new Float32Array(m.count * 3); m.cells.forEach((cell, i) => { _c.setHex(cell[3]); a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }); return a; };
    const relight = (m, base, g) => { for (let i = 0; i < m.count; i++) m.setRGB(i, base[i * 3] * g, base[i * 3 + 1] * g, base[i * 3 + 2] * g); m.commitColor(); };

    const pink = 0xff3d8b, gold = 0xffc23d, cyan = 0x3de0ff, ink = 0x111116, steel = 0x7a808c, iron = 0x1c1c22;
    const lampX = -6.7, lampZ = -0.6;

    /* ---------------- street floor (2x cells): sidewalk, curb, asphalt with lane paint, lamp light pool, puddles */
    const floor = new Builder(), wet = new Builder();
    const puddles = [[-6.0, -0.2, 1.7, 0.9], [4.8, 6.3, 1.4, 0.7], [-1.2, 10.8, 1.8, 0.6], [7.6, -2.0, 1.0, 0.8]];
    for (let x = -27; x < 27; x++) for (let z = -20; z < 35; z++) {
      const wx = x * 0.4, wz = z * 0.4, h = hash(x * 733 + z * 97 + 5000);
      let col;
      if (z < 11) col = (((x + 300) % 3 === 0) || ((z + 300) % 3 === 0)) ? 0x26272f : shade(0x3a3b45, 0.85 + 0.25 * h);
      else if (z === 11) col = 0x6a6b75;
      else if (z === 24 && ((x + 300) % 6) < 3) col = 0xc9a227;
      else col = shade(0x1b1c23, 0.8 + 0.4 * h);
      const lk = Math.pow(Math.max(0, 1 - Math.hypot(wx - lampX, wz - lampZ) / 4.4), 1.4);
      const inP = puddles.some(([px, pz, rx, rz]) => ((wx - px) / rx) ** 2 + ((wz - pz) / rz) ** 2 < 1 - 0.25 * hash(x * 31 + z));
      if (inP) wet.cell(x, -1, z, 0x0d1322);
      else floor.cell(x, -1, z, shade(mixHex(col, 0xffb565, 0.45 * lk), 1 + 1.1 * lk));
    }
    add(floor, { s: 2, jitter: 0.05, castShadow: false });
    const wetM = add(wet, { s: 2, jitter: 0, castShadow: false, emissive: 0.25 });
    const wetK = new Float32Array(wetM.count), wetP = new Float32Array(wetM.count);
    wetM.cells.forEach(([x, , z], i) => { wetK[i] = Math.max(0, 1 - Math.hypot(x * 0.4 - lampX, z * 0.4 - lampZ) / 3.6); wetP[i] = x * 0.9 + z * 0.6; });
    // ground behind the wall (4x cells)
    const back = new Builder();
    for (let x = -20; x < 20; x++) for (let z = -30; z < -10; z++) if (Math.abs(x) > 7 || z < -18) back.cell(x, -1, z, shade(0x15151d, 0.85 + 0.3 * hash(x * 13 + z * 7)));
    add(back, { s: 4, jitter: 0, castShadow: false });

    /* ---------------- brick wall (recessed mortar) + cap + pilasters */
    const wall = new Builder();
    const bricks = [0x7a3326, 0x8a3b2a, 0x6b2c22, 0x5a2622, 0x93432e];
    for (let x = -32; x <= 32; x++) for (let y = 0; y < 32; y++) {
      const row = Math.floor(y / 3), off = (row & 1) * 3;
      if (y % 3 === 2 || (x + off + 600) % 6 === 5) { wall.cell(x, y, -31, 0x3e353d); continue; }
      const id = row * 97 + Math.floor((x + off + 600) / 6);
      const grime = 0.5 + 0.5 * smoothstep(y / 16);
      wall.cell(x, y, -30, shade(bricks[Math.floor(hash(id) * 5)], grime * (0.85 + 0.3 * hash(id + 7))));
    }
    wall.box(-33, 32, -32, 67, 2, 4, 0x4a4a54);
    wall.box(-36, 0, -32, 3, 35, 4, 0x34343e).box(34, 0, -32, 3, 35, 4, 0x34343e);
    add(wall, { jitter: 0.03, castShadow: false });

    /* ---------------- graffiti (painted relief one cell proud of the bricks) */
    const gB = new Builder(), gKind = new Map();
    const paint = (str, ox, oy, s, shear, pals, wobble = 0) => {
      const t = voxelText(str, { depth: 1, color: (ci) => ci });
      const fill = new Map();
      t.map.forEach(([x, y, , ci]) => {
        for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
          const gy = y * s + j + (wobble ? Math.round(Math.sin(ci * 2.1) * wobble) : 0), gx = x * s + i + Math.floor(gy * shear);
          fill.set(gx + ',' + gy, [gx, gy, ci]);
        }
      });
      let ymin = 1e9, ymax = -1e9; fill.forEach(([, y]) => { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
      const out = new Map();
      fill.forEach(([x, y]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const k = (x + dx) + ',' + (y + dy); if (!fill.has(k)) out.set(k, [x + dx, y + dy]); } });
      const shadowC = new Map();
      [...fill.values(), ...out.values()].forEach(([x, y]) => { const k = (x + 2) + ',' + (y - 2); if (!fill.has(k) && !out.has(k)) shadowC.set(k, [x + 2, y - 2]); });
      const put = (x, y, c, kind) => { gB.cell(ox + x, oy + y, -29, c); gKind.set((ox + x) + ',' + (oy + y), kind); };
      shadowC.forEach(([x, y]) => put(x, y, 0x3b1a5c, 2));
      out.forEach(([x, y]) => put(x, y, 0x0c0c10, 1));
      fill.forEach(([x, y, ci]) => {
        const [a, b] = pals[ci % pals.length];
        let c = mixHex(b, a, (y - ymin) / Math.max(1, ymax - ymin));
        if ((x - y + 400) % 7 === 0) c = mixHex(c, 0xffffff, 0.45);
        put(x, y, c, 0);
      });
      // drips under the lowest fill cells
      fill.forEach(([x, y, ci]) => {
        if (y !== ymin || hash(x * 17 + oy) > 0.18) return;
        const n = 2 + Math.floor(hash(x * 5 + 1) * 5), [, b] = pals[ci % pals.length];
        for (let k = 2; k < n + 2; k++) if (oy + y - k >= 0) put(x, y - k, b, 0);
      });
    };
    paint('BOOM', -27, 17, 2, 0.25, [[0xff3d8b, 0xffc23d], [0x3de0ff, 0x7d5cff], [0xffc23d, 0xff5a2a], [0x9dff3d, 0x22c4a0]], 1);
    paint('808', -30, 3, 1, 0.2, [[0x3de0ff, 0x2a6cff]]);
    paint('AI', 19, 4, 1, 0.25, [[0x9dff3d, 0xff3d8b]]);
    // crown doodle above the AI tag
    for (const [x, y] of [[19, 13], [21, 14], [23, 15], [25, 14], [27, 13], [19, 12], [20, 12], [21, 12], [22, 12], [23, 12], [24, 12], [25, 12], [26, 12], [27, 12]]) { gB.cell(x, y, -29, gold); gKind.set(x + ',' + y, 3); }
    const graf = add(gB, { jitter: 0.02, emissive: 0.35, castShadow: false, hollow: false });
    const grafBase = baseOf(graf);
    const grafFill = [], grafX = [];
    graf.cells.forEach(([x, y], i) => { if (gKind.get(x + ',' + y) === 0 && y >= 12) { grafFill.push(i); grafX.push(x); } });

    /* ---------------- chain-link fences either side of the wall */
    const fence = new Builder();
    for (const sg of [-1, 1]) {
      for (let i = 0; i <= 16; i++) {
        const x = sg * (37 + i);
        for (let y = 0; y < 21; y++) if ((i + y) % 4 === 0 || (i - y + 400) % 4 === 0) fence.cell(x, y, -30, steel);
        fence.cell(x, 21, -30, 0x9aa0ac);
      }
      for (const i of [0, 8, 16]) fence.box(sg * (37 + i), 0, -31, 1, 23, 2, 0x5a5f6a);
      for (let i = 0; i <= 16; i += 2) fence.cell(sg * (37 + i), 23 + (i % 4 ? 1 : 0), -30, 0x9aa0ac); // barbed wire
    }
    add(fence, { jitter: 0.03, castShadow: true });

    /* ---------------- alley facades (2x cells) with windows + fire escape */
    const fac = new Builder(), facWin = new Builder();
    const facCols = { '-1': 0x3a2228, '1': 0x262a38 };
    for (const sg of [-1, 1]) {
      const fx = sg * 27;
      for (let z = -20; z <= 10; z++) for (let y = 0; y < 26; y++) {
        const isWin = (z + 40) % 5 < 2 && y % 6 >= 2 && y % 6 <= 4 && y > 1 && z < 9;
        if (isWin) {
          const h = hash(sg * 991 + z * 37 + Math.floor(y / 6) * 101);
          facWin.cell(fx, y, z, h < 0.4 ? [0xffc46b, 0xffe3a0, 0xffb060, 0x8fd8ff][Math.floor(h * 10)] : 0x0e111a);
        } else fac.cell(fx, y, z, shade(facCols[sg], 0.8 + 0.35 * hash(z * 13 + y * 7 + sg)));
        if (isWin && y % 6 === 2) fac.cell(fx - sg, y - 1, z, 0x55555f);                  // sill
      }
      fac.box(fx - sg, 26, -20, 1, 1, 31, 0x4a4a54);                                     // cornice
    }
    // fire escape on the left facade
    for (const y of [7, 13, 19]) {
      fac.box(-26, y, -15, 2, 1, 9, iron);
      for (let z = -15; z <= -7; z++) fac.cell(-24, y + 2, z, iron);
      for (let z = -15; z <= -7; z += 2) fac.cell(-24, y + 1, z, iron);
      if (y < 19) fac.line(-25, y + 1, -8, -25, y + 6, -13, iron);
    }
    add(fac, { s: 2, jitter: 0.03, castShadow: false });
    const facWinM = add(facWin, { s: 2, jitter: 0, emissive: 1.0, castShadow: false, hollow: false });
    const facWinBase = baseOf(facWinM);

    /* ---------------- skyline (3x cells) with twinkling windows, water towers, blinking antennas */
    const sky = new Builder(), skyWin = new Builder(), tips = new Builder();
    for (let x = -52; x < 52;) {
      const w = 3 + Math.floor(r() * 5), far = Math.abs(x) / 52;
      const h = 7 + Math.floor(r() * 22 * (1 - 0.35 * far));
      const c = shade(mixHex(0x0e1228, 0x1d1234, r()), 0.8 + 0.4 * r());
      const lit = 0.25 + r() * 0.3, warm = r() < 0.6;
      for (let i = 0; i < w; i++) for (let y = 0; y < h; y++) {
        if (i % 2 === 1 && y % 2 === 1 && i < w - 1 && y < h - 1 && y > 2 && r() < lit) skyWin.cell(x + i, y, -30, warm ? (r() < 0.7 ? 0xffc46b : 0xfff0c0) : (r() < 0.5 ? 0x8fd8ff : 0xff8fb8));
        else sky.cell(x + i, y, -30, c);
      }
      const roll = r();
      if (roll < 0.25) { sky.box(x + 1, h, -30, 1, 1, 1, iron).box(x + 1, h + 1, -30, 2, 2, 1, 0x3a2a26); }
      else if (roll < 0.55) { sky.box(x + Math.floor(w / 2), h, -30, 1, 3, 1, iron); tips.cell(x + Math.floor(w / 2), h + 3, -30, 0xff2a2a); }
      x += w + (r() < 0.3 ? 1 : 0);
    }
    // second, taller and further skyline row for depth
    for (let x = -40; x < 40;) {
      const w = 4 + Math.floor(r() * 5), h = 14 + Math.floor(r() * 18);
      for (let i = 0; i < w; i++) for (let y = 8; y < h; y++) sky.cell(x + i, y, -36, shade(0x15102a, 0.8 + 0.2 * r()));
      if (r() < 0.5) tips.cell(x + Math.floor(w / 2), h, -36, 0xff2a2a);
      x += w + 2 + Math.floor(r() * 3);
    }
    add(sky, { s: 3, jitter: 0.02, castShadow: false, receiveShadow: false });
    const skyWinM = add(skyWin, { s: 3, jitter: 0, emissive: 1.2, castShadow: false, hollow: false });
    const skyWinBase = baseOf(skyWinM);
    const tipsM = add(tips, { s: 3, jitter: 0, emissive: 2.0, castShadow: false, hollow: false });
    const tipsBase = baseOf(tipsM);

    // searchlights sweeping the sky behind the skyline (chorus)
    const search = [-1, 1].map((sg, i) => {
      const bm = H.beam({ color: i ? 0xbfe8ff : 0xffd0f0, length: 34, radius: 2.6, opacity: 0.05 });
      bm.group.position.set(sg * 12, 0.5, -24);
      group.add(bm.group);
      return bm;
    });

    /* ---------------- street lamp */
    const lamp = new Builder();
    lamp.box(-2, 0, -2, 4, 2, 4, iron).box(-1, 2, -1, 2, 31, 2, 0x2a2c34).box(-1, 33, -1, 10, 2, 2, 0x2a2c34).box(6, 31, -2, 5, 2, 4, iron);
    lamp.box(-2, 12, -2, 4, 1, 4, iron);
    add(lamp, { x: -8.4, z: lampZ, jitter: 0.02 });
    const bulb = add(new Builder().box(7, 30, -1, 3, 1, 2, 0xffd08a), { x: -8.4, z: lampZ, jitter: 0, emissive: 2.2, castShadow: false });
    const bulbBase = baseOf(bulb);
    const lampBeam = H.beam({ color: 0xffb860, length: 6.1, radius: 2.1, opacity: 0.1 });
    lampBeam.group.position.set(lampX, 6.0, lampZ); group.add(lampBeam.group);
    const lampLight = new THREE.PointLight(0xffb060, 16, 11, 1.4); lampLight.position.set(lampX, 5.2, lampZ);
    const pinkLight = new THREE.PointLight(pink, 6, 13, 1.5); pinkLight.position.set(5.5, 3.6, -1.5);
    group.add(lampLight, pinkLight);

    /* ---------------- speaker stacks with pumping woofers */
    const woofers = [];
    const ledB = new Builder();
    const woofer = (rr) => { const b = new Builder(); b.disc(0, 0, 0, rr, 1, (x, y) => { const d = Math.hypot(x, y); return d > rr - 0.7 ? 0xa0a6b2 : d < 1.1 ? 0x6a6a76 : 0x1c1c22; }); return b; };
    for (const sg of [-1, 1]) {
      const sx = sg * 7.5, sz = -4.3, ry = -sg * 0.3;
      const st = new Builder();
      st.box(-5, 0, -3, 10, 8, 6, 0x1a1a20).box(-5, 8, -3, 10, 8, 6, 0x1d1d24).box(-4, 16, -2, 8, 4, 5, 0x22222a);
      st.box(-5, 7, 3, 10, 1, 1, 0x8a8f9a).box(-5, 0, 3, 1, 16, 1, 0x8a8f9a).box(4, 0, 3, 1, 16, 1, 0x8a8f9a).box(-2, 17, 3, 4, 2, 1, 0x101014);
      add(st, { x: sx, z: sz, ry, jitter: 0.03 });
      ledB.box(-5, 15, 3, 10, 1, 1, pink).box(-5, 0, 3, 10, 1, 1, cyan);
      const holder = new THREE.Group(); holder.position.set(sx, 0, sz); holder.rotation.y = ry; group.add(holder);
      for (const wy of [4, 12]) {
        const wm = woofer(3.4).build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02 });
        wm.group.position.set(0, wy * U, 3.0 * U); holder.add(wm.group); woofers.push(wm);
      }
      const led = ledB.build({ anchor: 'none', pivot: PV, jitter: 0, emissive: 1.6, castShadow: false });
      ledB.map.clear();
      holder.add(led.group); woofers.push({ led, base: baseOf(led) });
    }

    /* ---------------- boombox with a live EQ */
    const bbG = new THREE.Group(); bbG.position.set(7.4, 0, 2.4); bbG.rotation.y = -0.75; bbG.scale.setScalar(0.78); group.add(bbG);
    const bb = new Builder();
    bb.box(-8, 0, -2, 16, 9, 4, 0x1d1f27).box(-8, 8, -2, 16, 1, 4, 0x9aa0ac).box(-8, 0, -2, 16, 1, 4, 0x2a2c36);
    bb.box(-6, 9, 0, 1, 3, 1, 0x9aa0ac).box(5, 9, 0, 1, 3, 1, 0x9aa0ac).box(-6, 12, 0, 12, 1, 1, 0x9aa0ac);
    bb.box(-2, 4, 2, 4, 3, 1, 0x2c2f3a).box(-1, 5, 3, 2, 1, 1, 0x4ad0ff);
    for (let i = 0; i < 4; i++) bb.cell(-2 + i, 7, 2, i % 2 ? 0xd9261c : 0x9aa0ac);
    const bbM = bb.build({ anchor: 'none', pivot: PV, jitter: 0.03 }); bbG.add(bbM.group);
    const bbWoof = [-5, 5].map((wx) => { const m = woofer(2.6).build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02 }); m.group.position.set(wx * U, 4.6 * U, 2.2 * U); bbG.add(m.group); woofers.push(m); return m; });
    const EQN = 4;
    const eq = H.instanced(EQN, { emissive: 1.6 }); eq.frustumCulled = false; bbG.add(eq);
    for (let j = 0; j < EQN; j++) eq.setColorAt(j, _c.setHex([cyan, 0x9dff3d, gold, pink][j]));
    eq.instanceColor.needsUpdate = true;

    /* ---------------- vinyl: milk crate of records + a stack on the floor */
    const crate = new Builder();
    for (let x = -3; x <= 3; x++) for (let y = 0; y < 5; y++) for (let z = -3; z <= 3; z++) {
      const edge = Math.abs(x) === 3 || Math.abs(z) === 3 || y === 0;
      if (!edge) continue;
      const hole = y > 0 && y < 4 && (x + z + y) % 2 === 0 && Math.abs(x) + Math.abs(z) < 6;
      if (!hole) crate.cell(x, y, z, 0x2b6cb0);
    }
    const sleeves = [0xffc23d, 0xff3d8b, 0x3de0ff, 0xf2f2f2, 0x9dff3d];
    for (let k = 0; k < 5; k++) crate.box(-2, 1, -2 + k, 5, 6 - (k % 2), 1, sleeves[k]);
    add(crate, { x: -5.2, z: 5.4, ry: 0.3 });
    const stack = new Builder();
    for (let k = 0; k < 6; k++) { const ox = k % 2 ? 1 : 0, oz = k % 3 === 1 ? 1 : 0; stack.flatDisc(ox, oz, k, 3.3, 1, 0x111114); stack.flatDisc(ox, oz, k, 1.0, 1, sleeves[k % 5]); }
    stack.box(-4, 0, 3, 7, 7, 1, 0xff3d8b).box(-3, 1, 4, 5, 5, 1, 0x111114);           // leaning sleeve with a record
    add(stack, { x: -7.4, z: 6.0, ry: -0.4 });

    /* ---------------- hydrant, cones, neon sign */
    const misc = new Builder();
    misc.box(-1, 0, -1, 3, 1, 3, 0xb01e1e).box(-1, 1, -1, 3, 4, 3, 0xd9261c).box(-2, 3, 0, 5, 1, 1, 0xd9261c).box(0, 5, 0, 1, 1, 1, 0xffc23d);
    add(misc, { x: 8.8, z: 5.0 });
    const cone = new Builder().box(-2, 0, -2, 4, 1, 4, 0x1a1a1f).box(-1, 1, -1, 3, 2, 3, 0xff6a1a).box(-1, 3, -1, 3, 1, 3, 0xf2f2f2).box(0, 4, 0, 1, 2, 1, 0xff6a1a);
    add(cone, { x: 8.9, z: 6.6 }); add(cone, { x: -9.0, z: 7.0, ry: 0.4 });

    const board = new Builder().box(-18, 0, -1, 37, 11, 1, 0x101014).box(-14, -6, -1, 1, 6, 1, iron).box(14, -6, -1, 1, 6, 1, iron);
    add(board, { x: 8.8, y: 4.7, z: -6.1, s: 0.5, jitter: 0.02 });
    const neonB = new Builder();
    voxelText('AI FM', { depth: 1 }).map.forEach(([x, y]) => neonB.cell(x - 14, y + 2, 0, pink));
    for (let x = -17; x <= 17; x++) { neonB.cell(x, 0, 0, cyan); neonB.cell(x, 10, 0, cyan); }
    for (let y = 0; y <= 10; y++) { neonB.cell(-17, y, 0, cyan); neonB.cell(17, y, 0, cyan); }
    const neon = add(neonB, { x: 8.8, y: 4.7, z: -5.98, s: 0.5, jitter: 0, emissive: 2.0, castShadow: false, hollow: false });
    const neonBase = baseOf(neon);
    const neonIsText = new Uint8Array(neon.count); neon.cells.forEach((c, i) => { neonIsText[i] = c[3] === pink ? 1 : 0; });

    /* ---------------- crowd + dust */
    const crowd = H.crowd({ rows: 3, cols: 17, spacing: 0.9, z0: 8.3, scale: 0.72, y0: 0, palette: [0x1c1c24, 0x2b2b36, pink, gold, cyan, 0x5a5a66, 0x8a1f3c, 0xf2f2f2], style: 'nod', hands: 0.5, seed: 21, rowStep: 0.92, rise: 0.12 });
    group.add(crowd.group);
    const lampDust = H.confetti({ count: 36, colors: [0xffd08a, 0xffe6c0, 0xffb060], origin: [lampX, 0.3, lampZ], spread: [3.6, 3.6], mode: 'rise', up: 0.42, life: 12, size: 0.05, emissive: 1.6, seed: 31, sway: 0.35 });
    const dust = H.confetti({ count: 40, colors: [0xffffff, 0xffc8e0, 0xbfe8ff], origin: [0, 0.2, -1], spread: [17, 9], mode: 'rise', up: 0.3, life: 15, size: 0.04, emissive: 1.2, seed: 32, sway: 0.5 });
    for (const p of [lampDust, dust]) group.add(p.group);

    const TAU = Math.PI * 2;
    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.14), snare = f.env('drums', ['s', 'cl'], 0.12), hat = f.env('drums', ['h', 'o'], 0.07), crash = f.env('drums', 'c', 0.6);
        const ch = f.section === 'chorus' ? 1 : f.section === 'bridge' ? 0.45 : 0.12;
        const E = f.energy, L = f.loopP * TAU;

        // woofers pump on kicks, LED strips flash
        for (const w of woofers) {
          if (w.led) { relight(w.led, w.base, 0.45 + 1.3 * kick * (0.5 + E) + 0.3 * ch); continue; }
          const s = 1 + 0.1 * kick * (0.6 + E);
          w.group.scale.set(s, s, 1 + 2.5 * kick);
        }
        // boombox EQ: four bars driven by kick / snare / hats / bass
        const bassE = Math.exp(-Math.min(9, f.since('bass')) / 0.25);
        const lv = [kick, bassE * 0.9, snare, hat];
        for (let j = 0; j < EQN; j++) {
          const h = 0.05 + 0.5 * Math.min(1, lv[j] * (0.5 + 0.6 * E) + 0.12 * (0.5 + 0.5 * Math.sin(f.beat * Math.PI + j)));
          H.putW(eq, j, (j - 1.5) * 0.24, 0.22 + h / 2, 0.42, 0.18, h, 0.1);
        }
        eq.instanceMatrix.needsUpdate = true;

        // graffiti: snare flash + a highlight that sweeps across BOOM once per bar
        const sweep = -30 + ((f.beat / 4) % 1) * 66;
        const gG = 0.8 + (0.35 + 0.8 * ch) * snare * (0.4 + E) + 0.25 * crash;
        for (let n = 0; n < grafFill.length; n++) {
          const i = grafFill[n], d = Math.abs(grafX[n] - sweep);
          const hl = d < 4 ? (1 - d / 4) * (0.25 + 0.5 * ch) : 0;
          graf.setRGB(i, grafBase[i * 3] * gG + hl, grafBase[i * 3 + 1] * gG + hl, grafBase[i * 3 + 2] * gG + hl);
        }
        graf.commitColor();

        // windows: a subset switches on/off every ~1.5 s; facade windows breathe with the kick in choruses
        const slot = Math.floor(f.loopP * 40);
        for (let i = 0; i < skyWinM.count; i++) {
          const on = hash(i * 7 + 3) < 0.25 ? (hash(i * 131 + slot * 17) > 0.4 ? 1 : 0.05) : 1;
          const g = on * (0.75 + 0.25 * Math.sin(L * 3 + i));
          skyWinM.setRGB(i, skyWinBase[i * 3] * g, skyWinBase[i * 3 + 1] * g, skyWinBase[i * 3 + 2] * g);
        }
        skyWinM.commitColor();
        const fg = 0.8 + 0.5 * kick * ch;
        for (let i = 0; i < facWinM.count; i++) {
          const on = hash(i * 11 + 1) < 0.3 ? (hash(i * 53 + Math.floor(f.loopP * 24) * 29) > 0.5 ? 1 : 0.15) : 1;
          const g = on * fg;
          facWinM.setRGB(i, facWinBase[i * 3] * g, facWinBase[i * 3 + 1] * g, facWinBase[i * 3 + 2] * g);
        }
        facWinM.commitColor();
        for (let i = 0; i < tipsM.count; i++) { const g = Math.sin(L * 30 + i * 1.7) > 0.55 ? 1.4 : 0.12; tipsM.setRGB(i, tipsBase[i * 3] * g, tipsBase[i * 3 + 1] * g, tipsBase[i * 3 + 2] * g); }
        tipsM.commitColor();

        // neon: buzz flicker in verses, colour swap per bar in choruses, kick pulse
        const flick = ch < 0.5 && hash(Math.floor(f.t * 14) + 99) < 0.06 ? 0.2 : 1;
        const swap = ch > 0.9 && (f.bar & 1);
        const ng = flick * (0.85 + 0.6 * kick);
        for (let i = 0; i < neon.count; i++) {
          const k = neonIsText[i] ? ng : 0.7 + 0.5 * hat;
          if (swap) neon.setRGB(i, neonBase[i * 3 + 2] * k * 1.2, neonBase[i * 3 + 1] * k, neonBase[i * 3] * k);
          else neon.setRGB(i, neonBase[i * 3] * k, neonBase[i * 3 + 1] * k, neonBase[i * 3 + 2] * k);
        }
        neon.commitColor();

        // street lamp: steady warm with an occasional sodium buzz
        const buzz = ch < 0.5 && hash(Math.floor(f.t * 20) + 7) < 0.025 ? 0.4 : 1;
        lampLight.intensity = 16 * buzz * (1 + 0.15 * snare);
        lampBeam.setOpacity(0.035 + 0.08 * buzz);
        relight(bulb, bulbBase, buzz);
        pinkLight.intensity = 3 + 16 * kick * (0.4 + E) + 5 * ch;
        pinkLight.color.setHex(swap ? cyan : pink);

        // puddles reflect lamp + neon, ripple slowly
        for (let i = 0; i < wetM.count; i++) {
          const lk = wetK[i], rip = 0.5 + 0.5 * Math.sin(L * 12 + wetP[i]);
          const pk = (0.12 + 0.55 * kick * (0.4 + E)) * (1 - lk) * (0.6 + 0.4 * rip);
          const wk = lk * (0.7 + 0.2 * rip);
          wetM.setRGB(i, 0.02 + pk * (swap ? 0.1 : 1) + wk * 1.0, 0.03 + pk * (swap ? 0.8 : 0.15) + wk * 0.55, 0.06 + pk * (swap ? 1 : 0.45) + wk * 0.2);
        }
        wetM.commitColor();

        // searchlights sweep the sky (mostly in choruses)
        search.forEach((bm, i) => {
          bm.group.rotation.set(-0.25 + 0.15 * Math.sin(L * 3 + i), 0, Math.PI + (i ? -1 : 1) * 0.3 + 0.38 * Math.sin(L * 4 + i * 2.2));
          bm.setOpacity(0.02 + 0.12 * ch * (0.6 + 0.4 * E) + 0.05 * crash);
        });

        crowd.update(f, 'nod', 0.15 + 0.6 * ch);
        lampDust.update(f, 1);
        dust.update(f, 0.5 + 0.5 * E);
      },
    };
  },
};
