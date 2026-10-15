// The HOST's audio engine: two <audio> decks (streams, low memory) -> gain -> master -> analyser -> speakers.
// Crossfades like a DJ when the server says so. Reports its position back so everybody's stage stays in sync.
export class HostPlayer {
  constructor(net) {
    this.net = net;
    this.ctx = null;
    this.decks = [];
    this.cur = -1;               // index of the deck whose track is "current"
    this.current = null;         // track meta
    this.unlocked = false;
    this.onChange = () => {};
  }

  async unlock() {
    if (this.unlocked) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.master = this.ctx.createGain(); this.master.gain.value = 0.95;
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 256;
    this.master.connect(this.analyser); this.analyser.connect(this.ctx.destination);
    for (let i = 0; i < 2; i++) {
      const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.playsInline = true;
      const src = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g); g.connect(this.master);
      el.addEventListener('ended', () => { if (this.decks[this.cur] === d && this.current) this.net.send({ type: 'ended', trackId: this.current.id }); });
      const d = { el, gain: g, track: null };
      this.decks.push(d);
    }
    await this.ctx.resume();
    // unlock both elements inside this user gesture (iOS/Android autoplay policy)
    const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    for (const d of this.decks) { d.el.src = silent; try { await d.el.play(); } catch { /* ignore */ } d.el.pause(); }
    this.unlocked = true;
    this.net.send({ type: 'audioReady' });
    setInterval(() => this._report(), 1000);
    try { this.wake = await navigator.wakeLock?.request('screen'); } catch { /* needs https */ }
  }

  /** current song position in seconds (or null) */
  position() {
    const d = this.decks[this.cur];
    if (!d || !this.current) return null;
    // compensate output latency so visuals land with what you HEAR
    return Math.max(0, d.el.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0));
  }
  level() {
    if (!this.analyser) return 0;
    const a = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteTimeDomainData(a);
    let s = 0; for (const v of a) s += Math.abs(v - 128); return s / a.length / 64;
  }

  pause() { this.paused = true; this.decks.forEach((d) => d.el.pause()); }
  resume() { this.paused = false; const d = this.decks[this.cur]; if (d && this.current) d.el.play().catch(() => {}); this.ctx && this.ctx.resume(); }

  async play(track, { fade = 0, delay = 0, startPos = 0, soft = false, paused = false } = {}) {
    if (!this.unlocked) return;
    const same = this.current && this.current.id === track.id && this.decks[this.cur];
    if (soft && same && (!this.decks[this.cur].el.paused || paused)) { this.paused = paused; return; }
    this.paused = paused;
    const idx = this.cur < 0 ? 0 : 1 - this.cur;
    const d = this.decks[idx];
    d.track = track;
    d.el.src = `/tracks/${track.file}`;
    d.el.load();
    await new Promise((res) => { const done = () => res(); d.el.addEventListener('canplay', done, { once: true }); setTimeout(done, 4000); });
    const start = () => {
      const out = this.decks[this.cur];
      const t0 = this.ctx.currentTime;
      const n = 64, up = new Float32Array(n), dn = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1); up[i] = Math.sin(x * Math.PI / 2); dn[i] = Math.cos(x * Math.PI / 2); }
      d.el.currentTime = startPos || 0;
      if (!paused) d.el.play().catch((e) => console.warn('play blocked', e));
      d.gain.gain.cancelScheduledValues(t0);
      if (fade > 0 && out && this.current) {
        d.gain.gain.setValueCurveAtTime(up, t0, fade);
        out.gain.gain.cancelScheduledValues(t0);
        out.gain.gain.setValueCurveAtTime(dn, t0, fade);
        setTimeout(() => { if (this.decks[this.cur] !== out) { out.el.pause(); } }, fade * 1000 + 300);
      } else {
        d.gain.gain.setValueAtTime(1, t0);
        if (out && out !== d) { out.gain.gain.setValueAtTime(0, t0); out.el.pause(); }
      }
      this.cur = idx; this.current = track;
      this.onChange(track);
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: 'AI Radio · ' + track.vibe, album: 'Claude Band' }); } catch { /* ok */ }
      }
    };
    if (delay > 0.05) setTimeout(start, delay * 1000 - 40); else start();
  }

  _report() {
    const d = this.decks[this.cur];
    if (!d || !this.current) return;
    if (this.paused) return;
    this.net.send({ type: 'pos', trackId: this.current.id, pos: d.el.currentTime, playing: !d.el.paused });
    if (d.el.paused && !d.el.ended) { d.el.play().catch(() => {}); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
}
