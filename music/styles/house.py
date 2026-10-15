"""House: four-on-the-floor kick, claps on 2&4, offbeat open hats, shuffled 16th hats, offbeat sub bass,
m7 chord stabs (saw / piano / organ, chosen per seed) with filter sweeps, sidechain-pumped pads,
16th arpeggio pluck with delay, snare builds + noise risers before drops, kick-less breakdown in the bridge."""
import numpy as np
from engine import *
from engine import _fit

NAME = 'House'
BPMS = [124, 124, 128]
KEYS = [45, 46, 48, 50, 41, 43]          # A, Bb, C, D, F, G (chord register; bass is folded to ~A1-G#2)
TITLES = (['Deep', 'Velvet', 'Midnight', 'Golden', 'Liquid', 'Warehouse', 'Sunset', 'Higher', 'Paradise', 'Saturday'],
          ['Groove', 'Motion', 'Pulse', 'Floor', 'Garage', 'Feeling', 'Rhythm', 'Lights', 'Jack', 'Love'])

PROGS = [[0, 5, 2, 6], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 0, 4], [5, 6, 0, 0], [0, 2, 5, 6], [3, 4, 0, 0], [0, 3, 6, 2]]
# stab rhythms: (16th step, length in steps)
STABS = [
    [(2, 2), (6, 2), (10, 2), (14, 2)],                 # classic offbeat
    [(0, 2), (3, 2), (6, 2), (10, 2), (13, 2)],         # syncopated
    [(0, 5), (6, 4), (10, 5)],                          # dotted piano chords
    [(3, 2), (6, 2), (11, 2), (14, 2)],                 # off-grid
    [(0, 3), (3, 3), (8, 2), (11, 3), (14, 2)],         # 3-3-2 garage push
]
BASSPAT = [
    [(2, 1.7, 0), (6, 1.7, 0), (10, 1.7, 0), (14, 1.7, 0)],                       # pure offbeat
    [(2, 1.5, 0), (6, 1.5, 0), (7, 0.8, 12), (10, 1.5, 0), (14, 1.2, 0), (15, 0.8, 12)],
    [(2, 1.5, 0), (5, 0.8, 0), (6, 1.5, 12), (10, 1.5, 0), (13, 0.8, 0), (14, 1.5, 7)],
    [(2, 2.5, 0), (6, 1.5, 0), (10, 2.5, 0), (13, 1.0, 12), (14, 1.5, 0)],
]


# ----------------------------------------------------------------------------- voices
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


def _fade(x, ms=6):
    k = min(len(x), int(ms * SR / 1000))
    x[-k:] *= np.linspace(1, 0, k)
    x[:8] *= np.linspace(0, 1, 8)
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


def voicing(root, scale, deg, size=4, center=60):
    notes = diatonic_chord(root, scale, deg, size)
    out = []
    for n in notes:
        while n >= center + 6: n -= 12
        while n < center - 6: n += 12
        out.append(n)
    return sorted(out)


def stab_voice(notes, dur, cutoff, kind, rng):
    n = int(dur * SR)
    x = np.zeros(n)
    t = np.arange(n) / SR
    if kind == 'saw':
        for m in notes:
            f = midi_hz(m)
            for dc in (-0.006, 0.006):
                x += bsaw(f * (1 + dc), dur, rng.random())
            x += 0.4 * np.sin(2 * np.pi * f / 2 * t)
        e = adsr(n, 0.003, 0.14, 0.35, 0.06)
        x = lp(x * e, cutoff, 2) + 0.5 * bp(x * e, cutoff * 0.7, cutoff * 1.1, 1)
    elif kind == 'piano':
        for m in notes:
            f = midi_hz(m)
            for k, a in ((1, 1.0), (2, 0.55), (3, 0.35), (4, 0.25), (5, 0.12), (6, 0.08)):
                fk = f * k * (1 + 0.0004 * k * k)
                if fk > 12000: break
                x += a * np.sin(2 * np.pi * fk * t + rng.random() * 6) * np.exp(-t / (0.9 / k ** 0.7))
        x += hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.004) * 0.3
        e = adsr(n, 0.002, 0.3, 0.6, 0.08)
        x = lp(x * e, cutoff * 1.5, 1)
    else:  # organ (M1-ish)
        for m in notes:
            f = midi_hz(m)
            for k, a in ((1, 1.0), (2, 0.7), (3, 0.3), (4, 0.35), (6, 0.12)):
                x += a * np.sin(2 * np.pi * f * k * t + rng.random() * 6)
        e = adsr(n, 0.002, 0.1, 0.45, 0.05) * (1 - 0.3 * (1 - np.exp(-t / 0.15)))
        x = lp(x * e, cutoff * 1.3, 2)
    x = _fade(x, 5)
    return x / (len(notes) * 1.6)


def pad_voice(notes, dur, rng, bright=1300):
    n = int(dur * SR)
    L, R = np.zeros(n), np.zeros(n)
    for m in notes:
        f = midi_hz(m)
        for j, dc in enumerate((-0.009, -0.003, 0.004, 0.01)):
            v = bsaw(f * (1 + dc), dur, rng.random())
            (L if j % 2 == 0 else R)[:] += v
            (R if j % 2 == 0 else L)[:] += 0.35 * v
    e = adsr(n, 0.25, 0.4, 0.85, min(0.5, dur * 0.3))
    st = np.stack([lp(L * e, bright, 2), lp(R * e, bright, 2)])
    return st / (len(notes) * 3.0)


def bass_voice(m, dur, rng):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * lp(bsaw(f, dur, 0.0), 380 + f * 2, 2) + 0.15 * np.sin(4 * np.pi * f * t)
    x = softclip(x * adsr(n, 0.004, 0.08, 0.8, 0.035) * 1.2, 1.5)
    return _fade(x, 4)


def arp_voice(m, dur, rng):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = 0.6 * pluck(f, dur, rng, 0.993, 0.55) + bsaw(f, dur, rng.random()) * np.exp(-t / 0.05) * 0.5
    x = hp(lp(x, 3200, 2), 150)
    return _fade(x * adsr(n, 0.002, 0.05, 0.9, 0.03), 4)


def riser(dur, rng, f0=300, f1=9000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp_sweep(hp(rng.standard_normal(n), 150), (f0, f1), 8)
    x = x * (t / dur) ** 2
    return _fade(x, 30)


def impact(rng, dur=1.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 40 + 60 * np.exp(-t / 0.08)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    return _fade(softclip(x * 1.5, 1.5), 50)


# ----------------------------------------------------------------------------- compose
def compose(c):
    _fit_len(c)
    rng, root = c.rng, c.root
    scale = c.brief.get('scale') or ('dorian' if rng.random() < 0.45 else 'minor')
    pv = PROGS[int(rng.integers(len(PROGS)))]
    pc = PROGS[int(rng.integers(len(PROGS)))]
    if c.brief.get('progression'):
        pv = pc = c.brief['progression']
    slow = rng.random() < 0.3                       # 2 bars per chord
    kind = ['saw', 'piano', 'organ'][int(rng.integers(3))]
    sv = STABS[int(rng.integers(len(STABS)))]
    sc = STABS[int(rng.integers(len(STABS)))]
    bv = BASSPAT[int(rng.integers(2))]
    bc = BASSPAT[int(rng.integers(len(BASSPAT)))]
    sw = float(rng.uniform(0.06, 0.2))              # shuffle amount
    arp_shape = [[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [0, 1, 2, 3, 2, 1], [0, 2, 3, 1, 2, 0, 3, 1]][int(rng.integers(5))]
    perc_pat = [[3, 11], [7, 15], [3, 6, 11, 14], [5, 13], [3, 10, 13]][int(rng.integers(5))]
    perc_kind = ['rim', 'conga', 'shaker'][int(rng.integers(3))]

    m = c.mix
    KT = []                                          # kick times for sidechain
    m.stem('kick', 0.75, 0.0)
    m.stem('drums', 2.2, 0.10)
    m.stem('bass', 0.42, 0.0, fx=lambda y: duck(y, KT, 0.55, 0.09))
    m.stem('pad', 1.8, 0.35, fx=lambda y: duck(y, KT, 0.75, 0.16))
    m.stem('stab', 2.2, 0.22, fx=lambda y: duck(y, KT, 0.35, 0.10))
    m.stem('arp', 1.4, 0.25, fx=lambda y: echo(duck(y, KT, 0.4, 0.12), 0.75 * c.beat, 0.38, 4, 3000))
    m.stem('fx', 0.65, 0.35)

    K = kick(rng, f0=155, f1=48, dur=0.36, click=0.32, drive=2.0)
    CL = [clap(rng, 0.3) * 0.8 for _ in range(3)]
    SN = [hp(snare(rng, 220, 0.16, 0.9), 300) * 0.7 for _ in range(2)]
    HC = [hat(rng, 0.045, tone=8000) for _ in range(4)]
    HO = hat(rng, open_=True, tone=7500)[:int(0.22 * SR)] * np.linspace(1, 0, int(0.22 * SR)) ** 0.5
    CR = crash(rng, 2.0)
    IMP = impact(rng)
    if perc_kind == 'rim':
        PC = rim(rng) * 0.7
    elif perc_kind == 'conga':
        PC = conga(rng, 260 * 2 ** (rng.integers(0, 5) / 12), 0.2) * 0.6
    else:
        nn = int(0.06 * SR)
        PC = bp(rng.standard_normal(nn), 4000, 11000) * np.exp(-np.arange(nn) / (0.015 * SR)) * 0.6

    def prog_for(sec):
        return pc if sec.name in ('chorus', 'outro', 'bridge') else pv

    def chord_deg(sec, b):
        i = b - sec.bar
        p = prog_for(sec)
        return p[(i // 2 if slow else i) % 4]

    def T(b, s):
        return c.t(b) + c.swing(s, sw)

    def drop_next(sec):                              # is the next section a chorus (drop)?
        i = c.sections.index(sec)
        return i + 1 < len(c.sections) and c.sections[i + 1].name == 'chorus'

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    for sec in c.sections:
        en = sec.energy
        build = drop_next(sec)
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            t0 = c.t(b)
            kicks = sec.name != 'bridge'
            if sec.name == 'outro' and from_end == 0:
                kicks = True
            gap = build and from_end == 0             # drop gap: no kick on the last beat
            claps = not (sec.name == 'intro' and i < 2) and not (sec.name == 'bridge' and i < 4) and not (sec.name == 'outro' and from_end == 0)
            open_h = (sec.name not in ('intro', 'bridge') or (sec.name == 'intro' and i >= 2)) and not (sec.name == 'outro' and from_end == 0)
            hat16 = en >= 0.55 or sec.name == 'bridge' and i >= 4
            perc = en >= 0.55 and sec.name != 'bridge'
            roll_bars = 2 if sec.name != 'bridge' else 4
            rolling = build and from_end < roll_bars
            for s in range(16):
                t = T(b, s)
                if gap and s >= 12:
                    continue
                if kicks and s % 4 == 0:
                    m.add('kick', K, t, 1.0); KT.append(t); c.ev('drums', t, 'k', 1.0)
                if claps and s in (4, 12) and not rolling:
                    m.add('drums', CL[int(rng.integers(3))], t, 0.85, 0.05); c.ev('drums', t, 'cl', 0.9)
                if open_h and s % 4 == 2 and not (sec.name == 'bridge'):
                    m.add('drums', HO, t, 0.42, -0.2); c.ev('drums', t, 'o', 0.6)
                elif (hat16 or s % 2 == 0) and sec.name != 'bridge' or (sec.name == 'bridge' and hat16):
                    v = (0.5 if s % 4 == 0 else 0.3 if s % 2 == 0 else 0.22) + rng.random() * 0.08
                    if sec.name == 'bridge':
                        v *= 0.4 + 0.15 * (i - 4)
                    m.add('drums', HC[int(rng.integers(4))], t, v, 0.3); c.ev('drums', t, 'h', round(v, 2))
                if perc and s in perc_pat:
                    m.add('drums', PC, t, 1.0, 0.45); c.ev('drums', t, 'p', 0.6)
            # snare build (8ths -> 16ths -> 32nds) leading into the drop
            if rolling:
                k = roll_bars - 1 - from_end           # 0..roll_bars-1
                div = 2 if k < roll_bars - 1 else 4
                if roll_bars == 4:
                    div = [1, 2, 2, 4][k]
                prog0 = k / roll_bars
                for j in range(4 * div):
                    t = t0 + j * c.beat / div
                    v = 0.25 + 0.6 * (prog0 + j / (4 * div) / roll_bars)
                    m.add('drums', SN[j % 2], t, v, 0.0); c.ev('drums', t, 's', round(v, 2))
                if from_end == 0:
                    m.add('fx', riser(c.t(roll_bars), rng), c.t(b - roll_bars + 1), 1.0)
            if b == sec.bar and sec.name in ('chorus', 'verse') and b > 0 or (sec.name == 'chorus' and i % 8 == 0 and i > 0):
                m.add('drums', CR, t0, 0.45, -0.3); c.ev('drums', t0, 'c', 0.9)
                if sec.name == 'chorus' and i == 0:
                    m.add('fx', IMP, t0, 1.2)

    # ------------------------------------------------------------ bass (offbeat sub)
    c.progress(0.3, 'bass')
    bcache = {}
    for sec in c.sections:
        if sec.name == 'bridge':
            continue
        pat = bc if sec.name == 'chorus' else bv
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            if sec.name == 'intro' and i < sec.bars - 1:
                continue
            if sec.name == 'outro' and from_end == 0:
                continue
            r = scale_note(root, scale, chord_deg(sec, b))
            while r > 44: r -= 12
            while r < 33: r += 12
            for s, ln, iv in pat:
                if drop_next(sec) and from_end == 0 and s >= 12:
                    continue
                note = r + iv
                dur = ln * c.step
                key = (note, round(dur, 3))
                if key not in bcache:
                    bcache[key] = bass_voice(note, dur, rng)
                t = T(b, s)
                v = 0.95 if iv == 0 else 0.75
                m.add('bass', bcache[key], t, v)
                c.ev('bass', t, int(note), dur, v)

    # ------------------------------------------------------------ chord stabs + pads
    c.progress(0.5, 'chords')
    scache, pcache = {}, {}
    cut_bins = np.geomspace(350, 7000, 16)
    dirn = 1
    for sec in c.sections:
        pat = sc if sec.name == 'chorus' else sv
        if sec.name == 'bridge':
            pat = [(0, 6), (6, 4), (10, 6)]
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            frac = (i + 0.5) / sec.bars
            from_end = sec.bar + sec.bars - 1 - b
            deg = chord_deg(sec, b)
            notes = voicing(root, scale, deg, 4, 61)
            croot = scale_note(root, scale, deg)
            # filter automation per section
            if sec.name == 'intro':
                cut = 400 + 700 * frac
            elif sec.name == 'verse':
                cut = 800 * (5.0 ** frac)
            elif sec.name == 'chorus':
                cut = 4200 + 1500 * np.sin(2 * np.pi * i / 8)
            elif sec.name == 'bridge':
                cut = 600 * (11.0 ** frac)
            else:
                cut = 3000 * (0.2 ** frac)
            cut = float(cut_bins[np.argmin(np.abs(np.log(cut_bins / cut)))])
            if not (sec.name == 'outro' and from_end == 0):
                for s, ln in pat:
                    if drop_next(sec) and from_end == 0 and s >= 12:
                        continue
                    dur = ln * c.step * 0.92
                    key = (tuple(notes), round(dur, 3), cut)
                    if key not in scache:
                        scache[key] = stab_voice(notes, dur, cut, kind, rng)
                    t = T(b, s)
                    v = 0.85 + 0.1 * (s % 4 == 0)
                    m.add('stab', scache[key], t, v, 0.12 * dirn)
                    c.ev('guitar', t, int(croot), round(dur, 3), round(v, 2), dirn, 1 if dur < 0.3 else 0)
                    dirn = -dirn
            # pads: chorus, bridge, second verse
            nverse = sum(1 for s2 in c.sections[:c.sections.index(sec)] if s2.name == 'verse')
            if sec.name in ('chorus', 'bridge') or (sec.name == 'verse' and nverse >= 1):
                if not slow or i % 2 == 0:
                    plen = c.bar_s * (2 if slow else 1)
                    key = (tuple(notes), round(plen, 3), sec.name == 'bridge')
                    if key not in pcache:
                        pcache[key] = pad_voice([n - 12 for n in notes] + [notes[0], notes[2]], plen + 0.4, rng,
                                                2200 if sec.name == 'bridge' else 1400)
                    g = 1.0 if sec.name == 'bridge' else (0.7 if sec.name == 'chorus' else 0.45)
                    m.add('pad', pcache[key], c.t(b), g)

    # ------------------------------------------------------------ arp (16ths, delay)
    c.progress(0.7, 'arp')
    acache = {}
    for sec in c.sections:
        nverse = sum(1 for s2 in c.sections[:c.sections.index(sec)] if s2.name == 'verse')
        on = sec.name == 'chorus' or (sec.name == 'verse' and nverse >= 1) or sec.name == 'bridge'
        if not on:
            continue
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            if sec.name == 'verse' and i < sec.bars // 2:
                continue
            if sec.name == 'bridge' and i < 2:
                continue
            notes = [n + 12 for n in voicing(root, scale, chord_deg(sec, b), 4, 61)]
            g = 0.8 if sec.name == 'chorus' else 0.5
            if sec.name == 'bridge':
                g = 0.35 + 0.08 * i
            for s in range(16):
                if drop_next(sec) and from_end == 0 and s >= 12:
                    continue
                idx = arp_shape[(i * 16 + s) % len(arp_shape)] % len(notes)
                note = notes[idx] + (12 if (s % 8 == 7 and sec.name == 'chorus' and notes[idx] < 76) else 0)
                dur = c.step * 1.4
                if note not in acache:
                    acache[note] = arp_voice(note, dur, rng)
                t = T(b, s)
                v = (1.0 if s % 4 == 0 else 0.7) * g
                m.add('arp', acache[note], t, v, 0.25 * (1 if s % 2 else -1))
                c.ev('lead', t, int(note), round(dur, 3), round(v, 2))
    for v in c.events.values():
        v.sort(key=lambda e: e[0])
    c.progress(0.9, 'mixing')
