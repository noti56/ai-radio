// WebSocket client with auto-reconnect, server clock sync and a tiny event emitter.
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } return null; };
export { LS };

export class Net {
  constructor() {
    this.handlers = {};
    this.state = null;
    this.role = 'guest';
    this.offset = 0;                 // serverNow = Date.now() + offset
    this.connected = false;
    this.clientId = LS('radio.id') || Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    LS('radio.id', this.clientId);
    this.wantHost = false; // role is chosen on every visit (host token is remembered so the host can reclaim the seat)
    this.name = LS('radio.name') || '';
    this.avatar = LS('radio.avatar') || '🎧';
    this.vibes = [];
    this._best = Infinity;
  }
  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return this; }
  emit(evt, ...a) { (this.handlers[evt] || []).forEach((f) => f(...a)); }
  serverNow() { return Date.now() + this.offset; }

  setProfile(name, avatar) { this.name = name; this.avatar = avatar; LS('radio.name', name); LS('radio.avatar', avatar); this.send({ type: 'setName', name, avatar }); }
  setWantHost(v) { this.wantHost = v; LS('radio.role', v ? 'host' : 'guest'); if (this.ws && this.ws.readyState === 1) this.hello(); }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = this.ws = new WebSocket(`${proto}://${location.host}/radio-ws`);
    ws.onopen = () => { this.connected = true; this.hello(); this.emit('connection', true); this._pingLoop(); };
    ws.onclose = () => { this.connected = false; this.emit('connection', false); clearInterval(this._pi); setTimeout(() => this.connect(), 1500); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      switch (m.type) {
        case 'welcome':
          this.role = m.role; this.vibes = m.vibes || this.vibes;
          if (m.hostToken) LS('radio.hostToken', m.hostToken);
          if (m.hostTaken) { this.wantHost = false; LS('radio.role', 'guest'); }
          this.emit('welcome', m);
          break;
        case 'pong': {
          const now = Date.now(), rtt = now - m.t;
          if (rtt <= this._best + 15) { this._best = Math.min(this._best, rtt); this.offset = m.s + rtt / 2 - now; }
          break;
        }
        case 'state': this.state = m.state; this.emit('state', m.state); break;
        default: this.emit(m.type, m);
      }
    };
  }
  hello() {
    this.send({ type: 'hello', clientId: this.clientId, name: this.name || 'Guest', avatar: this.avatar, wantHost: this.wantHost, hostToken: LS('radio.hostToken') || undefined });
  }
  _pingLoop() {
    const ping = () => this.send({ type: 'ping', t: Date.now() });
    ping(); setTimeout(ping, 300); setTimeout(ping, 900);
    this._pi = setInterval(() => { this._best = Math.min(this._best + 10, 400); ping(); }, 8000);
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
}
