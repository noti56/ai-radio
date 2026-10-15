"""Synthwave / outrun: gated-reverb snare, Linn-style kit with tom fills, driving 8th-note octave saw bass,
lush detuned supersaw pads, 16th sequencer arp with delay, soaring delayed lead melody (hook repeats every chorus),
minor-key i-VI-III-VII / i-VII-VI-VII progressions, half-time breakdown bridge."""
import numpy as np
from engine import *
from engine import _fit

NAME = 'Synthwave'
BPMS = [100, 104, 108, 112, 116]
KEYS = [45, 47, 48, 50, 52, 42]          # A, B, C, D, E, F# minor (chord register)
TITLES = (['Neon', 'Midnight', 'Chrome', 'Electric', 'Crimson', 'Retro', 'Laser', 'Sunset', 'Turbo', 'Velvet'],
          ['Drive', 'Horizon', 'Boulevard', 'Skyline', 'Runner', 'Dreams', 'Overdrive', 'Coast', 'Grid', 'Nights'])

PROGS = [[0, 5, 2, 6], [0, 6, 5, 6], [5, 6, 0, 0], [0, 3, 5, 6], [0, 5, 3, 6], [0, 2, 5, 6], [5, 2, 6, 0]]
RHY = [  # 2-bar lead rhythms in 16ths: (start, length)
    [(0, 6), (6, 2), (8, 4), (12, 4), (16, 6), (22, 2), (24, 8)],
    [(0, 3), (3, 3), (6, 2), (8, 8), (16, 3), (19, 3), (22, 2), (24, 8)],
    [(2, 2), (4, 4), (8, 2), (10, 6), (18, 2), (20, 4), (24, 4), (28, 4)],
    [(0, 8), (8, 4), (12, 4), (16, 4), (20, 4), (24, 8)],
    [(0, 4), (4, 2), (6, 6), (12, 4), (16, 4), (20, 2), (22, 10)],
]


# ----------------------------------------------------------------------------- helpers / voices
def bsaw(f, dur, phase=0.0):
    """band-limited (polyBLEP) saw."""
    n = int(dur * SR)
    f = np.full(n, float(f)) if np.isscalar(f) else _fit(np.asarray(f, dtype=np.float64), n)
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    y[m] -= t * t + t + t + 1
    return y


def bpulse(f, dur, w=0.5, phase=0.0):
    return bsaw(f, dur, phase) - bsaw(f, dur, phase + w)


def _fade(x, ms=6):
    k = min(x.shape[-1], int(ms * SR / 1000))
    x[..., -k:] *= np.linspace(1, 0, k)
    x[..., :8] *= np.linspace(0, 1, 8)
    return x


def _fit_len(c, lo=126.0, hi=178.0):
    """Keep the song in the 2-3 min window regardless of tempo (re-plans Ctx sections if needed)."""
    if lo <= c.duration <= hi:
        return
    cands = []
    for k in (1, 1.5, 2):
        d = sum(p[1] for p in make_plan(k)) * c.bar_s
        cands.append((0 if lo <= d <= hi else min(abs(d - lo), abs(d - hi)), abs(d - 150), k))
    k = min(cands)[2]
    c.k = k
    c.sections, bar = [], 0
    for name, bars, en in make_plan(k):
        c.sections.append(Section(name, bar, bars, en))
        bar += bars
    c.total_bars = bar
    c.duration = bar * c.bar_s
    c.mix = Mixer(c.duration + 2.5, c.rng)


def voicing(root, scale, deg, size=3, center=60):
    out = []
    for n in diatonic_chord(root, scale, deg, size):
        while n >= center + 6: n -= 12
        while n < center - 6: n += 12
        out.append(n)
    return sorted(out)


def supersaw(notes, dur, rng, bright=2400, att=0.35):
    n = int(dur * SR)
    L, R = np.zeros(n), np.zeros(n)
    det = (-0.018, -0.011, -0.004, 0.0, 0.005, 0.012, 0.019)
    for m in notes:
        f = midi_hz(m)
        for j, dc in enumerate(det):
            v = bsaw(f * (1 + dc), dur, rng.random())
            p = (j / (len(det) - 1)) * 2 - 1           # spread voices across the stereo field
            L += v * (0.5 - 0.4 * p)
            R += v * (0.5 + 0.4 * p)
    e = adsr(n, att, 0.6, 0.8, min(0.6, dur * 0.3))
    st = np.stack([lp(L * e, bright, 2), lp(R * e, bright, 2)])
    st = hp(st, 120)
    return _fade(st / (len(notes) * 4.0), 20)


def bass_voice(m, dur, bright=1.0):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bsaw(f, dur) + 0.5 * bsaw(f * 1.004, dur, 0.3)
    x = lp_sweep(x, 280 + 1500 * bright * np.exp(-t / 0.07) + f, 5)
    x = x + 0.6 * np.sin(2 * np.pi * f * t)
    x = softclip(x * adsr(n, 0.003, 0.08, 0.75, 0.03), 1.4)
    return _fade(x, 4)


def arp_voice(m, dur, rng):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bpulse(f, dur, 0.3, rng.random()) + 0.4 * bsaw(f * 2.002, dur)
    x = lp_sweep(x, 900 + 3500 * np.exp(-t / 0.05), 5)
    return _fade(x * adsr(n, 0.002, 0.07, 0.35, 0.04) * 0.6, 4)


def lead_voice(m, dur, rng, prev=None):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.18) / 0.3, 0, 1)
    fr = f * vib
    if prev is not None:                              # short portamento from previous note
        fr = fr * (midi_hz(prev) / f) ** np.exp(-t / 0.025)
    x = bsaw(fr * 0.9965, dur) + bsaw(fr * 1.0035, dur, 0.4) + 0.6 * bpulse(fr * 0.5, dur, 0.5)
    x = lp_sweep(x, 3000 + 2500 * np.exp(-t / 0.25), 5)
    x = softclip(x * adsr(n, 0.015, 0.2, 0.8, min(0.15, dur * 0.3)) * 0.6, 1.4)
    return _fade(x, 8)


def gated_snare(rng, tone=200, gate=0.22):
    d = gate + 0.05
    n = int(d * SR)
    t = np.arange(n) / SR
    body = snare(rng, tone, 0.2, 0.9)
    body = np.concatenate([body, np.zeros(n - len(body))]) if len(body) < n else body[:n]
    tail = lp(hp(rng.standard_normal(n), 400), 7000, 2)
    # dense 'room' tail that stays flat and is then gated hard
    g = np.where(t < gate, 0.55 * (1 - 0.35 * t / gate), 0.55 * 0.65 * np.exp(-(t - gate) / 0.012))
    tail = tail * g * (1 - np.exp(-t / 0.004))
    return _fade(softclip(body * 0.9 + tail, 1.3), 6)


# ----------------------------------------------------------------------------- melody
def make_phrase(rng, rhythm, chord_degs, start_deg, lo=-2, hi=9, resolve=True):
    """rhythm over 2 bars; chord_degs: chord degree per bar (len 2). Returns [(start16, len16, deg)]."""
    out, deg = [], start_deg
    for k, (s, ln) in enumerate(rhythm):
        cd = chord_degs[min(1, s // 16)]
        tones = [cd + o for o in (-7, -5, -3, 0, 2, 4, 7, 9, 11)]
        strong = s % 8 == 0 or ln >= 6
        if strong:
            cand = [x for x in tones if lo <= x <= hi]
            deg = min(cand, key=lambda x: abs(x - deg) + rng.random() * 2.5)
        else:
            deg = int(np.clip(deg + rng.choice([-2, -1, -1, 1, 1, 2, 3]), lo, hi))
        if resolve and k == len(rhythm) - 1:
            cand = [x for x in tones if lo <= x <= hi]
            deg = min(cand, key=lambda x: abs(x - deg))
        out.append((s, ln, deg))
    return out


# ----------------------------------------------------------------------------- compose
def compose(c):
    _fit_len(c)
    rng, root = c.rng, c.root
    scale = c.brief.get('scale') or 'minor'
    pv = PROGS[int(rng.integers(len(PROGS)))]
    pc = PROGS[int(rng.integers(len(PROGS)))]
    if c.brief.get('progression'):
        pv = pc = c.brief['progression']
    four = rng.random() < 0.5                         # four-on-the-floor in choruses
    bass_mode = int(rng.integers(3))                  # 0 octave pulse, 1 straight 8ths, 2 r r 8va r
    arp_shape = [[0, 1, 2, 3], [0, 1, 2, 1], [0, 2, 1, 3], [3, 2, 1, 0], [0, 1, 2, 3, 2, 1, 0, 1]][int(rng.integers(5))]
    rv = RHY[int(rng.integers(len(RHY)))]
    rc = RHY[int(rng.integers(len(RHY)))]
    add9 = rng.random() < 0.4

    m = c.mix
    KT = []
    m.stem('drums', 0.7, 0.14)
    m.stem('bass', 0.7, 0.02, fx=lambda y: duck(y, KT, 0.35, 0.08))
    m.stem('pad', 1.9, 0.35, fx=lambda y: duck(y, KT, 0.3, 0.2))
    m.stem('arp', 0.7, 0.25, fx=lambda y: echo(y, 0.75 * c.beat, 0.35, 4, 2800))
    m.stem('lead', 0.42, 0.4, fx=lambda y: echo(y, 0.75 * c.beat, 0.42, 5, 2600))

    K = kick(rng, 135, 50, 0.45, 0.22, 1.7)
    SN = [gated_snare(rng, 190 + 8 * i) for i in range(3)]
    CL = clap(rng, 0.25) * 0.6
    HC = [hat(rng, 0.04, tone=7600) * 0.8 for _ in range(3)]
    HO = hat(rng, open_=True, tone=7600)
    CR = crash(rng, 2.2)
    TM = [tom(rng, f, 0.45) for f in (220, 165, 120)]
    TM = [lp(x, 5000) for x in TM]

    def prog(sec):
        return pc if sec.name in ('chorus', 'outro', 'bridge') else pv

    def deg_at(sec, b):
        return prog(sec)[(b - sec.bar) % 4]

    def is_fill(sec, b):
        return b == sec.bar + sec.bars - 1 and sec.name not in ('outro',)

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            t0 = c.t(b)
            fill = is_fill(sec, b)
            name = sec.name
            if name == 'intro':
                if i < 2:
                    continue
                kpat, spat, hpat = [0, 8], [], list(range(0, 16, 4))
            elif name == 'bridge':
                if i < 4:
                    continue
                kpat, spat, hpat = [0, 10], [8], list(range(0, 16, 2))
            elif name == 'outro':
                if i >= 2:
                    continue
                kpat, spat, hpat = [0, 8], [4, 12], list(range(0, 16, 2))
            elif name == 'chorus':
                kpat = [0, 4, 8, 12] if four else [0, 8, 10]
                spat, hpat = [4, 12], list(range(0, 16, 1 if sec.energy > 0.92 else 2))
            else:
                kpat = [0, 8] + ([10] if rng.random() < 0.35 else [])
                spat, hpat = [4, 12], list(range(0, 16, 2))
            for s in range(16):
                t = t0 + s * c.step
                if fill and s >= 8:
                    if s % 2 == 0 or s >= 12:
                        k = min(2, (s - 8) // 3)
                        m.add('drums', TM[k], t, 0.75, [-0.45, 0.0, 0.45][k]); c.ev('drums', t, 't%d' % (k + 1), 0.9)
                    if s == 8 or (s in kpat):
                        m.add('drums', K, t, 0.9); KT.append(t); c.ev('drums', t, 'k', 0.9)
                    continue
                if s in kpat:
                    m.add('drums', K, t, 1.0); KT.append(t); c.ev('drums', t, 'k', 1.0)
                if s in spat:
                    m.add('drums', SN[int(rng.integers(3))], t, 0.85, 0.05); c.ev('drums', t, 's', 0.95)
                    if name == 'chorus':
                        m.add('drums', CL, t + 0.004, 0.6, -0.1)
                if s in hpat:
                    op = name == 'chorus' and s % 8 == 6
                    v = (0.62 if s % 4 == 0 else 0.45 if s % 2 == 0 else 0.3) + rng.random() * 0.08
                    m.add('drums', HO if op else HC[int(rng.integers(3))], t, v * (0.8 if op else 1), 0.3)
                    c.ev('drums', t, 'o' if op else 'h', round(v, 2))
            if (i == 0 and name in ('verse', 'chorus', 'bridge') and b > 0) or (name == 'chorus' and i % 8 == 0 and i) \
                    or (name == 'bridge' and i == 4) or (name == 'outro' and i == 0):
                m.add('drums', CR, t0, 0.55, -0.35); c.ev('drums', t0, 'c', 0.9)
    # final hit on the outro's last chord
    c.progress(0.25, 'bass')

    # ------------------------------------------------------------ bass: driving 8ths
    bcache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            if sec.name == 'intro' and i < 2:
                continue
            if sec.name == 'outro' and i >= 2:
                continue
            r = scale_note(root, scale, deg_at(sec, b))
            while r > 44: r -= 12
            while r < 32: r += 12
            if sec.name == 'bridge' and i < 4:
                steps = [(0, 8, 0), (8, 8, 0)]                # long notes in the breakdown
            else:
                mode = 0 if sec.name == 'chorus' and bass_mode == 1 else bass_mode
                pat = {0: [0, 12, 0, 12, 0, 12, 0, 12], 1: [0] * 8, 2: [0, 0, 12, 0, 0, 0, 12, 0]}[mode]
                steps = [(2 * j, 2, iv) for j, iv in enumerate(pat)]
            if is_fill(sec, b) and sec.name != 'intro':
                pn = scale_note(root, scale, deg_at(sec, b) + int(rng.choice([4, 6])))
                while pn - r > 12: pn -= 12
                while pn <= r: pn += 12
                steps = [x for x in steps if x[0] < 12] + [(12, 2, 0), (14, 2, pn - r)]
            for s, ln, iv in steps:
                note = r + iv
                dur = ln * c.step * (0.85 if ln <= 2 else 0.95)
                bright = 1.0 if sec.name == 'chorus' else 0.6
                key = (note, round(dur, 3), bright)
                if key not in bcache:
                    bcache[key] = bass_voice(note, dur, bright)
                t = c.t(b) + s * c.step
                v = 0.9 if s % 4 == 0 else 0.75
                m.add('bass', bcache[key], t, v)
                c.ev('bass', t, int(note), round(dur, 3), v)

    # ------------------------------------------------------------ pads (supersaw) + chord events
    c.progress(0.4, 'pads')
    pcache = {}
    dirn = 1
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            deg = deg_at(sec, b)
            notes = voicing(root, scale, deg, 3, 60)
            croot = scale_note(root, scale, deg)
            if add9:
                notes = notes + [scale_note(root, scale, deg + 1) + 12]
            bright = {'intro': 900 + 400 * i, 'verse': 2200, 'chorus': 4600, 'bridge': 2600, 'outro': 1800}[sec.name]
            bright = int(round(bright, -2))
            dur = c.bar_s + 0.5
            key = (tuple(notes), bright)
            if key not in pcache:
                pcache[key] = supersaw([notes[0] - 12] + notes, dur, rng, bright, 0.25 if sec.name == 'chorus' else 0.45)
            g = {'intro': 0.9, 'verse': 0.55, 'chorus': 0.85, 'bridge': 1.0, 'outro': 0.9}[sec.name]
            if sec.name == 'outro':
                g *= 1 - i / sec.bars * 0.5
            m.add('pad', pcache[key], c.t(b), g)
            c.ev('guitar', c.t(b), int(croot), round(c.bar_s, 3), 0.8, dirn, 0)
            dirn = -dirn
    # last chord ring-out at the very end
    last = c.sections[-1]
    notes = voicing(root, scale, 0, 3, 60)
    ring = supersaw([notes[0] - 12] + notes, 3.0, rng, 1600, 0.05)
    m.add('pad', ring, c.t(last.bar + last.bars), 0.7)

    # ------------------------------------------------------------ arp sequencer (16ths)
    c.progress(0.55, 'arp')
    acache = {}
    for sec in c.sections:
        if sec.name == 'outro':
            continue
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            deg = deg_at(sec, b)
            ch = voicing(root, scale, deg, 3, 66)
            ch = ch + [ch[0] + 12]
            g = {'intro': 0.4 + 0.15 * i, 'verse': 0.85, 'chorus': 0.6, 'bridge': 0.8}[sec.name]
            for s in range(16):
                if is_fill(sec, b) and s >= 12:
                    continue
                note = ch[arp_shape[(i * 16 + s) % len(arp_shape)] % len(ch)]
                dur = c.step * 0.9
                if note not in acache:
                    acache[note] = arp_voice(note, dur, rng)
                t = c.t(b) + s * c.step
                v = g * (1.0 if s % 4 == 0 else 0.75)
                m.add('arp', acache[note], t, v, 0.3 * (1 if (s // 2) % 2 else -1))
                if s % 4 == 0 and sec.name in ('intro', 'verse', 'bridge'):   # arp bursts animate the harmonic player
                    c.ev('guitar', t + 0.001, int(note), round(c.beat, 3), round(min(1, v), 2), 1 if s % 8 == 0 else -1, 1)

    # ------------------------------------------------------------ lead melody
    c.progress(0.7, 'lead')
    lo, hi = -3, 9
    hook = None
    lroot = root + 12
    while lroot < 59: lroot += 12
    while lroot > 67: lroot -= 12
    lcache = {}
    for sec in c.sections:
        if sec.name in ('intro', 'outro'):
            continue
        nverse = sum(1 for s2 in c.sections[:c.sections.index(sec)] if s2.name == 'verse')
        if sec.name == 'verse' and nverse == 0:
            continue                                   # first verse: arp + bass carry it
        for pb in range(sec.bar, sec.bar + sec.bars, 4):
            p4 = pb - sec.bar
            degs = [deg_at(sec, pb + k) for k in range(4)]
            if sec.name == 'chorus':
                if hook is None:
                    a = make_phrase(rng, rc, degs[:2], 4, 0, hi, False)
                    b2 = make_phrase(rng, rc, degs[2:], a[-1][2], 0, hi, True)
                    hook = a + [(s + 32, ln, d) for s, ln, d in b2]
                phrase = hook
                oct_up = 7 if (p4 // 4) % 2 == 1 and sec.energy >= 0.95 and max(x[2] for x in hook) <= 4 else 0
            else:
                rr = rv if sec.name == 'verse' else RHY[int(rng.integers(len(RHY)))]
                a = make_phrase(rng, rr, degs[:2], 2, lo, hi - 2, False)
                b2 = make_phrase(rng, rr, degs[2:], a[-1][2], lo, hi - 2, True)
                phrase = a + [(s + 32, ln, d) for s, ln, d in b2]
                oct_up = 0
                if sec.name == 'bridge' and p4 == 0:
                    phrase = [x for x in phrase if x[0] >= 16]
            prev = None
            for s, ln, d in phrase:
                note = scale_note(lroot, scale, d + oct_up)
                bar = pb + s // 16
                if bar >= sec.bar + sec.bars:
                    continue
                t = c.t(pb) + s * c.step
                dur = ln * c.step * 0.95
                key = (note, round(dur, 3), prev)
                if key not in lcache:
                    lcache[key] = lead_voice(note, dur, rng, prev)
                v = 0.85 if sec.name == 'chorus' else 0.7
                m.add('lead', lcache[key], t, v, 0.05)
                c.ev('lead', t, int(note), round(dur, 3), v)
                prev = note
    for v in c.events.values():
        v.sort(key=lambda e: e[0])
    c.progress(0.9, 'mixing')
