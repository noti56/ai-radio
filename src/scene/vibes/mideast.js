// MIDDLE EASTERN: an Arabian night in a moonlit desert palace courtyard.
// Tiled pishtaq portal with a pointed arch, horseshoe arches with red/ivory ablaq voussoirs, onion dome + slender minarets
// crowned by glowing crescents, mashrabiya screens whose 8-point stars ripple with the beat, swinging fanous lanterns on
// festoon ropes, a Persian carpet under the band, cushions + brass tea tables, palms, stepped dunes, a big moon, dense stars.
// Deterministic: build uses ctx.rng, update is a pure function of f (ambient motion is periodic in the 60 s loop).
export default {
  id: 'mideast',
  label: 'Middle Eastern',
  idleBpm: 100,
  palette: { skyTop: 0x040724, skyBottom: 0x2a1b4a, glow: 0x1e2a66, accent: 0xe8b04a, flash: 0xffd27a },
  lights: { hemi: [0x9fb2ff, 0x3a2416, 0.6], key: [0xffe2b8, 1.45], rim: [0x7f9bff, 1.5] },
  fog: { color: 0x0e0b26, near: 32, far: 120 },
  bloom: { strength: 0.6, radius: 0.5, threshold: 0.8 },
  exposure: 1.05,
  cam: { punch: 0.45, shake: 0.25, dist: 1, height: 1 },
  band: {
    guitar: 'oud', bass: 'bass', drums: 'darbuka',
    colors: { guitar: 0x7b3f1e, bass: 0x1d6c74, kit: 0xb5652b, accent: 0xe8c068 },
    costumes: {
      guitar: [['keffiyeh', 0xf2efe6, 0xc62828]],
      bass: [['keffiyeh', 0xf2efe6, 0x1b1b1f], ['chain', 0xe8b04a]],
      drums: [['fez', 0xb3122e, 0xffcc4a], ['scarf', 0x1f9e9a, 0xe8b04a]],
    },
    moves: { guitar: 'sway', bass: 'groove', drums: 'sway', intensity: 1.05 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, U, shade, mixHex, hash } = V;
    const group = new THREE.Group();
    const r = rng(1408);
    const TAU = Math.PI * 2;
    const SAND = 0xc49a6c, SAND_D = 0xa47b55, IVORY = 0xefe2c4, TURQ = 0x1fa39c, LAPIS = 0x223f8f, GOLD = 0xd9a441, GOLD_D = 0xa8792e;
    const RUST = 0xa8452a, WOOD = 0x3a2414, WOOD2 = 0x2a180c, BRASS = 0xc8963a, WIN = 0xfeedfa; // WIN = marker for glowing windows
    const add = (b, scale, opts, x = 0, y = 0, z = 0) => {
      const m = b.build({ anchor: 'none', pivot: [0, 0, 0], ...opts });
      m.group.scale.setScalar(scale); m.group.position.set(x, y, z); group.add(m.group); return m;
    };
    // arch tests in world units
    const pointed = (x, y, cx, hw, hs, pad = 0) => {
      if (y < hs) return Math.abs(x - cx) <= hw + pad;
      const dy = y - hs, R = 2 * hw + pad;
      return (x - (cx - hw)) ** 2 + dy * dy <= R * R && (x - (cx + hw)) ** 2 + dy * dy <= R * R;
    };
    const horse = (x, y, cx, r0, hs, pad = 0) => (y < hs && Math.abs(x - cx) <= 0.8 * r0 + pad) || ((x - cx) ** 2 + (y - hs) ** 2 <= (r0 + pad) ** 2 && y >= hs - 0.55 * r0);

    /* ---------------------------------------------------------------- courtyard floor (0.5 cells) */
    const floor = new Builder();
    for (let i = -24; i <= 23; i++) for (let k = -15; k <= 22; k++) {
      const a = ((i % 6) + 6) % 6, b = ((k % 6) + 6) % 6;
      let c = ((i + k) & 1) ? 0x8c7660 : 0x846e58;
      if (Math.abs(a - 3) + Math.abs(b - 3) === 3) c = 0x7a5a44;
      if (a === 3 && b === 3) c = 0x2a8a84;
      if (a === 0 && b === 0) c = GOLD_D;
      floor.cell(i, -1, k, c);
    }
    add(floor, 2.5, { jitter: 0.05, seed: 31, castShadow: false }, 0, 0.1, 0);

    /* ---------------------------------------------------------------- palace: facade, portal, colonnades, domes, minarets (0.4 cells) */
    const S2 = 0.4, FY = 0.05;
    const fac = new Builder();
    const SIDE_X = [-8.2, -5.2, 5.2, 8.2];
    const archAt = (x) => { if (Math.abs(x) < 2.2) return { cx: 0, hs: 2.4, pt: true }; for (const cx of SIDE_X) if (Math.abs(x - cx) < 1.8) return { cx, hs: 2.2, pt: false }; return null; };
    const openAt = (x, y, pad = 0) => { const a = archAt(x); if (!a) return false; return a.pt ? pointed(x, y, 0, 1.4, 2.4, pad) : horse(x, y, a.cx, 1.1, 2.2, pad); };
    const ablaq = (x, y, cx, hs, n = 9) => ((Math.floor((Math.atan2(y - hs, x - cx) + Math.PI) / (Math.PI / n)) & 1) ? RUST : IVORY);
    for (let i = -32; i <= 32; i++) {
      const x = i * S2, inP = Math.abs(i) <= 7;
      const top = inP ? 14 : 10;
      for (let j = 0; j <= top; j++) {
        const y = FY + j * S2;
        if (openAt(x, y)) continue;
        const a = archAt(x);
        const ring = a && openAt(x, y, 0.45);
        let c;
        if (ring) c = y < a.hs ? (inP ? GOLD : SAND_D) : ablaq(x, y, a.cx, a.hs);
        else if (inP) {
          if (j === 14) c = GOLD_D;
          else if (Math.abs(i) >= 6 || j >= 13) c = ((i + j) & 1) ? TURQ : LAPIS;
          else if (Math.abs(i) === 5 || j === 12) c = GOLD;
          else c = j <= 1 ? (((i + j) & 1) ? TURQ : IVORY) : SAND;
        } else {
          if (j <= 1) c = ((i + j) & 1) ? TURQ : IVORY;
          else if (j === 2) c = LAPIS;
          else if (j === 9) c = (((i % 4) + 4) % 4 === 0) ? GOLD : LAPIS;
          else if (j === 10) c = GOLD_D;
          else c = (j % 3 === 0) ? SAND_D : SAND;
        }
        fac.cell(i, j, -16, c);
        fac.cell(i, j, -17, j >= 10 ? GOLD_D : SAND_D);
        if (inP) {
          fac.cell(i, j, -15, c);
          // deep iwan recess: line the opening with muqarnas-like tiers
          if (Math.abs(i) <= 5 && (openAt(x + S2, y) || openAt(x - S2, y) || openAt(x, y - S2))) {
            fac.cell(i, j, -18, (j & 1) ? TURQ : IVORY); fac.cell(i, j, -19, (j & 1) ? IVORY : GOLD);
          }
        }
      }
      if (!inP) { const m = ((i % 4) + 4) % 4; if (m !== 3) fac.cell(i, 11, -16, SAND); if (m === 1) fac.cell(i, 12, -16, SAND); }
    }
    // side colonnades (riwaq) along x = +-10.4
    const BAYS = [-4.8, -2.4, 0, 2.4];
    for (const sx of [-1, 1]) {
      const i = sx * 26;
      for (let k = -15; k <= 9; k++) {
        const z = k * S2;
        let cz = BAYS[0]; for (const b of BAYS) if (Math.abs(z - b) < Math.abs(z - cz)) cz = b;
        for (let j = 0; j <= 9; j++) {
          const y = FY + j * S2;
          if (pointed(z, y, cz, 0.95, 2.0)) continue;
          const ring = pointed(z, y, cz, 0.95, 2.0, 0.4);
          let c;
          if (ring) c = y < 2.0 ? (j === 4 ? GOLD : SAND_D) : ablaq(z, y, cz, 2.0, 7);
          else if (j === 9) c = GOLD_D;
          else if (j === 8) c = (k & 1) ? TURQ : LAPIS;
          else if (j <= 1) c = ((k + j) & 1) ? TURQ : IVORY;
          else c = SAND;
          fac.cell(i, j, k, c);
        }
        if ((((k % 2) + 2) % 2) === 0) fac.cell(i, 10, k, SAND);
      }
    }
    // dome profile
    const onion = (t) => (t < 0.35 ? 1 + 0.2 * Math.sin((t / 0.35) * Math.PI / 2) : 1.2 * Math.cos(((t - 0.35) / 0.65) * Math.PI / 2));
    const domeCol = (cx, cz, t) => (x, y, z) => { const ang = Math.atan2(z - cz, x - cx); return (((ang / (Math.PI / 8)) % 1 + 1) % 1) < 0.2 ? GOLD : mixHex(0x15706c, 0x3cc4b6, t); };
    // great dome behind the portal (z = -14)
    fac.flatDisc(0, -35, 9, 7, 4, (x, y, z) => {
      const ang = Math.atan2(z + 35, x), sec = (((ang / (Math.PI / 6)) % 1) + 1) % 1;
      if ((y === 10 || y === 11) && sec > 0.3 && sec < 0.7 && x * x + (z + 35) ** 2 > 30) return WIN;
      return y === 12 ? GOLD : SAND;
    });
    for (let h = 0; h <= 6; h++) { const t = h / 6; fac.flatDisc(0, -35, 13 + h, Math.max(0.7, 7 * onion(t)), 1, domeCol(0, -35, t)); }
    fac.cell(0, 20, -35, GOLD);
    // small domes on the roof
    for (const sx of [-1, 1]) {
      const ci = sx * 17;
      fac.flatDisc(ci, -20, 10, 3, 2, (x, y) => (y === 11 ? GOLD : SAND));
      for (let h = 0; h <= 3; h++) { const t = h / 3; fac.flatDisc(ci, -20, 12 + h, Math.max(0.6, 3.2 * onion(t)), 1, domeCol(ci, -20, t)); }
      fac.cell(ci, 16, -20, GOLD);
    }
    // minarets at the corners
    for (const sx of [-1, 1]) {
      const i0 = sx * 34, k0 = -22;
      fac.box(i0 - 2, 0, k0 - 2, 5, 8, 5, (x, y) => (y <= 1 ? (((x + y) & 1) ? TURQ : IVORY) : y === 7 ? GOLD : (y % 3 === 0 ? SAND_D : SAND)));
      fac.flatDisc(i0, k0, 8, 1.6, 5, (x, y, z) => ((y === 10 || y === 11) && x === i0 && z === k0 + 1 ? WIN : (y === 12 ? TURQ : IVORY)));
      fac.flatDisc(i0, k0, 13, 2.6, 1, GOLD_D);
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d = x * x + z * z; if (d >= 4 && d <= 7.5 && ((x + z) & 1)) fac.cell(i0 + x, 14, k0 + z, GOLD); }
      fac.flatDisc(i0, k0, 14, 1.2, 2, IVORY);
      fac.flatDisc(i0, k0, 16, 1.6, 1, TURQ);
      fac.flatDisc(i0, k0, 17, 0.9, 1, TURQ);
      fac.cell(i0, 18, k0, GOLD);
    }
    // move window markers into the glowing builder
    const fgl = new Builder();
    fac.map.forEach((v, key) => { if (v[3] === WIN) { fac.map.delete(key); fgl.cell(v[0], v[1], v[2], 0xffa940); } });
    add(fac, 2, { jitter: 0.045, seed: 41, castShadow: false }, 0, FY, 0);
    const winM = add(fgl, 2, { jitter: 0, emissive: 1.3, castShadow: false, hollow: false }, 0, FY, 0);

    /* ---------------------------------------------------------------- mashrabiya screens + portal rosettes (0.2 cells) */
    const wood = new Builder(), lat = new Builder();
    const panels = [{ test: (x, y, p) => pointed(x, y, 0, 1.4, 2.4, p), x0: -1.9, x1: 1.9, y1: 5.2, zw: -37, zg: -38, cx: 0, cy: 2.6, door: 1.1 }]
      .concat(SIDE_X.map((cx) => ({ test: (x, y, p) => horse(x, y, cx, 1.1, 2.2, p), x0: cx - 1.4, x1: cx + 1.4, y1: 3.6, zw: -33, zg: -34, cx, cy: 2.0, door: 0.45 })));
    const starAt = (du, dv) => Math.max(Math.abs(du), Math.abs(dv)) <= 1 || Math.abs(du) + Math.abs(dv) <= 2;
    for (const P of panels) {
      const ic = Math.round(P.cx / 0.2), jc = Math.round((P.cy - 0.1) / 0.2);
      for (let i = Math.floor(P.x0 / 0.2); i <= Math.ceil(P.x1 / 0.2); i++) for (let j = 0; j <= Math.ceil(P.y1 / 0.2); j++) {
        const x = i * 0.2, y = j * 0.2 + 0.1;
        if (!P.test(x, y, 0.22)) continue;
        if (y < P.door) { wood.cell(i, j, P.zw, ((i + j) % 3 === 0 && P.door > 1) ? GOLD : 0x4a2a18); continue; }
        if (!P.test(x, y, -0.18)) { wood.cell(i, j, P.zw, WOOD2); continue; }
        let du = (((i - ic) % 6) + 6) % 6, dv = (((j - jc) % 6) + 6) % 6; if (du > 3) du -= 6; if (dv > 3) dv -= 6;
        if (starAt(du, dv) || (Math.abs(du) === 3 && Math.abs(dv) === 3)) lat.cell(i, j, P.zg, 0xffffff);
        else wood.cell(i, j, P.zw, WOOD);
      }
    }
    for (const sx of [-1, 1]) for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) if (starAt(du, dv)) lat.cell(Math.round(sx * 1.55 / 0.2) + du, 22 + dv, -29, 0xffffff);
    add(wood, 1, { jitter: 0.05, seed: 51, castShadow: false }, 0, 0.1, 0);
    const latM = add(lat, 1, { jitter: 0, emissive: 1.25, castShadow: false, hollow: false }, 0, 0.1, 0);
    const latN = latM.count, latD = new Float32Array(latN), latK = new Uint8Array(latN), latP = new Uint8Array(latN);
    latM.cells.forEach(([i, j, k], n) => {
      latD[n] = Math.hypot(i * 0.2, j * 0.2 + 0.1 - 2.4);
      latK[n] = k === -29 ? 2 : 0;
      latP[n] = (Math.floor((i + 2) / 6) + Math.floor((j + 2) / 6)) & 1;
    });

    /* ---------------------------------------------------------------- crescents on every finial (glow) */
    const cres = new Builder();
    const crescent = (cx, cy, cz, rad = 3.4) => {
      for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
        if (x * x + y * y <= rad * rad && (x - 1.5) ** 2 + (y - 0.9) ** 2 > (rad * 0.82) ** 2) cres.cell(cx + x, cy + y, cz, 0xffd36a);
      }
    };
    crescent(0, 44, -70);                                 // great dome
    crescent(-34, 35, -40, 2.6); crescent(34, 35, -40, 2.6); // small domes
    crescent(-68, 40, -110, 2.8); crescent(68, 40, -110, 2.8); // minarets
    const cresM = add(cres, 1, { jitter: 0, emissive: 1.6, castShadow: false, hollow: false }, 0, 0, 0);

    /* ---------------------------------------------------------------- persian carpet under the band */
    const carpet = new Builder();
    const CW = 56, CD = 39, MGOLD = 0xd4a23b;
    for (let a = 0; a < CW; a++) for (let b = 0; b < CD; b++) {
      const e = Math.min(a, CW - 1 - a, b, CD - 1 - b);
      let c;
      if (e === 0) c = 0x1a1f3d;
      else if (e === 1 || e === 6) c = 0xc9962e;
      else if (e <= 5) {
        const s = (e === Math.min(a, CW - 1 - a) ? b : a), m = s % 6, n = e - 2;
        c = 0x1d2a55;
        if (Math.abs(m - 3) + Math.abs(n - 1.5) <= 1.6) c = (m === 3 && (n === 1 || n === 2)) ? 0xb3202a : 0xe3d2a6;
        else if (m === 0 && (n === 1 || n === 2)) c = TURQ;
      } else if (e === 7) c = ((a + b) & 1) ? 0xe3d2a6 : 0xb3202a;
      else {
        const dx = a - (CW - 1) / 2, dz = b - (CD - 1) / 2;
        const lz = Math.abs(dx) / 15 + Math.abs(dz) / 9.5, li = Math.abs(dx) / 10.5 + Math.abs(dz) / 6.6;
        const fx = Math.min(a - 8, CW - 9 - a), fz = Math.min(b - 8, CD - 9 - b), sp = fx / 9 + fz / 6;
        c = 0x8e1b1b;
        if (lz <= 1) {
          c = lz > 0.88 ? MGOLD : 0x1d2a55;
          if (li <= 1) c = li > 0.86 ? MGOLD : 0xe8d9b5;
          if (Math.max(Math.abs(dx), Math.abs(dz)) <= 3 || Math.abs(dx) + Math.abs(dz) <= 4.6) c = MGOLD;
          if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) c = 0xb3202a;
          if (lz <= 1 && lz > 0.6 && li > 1 && (Math.round(dx) + Math.round(dz)) % 3 === 0) c = TURQ;
        } else if (sp <= 1) c = sp > 0.82 ? MGOLD : 0x1d2a55;
        else {
          const u = (((a - 8) % 6) + 6) % 6, v = (((b - 8) % 6) + 6) % 6;
          if ((u === 3 && v >= 2 && v <= 4) || (v === 3 && u >= 2 && u <= 4)) c = (u === 3 && v === 3) ? MGOLD : TURQ;
          else if (u === 0 && v === 0) c = 0xe3d2a6;
        }
      }
      carpet.cell(a - 28, -1, b - 24, c);
    }
    for (let b = 0; b < CD; b += 2) { carpet.cell(-29, -1, b - 24, 0xefe4c8); carpet.cell(CW - 28, -1, b - 24, 0xefe4c8); }
    const carpetM = add(carpet, 1, { jitter: 0.06, seed: 61, castShadow: false }, 0, 0.05, 0);
    const medIdx = [], medCol = [];
    carpetM.cells.forEach((cl, n) => { if (cl[3] === MGOLD) { medIdx.push(n); medCol.push(cl[3]); } });
    const medBase = new THREE.Color(MGOLD);

    /* ---------------------------------------------------------------- decor: side majlis (rugs, cushions, tea tables), urns, braziers */
    const decor = new Builder(), dglow = new Builder();
    const mb = (B, sx, i, j, k, w, h, d, c) => { for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) for (let e = 0; e < d; e++) B.cell(sx * (i + a), j + b, k + e, typeof c === 'function' ? c(a, b, e) : c); };
    const CUSH = [0xb3202a, 0xd9a441, 0x1f8a86, 0x6a2a6a, 0xc0531a];
    for (const sx of [-1, 1]) {
      // kilim
      mb(decor, sx, 33, -1, -10, 17, 1, 24, (a, b, e) => {
        if (a === 0 || a === 16 || e === 0 || e === 23) return RUST;
        const s = e % 6; if (Math.abs(a - 8) + Math.abs(s - 3) <= 2) return s === 3 && a === 8 ? GOLD : IVORY;
        return [0x26306a, 0x26306a, IVORY, 0xa33a22, 0xa33a22, GOLD][s];
      });
      // back cushions against the colonnade + floor cushions
      [-9, -3, 3, 9].forEach((kz, n) => {
        const c = CUSH[(n + (sx > 0 ? 0 : 2)) % CUSH.length];
        mb(decor, sx, 47, 0, kz, 2, 4, 5, (a, b, e) => (b === 3 || e === 0 || e === 4 ? shade(c, 0.75) : (b === 1 && e === 2 ? GOLD : c)));
        mb(decor, sx, 43, 0, kz, 4, 2, 5, (a, b, e) => (b === 1 && (a + e) % 3 === 0 ? GOLD : shade(c, 1.1)));
      });
      [-6, 6].forEach((kz, n) => mb(decor, sx, 32, 0, kz - 2, 3, 2, 4, CUSH[(n + 3) % CUSH.length]));
      // low brass table with dallah + tea glasses
      decor.flatDisc(sx * 39, 1, 2, 3.5, 1, (x, y, z) => { const d = (x - sx * 39) ** 2 + (z - 1) ** 2; return d > 7 && d < 10 ? GOLD_D : BRASS; });
      mb(decor, sx, 38, 0, 0, 2, 2, 2, GOLD_D);
      decor.flatDisc(sx * 39, 1, 3, 1.2, 2, BRASS); decor.flatDisc(sx * 39, 1, 5, 0.7, 2, BRASS);
      decor.cell(sx * 39, 7, 1, GOLD).cell(sx * 41, 5, 1, BRASS).cell(sx * 42, 6, 1, BRASS).cell(sx * 37, 5, 1, GOLD_D).cell(sx * 37, 6, 1, GOLD_D);
      for (const [gi, gk] of [[37, -1], [41, -1], [37, 3], [41, 3]]) { dglow.cell(sx * gi, 3, gk, 0x8a2a0c); decor.cell(sx * gi, 4, gk, 0xf5e7c0); }
      // terracotta urns with agave
      for (const [ui, uk] of [[18, -28], [46, 24]]) {
        [1.2, 1.8, 2.2, 2.4, 2.4, 2.1, 1.6, 1.1, 1.0, 1.4].forEach((rr, j) => decor.flatDisc(sx * ui, uk, j, rr, 1, j === 4 ? TURQ : j === 9 ? GOLD : RUST));
        for (const [dx, dz, hh] of [[0, 0, 4], [1, 0, 3], [-1, 0, 3], [0, 1, 3], [0, -1, 2], [1, 1, 2], [-1, -1, 2]]) decor.box(sx * ui + dx, 10, uk + dz, 1, hh, 1, 0x3f7a3a);
      }
      // brazier: tripod + bowl + glowing coals
      const bi = sx * 30, bk = -17;
      for (const [dx, dz] of [[-2, -2], [2, -2], [0, 2]]) decor.line(bi + dx, 0, bk + dz, bi + Math.sign(dx), 6, bk + Math.sign(dz), GOLD_D);
      decor.flatDisc(bi, bk, 7, 2.2, 1, BRASS); decor.flatDisc(bi, bk, 8, 2.9, 1, (x, y, z) => ((x - bi) ** 2 + (z - bk) ** 2 > 5 ? GOLD : BRASS));
      dglow.flatDisc(bi, bk, 9, 2.0, 1, (x, y, z) => (((x + z) & 1) ? 0xff6a1a : 0xffb030));
    }
    add(decor, 1, { jitter: 0.05, seed: 71 }, 0, 0.05, 0);
    add(dglow, 1, { jitter: 0.1, seed: 72, emissive: 1.5, castShadow: false, hollow: false }, 0, 0.05, 0);

    /* ---------------------------------------------------------------- palms (0.3 cells), each sways a little */
    const palmB = (seed, Hh, lean) => {
      const pr = rng(seed), b = new Builder();
      let tx = 0;
      for (let y = 0; y < Hh; y++) { tx = Math.round(lean * (y / Hh) ** 2 * 3); b.box(tx - 1, y, -1, 2, 1, 2, ((y >> 1) & 1) ? 0x6b4a30 : 0x553a25); }
      const cx = tx - 0.5, cz = -0.5;
      const nF = 9;
      for (let f = 0; f < nF; f++) {
        const a = (f / nF) * TAU + pr() * 0.4, L = 7 + Math.floor(pr() * 3), ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= L; s++) {
          const dy = Math.round(s * 0.9 - s * s * 0.16), x = Math.round(cx + ca * s), z = Math.round(cz + sa * s), y = Hh + dy;
          const g = mixHex(0x2f7a3a, 0x1d4f2a, s / L);
          b.cell(x, y, z, g);
          if (s > 1 && s < L) { const px = Math.round(-sa), pz = Math.round(ca); b.cell(x + px, y - 1, z + pz, shade(g, 0.82)); b.cell(x - px, y - 1, z - pz, shade(g, 0.82)); }
        }
      }
      b.box(tx - 1, Hh - 1, -1, 2, 2, 2, 0x3d6b2a);
      for (const [dx, dz] of [[-2, 0], [1, -2], [1, 1], [-1, 1]]) b.box(tx + dx, Hh - 3, dz, 1, 2, 1, 0xc0782a);
      return b;
    };
    const PALMS = [[-9.6, -5.4, 17, 0.8], [9.6, -5.4, 18, -0.8], [-13.4, -1.5, 19, 1], [13.4, -1.5, 16, -1], [-14.8, 8.5, 18, 0.6], [14.8, 8.5, 17, -0.6], [-16.5, -6, 20, 0.4], [16.5, -6, 19, -0.4]];
    const palms = PALMS.map(([x, z, hh, lean], n) => {
      const m = add(palmB(300 + n, hh, lean), 1.5, { jitter: 0.06, seed: 80 + n, castShadow: Math.abs(x) < 12 }, x, 0.05, z);
      m.group.rotation.y = r() * TAU;
      return m;
    });

    /* ---------------------------------------------------------------- stepped dunes (2-unit cells) */
    const dunes = new Builder();
    for (let i = -18; i <= 18; i++) for (let k = -20; k <= 5; k++) {
      if (Math.abs(i) <= 6 && k >= -5) continue;
      const far = Math.max(0, (-k - 6) / 14) + Math.max(0, (Math.abs(i) - 7) / 12);
      const n = (0.5 + 0.5 * Math.sin(i * 0.45 + k * 0.21)) * (0.5 + 0.5 * Math.cos(k * 0.37 - i * 0.16));
      const h = Math.max(0, Math.min(3, Math.round(n * 2.2 + far * 1.4 - 0.4)));
      for (let j = -1; j < h; j++) dunes.cell(i, j, k, mixHex(0x8a6a50, 0xbf9970, (j + 1) / 4 * 0.7 + (j === h - 1 ? 0.3 : 0)));
    }
    add(dunes, 10, { jitter: 0.06, seed: 91, castShadow: false, receiveShadow: false }, 0, 0.8, 0);

    /* ---------------------------------------------------------------- moon + star sky */
    const moon = new Builder();
    moon.disc(0, 0, 0, 6.2, 2, (x, y) => {
      const cr = [[2, 1, 1.6], [-2, -2, 1.3], [-1, 3, 0.9], [3, -3, 1]].some(([a, b, rr]) => (x - a) ** 2 + (y - b) ** 2 <= rr * rr);
      return cr ? 0xd8cfb4 : 0xfff3d6;
    });
    add(moon, 3, { jitter: 0.04, seed: 93, emissive: 0.7, castShadow: false, receiveShadow: false }, -17, 11, -42);
    const stars = H.starfield({ count: 520, radius: 50, yMin: 3, size: 0.42, colors: [0xffffff, 0xfff0c4, 0xc4dcff, 0xffffff], seed: 17 });
    group.add(stars.group);

    /* ---------------------------------------------------------------- festoon ropes with string lights */
    const ropeP = (sx, t, out) => out.set(sx * (2.8 + 7.6 * t), 5.7 - 1.4 * t - 0.9 * 4 * t * (1 - t), -5.9 + 9.5 * t);
    const tv = new THREE.Vector3();
    const ropeB = new Builder();
    for (const sx of [-1, 1]) for (let s = 0; s <= 140; s++) { ropeP(sx, s / 140, tv); ropeB.cell(Math.round(tv.x / 0.2), Math.round(tv.y / 0.2), Math.round(tv.z / 0.2), 0x2a1d14); }
    const ropeM = ropeB.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.05, castShadow: false });
    group.add(ropeM.group);
    const NB = 26, bulbs = H.instanced(NB * 2, { emissive: 1.2 });
    group.add(bulbs);
    for (let n = 0; n < NB * 2; n++) { const sx = n < NB ? -1 : 1; ropeP(sx, ((n % NB) + 0.5) / NB, tv); H.putW(bulbs, n, tv.x, tv.y - 0.14, tv.z, 0.12, 0.16, 0.12); /* world-unit sizes */ }
    bulbs.instanceMatrix.needsUpdate = true;
    const BULBC = [[1, 0.72, 0.3], [0.2, 0.9, 0.85], [1, 0.38, 0.45]];

    /* ---------------------------------------------------------------- fanous lanterns (instanced, swinging) */
    const LS = 0.14;
    const fOff = [], gOff = [], gPar = [];
    const aF = (x, y, z) => fOff.push(x * LS, y * LS, z * LS);
    aF(0, 0, 0); aF(0, -1, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) aF(x, -2, z);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 2 || Math.abs(z) === 2) aF(x, -3, z);
    for (let y = -7; y <= -4; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) !== 2 && Math.abs(z) !== 2) continue;
      if (Math.abs(x) === 2 && Math.abs(z) === 2) aF(x, y, z);
      else { gOff.push(x * LS, y * LS, z * LS); gPar.push((x + y + z) & 1); }
    }
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) aF(x, -8, z);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) aF(x, -9, z);
    aF(0, -10, 0);
    const nFo = fOff.length / 3, nGo = gOff.length / 3;
    const LCOL = [[0xffb347, 0xff6a3d], [0x3fe0d0, 0x2a7fff], [0xff4a6a, 0xffb347], [0x7dff9a, 0x3fe0d0], [0xffd36a, 0xff4a6a]];
    const LANT = [];
    for (const sx of [-1, 1]) for (const t of [0.3, 0.55, 0.8]) { ropeP(sx, t, tv); LANT.push({ p: tv.clone(), rope: 0.3 + 0.25 * (t === 0.55 ? 1 : 0), s: 0.8, amp: 0.1 }); }
    for (const sx of [-1, 1]) for (const z of [-4.8, 0]) LANT.push({ p: new THREE.Vector3(sx * 10.4, 3.55, z), rope: 0.1, s: 0.65, amp: 0.05 });
    LANT.push({ p: new THREE.Vector3(0, 4.75, -6.6), rope: 0.1, s: 0.9, amp: 0.04 });
    const NL = LANT.length;
    LANT.forEach((L, n) => { L.k1 = 11 + (n % 5); L.k2 = 13 + ((n * 3) % 6); L.ph = r() * TAU; L.ph2 = r() * TAU; L.col = LCOL[n % LCOL.length]; });
    const lFrame = H.instanced(NL * (nFo + 1), { emissive: 0.15, castShadow: true });
    const lGlass = H.instanced(NL * nGo, { emissive: 1.6 });
    group.add(lFrame, lGlass);
    const _cc = new THREE.Color();
    for (let n = 0; n < NL; n++) {
      for (let c = 0; c < nFo; c++) lFrame.setColorAt(n * (nFo + 1) + c, _cc.setHex(c < 2 ? GOLD_D : BRASS));
      lFrame.setColorAt(n * (nFo + 1) + nFo, _cc.setHex(0x2a1d14));
    }
    lFrame.instanceColor.needsUpdate = true;
    const gBase = new Float32Array(NL * nGo * 3);
    for (let n = 0; n < NL; n++) for (let c = 0; c < nGo; c++) { _cc.setHex(LANT[n].col[gPar[c]]); gBase.set([_cc.r, _cc.g, _cc.b], (n * nGo + c) * 3); }

    /* ---------------------------------------------------------------- fire, embers, chorus sparkles, crowd, warm lights */
    const fires = [-6, 6].map((x, n) => { const p = H.confetti({ count: 40, colors: [0xff5a00, 0xff9a1a, 0xffd36a], origin: [x, 1.9, -3.4], spread: [0.6, 0.6], mode: 'rise', up: 1.5, life: 0.9, size: 0.2, emissive: 2, seed: 101 + n, sway: 0.18 }); group.add(p.group); return p; });
    const embers = H.confetti({ count: 110, colors: [0xffc04a, 0xff8a2a, 0xfff0c0], origin: [0, 0.4, 0.5], spread: [22, 15], mode: 'rise', up: 0.42, life: 14, size: 0.08, emissive: 2.2, seed: 111, sway: 0.9 });
    group.add(embers.group);
    const sparks = H.confetti({ count: 70, colors: [0xffd36a, 0x3fe0d0, 0xffffff, 0xff8a5a], origin: [0, 8.5, -1], spread: [16, 11], mode: 'fall', life: 3.6, size: 0.08, emissive: 1.6, seed: 121, sway: 0.5 });
    group.add(sparks.group);
    const crowd = H.crowd({ rows: 4, cols: 18, spacing: 0.92, z0: 7.7, y0: -0.12, palette: [0xf2ece0, 0xd9c7a3, 0x2b3d7a, 0xb5532f, 0x1f8a86, 0x5a2a4a, 0xf2ece0], skin: [0xf1c9a5, 0xd2a07a, 0xa8744f, 0x7a4f33], style: 'sway', hands: 0.5, seed: 33, rise: 0.1, rowStep: 0.95 });
    group.add(crowd.group);
    const torchL = new THREE.PointLight(0xff8a30, 6, 13, 1.6); torchL.position.set(-6, 2.4, -3.4);
    const torchR = new THREE.PointLight(0xff8a30, 6, 13, 1.6); torchR.position.set(6, 2.4, -3.4);
    group.add(torchL, torchR);

    // scratch objects for update (no per-frame allocation)
    const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    const cresN = cresM.count, winN = winM.count;
    const cresBase = new THREE.Color(0xffd36a), winBase = new THREE.Color(0xffa940);

    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.14), tek = f.env('drums', ['s', 'cl'], 0.1), crash = f.env('drums', 'c', 0.6);
        const ch = f.section === 'chorus' ? 1 : f.section === 'bridge' ? 0.45 : 0;
        const E = f.energy, L = f.loopP * TAU;

        // lanterns swing (integer cycles per 60 s loop) and glow; one lantern per beat gets the spotlight
        const spot = Math.floor(f.beat) % NL, sp = 1 - f.beatPhase;
        const gArr = lGlass.instanceColor.array;
        for (let n = 0; n < NL; n++) {
          const Ln = LANT[n];
          const rx = Ln.amp * Math.sin(L * Ln.k1 + Ln.ph) + 0.02 * kick * (n & 1 ? 1 : -1);
          const rz = Ln.amp * 1.2 * Math.sin(L * Ln.k2 + Ln.ph2);
          _q.setFromEuler(_e.set(rx, 0, rz));
          const sc = Ln.s, cs = (LS * sc) / U * 0.98;
          const fb = n * (nFo + 1);
          for (let c = 0; c < nFo; c++) {
            _v.set(fOff[c * 3] * sc, fOff[c * 3 + 1] * sc - Ln.rope, fOff[c * 3 + 2] * sc).applyQuaternion(_q).add(Ln.p);
            lFrame.setMatrixAt(fb + c, _m.compose(_v, _q, _s.set(cs, cs, cs)));
          }
          _v.set(0, -Ln.rope / 2, 0).applyQuaternion(_q).add(Ln.p);
          lFrame.setMatrixAt(fb + nFo, _m.compose(_v, _q, _s.set(0.35, Math.max(0.05, Ln.rope / U), 0.35)));
          const g = 0.45 + 0.25 * E + 0.25 * ch + 0.35 * kick + (n === spot ? 0.55 * sp * sp : 0);
          for (let c = 0; c < nGo; c++) {
            const o = (n * nGo + c) * 3;
            _v.set(gOff[c * 3] * sc, gOff[c * 3 + 1] * sc - Ln.rope, gOff[c * 3 + 2] * sc).applyQuaternion(_q).add(Ln.p);
            lGlass.setMatrixAt(n * nGo + c, _m.compose(_v, _q, _s.set(cs, cs, cs)));
            gArr[o] = gBase[o] * g; gArr[o + 1] = gBase[o + 1] * g; gArr[o + 2] = gBase[o + 2] * g;
          }
        }
        lFrame.instanceMatrix.needsUpdate = true; lGlass.instanceMatrix.needsUpdate = true; lGlass.instanceColor.needsUpdate = true;

        // mashrabiya stars: a ring of light ripples out of the portal every 2 beats; chorus alternates gold/turquoise per bar
        const ring = ((f.beat % 2) / 2) * 12, base = 0.3 + 0.3 * E + 0.15 * ch;
        const la = latM.mesh.instanceColor.array, bar = f.bar;
        for (let n = 0; n < latN; n++) {
          const dd = latD[n] - ring, w = Math.exp(-(dd * dd) / 0.8);
          const b = base + w * (0.4 + 0.35 * E) + 0.2 * kick + (latK[n] === 2 ? 0.25 * tek : 0);
          let R, G, B;
          if (latK[n] === 2) { R = 1; G = 0.72; B = 0.3; }
          else {
            const m = ch > 0.9 ? ((latP[n] + bar) & 1) : latP[n] * 0.18;
            R = 1 + (0.18 - 1) * m; G = 0.56 + (0.88 - 0.56) * m; B = 0.2 + (0.82 - 0.2) * m;
          }
          la[n * 3] = R * b; la[n * 3 + 1] = G * b; la[n * 3 + 2] = B * b;
        }
        latM.mesh.instanceColor.needsUpdate = true;

        // string lights: chase on half beats
        const ba = bulbs.instanceColor.array, step = Math.floor(f.beat * 2);
        const bb = 0.45 + 0.4 * E + 0.25 * ch;
        for (let n = 0; n < NB * 2; n++) {
          const lit = ((n % NB) + step) % 3 === 0 ? 1.5 : 0.35;
          const c = BULBC[n % 3], k = bb * lit + 0.2 * kick;
          ba[n * 3] = c[0] * k; ba[n * 3 + 1] = c[1] * k; ba[n * 3 + 2] = c[2] * k;
        }
        bulbs.instanceColor.needsUpdate = true;

        // crescents flare on crashes, windows breathe with the bar
        const ck = 0.8 + 0.25 * ch + 0.9 * crash;
        for (let n = 0; n < cresN; n++) cresM.setRGB(n, cresBase.r * ck, cresBase.g * ck, cresBase.b * ck);
        cresM.commitColor();
        const wk = 0.6 + 0.3 * E + 0.25 * Math.pow(1 - (f.beatInBar / 4), 2);
        for (let n = 0; n < winN; n++) winM.setRGB(n, winBase.r * wk, winBase.g * wk, winBase.b * wk);
        winM.commitColor();

        // carpet medallion gold threads pulse with the doum (kick)
        const mk = 1 + (0.6 + 0.6 * E) * kick;
        for (let n = 0; n < medIdx.length; n++) carpetM.setRGB(medIdx[n], medBase.r * mk, medBase.g * mk, medBase.b * mk);
        carpetM.commitColor();

        // palms sway gently
        for (let n = 0; n < palms.length; n++) { const g = palms[n].group; g.rotation.z = 0.025 * Math.sin(L * 3 + n * 1.7); g.rotation.x = 0.015 * Math.sin(L * 4 + n); }

        // fire + warm torch light
        const flick = 0.85 + 0.1 * Math.sin(L * 173) + 0.06 * Math.sin(L * 311 + 1.3);
        torchL.intensity = (4 + 3 * E + 5 * kick) * flick;
        torchR.intensity = (4 + 3 * E + 5 * tek) * (1.7 - flick);
        const fa = Math.min(1, 0.55 + 0.35 * E + 0.3 * ch);
        fires[0].update(f, fa); fires[1].update(f, fa);
        embers.update(f, 0.35 + 0.65 * E);
        sparks.update(f, ch > 0.9 ? 0.55 + 0.45 * E : 0);
        stars.update(f);
        crowd.update(f, ch > 0.9 ? 'dance' : f.section === 'bridge' ? 'wave' : 'sway', 0.3 + 0.5 * E);
      },
    };
  },
};
