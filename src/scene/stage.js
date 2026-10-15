// Stage runtime: renderer, post stack, lighting rig, 60-second looping camera, vibe loading/transitions.
import * as V from './voxel.js';
import * as H from './helpers.js';
import { createBand } from './band.js';
import { Timeline, idleTimeline, LOOP } from './timeline.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const { THREE } = V;
const loaders = import.meta.glob('./vibes/*.js');
const c = (h) => new THREE.Color(h);

/** shots of the 60 s camera loop: [position, lookAt] relative to a 7-unit wide band (x of players is +-3.5) */
const SHOTS = [
  [[0, 3.4, 15.5], [0, 1.9, 0]],
  [[-5.2, 2.8, 9.5], [-3.4, 1.9, 0.6]],
  [[-1.5, 2.9, 8.2], [0, 1.8, -1.2]],
  [[4.6, 2.2, 8.4], [3.4, 1.7, 0.6]],
  [[1.4, 2.6, 5.6], [0, 1.6, -2.4]],
  [[0, 8.2, 11.5], [0, 0.6, -1.0]],
  [[-11, 3.6, 8], [0, 1.9, 0]],
  [[0, 2.4, 14], [0, 2.4, 0]],
  [[10.5, 3.8, 8.5], [0, 1.9, 0]],
  [[0, 5.2, 12.5], [0, 1.6, 0]],
];

export class Stage {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    this.clock = null;                 // () => ({ timeline, t })
    this.f = {};
    this.vibe = null; this.vibeId = null;
    this.leaving = [];
    this.transitionT = 1;
    this.wallT = 0;
    this._setup();
  }

  _setup() {
    const q = this.quality;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q === 'low', powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'mid' ? 1.5 : 1);
    r.setPixelRatio(dpr);
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = q !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x101018, 28, 90);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);

    this.lights = {
      hemi: new THREE.HemisphereLight(0xffffff, 0x666666, 1),
      key: new THREE.DirectionalLight(0xffffff, 2.2),
      rim: new THREE.DirectionalLight(0xffffff, 0.8),
    };
    const key = this.lights.key;
    key.position.set(6, 12, 10); key.castShadow = q !== 'low';
    const sz = q === 'high' ? 2048 : 1024; key.shadow.mapSize.set(sz, sz);
    const sc = key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -8; sc.near = 1; sc.far = 50;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
    this.lights.rim.position.set(-8, 6, -10);
    this.scene.add(this.lights.hemi, key, key.target, this.lights.rim);

    // gradient backdrop
    this.bgU = { uTop: { value: c(0x202030) }, uBot: { value: c(0x08080c) }, uGlow: { value: c(0x000000) }, uPulse: { value: 0 } };
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.bgU, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uGlow; uniform float uPulse; void main(){ vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, vUv.y)); float g = max(0.0, 1.0 - distance(vUv, vec2(0.5, 0.45)) * 1.5); col += uGlow * g * (0.35 + uPulse); gl_FragColor = vec4(col, 1.0); }',
    }));
    bg.frustumCulled = false; bg.renderOrder = -1000; this.scene.add(bg);

    this.band = createBand();
    this.scene.add(this.band.group);

    // post
    if (q !== 'low') {
      const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: q === 'high' ? 4 : 2 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.85);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.gradeU = { tDiffuse: { value: null }, uVig: { value: 0.35 }, uFlash: { value: 0 }, uFlashC: { value: c(0xffffff) } };
      this.composer.addPass(new ShaderPass({
        uniforms: this.gradeU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uVig; uniform float uFlash; uniform vec3 uFlashC; void main(){ vec3 col = texture2D(tDiffuse, vUv).rgb; float d = distance(vUv, vec2(0.5)); col *= 1.0 - uVig * smoothstep(0.35, 0.95, d); col = mix(col, uFlashC, uFlash); gl_FragColor = vec4(col, 1.0); }',
      }));
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.aspect; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    if (this.bloom) this.bloom.resolution.set(w / 2, h / 2);
  }

  ctx() {
    return { THREE, V, H, band: this.band, scene: this.scene, lights: this.lights, quality: this.quality, rng: V.rng, aspect: this.aspect };
  }

  /** switch vibe (loads the module lazily). Transition ~1.4 s. */
  async setVibe(id, { instant = false } = {}) {
    if (this.vibeId === id) return;
    const key = `./vibes/${id}.js`;
    let mod;
    try { mod = await (loaders[key] || loaders['./vibes/rock.js'])(); } catch (e) { console.warn('vibe load failed', id, e); mod = await loaders['./vibes/rock.js'](); }
    const def = mod.default;
    if (this.vibe) {
      this.leaving.push({ ...this.vibe, t0: this.wallT });
    }
    const built = def.build(this.ctx());
    this.scene.add(built.group);
    this.vibe = { def, built, group: built.group, t0: this.wallT };
    this.vibeId = id;
    this._applyLook(def);
    this.band.configure(def.band || {});
    if (this.timeline) this.band.setTimeline(this.timeline);
    this.transitionStart = instant ? -10 : this.wallT;
    if (this.gradeU) { this.gradeU.uFlash.value = instant ? 0 : 0.9; this.gradeU.uFlashC.value.setHex(def.palette?.flash ?? def.palette?.accent ?? 0xffffff); }
  }

  _applyLook(def) {
    const p = def.palette || {};
    this.bgU.uTop.value.setHex(p.skyTop ?? 0x202030); this.bgU.uBot.value.setHex(p.skyBottom ?? 0x08080c); this.bgU.uGlow.value.setHex(p.glow ?? 0x000000);
    const L = def.lights || {};
    const h = L.hemi || [0xffffff, 0x555566, 0.9]; this.lights.hemi.color.setHex(h[0]); this.lights.hemi.groundColor.setHex(h[1]); this.lights.hemi.intensity = h[2];
    const k = L.key || [0xfff0dd, 2.0]; this.lights.key.color.setHex(k[0]); this.lights.key.intensity = k[1];
    const r = L.rim || [0xffffff, 0.8]; this.lights.rim.color.setHex(r[0]); this.lights.rim.intensity = r[1];
    const fog = def.fog || {}; this.scene.fog.color.setHex(fog.color ?? p.skyBottom ?? 0x101018); this.scene.fog.near = fog.near ?? 28; this.scene.fog.far = fog.far ?? 90;
    const bl = def.bloom || {};
    if (this.bloom) { this.bloom.strength = bl.strength ?? 0.5; this.bloom.radius = bl.radius ?? 0.5; this.bloom.threshold = bl.threshold ?? 0.85; }
    this.renderer.toneMappingExposure = def.exposure ?? 1.0;
    this.cam = { punch: 0, shake: 0, orbit: 1, height: 1, dist: 1, ...(def.cam || {}) };
  }

  setTimeline(tl) {
    this.timeline = tl;
    this.band.setTimeline(tl);
  }

  _cameraAt(f) {
    const n = SHOTS.length;
    // smooth spline through the shots over one 60 s loop, easing so each shot holds a moment
    const u = f.loopP * n;
    const i = Math.floor(u), k = u - i;
    const e = V.smoothstep(V.smoothstep(k));                       // hold then move
    const g = (j) => SHOTS[((j % n) + n) % n];
    const cr = (a, b, c2, d, t) => 0.5 * ((2 * b) + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    for (let ax = 0; ax < 3; ax++) {
      pos.setComponent(ax, cr(g(i - 1)[0][ax], g(i)[0][ax], g(i + 1)[0][ax], g(i + 2)[0][ax], e));
      tgt.setComponent(ax, cr(g(i - 1)[1][ax], g(i)[1][ax], g(i + 1)[1][ax], g(i + 2)[1][ax], e));
    }
    return { pos, tgt };
  }

  /** wallDt in seconds */
  frame(wallDt) {
    this.wallT += wallDt;
    const clk = this.clock ? this.clock() : null;
    let tl = clk && clk.timeline;
    if (!tl) { tl = this.idle ||= {}; const key = (this.vibeId || 'rock'); tl = this.idle[key] ||= idleTimeline(key, this.vibe?.def?.idleBpm || 120); }
    if (tl !== this.timeline) { this.timeline = tl; this.band.setTimeline(tl); }
    const t = clk && clk.timeline ? clk.t : this.wallT;
    const f = tl.frame(t, this.f);
    f.wall = this.wallT; f.dt = wallDt; f.quality = this.quality;

    // vibe transition animation
    const tt = (this.wallT - (this.transitionStart ?? -10)) / 1.4;
    if (this.vibe) {
      const s = V.clamp(tt);
      this.vibe.group.scale.setScalar(Math.max(1e-3, V.easeOutBack(s, 1.3)));
      this.band.setPop(V.clamp((tt - 0.15) / 0.85));
      if (this.gradeU) this.gradeU.uFlash.value = Math.max(0, 0.9 * (1 - V.smoothstep(tt * 3)));
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      const s = (this.wallT - this.transitionStart) / 0.5;
      l.group.scale.setScalar(Math.max(1e-3, 1 - V.easeInCubic(s)));
      if (s >= 1) { this.scene.remove(l.group); l.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.material && o.material.isMeshBasicMaterial) { o.geometry.dispose(); o.material.dispose(); } }); this.leaving.splice(i, 1); }
    }

    this.band.update(f);
    if (this.vibe) this.vibe.built.update(f);

    // camera
    const { pos, tgt } = this._cameraAt(f);
    const a = this.aspect;
    const wide = a < 1.35 ? V.lerp(1, 2.05, V.clamp((1.35 - a) / 0.9)) : 1;
    const cm = this.cam || { punch: 0, shake: 0, dist: 1, height: 1 };
    const off = pos.clone().sub(tgt);
    off.multiplyScalar(wide * cm.dist); off.y *= cm.height;
    pos.copy(tgt).add(off);
    const kick = f.env('drums', 'k', 0.12);
    if (cm.shake) { const sh = cm.shake * kick; pos.x += Math.sin(f.t * 61) * 0.06 * sh; pos.y += Math.cos(f.t * 53) * 0.06 * sh; }
    this.camera.position.copy(pos);
    this.camera.lookAt(tgt);
    this.camera.fov = 36 - cm.punch * kick * 1.6;
    this.camera.updateProjectionMatrix();

    this.bgU.uPulse.value = 0.25 * kick;
    // key light follows the band for shadows
    this.lights.key.target.position.set(0, 0, 0);

    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
