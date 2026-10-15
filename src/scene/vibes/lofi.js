// LO-FI: a cozy night bedroom-studio diorama. Big window with rain, drifting clouds, moon and a sleepy city; desk with a
// glowing monitor (live waveform), desk lamp and steaming coffee; bookshelf, record player spinning at 33 rpm, wall clock
// whose minute hand turns once per loop, string lights that chase on the beat, plants, a sleeping cat on the sill and two
// sleepy critters on floor cushions puffing Z's. Deterministic: build uses ctx.rng, update is a pure function of f.
export default {
  id: 'lofi',
  label: 'Lo-Fi',
  idleBpm: 78,
  palette: { skyTop: 0x0b0e22, skyBottom: 0x171230, glow: 0x2a2a52, accent: 0xffb35a, flash: 0xffd9a0 },
  lights: { hemi: [0x9fb8d8, 0x2a1a20, 0.42], key: [0xffd2a0, 0.95], rim: [0x6fd6d0, 1.1] },
  fog: { color: 0x0e1024, near: 30, far: 80 },
  bloom: { strength: 0.45, radius: 0.7, threshold: 0.82 },
  exposure: 1.02,
  cam: { punch: 0.25, shake: 0 },
  band: {
    guitar: 'acoustic', bass: 'bass', drums: 'pads',
    colors: { guitar: 0xc58a52, bass: 0x2f8f8a, kit: 0x2b2b30, accent: 0xf3e3c3, glow: 0xffa860 },
    costumes: {
      guitar: [['headphones', 0xf3e3c3, 0xffa060], ['scarf', 0x2f8f8a, 0xf3e3c3]],
      bass: [['beanie', 0x9a7bd0, 0xe0d7ff], ['scarf', 0xe0a040, 0xf3e3c3]],
      drums: [['beanie', 0x2f8f8a, 0xf3e3c3], ['scarf', 0xc0504d, 0xf3e3c3]],
    },
    moves: { guitar: 'sway', bass: 'sway', drums: 'sway', intensity: 0.55 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, U, mixHex, shade, hash } = V;
    const group = new THREE.Group();
    const r = rng(4530);
    const PV = [0, -0.5, 0];                       // cell y=0 sits on the floor
    const add = (b, { x = 0, y = 0, z = 0, s = 1, ry = 0, parent = group, ...o } = {}) => {
      const m = b.build({ anchor: 'none', pivot: PV, jitter: 0.04, seed: 9, ...o });
      m.group.position.set(x, y, z); m.group.scale.setScalar(s); m.group.rotation.y = ry;
      parent.add(m.group);
      return m;
    };
    const holder = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; group.add(g); return g; };
    const _c = new THREE.Color();
    const baseOf = (m) => { const a = new Float32Array(m.count * 3); m.cells.forEach((cell, i) => { _c.setHex(cell[3]); a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }); return a; };
    const colorize = (mesh, cols) => { cols.forEach((h, i) => mesh.setColorAt(i, _c.setHex(h))); mesh.instanceColor.needsUpdate = true; };

    const wood = 0x8a5a3a, darkWood = 0x4a3328, cream = 0xf3e3c3, ink = 0x1c1a22, teal = 0x2f8f8a, amber = 0xffb35a;
    const greens = [0x3f8f4a, 0x2f7a40, 0x4fa858, 0x276a38];

    /* ---------------- wooden floor (2x cells) with an oval rug */
    const fl = new Builder();
    const rugC = [0xe8c07a, teal, cream, 0xc0504d, teal, 0xe8c07a, 0x6a4a8a];
    for (let x = -25; x < 25; x++) for (let z = -15; z < 24; z++) {
      const wx = x * 0.4, wz = z * 0.4;
      const d = Math.hypot(wx / 5.4, (wz + 1.0) / 3.9);
      let col;
      if (d < 1) col = d > 0.93 ? cream : shade(rugC[Math.floor(d * 7) % rugC.length], 0.92 + 0.12 * hash(x * 7 + z * 3));
      else {
        const seam = (x + Math.floor(hash(z * 31 + 7) * 9) + 300) % 8 === 0;
        col = seam ? 0x3a2618 : shade([0x7a5034, 0x8a5c3c, 0x6e4830][(z + 30) % 3], 0.85 + 0.25 * hash(x * 13 + z * 101));
      }
      fl.cell(x, -1, z, col);
      if (z === 23 || x === -25 || x === 24) for (let y = -3; y <= -2; y++) fl.cell(x, y, z, 0x3a2618);
    }
    add(fl, { s: 2, jitter: 0.04, castShadow: false });

    /* ---------------- back wall (2x cells) with a big window + left wall */
    const wall = new Builder(), frame = new Builder();
    const paper = (x, y) => (y <= 2 ? shade(darkWood, 0.9 + 0.2 * hash(x * 5)) : y === 3 ? 0xd8c4a0 : y === 23 ? 0xd8c4a0 : ((x + 100) % 4 === 0 ? 0x46334f : ((x + y) % 6 === 0 ? 0x4a3658 : 0x3d2c48)));
    for (let x = -25; x < 25; x++) for (let y = 0; y < 24; y++) {
      if (x >= -10 && x <= 10 && y >= 5 && y <= 18) continue;           // window opening
      wall.cell(x, y, -16, paper(x, y));
    }
    for (let z = -16; z <= 4; z++) for (let y = 0; y < 24; y++) wall.cell(-26, y, z, paper(z, y));
    for (let y = 0; y < 24; y++) wall.cell(-26, y, 5, 0xd8c4a0);           // wall end trim
    add(wall, { s: 2, jitter: 0.03, castShadow: false });
    // window frame, mullions, sill
    for (let y = 4; y <= 19; y++) { frame.cell(-11, y, -15, cream); frame.cell(11, y, -15, cream); }
    for (let x = -11; x <= 11; x++) { frame.cell(x, 19, -15, cream); }
    for (let y = 5; y <= 18; y++) frame.cell(0, y, -16, cream);
    for (let x = -10; x <= 10; x++) frame.cell(x, 12, -16, cream);
    frame.box(-12, 4, -16, 25, 1, 4, 0xe6d2b0);                           // deep sill
    add(frame, { s: 2, jitter: 0.03 });

    /* ---------------- outside: skyline, moon, clouds, stars, rain */
    const city = new Builder(), cityWin = new Builder();
    for (const [zc, hmin, hmax, tint] of [[-35, 4, 15, 0x1a1a38], [-46, 9, 24, 0x141634]]) {
      for (let x = -30; x < 30;) {
        const w = 3 + Math.floor(r() * 4), h = hmin + Math.floor(r() * (hmax - hmin));
        const c = shade(tint, 0.8 + 0.35 * r());
        for (let i = 0; i < w; i++) for (let y = 0; y < h; y++) {
          if (zc === -35 && i % 2 === 1 && y % 2 === 1 && i < w - 1 && y < h - 1 && r() < 0.35) cityWin.cell(x + i, y, zc, r() < 0.75 ? 0xffc77a : 0x9fd8ff);
          else city.cell(x + i, y, zc, c);
        }
        if (r() < 0.3) city.box(x + 1, h, zc, 1, 2, 1, c);
        x += w + (r() < 0.4 ? 1 : 0);
      }
    }
    add(city, { s: 2, jitter: 0.02, castShadow: false, receiveShadow: false });
    const cityWinM = add(cityWin, { s: 2, jitter: 0, emissive: 1.1, castShadow: false, hollow: false });
    const cityWinBase = baseOf(cityWinM);
    const moonB = new Builder();
    moonB.disc(0, 0, 0, 6.5, 1, (x, y) => { const cr = [[2, 2, 1.6], [-2.5, -1, 1.2], [1, -3, 1]].some(([cx, cy, rr]) => (x - cx) ** 2 + (y - cy) ** 2 < rr * rr); return cr ? 0xe8d8b0 : 0xfff3d0; });
    const moon = moonB.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02, emissive: 1.5, castShadow: false });
    moon.group.position.set(-2.4, 8.0, -24); group.add(moon.group);
    const clouds = [0, 1, 2].map((k) => {
      const b = new Builder();
      for (let j = 0; j < 4; j++) b.ball(j * 3 - 4, (j % 2) * 1.2, 0, 2.2 + (j % 3) * 0.5, shade(0x2a2446, 0.85 + 0.25 * (j % 2)));
      const m = b.build({ anchor: 'center', jitter: 0.04, castShadow: false, emissive: 0.08 });
      m.group.scale.setScalar(2 + k * 0.4); group.add(m.group); return m;
    });
    const stars = H.starfield({ count: 70, radius: 46, yMin: 6, size: 0.22, seed: 11, colors: [0xffffff, 0xfff2c4, 0xc4e6ff] });
    group.add(stars.group);
    const RAIN = 170;
    const rain = H.instanced(RAIN, { emissive: 0.45 });
    const rainD = [];
    for (let i = 0; i < RAIN; i++) { rainD.push([(r() - 0.5) * 9.4, -6.9 - r() * 4, r(), 0.8 + r() * 0.5]); rain.setColorAt(i, _c.setHex(i % 3 ? 0x6f8fc8 : 0x9fb8e8)); }
    rain.instanceColor.needsUpdate = true; group.add(rain);

    /* ---------------- string lights: back wall swoops + left wall */
    const bulbsP = [];
    for (let i = 0; i < 26; i++) { const u = i / 25, x = -9.6 + 19.2 * u, s = ((u * 2) % 1); bulbsP.push([x, 8.7 - 0.85 * 4 * s * (1 - s), -6.0]); }
    for (let i = 0; i < 11; i++) { const u = i / 10, z = -5.6 + 7 * u; bulbsP.push([-9.8, 8.5 - 0.7 * 4 * u * (1 - u), z]); }
    const wire = new Builder();
    for (let i = 0; i < bulbsP.length - 1; i++) {
      if (i === 25) continue;
      const a = bulbsP[i], b = bulbsP[i + 1];
      wire.line(Math.round(a[0] / U), Math.round(a[1] / U) + 1, Math.round(a[2] / U), Math.round(b[0] / U), Math.round(b[1] / U) + 1, Math.round(b[2] / U), 0x2a2a30);
    }
    wire.build && add(wire, { y: -0.1, jitter: 0, castShadow: false, hollow: false });
    const NB = bulbsP.length;
    const bulbs = H.instanced(NB, { emissive: 1.1 });
    const bulbCol = [0xffb35a, 0xff8a7a, 0xffe08a, 0x7fd8c8, 0xf3a0c8];
    const bulbBase = new Float32Array(NB * 3);
    for (let i = 0; i < NB; i++) { _c.setHex(bulbCol[i % bulbCol.length]); bulbBase[i * 3] = _c.r; bulbBase[i * 3 + 1] = _c.g; bulbBase[i * 3 + 2] = _c.b; H.putW(bulbs, i, bulbsP[i][0], bulbsP[i][1], bulbsP[i][2], 0.18, 0.24, 0.18); }
    bulbs.instanceMatrix.needsUpdate = true; group.add(bulbs);

    /* ---------------- desk: monitor (live waveform), keyboard, lamp, coffee + steam, chair */
    const deskG = holder(-7.3, 0, -5.0);
    const desk = new Builder();
    desk.box(-8, 7, -3, 17, 1, 7, wood).box(-8, 0, -3, 1, 7, 1, darkWood).box(8, 0, -3, 1, 7, 1, darkWood).box(-8, 0, 3, 1, 7, 1, darkWood).box(8, 0, 3, 1, 7, 1, darkWood);
    desk.box(3, 4, -3, 5, 3, 6, shade(wood, 0.85)).cell(5, 5, 3, 0xd8c4a0);
    desk.box(1, 8, -2, 2, 2, 1, ink).box(-3, 10, -2, 10, 7, 1, ink);         // monitor stand + bezel
    desk.box(-1, 8, 1, 7, 1, 2, 0x8a8a96);                                   // keyboard
    desk.box(7, 8, 1, 2, 3, 2, cream).cell(9, 9, 1, cream).cell(7, 10, 1, 0x3a2418); // mug
    desk.box(-8, 8, -1, 3, 1, 3, ink).line(-7, 9, 0, -6, 15, 0, ink).box(-6, 15, -1, 4, 2, 3, teal); // lamp
    add(desk, { parent: deskG, jitter: 0.03 });
    const screen = add(new Builder().box(-2, 11, -1, 8, 5, 1, 0x0d2a2e), { parent: deskG, jitter: 0, emissive: 0.7, castShadow: false });
    add(new Builder().box(-5, 14, 0, 2, 1, 1, 0xffe0a0), { parent: deskG, jitter: 0, emissive: 2.4, castShadow: false });
    const NW = 10;
    const wave = H.instanced(NW, { emissive: 1.8 }); deskG.add(wave);
    colorize(wave, Array.from({ length: NW }, (_, j) => mixHex(0x5fe0d0, 0xff8ab8, j / (NW - 1))));
    const NS = 8;
    const steam = H.instanced(NS, { emissive: 0.5 }); deskG.add(steam);
    colorize(steam, Array(NS).fill(0xe8eef8));
    const deskLight = new THREE.PointLight(0xffb35a, 9, 8, 1.5); deskLight.position.set(-8.3, 2.7, -4.6); group.add(deskLight);
    const chair = new Builder();
    chair.box(-4, 5, -4, 8, 1, 8, teal).box(-4, 6, 3, 8, 7, 1, teal).box(-1, 1, -1, 2, 4, 2, ink).box(-4, 0, -1, 8, 1, 2, ink).box(-1, 0, -4, 2, 1, 8, ink);
    add(chair, { x: -7.0, z: -3.0, ry: 0.5 });

    /* ---------------- poster + wall clock */
    const poster = new Builder();
    for (let x = 0; x < 16; x++) for (let y = 0; y < 13; y++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 12;
      let c = edge ? ink : mixHex(0xff9a6a, 0x3a2a6a, (y - 1) / 10);
      if (!edge && (x - 7.5) ** 2 + (y - 5) ** 2 < 7) c = 0xffe9a8;
      if (!edge && y < 5 + Math.abs(((x * 3) % 10) - 5) * -0.6 + 1) c = y < 3 ? 0x1e1a38 : 0x2c2350;
      poster.cell(x - 8, y, 0, c);
    }
    add(poster, { x: -7.2, y: 4.3, z: -6.15, jitter: 0.02, castShadow: false });
    const clockB = new Builder();
    clockB.disc(0, 0, 0, 4.2, 1, (x, y) => (x * x + y * y > 12 ? 0x3a2418 : cream));
    for (let k = 0; k < 12; k++) clockB.cell(Math.round(Math.cos(k * Math.PI / 6) * 2.8), Math.round(Math.sin(k * Math.PI / 6) * 2.8), 1, ink);
    const clock = clockB.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02 });
    clock.group.position.set(5.9, 6.6, -6.15); group.add(clock.group);
    const hand = (len, w) => { const g = new THREE.Group(); const m = new Builder().box(0, 0, 0, 1, len, 1, ink).build({ anchor: 'none', pivot: [0.5, 0, 0.5], jitter: 0 }); m.group.scale.set(w, 1, 1); g.add(m.group); g.position.set(5.9, 6.6, -5.88); group.add(g); return g; };
    const minHand = hand(4, 0.7), hourHand = hand(3, 1);

    /* ---------------- bookshelf + record player cabinet */
    const shelf = new Builder();
    shelf.box(-6, 0, -2, 1, 22, 4, darkWood).box(5, 0, -2, 1, 22, 4, darkWood).box(-6, 22, -2, 12, 1, 4, darkWood).box(-5, 0, -3, 10, 22, 1, shade(darkWood, 0.7));
    const bookCols = [0xc0504d, 0x2f8f8a, 0xe0a040, 0x6a4a8a, cream, 0x3f6fb0, 0xd87a9a];
    for (const sy of [0, 5, 10, 15]) {
      shelf.box(-5, sy, -2, 10, 1, 4, darkWood);
      for (let x = -5; x < 5; x++) { if (r() < 0.12) continue; const h = 2 + Math.floor(r() * 3); shelf.box(x, sy + 1, -2, 1, h, 3, bookCols[Math.floor(r() * bookCols.length)]); }
    }
    shelf.box(-2, 23, -1, 3, 2, 3, 0xc0603a).ball(-1, 26, 0, 2, greens[0]).ball(-2, 27, 1, 1.4, greens[2]);
    add(shelf, { x: 8.0, z: -5.4, jitter: 0.04 });
    const cab = new Builder();
    cab.box(-4, 1, -3, 8, 4, 6, wood).box(-4, 0, -3, 1, 1, 1, darkWood).box(3, 0, -3, 1, 1, 1, darkWood).box(-4, 0, 2, 1, 1, 1, darkWood).box(3, 0, 2, 1, 1, 1, darkWood);
    cab.box(-3, 5, -2, 7, 1, 5, ink).box(2, 6, 1, 1, 1, 1, 0xb0b0ba).line(2, 6, 1, 0, 6, -1, 0xb0b0ba);
    cab.box(-4, 1, 3, 1, 5, 4, 0xe0a040).box(-3, 1, 3, 1, 5, 4, 0x6a4a8a);  // leaning sleeves
    add(cab, { x: 8.6, z: -1.2, ry: -Math.PI / 2 });
    const platter = new Builder().flatDisc(0, 0, 0, 2.3, 1, (x, y, z) => (x * x + z * z < 1.2 ? 0xc0504d : (x === 0 && z > 0) ? 0x3a3a44 : 0x111114));
    const platG = holder(8.4, 6 * U + 0.1, -1.0);
    const platM = platter.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02 }); platG.add(platM.group);

    /* ---------------- plants: monstera, hanging pothos, sill succulents */
    const mon = new Builder();
    mon.box(-3, 0, -3, 6, 5, 6, 0xc0603a).box(-2, 5, -2, 4, 1, 4, 0x3a2418);
    [[0, 9, 0, 3.2], [-3, 12, 1, 2.8], [3, 13, -1, 2.6], [0, 15, 2, 2.4], [-1, 11, -3, 2.6], [2, 10, 3, 2.2]].forEach(([x, y, z, rr], k) => { mon.line(0, 5, 0, x, y, z, 0x3a6a30); mon.ball(x, y, z, rr, greens[k % 4]); });
    const monG = holder(-8.9, 0, 2.6);
    add(mon, { parent: monG, jitter: 0.06 });
    const hang = new Builder();
    hang.line(0, 0, 0, 0, -6, 0, 0x8a8a96).box(-2, -10, -2, 5, 4, 5, 0xe8d8bc);
    for (const [vx, vz, len] of [[-2, -2, 10], [2, 2, 12], [-2, 2, 8], [2, -2, 9]]) for (let k = 0; k < len; k++) hang.cell(vx + Math.round(Math.sin(k * 0.8) * 0.6) + Math.sign(vx), -10 - k, vz, greens[(k + vx + 9) % 4]);
    hang.ball(0, -6, 0, 2.2, greens[1]);
    const hangG = holder(9.0, 9.4, -3.4);
    const hangM = hang.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.05 }); hangG.add(hangM.group);
    const sill = new Builder();
    sill.box(-1, 0, -1, 3, 2, 3, 0xc0603a).box(0, 2, 0, 1, 4, 1, greens[0]).box(-1, 3, 0, 1, 2, 1, greens[2]).box(1, 4, 0, 1, 1, 1, 0xff8ab8);
    sill.box(-23, 0, -1, 4, 2, 3, cream).ball(-21.5, 3, 0, 2, greens[3]);
    add(sill, { x: -1.4, y: 2.0, z: -5.4, jitter: 0.04 });

    // floor lamp in the open right corner
    add(new Builder().box(-2, 0, -2, 4, 1, 4, ink).box(0, 1, 0, 1, 25, 1, 0x3a3a44), { x: 9.3, z: 3.2 });
    add(new Builder().box(-3, 26, -3, 7, 5, 7, 0xffe2b0).box(-2, 31, -2, 5, 1, 5, 0xffe2b0), { x: 9.3, z: 3.2, emissive: 0.9, jitter: 0.02, castShadow: false });

    /* ---------------- sleeping cat on the sill */
    const catG = holder(2.6, 2.0, -5.5, 0.15);
    const catBody = new Builder();
    const fur = (x, y, z) => ((x + 40) % 3 === 0 ? 0xc06a2a : 0xe8904a);
    catBody.box(-4, 0, -2, 8, 3, 4, fur).box(-3, 3, -1, 6, 1, 3, fur);
    catBody.box(3, 0, -2, 4, 4, 4, 0xe8904a).cell(3, 4, -2, 0xe8904a).cell(6, 4, -2, 0xe8904a).cell(3, 4, 1, 0xe8904a).cell(6, 4, 1, 0xe8904a);
    catBody.box(4, 1, 2, 2, 1, 1, 0xf6e4cc).cell(4, 2, 2, ink).cell(6, 2, 2, ink);
    catBody.box(2, 0, 2, 3, 1, 1, 0xf6e4cc);
    const catM = catBody.build({ anchor: 'none', pivot: PV, jitter: 0.03 }); catG.add(catM.group);
    const tailG = new THREE.Group(); tailG.position.set(-4 * U, 0.1, 0); catG.add(tailG);
    const tailM = new Builder().box(-5, 0, 0, 5, 1, 1, fur).cell(-5, 0, 1, 0xc06a2a).cell(-5, 0, 2, 0xc06a2a).build({ anchor: 'none', pivot: [0, 0, 0.5], jitter: 0.03 });
    tailG.add(tailM.group);

    /* ---------------- floor cushions with sleepy critters */
    const critters = [[-6.0, 5.4, 0xf7b98a, 0xe8664a, 2.5], [6.3, 5.6, 0xb9a6f0, 0x8c6cf0, -2.5]].map(([x, z, c, cushion, ry], k) => {
      const cu = new Builder().flatDisc(0, 0, 0, 3.4, 1, cushion).flatDisc(0, 0, 1, 2.9, 1, shade(cushion, 1.1)).cell(0, 2, 0, shade(cushion, 0.8));
      add(cu, { x, z, s: 1.3, ry, jitter: 0.04 });
      const g = holder(x, 0.52, z, ry); g.userData.s = 0.6;
      const b = new Builder();
      b.box(-3, 0, -3, 7, 6, 6, c).box(-2, 6, -2, 5, 1, 4, c);
      b.box(-2, 3, 3, 2, 1, 1, ink).box(1, 3, 3, 2, 1, 1, ink).cell(-2, 2, 3, 0xff8ab8).cell(2, 2, 3, 0xff8ab8);
      b.box(-4, 1, -1, 1, 3, 2, shade(c, 0.85)).box(4, 1, -1, 1, 3, 2, shade(c, 0.85));
      b.box(-3, 7, -2, 6, 1, 5, k ? 0x5fa8d8 : 0xe0a040).box(0, 8, 0, 1, 2, 1, k ? 0x5fa8d8 : 0xe0a040).cell(0, 10, 0, cream); // night cap
      const m = b.build({ anchor: 'none', pivot: PV, jitter: 0.03 }); g.add(m.group);
      return g;
    });
    // Z's (3 strokes each) rising from the cat and the critters
    const zSrc = [[2.6 + 0.9, 3.0, -5.3], [-6.0, 1.6, 5.4], [6.3, 1.6, 5.6]];
    const NZ = 9;
    const zs = H.instanced(NZ * 3, { emissive: 0.9 }); group.add(zs);
    colorize(zs, Array(NZ * 3).fill(0xd8d0ff));

    /* ---------------- motes / fireflies (chorus) */
    const motes = H.confetti({ count: 46, colors: [0xffd08a, 0xffe6c0, 0xff9ab8, 0x9fe8d8], origin: [0, 0.4, -0.5], spread: [17, 10], mode: 'rise', up: 0.32, life: 15, size: 0.06, emissive: 1.8, seed: 19, sway: 0.5 });
    group.add(motes.group);

    const washLight = new THREE.PointLight(0xff9a6a, 4, 14, 1.4); washLight.position.set(0, 6.8, -3.2); group.add(washLight);

    const TAU = Math.PI * 2;
    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.18), snare = f.env('drums', ['s', 'cl'], 0.15), hat = f.env('drums', ['h', 'o'], 0.08);
        const ch = f.section === 'chorus' ? 1 : f.section === 'bridge' ? 0.5 : 0.15;
        const E = f.energy, L = f.loopP * TAU;

        // rain outside (each drop falls every 0.6 s -> 100 cycles per loop)
        const amt = 0.55 + 0.45 * E;
        for (let i = 0; i < RAIN; i++) {
          const d = rainD[i], u = (f.loopP * 100 * d[3] % 1 + d[2]) % 1;
          const vis = i / RAIN < amt ? 1 : 0;
          H.putW(rain, i, d[0] - u * 0.5, 9.8 - u * 10, d[1], 0.02 * vis, 0.24 * vis, 0.02 * vis, 0, 0, 0.05);
        }
        rain.instanceMatrix.needsUpdate = true;

        // string lights: a warm wave travels along the string every 2 bars, kick lifts them, choruses glow brighter
        const glow = 0.35 + 0.25 * ch;
        for (let i = 0; i < NB; i++) {
          const w = 0.5 + 0.5 * Math.cos(TAU * (f.beat / 8 - i / 7));
          const g = glow + 0.7 * w * w * (0.4 + 0.6 * E) + 0.35 * kick;
          bulbs.setColorAt(i, _c.setRGB(bulbBase[i * 3] * g, bulbBase[i * 3 + 1] * g, bulbBase[i * 3 + 2] * g));
        }
        bulbs.instanceColor.needsUpdate = true;
        washLight.intensity = 3 + 4 * ch + 3 * kick * E;

        // monitor waveform
        const bassE = Math.exp(-Math.min(9, f.since('bass')) / 0.3), gtrE = Math.exp(-Math.min(9, f.since('guitar')) / 0.35);
        for (let j = 0; j < NW; j++) {
          const m = Math.abs(j - 4.5) / 4.5;
          const h = 0.06 + 0.5 * Math.min(1, (kick * (1 - m) + snare * m * 0.8 + bassE * 0.5 * (1 - m * 0.5) + gtrE * 0.4 * (0.5 + 0.5 * Math.sin(j * 1.7 + f.beat * Math.PI)) + 0.1 * hat) * (0.5 + 0.6 * E));
          H.putW(wave, j, -0.32 + j * 0.13, 2.7, -0.06, 0.09, h, 0.04);
        }
        wave.instanceMatrix.needsUpdate = true;
        deskLight.intensity = 8 + 2.5 * kick;

        // coffee steam (3 s cycles)
        for (let k = 0; k < NS; k++) {
          const u = (f.loopP * 20 + k / NS) % 1, s = 0.09 * Math.sin(Math.PI * u);
          H.putW(steam, k, 1.6 + Math.sin(u * 7 + k) * 0.08, 2.3 + u * 1.0, 0.3 + Math.cos(u * 5 + k) * 0.05, s, s, s, u * 3, u * 2, 0);
        }
        steam.instanceMatrix.needsUpdate = true;

        // clouds drift across the moon, stars twinkle, city windows slowly change
        clouds.forEach((m, k) => { const u = (f.loopP * (k + 1) + k * 0.37) % 1; m.group.position.set(-11 + 22 * u, 6.6 + k * 1.1, -21 - k); });
        stars.update(f);
        const slot = Math.floor(f.loopP * 20);
        for (let i = 0; i < cityWinM.count; i++) {
          const on = hash(i * 13 + 5) < 0.3 ? (hash(i * 71 + slot * 7) > 0.45 ? 1 : 0.08) : 1;
          cityWinM.setRGB(i, cityWinBase[i * 3] * on, cityWinBase[i * 3 + 1] * on, cityWinBase[i * 3 + 2] * on);
        }
        cityWinM.commitColor();

        // clock: minute hand turns once per loop
        minHand.rotation.z = -L; hourHand.rotation.z = -L / 12 - 1.2;
        // record spins at 33 rpm (33 turns per 60 s loop)
        platG.rotation.y = -L * 33;
        // plants sway, cat breathes and flicks its tail, critters doze and bob to the beat
        monG.rotation.z = 0.025 * Math.sin(L * 4); monG.rotation.x = 0.02 * Math.sin(L * 3 + 1);
        hangG.rotation.z = 0.06 * Math.sin(L * 5); hangG.rotation.x = 0.04 * Math.sin(L * 3);
        const br = Math.sin(L * 15);
        catM.group.scale.set(1, 1 + 0.05 * br, 1 + 0.02 * br);
        tailG.rotation.y = 0.25 * Math.sin(L * 6) + 0.25 * snare;
        critters.forEach((g, k) => {
          const b2 = Math.sin(L * 13 + k * 2);
          g.scale.set(0.6 * (1 + 0.02 * b2), 0.6 * (1 + 0.05 * b2), 0.6 * (1 + 0.02 * b2));
          g.rotation.z = 0.06 * Math.sin(Math.PI * f.beat / 2 + k);
        });
        // Z's: 3 per sleeper, 4 s cycles (15 per loop)
        for (let n = 0; n < NZ; n++) {
          const src = zSrc[n % 3], u = (f.loopP * 15 + Math.floor(n / 3) / 3 + (n % 3) * 0.13) % 1;
          const s = 0.18 + 0.3 * u, a = Math.sin(Math.PI * Math.min(1, u * 1.3));
          const x = src[0] + 0.5 * u + 0.15 * Math.sin(u * 6), y = src[1] + 1.4 * u, z = src[2];
          const k = s * a, wdt = 0.6 * k;
          H.putW(zs, n * 3, x, y + wdt * 0.6, z, wdt, 0.18 * k, 0.18 * k);
          H.putW(zs, n * 3 + 1, x, y, z, 0.18 * k, wdt * 1.35, 0.18 * k, 0, 0, 0.82);
          H.putW(zs, n * 3 + 2, x, y - wdt * 0.6, z, wdt, 0.18 * k, 0.18 * k);
        }
        zs.instanceMatrix.needsUpdate = true;

        motes.update(f, 0.3 + 0.7 * ch);
      },
    };
  },
};
