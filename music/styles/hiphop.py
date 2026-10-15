"""Hip hop instrumental, two flavours chosen per seed:
  boom-bap: dusty swung kick/snare, chopped minor-7 e-piano loop with tape wow, deep round bass, vinyl crackle,
            scratches and vocal chops on the hooks.
  trap:     808 sub with glides, rolling hi-hats (16ths / triplets / 32nd rolls), clap+snare on the backbeat,
            dark FM bell melody over a low pad, vocal chops and risers into the hooks.
Both: kick-less filtered breakdown in the bridge, riser + drum stop before the last hook."""
import numpy as np
from engine import *
from engine import _fit

NAME = 'Hip Hop'
BPMS = [80, 84, 88, 92, 96]
KEYS = [41, 43, 44, 45, 46, 48]          # F, G, Ab, A, Bb, C (minor)
TITLES = (['Golden', 'Concrete', 'Late', 'Smoke', 'Velvet', 'Dusty', 'Cold', 'Night', 'Brooklyn', 'Purple'],
          ['Cipher', 'Blocks', 'Rhymes', 'Tape', 'Crates', 'Hustle', 'Corner', 'Static', 'Avenue', 'Season'])

BB_PROGS = [[0, 0, 3, 3], [0, 0, 5, 5], [0, 3, 5, 4], [0, 5, 3, 4], [0, 6, 5, 5], [3, 4, 0, 0], [0, 2, 3, 4], [5, 4, 0, 0]]
TR_PROGS = [[0, 0, 5, 5], [0, 5, 0, 6], [0, 3, 5, 4], [5, 5, 0, 0], [0, 0, 3, 4], [0, 5, 3, 3], [0, 6, 5, 4]]
CHOPS = [[(0, 8), (8, 8)], [(0, 6), (6, 4), (10, 6)], [(0, 3), (3, 5), (10, 2), (12, 4)], [(0, 12), (14, 2)],
         [(2, 6), (8, 2), (10, 6)], [(0, 4), (6, 4), (12, 4)]]
BB_KICKS = [([0, 10], [0, 7, 10]), ([0, 3, 10], [0, 8, 10]), ([0, 8, 10], [0, 6, 9, 14]), ([0, 6, 9], [0, 10, 13]),
            ([0, 7, 10], [2, 7, 10])]
TR_KICKS = [[0, 10, 16, 26, 29], [0, 7, 16, 22], [0, 3, 10, 16, 19, 26], [0, 11, 16, 24, 27], [0, 6, 14, 16, 22, 30]]
VOWELS = {'ah': (800, 1150, 2900), 'oh': (450, 800, 2830), 'ee': (300, 2250, 3000), 'eh': (550, 1770, 2490), 'oo': (330, 870, 2250)}


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


def voicing(root, scale, deg, size=4, center=60):
    out = []
    for n in diatonic_chord(root, scale, deg, size):
        while n >= center + 6: n -= 12
        while n < center - 6: n += 12
        out.append(n)
    return sorted(out)


def ep_chord(notes, dur, rng, bright=0.8):
    x = sum(epiano(midi_hz(m) * (1 + rng.uniform(-0.0015, 0.0015)), dur, rng, bright) for m in notes) / len(notes)
    x = x + 0.35 * np.tanh(4 * x) * bright / 1.6          # tine 'bark'
    return _fade(x, 8)


def bb_bass(m, dur):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.3) + 0.1 * np.sin(6 * np.pi * f * t)
    x = softclip(x * adsr(n, 0.006, 0.25, 0.7, min(0.08, dur * 0.3)) * 1.3, 1.6)
    return _fade(lp(x, 700, 2), 6)


def b808(m, dur, prev=None, drive=2.2):
    f = midi_hz(m)
    glide = (midi_hz(prev) / f - 1) if prev is not None else 0.0
    x = sub808(f, dur, glide=glide, drive=drive, glide_t=0.06)
    return _fade(x, 6)


def bell(m, dur, rng, ratio=3.5):
    f = midi_hz(m)
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 2.2 * np.exp(-t / 0.18)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / 0.7)
    x += 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.25)
    x = lp(x * (1 - np.exp(-t / 0.002)), 6000, 1)
    return _fade(x, 10)


def dark_pad(notes, dur, rng, bright=900):
    n = int(dur * SR)
    L, R = np.zeros(n), np.zeros(n)
    for m in notes:
        f = midi_hz(m)
        for j, dc in enumerate((-0.007, 0.0, 0.007)):
            v = bsaw(f * (1 + dc), dur, rng.random())
            L += v * (0.8 if j != 2 else 0.3)
            R += v * (0.8 if j != 0 else 0.3)
    e = adsr(n, 0.4, 0.5, 0.85, min(0.6, dur * 0.3))
    st = hp(np.stack([lp(L * e, bright, 2), lp(R * e, bright, 2)]), 150)
    return _fade(st / (len(notes) * 2.5), 20)


def vowel(f0, dur, rng, v='ah', slide=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f0 * (1 + 0.006 * np.sin(2 * np.pi * 5.3 * t)) * (2 ** (slide * np.minimum(1, t / max(dur, 1e-3)) / 12))
    src = bsaw(fr, dur, rng.random()) + 0.05 * rng.standard_normal(n)
    F = VOWELS[v]
    y = sum(a * bp(src, f * 0.88, f * 1.12) for f, a in zip(F, (1.0, 0.6, 0.25)))
    return y


def chop(m, dur, rng, v='ah', slide=0.0):
    n = int(dur * SR)
    x = vowel(midi_hz(m), dur, rng, v, slide) * adsr(n, 0.008, 0.06, 0.8, min(0.05, dur * 0.3))
    return _fade(x / (np.abs(x).max() + 1e-9) * 0.7, 6)


def scratch(dur, beat, rng, f0=220.0, v='ah'):
    """Turntable scratch: a vowel 'sample' read back with a back-and-forth platter motion."""
    src = vowel(f0, 1.0, rng, v) + 0.3 * bp(rng.standard_normal(int(1.0 * SR)), 1500, 6000)
    src /= np.abs(src).max() + 1e-9
    n = int(dur * SR)
    t = np.arange(n) / SR
    strokes = int(rng.choice([2, 3, 4]))           # strokes per beat
    period = beat / strokes
    ph = (t / period) % 1.0
    tri = np.where(ph < 0.5, ph * 2, 2 - ph * 2)     # forward then back
    tri = 0.5 - 0.5 * np.cos(np.pi * tri)           # smooth turnarounds
    pos = 0.05 + 0.32 * tri                          # seconds into the sample
    y = np.interp(pos * SR, np.arange(len(src)), src)
    rate = np.abs(np.gradient(pos) * SR)
    y *= np.clip(rate / 1.5, 0, 1)                   # platter speed -> loudness
    cut = (ph < 0.5) if rng.random() < 0.5 else np.ones(n, bool)   # crossfader: optionally only forward strokes
    g = lp(cut.astype(float), 200, 1)
    return _fade(hp(y * g, 200) * 0.8, 8)


def vinyl(n, rng, amt=1.0):
    x = np.zeros(n, np.float32)
    k = int(n / SR * 9 * amt)
    pos = rng.integers(0, n - 200, k)
    x[pos] = (rng.standard_normal(k) * rng.uniform(0.2, 1.0, k) ** 2).astype(np.float32)
    big = rng.integers(0, n - 200, max(1, k // 25))
    x[big] += rng.choice([-1.0, 1.0], len(big)).astype(np.float32) * 2.5
    crackle = bp(x, 1200, 8000, 1)
    hiss = lp(hp(rng.standard_normal(n).astype(np.float32), 2500), 9000) * 0.035
    rumble = lp(rng.standard_normal(n).astype(np.float32), 60) * 0.25
    return (crackle * 0.5 + hiss + rumble).astype(np.float32)


def rev_cymbal(rng, dur):
    x = crash(rng, dur)[::-1].copy()
    return _fade(x, 20)


def riser(dur, rng, f0=300, f1=8000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp_sweep(hp(rng.standard_normal(n), 200), (f0, f1), 7) * (t / dur) ** 2
    return _fade(x, 25)


def wow_fx(stereo, depth=0.0016, rate=0.55):
    """tape/vinyl wow on a stereo stem (time-warp)."""
    n = stereo.shape[1]
    idx = np.arange(n, dtype=np.float64)
    tt = idx / SR
    warp = idx + depth * SR * (np.sin(2 * np.pi * rate * tt) + 0.3 * np.sin(2 * np.pi * rate * 3.1 * tt + 1))
    warp = np.clip(warp, 0, n - 1)
    out = np.empty_like(stereo)
    for ch in range(2):
        out[ch] = np.interp(warp, idx, stereo[ch])
    out = hp(lp(out, 6000, 2), 140)
    return softclip(out * 1.3, 1.3)


# ----------------------------------------------------------------------------- compose
def compose(c):
    _fit_len(c)
    rng, root = c.rng, c.root
    flav = c.brief.get('flavour') or c.brief.get('flavor') or ('trap' if rng.random() < 0.5 else 'boombap')
    trap = flav == 'trap'
    if trap:
        scale = c.brief.get('scale') or ['minor', 'harmonic_minor', 'phrygian'][int(rng.integers(3))]
        prog = TR_PROGS[int(rng.integers(len(TR_PROGS)))]
        if scale == 'phrygian' and 1 not in prog:
            prog = [0, 1, 0, 1] if rng.random() < .5 else [0, 0, 1, 5]
        sw = float(rng.uniform(0.0, 0.06))
    else:
        scale = c.brief.get('scale') or ('dorian' if rng.random() < 0.5 else 'minor')
        prog = BB_PROGS[int(rng.integers(len(BB_PROGS)))]
        sw = float(rng.uniform(0.16, 0.32))
    if c.brief.get('progression'):
        prog = c.brief['progression']
    chops_v = CHOPS[int(rng.integers(len(CHOPS)))]
    chops_c = CHOPS[int(rng.integers(len(CHOPS)))]
    kA, kB = BB_KICKS[int(rng.integers(len(BB_KICKS)))]
    tk = TR_KICKS[int(rng.integers(len(TR_KICKS)))]
    vow = list(VOWELS)[int(rng.integers(len(VOWELS)))]
    ratio = float(rng.choice([3.5, 2.0, 4.0, 1.41]))

    m = c.mix
    m.stem('drums', 1.4 if trap else 1.0, 0.06)
    m.stem('bass', 0.8 if trap else 0.38, 0.0)
    if trap:
        m.stem('keys', 1.3, 0.3)
    else:
        m.stem('keys', 0.45, 0.18, fx=lambda y: wow_fx(y))
    m.stem('lead', 0.5 if trap else 1.4, 0.3, fx=lambda y: echo(y, 0.75 * c.beat, 0.3, 3, 3000))
    m.stem('fx', 0.6, 0.3)
    m.stem('vinyl', 1.0, 0.0)

    if trap:
        K = kick(rng, 160, 55, 0.22, 0.4, 2.2)
        SN = [hp(snare(rng, 230, 0.2, 1.0), 250) * 0.7 for _ in range(2)]
        CL = [clap(rng, 0.28) for _ in range(2)]
        HC = [hat(rng, 0.03, tone=9500 + 400 * i) * 0.9 for i in range(4)]
        HO = hat(rng, open_=True, tone=9000)[:int(0.25 * SR)]
        HO = HO * np.linspace(1, 0, len(HO))
    else:
        K = lp(kick(rng, 115, 50, 0.38, 0.5, 2.6), 6000) * 0.8
        SN = [lp(softclip(snare(rng, 175 + 10 * i, 0.26, 0.95) + 0.5 * clap(rng, 0.26)[:int(0.26 * SR)], 1.6), 7000) for i in range(3)]
        CL = [clap(rng, 0.28)]
        HC = [lp(hat(rng, 0.05, tone=6800 + 300 * i), 11000) * 1.5 for i in range(3)]
        HO = lp(hat(rng, open_=True, tone=6800), 11000)[:int(0.3 * SR)]
        HO = HO * np.linspace(1, 0, len(HO))
    CR = crash(rng, 2.0)
    SH = bp(rng.standard_normal(int(0.07 * SR)), 5000, 12000) * np.exp(-np.arange(int(0.07 * SR)) / (0.018 * SR)) * 0.5

    def deg_at(b):
        return prog[(b % 4)]

    def T(b, s):
        return c.t(b) + c.swing(s, sw)

    def next_is(sec, name):
        i = c.sections.index(sec)
        return i + 1 < len(c.sections) and c.sections[i + 1].name == name

    def sec_mode(sec, i):
        """drum density: 0 none, 1 hats only, 2 light, 3 full"""
        if sec.name == 'intro':
            return 0 if i < 2 else 1
        if sec.name == 'bridge':
            return 1 if i < 4 else 2
        if sec.name == 'outro':
            return 2 if i < 2 else 0
        return 3

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            mode = sec_mode(sec, i)
            stop = from_end == 0 and next_is(sec, 'chorus')       # drum stop on the last beat before a hook
            t0 = c.t(b)
            if mode == 0:
                continue
            if trap:
                kp = [s - 16 * (b % 2) for s in tk if 0 <= s - 16 * (b % 2) < 16] if mode >= 2 else []
                if mode == 2 and sec.name == 'outro':
                    kp = [0]
                sp = [4, 12] if mode >= 2 else []
                # hats: 8ths (light) / 16ths with rolls (full)
                hits = []
                if mode == 1:
                    hits = [(q * c.beat / 2, 0.35) for q in range(8)]
                else:
                    for beat in range(4):
                        bt = beat * c.beat
                        r = rng.random()
                        if mode == 3 and r < (0.22 if sec.name == 'verse' else 0.32) and beat != 0:
                            div = int(rng.choice([3, 6, 8]))            # triplet 8ths / triplet 16ths / 32nds
                            if beat == 3 and rng.random() < 0.5:
                                div = 8
                            for q in range(div if div != 8 else 8):
                                v = 0.3 + 0.35 * q / div if div == 8 else 0.42
                                hits.append((bt + q * c.beat / div, v))
                        else:
                            for q in range(4 if mode == 3 else 2):
                                v = 0.5 if q == 0 else 0.36
                                hits.append((bt + q * c.beat / (4 if mode == 3 else 2), v))
                for ht, v in hits:
                    if stop and ht >= 3 * c.beat:
                        continue
                    m.add('drums', HC[int(rng.integers(4))], t0 + ht, v, 0.28); c.ev('drums', t0 + ht, 'h', round(v, 2))
                if mode == 3 and sec.name == 'chorus' and i % 2 == 1 and not stop:
                    tt = t0 + 14 * c.step
                    m.add('drums', HO, tt, 0.4, -0.25); c.ev('drums', tt, 'o', 0.6)
                for s in kp:
                    if stop and s >= 12: continue
                    tt = t0 + s * c.step
                    m.add('drums', K, tt, 0.9); c.ev('drums', tt, 'k', 0.95)
                for s in sp:
                    if stop and s >= 12: continue
                    tt = t0 + s * c.step
                    m.add('drums', CL[int(rng.integers(2))], tt, 0.75, 0.05); c.ev('drums', tt, 'cl', 0.9)
                    m.add('drums', SN[int(rng.integers(2))], tt, 0.6, -0.05); c.ev('drums', tt, 's', 0.8)
                if mode == 3 and i % 4 == 3 and rng.random() < 0.5 and not stop:   # extra snare flam at phrase end
                    tt = t0 + 15 * c.step
                    m.add('drums', SN[0], tt, 0.35); c.ev('drums', tt, 's', 0.4)
            else:
                kp = (kA if b % 2 == 0 else kB) if mode >= 2 else []
                if mode == 2 and sec.name == 'bridge':
                    kp = [0, 10]
                for s in range(16):
                    t = T(b, s)
                    if stop and s >= 12:
                        continue
                    if s in kp:
                        m.add('drums', K, t, 1.0); c.ev('drums', t, 'k', 1.0)
                    if s in (4, 12) and mode >= 2:
                        m.add('drums', SN[int(rng.integers(3))], t, 1.05, 0.04); c.ev('drums', t, 's', 0.95)
                    elif mode == 3 and s in (7, 15) and rng.random() < 0.18:
                        m.add('drums', SN[0], t, 0.22, 0.04); c.ev('drums', t, 's', 0.3)   # ghost note
                    if s % 2 == 0:
                        op = mode == 3 and sec.name == 'chorus' and s == 14 and i % 2 == 1
                        v = (0.55 if s % 4 == 0 else 0.4) + rng.random() * 0.1
                        if mode == 1:
                            v *= 0.7
                        m.add('drums', HO if op else HC[int(rng.integers(3))], t, v * (0.8 if op else 1), 0.25)
                        c.ev('drums', t, 'o' if op else 'h', round(v, 2))
                    if mode == 3 and sec.name == 'chorus' and s % 4 == 2:
                        m.add('drums', SH, t, 0.35, -0.4); c.ev('drums', t, 'p', 0.4)
            if i == 0 and sec.name in ('chorus',) or (sec.name == 'verse' and i == 0 and b > 4) or (sec.name == 'bridge' and i == 4):
                m.add('drums', CR, t0, 0.4, -0.3); c.ev('drums', t0, 'c', 0.8)
            # risers into hooks
            if from_end == 0 and next_is(sec, 'chorus'):
                rl = 2 if sec.name == 'bridge' else 1
                ts = c.t(b - rl + 1)
                m.add('fx', riser(c.bar_s * rl, rng), ts, 0.9)
                rc = rev_cymbal(rng, c.bar_s * 0.75)
                m.add('fx', rc, c.t(b + 1) - len(rc) / SR, 0.7, 0.2)

    # ------------------------------------------------------------ bass / 808
    c.progress(0.3, 'bass')
    bcache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            mode = sec_mode(sec, i)
            from_end = sec.bar + sec.bars - 1 - b
            stop = from_end == 0 and next_is(sec, 'chorus')
            if mode < 2:
                continue
            r = scale_note(root, scale, deg_at(b))
            lo_ = 30 if trap else 33
            while r >= lo_ + 12: r -= 12
            while r < lo_: r += 12
            if trap:
                kp = [s - 16 * (b % 2) for s in tk if 0 <= s - 16 * (b % 2) < 16]
                if sec.name == 'outro':
                    kp = [0]
            else:
                kp = (kA if b % 2 == 0 else kB)
                if sec.name == 'bridge':
                    kp = [0, 10]
            if stop:
                kp = [s for s in kp if s < 12]
            prev = None
            for j, s in enumerate(kp):
                nxt = kp[j + 1] if j + 1 < len(kp) else (12 if stop else 16)
                ln = max(2, nxt - s)
                note = r
                if trap and j > 0 and rng.random() < 0.3:
                    note = scale_note(root, scale, deg_at(b) + int(rng.choice([7, 4, -1])))
                    while note > r + 12: note -= 12
                    while note < r: note += 12
                if not trap and j == len(kp) - 1 and s >= 10 and rng.random() < 0.35:
                    note = scale_note(root, scale, deg_at(b) + int(rng.choice([7, 4, -1])))
                    while note > r + 12: note -= 12
                    while note < r - 2: note += 12
                dur = ln * c.step * (1.0 if trap else 0.92)
                glide_from = prev if (trap and prev is not None and prev != note and rng.random() < 0.6) else None
                key = (note, round(dur, 2), glide_from)
                if key not in bcache:
                    bcache[key] = b808(note, dur, glide_from) * 0.8 if trap else bb_bass(note, dur)
                t = T(b, s) if not trap else c.t(b) + s * c.step
                v = 0.95 if s == 0 else 0.8
                m.add('bass', bcache[key], t, v)
                c.ev('bass', t, int(note), round(dur, 3), v)
                prev = note

    # ------------------------------------------------------------ harmony: e-piano chops (boom-bap) / dark pad (trap)
    c.progress(0.5, 'keys')
    kcache = {}
    dirn = 1
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            stop = from_end == 0 and next_is(sec, 'chorus')
            deg = deg_at(b)
            croot = scale_note(root, scale, deg)
            notes = voicing(root, scale, deg, 4, 60 if trap else 64)
            if trap:
                key = ('pad', tuple(notes))
                if key not in kcache:
                    kcache[key] = dark_pad([notes[0] - 12] + notes[:3], c.bar_s + 0.6, rng, 1100)
                g = {'intro': 0.9, 'verse': 0.85, 'chorus': 0.9, 'bridge': 1.0, 'outro': 0.9}[sec.name]
                m.add('keys', kcache[key], c.t(b), g)
                for half in (0, 8):
                    if stop and half == 8:
                        continue
                    t = c.t(b) + half * c.step
                    c.ev('guitar', t, int(croot), round(c.bar_s / 2, 3), 0.7, dirn, 0)
                    dirn = -dirn
            else:
                pat = chops_c if sec.name == 'chorus' else chops_v
                if sec.name == 'bridge' and i < 4:
                    pat = [(0, 16)]
                bright = 1.0 if sec.name in ('intro', 'bridge', 'outro') else 1.6
                for s, ln in pat:
                    if stop and s >= 12:
                        continue
                    dur = ln * c.step * 0.95
                    key = (tuple(notes), round(dur, 3), bright)
                    if key not in kcache:
                        kcache[key] = ep_chord(notes, dur + 0.15, rng, bright)
                    t = T(b, s)
                    v = 0.9 if s == 0 else 0.75
                    if sec.name == 'intro':
                        v *= 0.8
                    m.add('keys', kcache[key], t, v, 0.0)
                    c.ev('guitar', t, int(croot), round(dur, 3), v, dirn, 1 if dur < 0.3 else 0)
                    dirn = -dirn

    # ------------------------------------------------------------ lead: bell motif (trap) / chops + scratches
    c.progress(0.7, 'lead')
    lcache = {}
    lroot = root + 24
    while lroot > 72: lroot -= 12
    while lroot < 61: lroot += 12
    # 2-bar motif in scale degrees: (step, len, degree)
    motif, pos, deg = [], 0, int(rng.choice([0, 2, 4]))
    while pos < 32:
        ln = int(rng.choice([2, 2, 3, 4, 4, 6]))
        if rng.random() < 0.25:
            pos += ln; continue
        deg = int(np.clip(deg + rng.choice([-2, -1, 0, 1, 2, 3, -3]), -2, 7))
        if pos % 16 == 0:
            deg = int(rng.choice([0, 2, 4]))
        motif.append((pos, min(ln, 32 - pos), deg))
        pos += ln
    chop_rhy = [[0, 3, 6, 10, 12], [0, 2, 6, 8, 11, 14], [2, 6, 10, 14], [0, 6, 8, 14]][int(rng.integers(4))]
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            from_end = sec.bar + sec.bars - 1 - b
            stop = from_end == 0 and next_is(sec, 'chorus')
            # --- bell melody (trap) on 2-bar loop
            if trap and (sec.name in ('chorus', 'intro', 'outro') or (sec.name == 'verse' and i % 4 < 2) or (sec.name == 'bridge' and i >= 2)):
                for s, ln, d in motif:
                    if s // 16 != b % 2:
                        continue
                    if stop and s % 16 >= 12:
                        continue
                    note = scale_note(lroot, scale, d)
                    dur = ln * c.step + 0.3
                    key = ('bell', note, round(dur, 2))
                    if key not in lcache:
                        lcache[key] = bell(note, dur, rng, ratio)
                    t = c.t(b) + (s % 16) * c.step
                    v = 0.8 if sec.name == 'chorus' else 0.6
                    m.add('lead', lcache[key], t, v, 0.15)
                    c.ev('lead', t, int(note), round(ln * c.step, 3), v)
            # --- vocal chops in the hook (both flavours)
            if sec.name == 'chorus' and (i % 4 in (1, 3) or trap is False and i % 2 == 0):
                cr = scale_note(root, scale, deg_at(b))
                tones = [scale_note(lroot - 12, scale, d) for d in range(-2, 8)]
                for j, s in enumerate(chop_rhy):
                    if stop and s >= 12:
                        continue
                    if trap and i % 4 == 1 and s < 8:
                        continue
                    target = cr + 12 * round((lroot - 12 - cr) / 12) + [0, 3, 7, 10, 7][j % 5] * (1 if j % 2 == 0 else 0)
                    note = min(tones, key=lambda x: abs(x - target))
                    ln = 2 if j + 1 < len(chop_rhy) and chop_rhy[j + 1] - s <= 2 else 3
                    dur = ln * c.step * 0.9
                    slide = -2.0 if (j == len(chop_rhy) - 1 and rng.random() < 0.5) else 0.0
                    key = ('chop', note, round(dur, 3), slide)
                    if key not in lcache:
                        lcache[key] = chop(note, dur, rng, vow, slide)
                    t = T(b, s)
                    m.add('lead', lcache[key], t, 0.55, -0.15)
                    c.ev('lead', t, int(note), round(dur, 3), 0.6)
            # --- scratches at phrase ends (boom-bap mainly)
            scr = (not trap and ((sec.name == 'chorus' and i % 4 == 3) or (sec.name == 'verse' and i % 8 == 7) or (sec.name == 'intro' and from_end == 0))) \
                or (trap and sec.name == 'intro' and from_end == 0)
            if scr:
                beats = 2
                st = 2 * c.beat if not stop else 1 * c.beat
                d = beats * c.beat
                x = scratch(d, c.beat, rng, midi_hz(lroot - 12), vow)
                m.add('fx', x, c.t(b) + st, 2.5, 0.3)
                for q in range(beats * 2):
                    c.ev('lead', c.t(b) + st + q * c.beat / 2, int(lroot + (5 if q % 2 else 0)), round(c.beat / 2, 3), 0.7)

    # ------------------------------------------------------------ vinyl / texture
    c.progress(0.85, 'texture')
    n = int((c.duration + 1.0) * SR)
    vx = vinyl(n, rng, 1.0 if not trap else 0.25)
    m.add('vinyl', vx * (1.2 if not trap else 0.4), 0.0, 1.0, 0.0)
    for v in c.events.values():
        v.sort(key=lambda e: e[0])
    c.progress(0.9, 'mixing')
