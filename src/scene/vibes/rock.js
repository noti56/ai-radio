// ROCK: black stage, amp walls, truss with sweeping spots, pyro flames, headbanging crowd.
// REFERENCE VIBE: copy this file's shape for new vibes.
//   export default { id, label, idleBpm, palette, lights, fog, bloom, exposure, cam, band, build(ctx) -> { group, update(f) } }
// Rules: deterministic (no Math.random / Date.now: use ctx.rng(seed) at build time, pure functions of `f` in update),
// everything is voxel cubes (Builder / helpers), keep it < ~20k instances, loop-friendly (use f.loopP for 60 s cycles).
export default {
  id: 'rock',
  label: 'Rock',
  idleBpm: 124,
  palette: { skyTop: 0x1b0a12, skyBottom: 0x050206, glow: 0x7a1220, accent: 0xff3b30, flash: 0xff5a3c },
  lights: { hemi: [0xffd9c8, 0x2a1015, 0.55], key: [0xffc9a0, 1.9], rim: [0xff3b30, 1.2] },
  fog: { color: 0x0a0408, near: 22, far: 70 },
  bloom: { strength: 0.65, radius: 0.55, threshold: 0.8 },
  exposure: 1.05,
  cam: { punch: 0.8, shake: 0.7 },
  band: {
    guitar: 'electric', bass: 'bass', drums: 'kit',
    colors: { guitar: 0xd9261c, bass: 0x20242c, kit: 0x1c1c22, accent: 0xffd24a },
    costumes: {
      guitar: [['mohawk', 0xff3b30, 0xffa000], ['shades', 0x111114]],
      bass: [['spikes', 0x1a1a1f], ['bandana', 0xd9261c]],
      drums: [['bandana', 0xf2f2f2], ['shades', 0x111114]],
    },
    moves: { guitar: 'headbang', bass: 'headbang', drums: 'pound', intensity: 1.15 },
    layout: { spread: 3.6, drumsZ: -2.7 },
  },

  build({ THREE, V, H, rng }) {
    const { Builder, voxelText, U, shade, mixHex } = V;
    const group = new THREE.Group();
    const r = rng(77);
    const ink = 0x15151a, steel = 0x3a3d46, red = 0xd9261c, amber = 0xffa000;

    // ---- stage deck with glowing edge strips
    const deck = new Builder();
    deck.box(-44, -3, -30, 88, 3, 74, (x, y, z) => (((x >> 2) + (z >> 2)) & 1 ? 0x24242c : 0x1b1b21));
    const deckM = deck.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.04, seed: 3 });
    group.add(deckM.group);
    const strip = new Builder();
    strip.box(-44, 0, 43, 88, 1, 1, amber).box(-44, 0, -30, 88, 1, 1, red).box(-44, 0, -30, 1, 1, 74, red).box(43, 0, -30, 1, 1, 74, red);
    const stripM = strip.build({ anchor: 'none', pivot: [0, 0, 0], emissive: 1.4, castShadow: false, jitter: 0 });
    group.add(stripM.group);

    // ---- back wall of amp stacks
    const amps = new Builder();
    const cab = (ox, oy, oz) => {
      amps.box(ox, oy, oz, 12, 12, 6, ink);
      for (let gx = 0; gx < 2; gx++) for (let gy = 0; gy < 2; gy++) {
        amps.box(ox + 1 + gx * 5, oy + 1 + gy * 5, oz + 6, 4, 4, 1, 0x2a2d35);
        amps.box(ox + 2 + gx * 5, oy + 2 + gy * 5, oz + 6, 2, 2, 1, 0x0b0b0e);
      }
      amps.box(ox, oy + 10, oz + 6, 12, 2, 1, steel);
      amps.box(ox + 1, oy + 11, oz + 7, 3, 1, 1, red);
    };
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) for (let lvl = 0; lvl < 2; lvl++) {
      cab(sx * (22 + i * 13) - (sx > 0 ? 0 : 12) - (sx > 0 ? 0 : 0), lvl * 12, -29);
    }
    const ampM = amps.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.03, seed: 4 });
    group.add(ampM.group);

    // ---- truss + hanging cans with real beams
    const truss = new Builder();
    truss.box(-42, 36, -16, 84, 1, 1, steel).box(-42, 40, -16, 84, 1, 1, steel).box(-42, 36, 14, 84, 1, 1, steel).box(-42, 40, 14, 84, 1, 1, steel);
    for (let x = -42; x <= 42; x += 6) { truss.box(x, 36, -16, 1, 5, 1, steel); truss.box(x, 36, 14, 1, 5, 1, steel); }
    for (const z of [-16, 14]) for (const x of [-42, 41]) truss.box(x, 0, z, 1, 36, 1, steel);
    const trussM = truss.build({ anchor: 'none', pivot: [0, 0, 0], jitter: 0.02, seed: 5 });
    group.add(trussM.group);

    const beamCols = [0xff3b30, 0xffa000, 0xffffff, 0xff3b30, 0xffa000, 0xffffff];
    const beams = beamCols.map((c, i) => {
      const bm = H.beam({ color: c, length: 15, radius: 1.5, opacity: 0.2 });
      bm.group.position.set(-6 + i * 2.4, 8.1, i % 2 ? 2.8 : -2.4);
      group.add(bm.group);
      return bm;
    });

    // ---- ROCK sign
    const signB = voxelText('ROCK', { color: (ci) => [red, amber, red, amber][ci], depth: 2 });
    const sign = signB.build({ anchor: 'center', emissive: 1.1, castShadow: false, jitter: 0 });
    sign.group.scale.setScalar(0.9);
    sign.group.position.set(0, 5.2, -4.6);
    group.add(sign.group);

    // ---- pyro columns at both sides
    const flameCols = [0xff3b00, 0xff8a00, 0xffd24a];
    const pyro = [-6.2, 6.2].map((x) => {
      const p = H.confetti({ count: 50, colors: flameCols, origin: [x, 0.2, -1.5], spread: [0.7, 0.7], mode: 'rise', up: 3.2, life: 1.1, size: 0.28, emissive: 1.8, seed: x > 0 ? 3 : 4, sway: 0.25 });
      group.add(p.group); return p;
    });
    const pyroBase = new Builder().box(-2, 0, -2, 4, 3, 4, steel).box(-1, 3, -1, 2, 1, 2, red);
    for (const x of [-6.2, 6.2]) { const pm = pyroBase.build({ anchor: 'base', jitter: 0.02, emissive: 0.2 }); pm.group.position.set(x, 0, -1.5); group.add(pm.group); }

    // ---- crowd (headbanging, hands in the air)
    const crowd = H.crowd({ rows: 4, cols: 18, spacing: 0.9, z0: 8.2, y0: -0.6, palette: [0x15151a, 0x2a1015, 0x3a3d46, 0xd9261c, 0x1a2230], style: 'headbang', hands: 0.65, seed: 12, rise: 0.0, rowStep: 0.95 });
    group.add(crowd.group);

    // ---- sparks falling from the truss during choruses
    const sparks = H.confetti({ count: 70, colors: [0xffd24a, 0xff8a00, 0xffffff], origin: [0, 9, 0], spread: [14, 10], mode: 'fall', life: 3.2, size: 0.1, emissive: 2, seed: 8 });
    group.add(sparks.group);

    // ---- colour wash
    const wash1 = new THREE.PointLight(0xff3b30, 10, 14, 1.6); wash1.position.set(-5, 4, 3);
    const wash2 = new THREE.PointLight(0xffa000, 8, 14, 1.6); wash2.position.set(5, 4, 3);
    group.add(wash1, wash2);

    return {
      group,
      update(f) {
        const kick = f.env('drums', 'k', 0.13), snare = f.env('drums', ['s', 'cl'], 0.12), crash = f.env('drums', 'c', 0.5);
        const chorus = f.section === 'chorus' ? 1 : f.section === 'bridge' ? 0.3 : 0.12;
        // sweeping beams (period divides the 60 s loop)
        beams.forEach((bm, i) => {
          const k = 2 + (i % 3);
          const swing = Math.sin(f.loopP * Math.PI * 2 * k + i) * 0.5;
          bm.group.rotation.set(0.1 + swing * 0.6 * (i % 2 ? 1 : -1), 0, swing * 0.8);
          bm.setOpacity(0.07 + 0.1 * f.energy + 0.2 * kick * chorus + 0.1 * crash);
        });
        sign.group.scale.setScalar(0.9 + 0.08 * kick);
        wash1.intensity = 5 + 12 * kick * f.energy; wash2.intensity = 4 + 12 * snare * f.energy;
        pyro.forEach((p) => p.update(f, clamp01(crash * 2 + (chorus > 0.9 ? 0.6 : 0))));
        sparks.update(f, chorus);
        crowd.update(f, 'headbang', 0.35 + 0.6 * f.energy);
      },
    };
  },
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
