// Turns a track's event lists (or a built-in idle groove) into the per-frame object `f` that scenes read.
// f is a PURE FUNCTION of (timeline, song position t). No Date.now/Math.random anywhere in scenes.
import { smoothstep } from './voxel.js';

export const LOOP = 60; // seconds: ambient scene motion loops every minute

function bsearch(a, t) { let lo = 0, hi = a.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }

export class Timeline {
  /** meta: {bpm, duration, sections, events:{drums:[[t,code,vel]],bass:[[t,midi,dur,vel]],guitar:[[t,root,dur,vel,dir,mute]],lead:[[t,midi,dur,vel]]}} */
  constructor(meta, { loopLen = 0 } = {}) {
    this.meta = meta;
    this.bpm = meta.bpm || 120;
    this.duration = meta.duration || 180;
    this.events = meta.events || {};
    this.sections = meta.sections || [];
    this.loopLen = loopLen;
    this.idx = {};
    for (const [inst, list] of Object.entries(this.events)) {
      const byCode = { '*': list.map((e) => e[0]) };
      if (inst === 'drums') {
        const tmp = {};
        list.forEach((e) => (tmp[e[1]] ||= []).push(e[0]));
        Object.assign(byCode, tmp);
      }
      this.idx[inst] = { list, byCode };
    }
    this._cache = new Map();
    this._ct = NaN;
  }

  sectionAt(t) {
    const s = this.sections;
    for (let i = 0; i < s.length; i++) if (t >= s[i].start && t < s[i].end) return { sec: s[i], next: s[i + 1], i };
    return { sec: s[s.length - 1] || { name: 'verse', energy: 0.6, start: 0, end: 9999 }, next: null, i: s.length - 1 };
  }

  _times(inst, code) {
    const e = this.idx[inst];
    if (!e) return null;
    if (code == null) return e.byCode['*'];
    if (Array.isArray(code)) {
      const key = code.join('|');
      return (e.byCode[key] ||= code.flatMap((c) => e.byCode[c] || []).sort((a, b) => a - b));
    }
    return e.byCode[code] || [];
  }

  /** build the frame object for song position t (seconds) */
  frame(t, out = {}) {
    const tl = this;
    if (tl.loopLen) t = t % tl.loopLen;
    const bpm = tl.bpm;
    const beat = Math.max(0, t) * bpm / 60;
    const { sec, next } = tl.sectionAt(t);
    // energy eases into the next section over the last 2 s
    let energy = sec.energy ?? 0.6;
    if (next && sec.end - t < 2) energy += ((next.energy ?? energy) - energy) * smoothstep(1 - (sec.end - t) / 2);
    const cache = new Map();
    out.t = t; out.loop = t % LOOP; out.loopP = out.loop / LOOP; out.bpm = bpm;
    out.beat = beat; out.bar = Math.floor(beat / 4); out.beatInBar = beat % 4; out.beatPhase = beat % 1;
    out.step = Math.floor(beat * 4); out.stepPhase = (beat * 4) % 1;
    out.energy = energy; out.section = sec.name; out.sectionP = (t - sec.start) / Math.max(0.001, sec.end - sec.start);
    out.track = tl.meta;
    /** seconds since the last matching event (Infinity if none yet). code: string | string[] | undefined */
    out.since = (inst, code) => {
      const key = inst + '|' + (Array.isArray(code) ? code.join(',') : code);
      let v = cache.get(key);
      if (v !== undefined) return v;
      const a = tl._times(inst, code);
      const i = a ? bsearch(a, t) : -1;
      v = i >= 0 ? t - a[i] : Infinity;
      cache.set(key, v);
      return v;
    };
    /** seconds until the next matching event */
    out.until = (inst, code) => {
      const a = tl._times(inst, code);
      if (!a) return Infinity;
      const i = bsearch(a, t) + 1;
      return i < a.length ? a[i] - t : Infinity;
    };
    /** exponential flash: 1 on the hit, decaying with time constant `decay` seconds */
    out.env = (inst, code, decay = 0.15) => { const s = out.since(inst, code); return s === Infinity ? 0 : Math.exp(-s / decay); };
    /** the most recent event row (e.g. last bass note [t,midi,dur,vel]) */
    out.last = (inst) => {
      const e = tl.idx[inst]; if (!e) return null;
      const i = bsearch(e.byCode['*'], t);
      return i >= 0 ? e.list[i] : null;
    };
    /** pulse on every beat: 1 on the beat, decaying */
    out.pulse = (decay = 0.2) => Math.exp(-out.beatPhase * (60 / bpm) / decay);
    return out;
  }
}

/** A built-in groove used when nothing is playing, so the stage never sits still. Pure function of vibe+bpm. */
export function idleTimeline(vibe, bpm = 120) {
  const beat = 60 / bpm, bars = Math.ceil(60 / (beat * 4));
  const ev = { drums: [], bass: [], guitar: [], lead: [] };
  const fourFloor = vibe === 'house' || vibe === 'synthwave';
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < 16; s++) {
      const t = (b * 16 + s) * beat / 4;
      if (s % 4 === 0 && (fourFloor || s % 8 === 0 || (s === 8 && b % 2))) ev.drums.push([t, 'k', 1]);
      if (s === 4 || s === 12) ev.drums.push([t, 's', 0.9]);
      if (s % 2 === 0) ev.drums.push([t, s % 8 === 6 && fourFloor ? 'o' : 'h', 0.5]);
      if (s % 2 === 0) ev.bass.push([t, [40, 40, 43, 38][b % 4] + (s === 14 ? 12 : 0), beat / 2, 0.8]);
    }
    for (const q of [0, 8]) ev.guitar.push([(b * 16 + q) * beat / 4, [52, 52, 55, 50][b % 4], beat * 2, 0.9, q ? -1 : 1, 0]);
  }
  return new Timeline({ bpm, duration: 60, sections: [{ name: 'verse', start: 0, end: 60, energy: 0.65 }], events: ev, idle: true }, { loopLen: 60 });
}
