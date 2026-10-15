"""Middle Eastern: maqam-based Arabic party track, fully synthesised.
Maqam per seed (hijaz / bayati / rast / nahawand / kurd, quarter-tones as float midi), real iqa'at on a
darbuka (dum/tek/ka, rolls, doholla fills) + riq jingles, bass drum + group claps in the chorus,
oud (double-course Karplus-Strong, tremolo picking, free-time taqsim intro), qanun runs/glissandi,
nay (sine + breath, vibrato, ornaments) doubled by a band-limited string section, tonic drone, synth bass."""
import numpy as np
from scipy import signal
from engine import *

NAME = 'Middle Eastern'
# all 4/4; tempos chosen so the engine's song plans land inside 125-180 s (see _fit_plan)
BPMS = [88, 92, 104, 108]
KEYS = [48, 50, 52, 53, 55]            # tonic in oud register: C D E F G
TITLES = (['Desert', 'Golden', 'Midnight', 'Cairo', 'Saffron', 'Velvet', 'Crimson', 'Silver', 'Hidden', 'Burning'],
          ['Caravan', 'Oasis', 'Lanterns', 'Dabke', 'Mirage', 'Bazaar', 'Nights', 'Dunes', 'Sultan', 'Moon'])

# sc: intervals, gh: ghammaz (dominant degree index), prog: bass degree per bar (integer-interval degrees only)
MAQAMAT = {
    'hijaz':    dict(sc=[0, 1, 4, 5, 7, 8, 10], gh=4, prog=[[0, 0, 1, 0], [0, 6, 1, 0], [0, 3, 1, 0], [0, 1, 6, 0]]),
    'bayati':   dict(sc=[0, 1.5, 3, 5, 7, 8, 10], gh=3, prog=[[0, 0, 6, 0], [0, 3, 6, 0], [3, 6, 0, 0], [0, 6, 5, 6]]),
    'rast':     dict(sc=[0, 2, 3.5, 5, 7, 9, 10.5], gh=4, prog=[[0, 3, 4, 0], [0, 0, 3, 4], [0, 5, 3, 4], [0, 3, 0, 4]]),
    'nahawand': dict(sc=[0, 2, 3, 5, 7, 8, 11], gh=4, prog=[[0, 5, 3, 4], [0, 3, 4, 0], [0, 0, 5, 4], [0, 3, 5, 4]]),
    'kurd':     dict(sc=[0, 1, 3, 5, 7, 8, 10], gh=3, prog=[[0, 1, 0, 6], [0, 6, 5, 6], [0, 3, 6, 0], [0, 1, 3, 0]]),
}
MAQ_ORDER = ['hijaz', 'bayati', 'rast', 'nahawand', 'kurd']

# iqa'at on a 16th grid (one 4/4 bar). D=dum T=tek K=ka(accent) k=ka(soft)
IQAAT = {
    'maqsum': 'D.T...T.D...T...',
    'baladi': 'D.D...T.D...T...',
    'saidi':  'D.T...D.D...T...',
    'malfuf': 'D..T..T.D..T..T.',
    'ayoub':  'D..kD.T.D..kD.T.',
}
CHORUS_IQA = ['maqsum', 'baladi', 'saidi']
KICK_PATS = [[0, 6, 8], [0, 8, 11], [0, 6, 8, 14], [0, 3, 8, 11]]
BASS_DABKE = [[0, 3, 6, 8, 11, 14], [0, 2, 6, 8, 10, 14], [0, 3, 6, 8, 12, 14]]

# melody rhythm cells (start, len) in 16ths; bar 1 of a 2-bar phrase / bar 2 (ends long)
RHY1 = [[(0, 4), (4, 2), (6, 2), (8, 4), (12, 4)],
        [(0, 2), (2, 2), (4, 4), (8, 2), (10, 2), (12, 4)],
        [(0, 3), (3, 3), (6, 2), (8, 4), (12, 2), (14, 2)],
        [(0, 2), (2, 1), (3, 1), (4, 2), (6, 2), (8, 6), (14, 2)],
        [(0, 6), (6, 2), (8, 2), (10, 2), (12, 4)],
        [(0, 1), (1, 1), (2, 2), (4, 4), (8, 1), (9, 1), (10, 2), (12, 4)],
        [(2, 2), (4, 2), (6, 2), (8, 4), (12, 2), (14, 2)],
        [(0, 3), (3, 1), (4, 4), (8, 3), (11, 1), (12, 4)]]
RHY2 = [[(0, 4), (4, 2), (6, 2), (8, 7)],
        [(0, 2), (2, 2), (4, 4), (8, 7)],
        [(0, 3), (3, 3), (6, 2), (8, 6)],
        [(0, 2), (2, 2), (4, 2), (6, 2), (8, 7)],
        [(0, 6), (6, 2), (8, 7)]]


# ----------------------------------------------------------------------------- dsp helpers
def onepole(x, tau, init=None):
    a = 1.0 - np.exp(-1.0 / (max(tau, 1e-4) * SR))
    zi = np.array([(x[0] if init is None else init) * (1 - a)])
    return signal.lfilter([a], [1, -(1 - a)], x, zi=zi)[0]


def fade(x, fin=0.0, fout=0.03):
    x = np.array(x, dtype=np.float64)
    n = len(x)
    a, b = min(n, int(fin * SR)), min(n, int(fout * SR))
    if a > 1:
        x[:a] *= np.linspace(0, 1, a)
    if b > 1:
        x[n - b:] *= np.linspace(1, 0, b)
    return x


def cut(x, dur, fout=0.03):
    n = min(len(x), max(8, int(dur * SR)))
    return fade(x[:n], 0, fout)


def warp(x, cents):
    """time-varying pitch shift by resampling (slides / vibrato on plucked notes)."""
    r = 2.0 ** (np.asarray(cents) / 1200.0)
    pos = np.cumsum(r) - r[0]
    return np.interp(pos, np.arange(len(x)), x)


def saw_bl(f, top=6500.0):
    """band-limited saw from a per-sample frequency array (additive, complex recursion)."""
    ph = 2 * np.pi * np.cumsum(f) / SR
    K = max(1, int(top / max(float(np.max(f)), 30.0)))
    z = np.exp(1j * ph)
    zk = z.copy()
    acc = np.zeros(len(f))
    for k in range(1, K + 1):
        acc += zk.imag / k
        if k < K:
            zk *= z
    return acc * (2 / np.pi)


# ----------------------------------------------------------------------------- percussion voices
def mk_dum(rng, f0=150, f1=96, dur=0.55, tau=0.17):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    m2 = np.sin(2 * np.pi * np.cumsum(f * 1.59) / SR) * np.exp(-t / 0.05) * 0.28
    att = lp(rng.standard_normal(n), 2200) * np.exp(-t / 0.005) * 0.45
    x = (body + m2 + att) * (1 - np.exp(-t / 0.0012))
    return fade(softclip(x, 1.3), 0, 0.03)


def mk_tek(rng, scale=1.0, crack=1.0, dur=0.2, tau=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ring = np.zeros(n)
    for fr, tt, a in ((820, .035, 1.0), (1290, .026, .6), (1870, .02, .45), (2650, .015, .35), (3550, .01, .25)):
        ring += a * np.sin(2 * np.pi * fr * scale * rng.uniform(.97, 1.03) * t + rng.random() * 6) * np.exp(-t / (tt * tau))
    ck = bp(rng.standard_normal(n), 2200, 9500) * np.exp(-t / 0.005) * 1.1 * crack
    x = (0.55 * ring + ck) * (1 - np.exp(-t / 0.0004))
    return fade(x, 0, 0.02) * 0.8


def mk_riq(rng, shake=False):
    dur = 0.38 if shake else 0.17
    n = int(dur * SR)
    t = np.arange(n) / SR
    jing = sum(np.sin(2 * np.pi * rng.uniform(4600, 11500) * t + rng.random() * 6) for _ in range(9)) / 4
    nz = lp(hp(rng.standard_normal(n), 5000), 11000)
    if shake:
        env = sum(a * np.exp(-np.maximum(t - d, 0) / 0.035) * (t >= d) for d, a in
                  ((0, 1), (.013, .7), (.028, .8), (.047, .55), (.075, .45), (.11, .3)))
    else:
        env = np.exp(-t / 0.035)
    x = (0.5 * jing + 0.8 * nz) * env * (1 - np.exp(-t / 0.0005))
    x += np.sin(2 * np.pi * 390 * t) * np.exp(-t / 0.018) * 0.25        # frame skin
    return fade(hp(x, 300), 0, 0.02) * 0.45


def mk_sagat(rng):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * rng.uniform(.99, 1.01) * t) * np.exp(-t / tt)
            for f, a, tt in ((2630, 1, .28), (3920, .7, .22), (5390, .5, .15), (7040, .35, .1)))
    x += hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.004) * 0.6
    return fade(x * (1 - np.exp(-t / 0.0005)), 0, 0.05) * 0.25


def mk_claps(rng):
    """group of hand clappers (several claps smeared by a few ms)."""
    out = np.zeros(int(0.35 * SR))
    for d in (0.0, 0.006, 0.013, 0.019):
        x = clap(rng, 0.3) * rng.uniform(.7, 1)
        i = int(d * SR)
        out[i:i + len(x)] += x[:len(out) - i]
    return fade(out * 0.5, 0, 0.04)


# ----------------------------------------------------------------------------- plucked strings
class PluckBank:
    def __init__(self, rng, bright, decay, length, post, det=1.0024, cdel=0.0035, nvar=2):
        self.rng, self.bright, self.decay, self.L, self.post = rng, bright, decay, length, post
        self.det, self.cdel, self.nvar, self.c = det, cdel, nvar, {}

    def get(self, m, var=0):
        key = (round(float(m) * 4) / 4, int(var) % self.nvar)
        if key not in self.c:
            f = float(midi_hz(key[0]))
            a = pluck(f, self.L, self.rng, self.decay, self.bright)
            b = pluck(f, self.L, self.rng, self.decay, self.bright)     # second string of the course
            b = np.interp(np.arange(len(b)) * self.det, np.arange(len(b)), b)
            d = int(self.cdel * SR)
            b = np.concatenate([np.zeros(d), b[:-d]])
            x = self.post(a + 0.8 * b)
            x = x / (np.abs(x).max() + 1e-9) * 0.6
            self.c[key] = fade(x, 0.0008, 0.05)
        return self.c[key]


def oud_post(x):
    x = hp(x, 70)
    x = x + 0.9 * bp(x, 100, 320) + 0.3 * bp(x, 850, 1500)
    return lp(x, 4800, 2)


def qanun_post(x):
    x = hp(x, 160)
    return lp(x + 0.25 * bp(x, 2000, 4500), 9000, 1)


def tremolo(bank, m, dur, interval, vel=1.0):
    """fast risha tremolo: repeated picks on one note."""
    n = int((dur + 0.6) * SR)
    out = np.zeros(n)
    k, tt = 0, 0.0
    while tt < dur - 1e-6:
        last = tt + interval >= dur - 1e-6
        seg = cut(bank.get(m, k), 0.55 if last else interval + 0.03, 0.12 if last else 0.025)
        sw = 0.75 + 0.25 * np.sin(np.pi * min(1, tt / max(dur, 1e-3)))     # gentle swell
        g = (1.0 if k % 2 == 0 else 0.78) * sw * vel
        i = int(tt * SR)
        m_ = min(len(seg), n - i)
        out[i:i + m_] += seg[:m_] * g
        tt += interval
        k += 1
    return out


# ----------------------------------------------------------------------------- continuous (legato) voices
def _curves(notes, n, glide, att, gap, slide_t=0.12):
    """notes: (start_s, dur_s, midi, vel, slide). -> smoothed midi curve, amp curve, time-since-onset, onsets"""
    mt = np.full(n, np.nan)
    at = np.zeros(n)
    ns = np.zeros(n)
    on = np.zeros(n)
    prev = None
    for j, (s, d, m, v, slide) in enumerate(notes):
        i0, i1 = int(s * SR), min(n, int((s + d) * SR))
        if i1 <= i0 + 2:
            continue
        mt[i0:i1] = m
        if slide and prev is not None:
            k = min(i1 - i0, int(slide_t * SR))
            mt[i0:i0 + k] = np.linspace(prev, m, k)
        g = gap
        if j + 1 < len(notes) and abs(notes[j + 1][2] - m) < 0.01 and notes[j + 1][0] - (s + d) < 0.02:
            g = max(gap, 0.045)                                         # re-articulate repeated pitch
        ig = max(i0 + 2, i1 - int(g * SR))
        at[i0:ig] = v
        ns[i0:i1] = s
        on[i0] = v
        prev = m
    valid = ~np.isnan(mt)
    if not valid.any():
        return None
    idx = np.where(valid, np.arange(n), 0)
    np.maximum.accumulate(idx, out=idx)
    first = mt[np.argmax(valid)]
    mt = mt[idx]
    mt[np.isnan(mt)] = first
    m_s = onepole(mt, glide, init=first)
    a_s = np.maximum(onepole(at, att, init=0.0), 0)
    tsn = np.arange(n) / SR - ns
    return m_s, a_s, tsn, on


def nay_render(notes, dur, rng):
    n = int(dur * SR)
    cv = _curves(notes, n, glide=0.028, att=0.04, gap=0.028)
    if cv is None:
        return np.zeros(n)
    m, a, tsn, on = cv
    t = np.arange(n) / SR
    vdep = 0.16 * np.clip((tsn - 0.22) / 0.45, 0, 1)
    vib = vdep * np.sin(2 * np.pi * (5.0 + 0.3 * np.sin(2 * np.pi * 0.23 * t)) * t)
    f = midi_hz(m + vib)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.13 * np.sin(2 * ph + 0.7) + 0.06 * np.sin(3 * ph + 1.3) + 0.02 * np.sin(4 * ph)
    nz = rng.standard_normal(n)
    breath = bp(nz, 500, 5000) * 0.09 + lp(nz, 2500) * (0.5 + 0.5 * np.sin(ph)) * 0.16
    chenv = signal.lfilter([1.0], [1, -np.exp(-1 / (0.03 * SR))], on)
    chiff = bp(rng.standard_normal(n), 1200, 7000) * chenv * 0.35
    return (tone * 0.85 + breath) * a + chiff * np.clip(a * 3, 0, 1)


def strings_render(notes, dur, rng, octs=((0, 1.0), (-12, 0.8)), att=0.1, bright=3600):
    n = int(dur * SR)
    cv = _curves(notes, n, glide=0.055, att=att, gap=0.0)
    if cv is None:
        return np.zeros(n)
    m, a, tsn, on = cv
    t = np.arange(n) / SR
    vdep = 0.11 * np.clip((tsn - 0.25) / 0.5, 0, 1)
    x = np.zeros(n)
    for o, g in octs:
        for k, det in enumerate((-0.07, 0.065)):
            vib = vdep * np.sin(2 * np.pi * (5.4 + 0.5 * k) * t + rng.random() * 6)
            drift = 0.02 * np.sin(2 * np.pi * (0.13 + 0.07 * k) * t + rng.random() * 6)
            x += saw_bl(midi_hz(m + o + det + vib + drift), 6500) * g
    x = hp(lp(x, bright, 2), 140)
    x = x + 0.35 * bp(x, 400, 1200)
    return x * a * 0.28


# ----------------------------------------------------------------------------- misc voices
def bass_note(midi, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(midi) * (1 + 0.035 * np.exp(-t / 0.015))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.38 * np.sin(2 * ph) + 0.16 * np.sin(3 * ph) + 0.06 * np.sin(4 * ph)
    env = (1 - np.exp(-t / 0.003)) * (0.55 + 0.45 * np.exp(-t / 0.12))
    return fade(softclip(x * env * 0.8, 1.4), 0, 0.035)


def drone_seg(midis, dur, fin=0.6, fout=0.8, cutoff=900):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, m in enumerate(midis):
        for det in (-0.06, 0.06):
            f = midi_hz(m + det + 0.03 * np.sin(2 * np.pi * (0.17 + 0.05 * k) * t + k))
            x += saw_bl(np.full(n, float(f[0])) if np.ndim(f) == 0 else f, 3000) * (1 if k == 0 else 0.6)
    x = lp(x, cutoff, 2)
    return fade(x * 0.25, fin, fout)


# ----------------------------------------------------------------------------- plan / maqam helpers
def _fit_plan(c):
    """keep 125-180 s even for brief-supplied tempos."""
    if 125 <= c.duration + 2.2 <= 180:
        return
    best = None
    for k in (1, 1.5, 2):
        d = sum(p[1] for p in make_plan(k)) * c.bar_s + 2.2
        err = max(0, 125 - d) + max(0, d - 180)
        key = (err, abs(d - 150))
        if best is None or key < best[0]:
            best = (key, k)
    c.k = best[1]
    c.sections, bar = [], 0
    for name, bars, en in make_plan(c.k):
        c.sections.append(Section(name, bar, bars, en))
        bar += bars
    c.total_bars, c.duration = bar, bar * c.bar_s
    c.mix = Mixer(c.duration + 2.5, c.rng)


class Maq:
    def __init__(self, name, root):
        d = MAQAMAT[name]
        self.name, self.sc, self.gh, self.root = name, d['sc'], d['gh'], root

    def m(self, deg, base, nxt=None):
        o, i = divmod(int(deg), 7)
        iv = self.sc[i]
        if self.name == 'nahawand' and i == 6 and (nxt is None or nxt < deg):
            iv = 10                                   # descending nahawand uses the minor 7th
        return base + iv + 12 * o

    def bass(self, deg):
        iv = self.sc[int(deg) % 7]
        return self.root - 12 + (iv - 12 if iv > 7 else iv)


def _walk1(rng, n, end, lo, hi, desc_bias=0.0):
    steps = np.array([-1, 1, -2, 2, 0, -3, 3])
    p = np.array([.27, .27 + desc_bias, .1, .1, .1, .04, .04])
    p = p / p.sum()
    out = [end]
    for _ in range(n - 1):
        cur = out[-1]
        for _try in range(6):
            nx = cur + int(rng.choice(steps, p=p))
            if lo <= nx <= hi:
                break
        else:
            nx = cur + (1 if cur < (lo + hi) / 2 else -1)
        out.append(int(np.clip(nx, lo, hi)))
    return out[::-1]


def _walk(rng, n, end, lo, hi, desc_bias=0.0, start=None):
    """backward random walk so the phrase lands exactly on `end`; mostly stepwise (maqam sayr).
    With `start`, several candidates are drawn and the one beginning nearest to `start` is kept."""
    if start is None or n < 2:
        return _walk1(rng, n, end, lo, hi, desc_bias)
    best = None
    for _ in range(24):
        w = _walk1(rng, n, end, lo, hi, desc_bias)
        sc = abs(w[0] - start) + (0.5 if w[0] == start else 0) + 0.3 * max(abs(np.diff(w)).max() - 2, 0)
        if best is None or sc < best[0]:
            best = (sc, w)
    return best[1]


def _harmonize(degs, rhythm, bass_of_bar, lo, hi):
    """strong beats -> consonant with the bass degree (root, 3rd step, 5th step)."""
    out = list(degs)
    for i, (bar, s, ln) in enumerate(rhythm):
        if i == len(out) - 1 or s not in (0, 8) or ln < 2:
            continue
        bd = bass_of_bar(bar)
        ok = {(bd) % 7, (bd + 2) % 7, (bd + 4) % 7}
        if out[i] % 7 in ok:
            continue
        for dd in (1, -1, 2, -2):
            if (out[i] + dd) % 7 in ok and lo <= out[i] + dd <= hi:
                out[i] += dd
                break
    return out


def make_melody(rng, maq, bars, kind, bass_deg):
    """-> list of (bar_rel, step, len, deg). Phrases are 2 bars: A A' B Ac (...)."""
    gh = maq.gh
    if kind == 'chorus':
        lo, hi = 2, 10
        tg = dict(A=7, A2=gh, B=gh + 2, C=7)
    else:
        lo, hi = -2, gh + 3
        tg = dict(A=gh, A2=int(rng.choice([1, 2])), B=gh + 1, C=0)
    nph = bars // 2
    pat = {4: 'A A2 B C', 6: 'A A2 B B2 A C', 8: 'A A2 B C A A2 B C'}.get(nph)
    if pat is None:
        pat = ' '.join((['A', 'A2', 'B', 'C'] * 4)[:nph])
    pat = pat.split()

    def gen_phrase(r1, r2, target, desc, start):
        rh = [(0, s, l) for s, l in r1] + [(1, s, l) for s, l in r2]
        degs = _walk(rng, len(rh), target, lo, hi, desc, start)
        return rh, degs

    rA = (RHY1[int(rng.integers(len(RHY1)))], RHY2[int(rng.integers(len(RHY2)))])
    rB = (RHY1[int(rng.integers(len(RHY1)))], RHY2[int(rng.integers(len(RHY2)))])
    A_rh, A_deg = gen_phrase(*rA, tg['A'], 0.0, tg['A'] - int(rng.choice([1, 2, 3])))
    B_rh, B_deg = gen_phrase(*rB, tg['B'], 0.0, tg['A2'] + int(rng.choice([1, 2])))
    n1A = len(rA[0])
    n1B = len(rB[0])

    def vary(rh, degs, n1, target, desc):
        # keep bar 1, re-aim bar 2 starting from the last bar-1 note
        tail = _walk(rng, len(rh) - n1 + 1, target, lo, hi, desc, degs[n1 - 1])
        return rh, list(degs[:n1]) + tail[1:]

    phrases = {'A': (A_rh, A_deg), 'B': (B_rh, B_deg)}
    phrases['A2'] = vary(A_rh, A_deg, n1A, tg['A2'], 0.0)
    phrases['B2'] = vary(B_rh, B_deg, n1B, tg['A'], 0.1)
    phrases['C'] = vary(A_rh, A_deg, n1A, tg['C'], 0.35)
    out = []
    for i, key in enumerate(pat):
        rh, degs = phrases[key]
        b0 = 2 * i
        degs = _harmonize(degs, rh, lambda br: bass_deg(b0 + br), lo, hi)
        for (br, s, ln), d in zip(rh, degs):
            out.append((b0 + br, s, ln, int(d)))
    return out, pat


def ornament(rng, notes, maq, base, intensity=1.0):
    """notes: (t, dur, deg, vel) -> synth sub-notes (t, d, midi, vel, slide) with graces/trills/mordents."""
    out = []
    prevd = None
    for j, (t, d, deg, v) in enumerate(notes):
        nxt = notes[j + 1][2] if j + 1 < len(notes) else None
        m = maq.m(deg, base, nxt)
        up = maq.m(deg + 1, base, deg)
        slide = prevd is not None and abs(deg - prevd) <= 2 and rng.random() < 0.22 * intensity
        r = rng.random() / intensity
        if d >= 0.4 and r < 0.22:                                     # grace note from above
            g = 0.055
            out.append((t, g, up, v * 0.85, False))
            out.append((t + g, d - g, m, v, False))
        elif d >= 0.7 and r < 0.45:                                   # trill on the tail of a long note
            h = d * 0.45
            out.append((t, h, m, v, slide))
            k, tt, step = 0, t + h, 1 / 13.0
            while tt + step < t + d - 0.12:
                out.append((tt, step, up if k % 2 == 0 else m, v * 0.92, False))
                tt += step
                k += 1
            out.append((tt, t + d - tt, m, v, False))
        elif d >= 0.3 and r < 0.58:                                   # mordent
            g = 0.045
            out.append((t, g, m, v, slide))
            out.append((t + g, g, up, v * 0.9, False))
            out.append((t + 2 * g, d - 2 * g, m, v, False))
        else:
            out.append((t, d, m, v, slide))
        prevd = deg
    return out


def taqsim_plan(rng, maq, dur, lo=-1, hi=9, top=None):
    """free-time improvisation: gestures exploring lower jins -> ghammaz -> peak -> cadence on tonic.
    returns list of (t, d, deg, long)"""
    gh = maq.gh
    peak = top if top is not None else int(rng.choice([gh + 2, 7]))
    targets = [int(rng.choice([1, 2])), gh, peak, gh, int(rng.choice([1, 2]))]
    seq = [(0.0, 0.9, 0, True)]
    t, cur = 0.9 + rng.uniform(0.1, 0.25), 0
    budget = dur * 0.78
    for tg in targets:
        if t > budget:
            break
        path = []
        c_ = cur
        while c_ != tg:
            c_ += 1 if tg > c_ else -1
            path.append(c_)
        if rng.random() < 0.4 and len(path) >= 2:               # turn: overshoot and come back
            path = path + [tg + (1 if tg >= cur else -1), tg]
        run = rng.random() < 0.55
        for k, dg in enumerate(path):
            last = k == len(path) - 1
            dd = rng.uniform(0.75, 1.4) if last else (rng.uniform(0.09, 0.14) if run else rng.uniform(0.2, 0.38))
            seq.append((t, dd, int(np.clip(dg, lo, hi)), last))
            t += dd
        t += rng.uniform(0.08, 0.3)
        cur = tg
    # cadence: descend to the tonic
    path = list(range(cur - 1, -1, -1)) if cur > 0 else [1, 0]
    if len(path) > 4:
        path = path[-4:]
    for k, dg in enumerate(path):
        last = k == len(path) - 1
        dd = rng.uniform(1.4, 2.0) if last else rng.uniform(0.18, 0.3)
        seq.append((t, dd, dg, last))
        t += dd
    sc = (dur * 0.97) / t
    return [(a * sc, b * sc, g, l) for a, b, g, l in seq]


# ----------------------------------------------------------------------------- compose
def compose(c):
    _fit_plan(c)
    rng, root = c.rng, c.root
    mqn = c.brief.get('maqam') if c.brief.get('maqam') in MAQAMAT else MAQ_ORDER[int(rng.integers(len(MAQ_ORDER)))]
    maq = Maq(mqn, root)
    c.maqam = mqn
    mv = MAQAMAT[mqn]
    iqa_v = c.brief.get('iqa') if c.brief.get('iqa') in IQAAT else list(IQAAT)[int(rng.integers(len(IQAAT)))]
    ci = [q for q in CHORUS_IQA if q != iqa_v]
    iqa_c = ci[int(rng.integers(len(ci)))]
    kick_pat = KICK_PATS[int(rng.integers(len(KICK_PATS)))]
    bass_dab = BASS_DABKE[int(rng.integers(len(BASS_DABKE)))]
    prog_v = mv['prog'][int(rng.integers(len(mv['prog'])))]
    prog_c = mv['prog'][int(rng.integers(len(mv['prog'])))]
    c.style_info = dict(maqam=mqn, iqa_verse=iqa_v, iqa_chorus=iqa_c)

    m = c.mix
    m.stem('perc', 0.95, 0.10)
    m.stem('beat', 0.85, 0.06)
    m.stem('bass', 0.5, 0.02)
    m.stem('drone', 0.55, 0.35)
    m.stem('oud', 1.6, 0.14)
    m.stem('taqsim', 1.2, 0.55, fx=lambda y: echo(y, 0.33, 0.3, 3, 2800))
    m.stem('qanun', 1.4, 0.30)
    m.stem('nay', 0.5, 0.32)
    m.stem('strings', 0.6, 0.30)
    m.stem('fx', 0.35, 0.40)

    def T(bar, step=0.0):
        return c.t(bar) + step * c.step

    def hum(s=0.004):
        return float(np.clip(rng.normal(0, s), -2 * s, 2 * s))

    secs = c.sections
    vbars = next(s.bars for s in secs if s.name == 'verse')
    cbars = next(s.bars for s in secs if s.name == 'chorus')

    # ---------------------------------------------------------------- harmony (bass degree per bar)
    mel_c, pat_c = make_melody(rng, maq, cbars, 'chorus', lambda br: prog_c[br % 4])
    mel_v, pat_v = make_melody(rng, maq, vbars, 'verse', lambda br: prog_v[br % 4])

    def cad_bars(pat):
        return {2 * i + 1 for i, k in enumerate(pat) if k == 'C'}
    cad_c, cad_v = cad_bars(pat_c), cad_bars(pat_v)
    # re-harmonise with cadence bars forced to the tonic
    bdeg_c = [0 if br in cad_c else prog_c[br % 4] for br in range(cbars)]
    bdeg_v = [0 if br in cad_v else prog_v[br % 4] for br in range(vbars)]

    def bass_deg(sec, rel):
        if sec.name == 'chorus':
            return bdeg_c[rel % cbars]
        if sec.name == 'verse':
            return bdeg_v[rel % vbars]
        return 0

    # ---------------------------------------------------------------- percussion
    c.progress(0.05, 'darbuka')
    DUM = [mk_dum(rng, 150 + 6 * i, 96 + 3 * i) for i in range(3)]
    TEK = [mk_tek(rng, 1.0 + 0.03 * i) for i in range(4)]
    KA = [mk_tek(rng, 0.8 + 0.03 * i, 0.55, 0.12, 0.6) for i in range(4)]
    RIQ = [mk_riq(rng) for _ in range(4)]
    RIQS = [mk_riq(rng, True) for _ in range(2)]
    SAG = mk_sagat(rng)
    DOH = {'t1': mk_dum(rng, 260, 215, 0.35, 0.09), 't2': mk_dum(rng, 190, 150, 0.4, 0.12), 't3': mk_dum(rng, 110, 70, 0.6, 0.2)}
    KK = kick(rng, 105, 44, 0.5, 0.12, 1.6)
    CL = [mk_claps(rng) for _ in range(2)]
    CR = fade(crash(rng, 2.2), 0, 0.4)

    def hit(code, t, vel, pan=0.0, stem='perc'):
        if code == 'D':
            m.add(stem, DUM[int(rng.integers(3))], t, 1.0 * vel, -0.05); c.ev('drums', t, 'k', vel)
        elif code in 'T':
            m.add(stem, TEK[int(rng.integers(4))], t, 0.85 * vel, 0.12); c.ev('drums', t, 's', vel)
        elif code in 'Kk':
            m.add(stem, KA[int(rng.integers(4))], t, 0.7 * vel, 0.18); c.ev('drums', t, 'h', vel)
        elif code == 'riq':
            m.add(stem, RIQ[int(rng.integers(4))], t, vel, 0.35); c.ev('drums', t, 'o', vel)
        elif code == 'riqs':
            m.add(stem, RIQS[int(rng.integers(2))], t, vel, 0.35); c.ev('drums', t, 'o', vel)
        elif code in DOH:
            m.add(stem, DOH[code], t, vel, {'t1': .3, 't2': 0, 't3': -.3}[code]); c.ev('drums', t, code, vel)

    def ornate(base, en, dense):
        p = list(base)
        for s in range(16):
            if p[s] != '.':
                continue
            pr = (0.2 + 0.6 * en if dense else 0.08 + 0.45 * en) if s % 2 == 0 else (0.12 + 0.45 * en if dense else 0.03 + 0.25 * en)
            if p[(s + 1) % 16] == 'D' and s % 2:
                pr *= 0.4
            if rng.random() < pr:
                p[s] = 'K' if (s % 4 == 2 and rng.random() < .5) else 'k'
        return ''.join(p)

    def play_bar(pat, t0, en, vel=1.0, upto=16):
        for s in range(upto):
            ch = pat[s]
            if ch == '.':
                continue
            v = {'D': 1.0, 'T': 0.9, 'K': 0.72, 'k': 0.45}[ch] * vel * rng.uniform(.9, 1.05)
            hit(ch, t0 + s * c.step + hum(0.003), round(min(v, 1.0), 2))

    def riq_bar(pat, t0, vel, upto=16, sixteenths=False):
        for s in range(0, upto, 1 if sixteenths else 2):
            acc = pat[s] in 'DT'
            if not acc and s % 2 and rng.random() < 0.5:
                continue
            code = 'riqs' if (acc and s in (4, 12)) else 'riq'
            hit(code, t0 + s * c.step + hum(0.004), round(vel * (0.85 if acc else 0.5) * rng.uniform(.85, 1.05), 2))

    def fill(t0, kind, upto_vel=1.0):
        if kind == 'roll':                     # 32nd-note tek/ka roll over beats 3-4, crescendo
            for i in range(16):
                t = t0 + 8 * c.step + i * c.step / 2
                v = round((0.3 + 0.7 * i / 15) * upto_vel, 2)
                hit('T' if i % 2 == 0 else 'K', t, v)
        elif kind == 'doholla':
            for s, code in ((8, 't1'), (10, 't1'), (12, 't2'), (13, 't2'), (14, 't3'), (15, 't3')):
                hit(code, t0 + s * c.step, 0.85)
                if s in (8, 12):
                    hit('K', t0 + (s + 1) * c.step, 0.5)
        else:                                  # short ka-tek pickup in the last beat
            for s, ch in ((12, 'T'), (13, 'K'), (14, 'T'), (15, 'K')):
                hit(ch, t0 + s * c.step, 0.75 if ch == 'T' else 0.55)

    for sec in secs:
        en = sec.energy
        if sec.name in ('verse', 'chorus'):
            base = IQAAT[iqa_v] if sec.name == 'verse' else IQAAT[iqa_c]
            dense = sec.name == 'chorus'
            orn = [ornate(base, en, dense) for _ in range(2)]
        for b in range(sec.bar, sec.bar + sec.bars):
            rel, t0 = b - sec.bar, c.t(b)
            last_of_sec = rel == sec.bars - 1
            if sec.name == 'intro':
                if last_of_sec:
                    fill(t0, 'roll', 0.9)
                continue
            if sec.name == 'bridge':
                if rel < 4:
                    if rel % 2 == 0:
                        hit('D', t0, 0.7)
                    hit('riqs', t0 + 8 * c.step, 0.35)
                elif rel < 7:
                    v = 0.55 + 0.15 * (rel - 4)
                    play_bar(IQAAT[iqa_v], t0, en, v)
                    riq_bar(IQAAT[iqa_v], t0, v * 0.8)
                else:
                    play_bar(IQAAT[iqa_v], t0, en, 0.95, upto=8)
                    for i in range(11):                               # roll, then a short stop before the drop
                        hit('T' if i % 2 == 0 else 'K', t0 + 8 * c.step + i * c.step / 2, round(0.35 + 0.65 * i / 10, 2))
                continue
            if sec.name == 'outro':
                if rel < 2:
                    pat = ornate(IQAAT[iqa_v], 0.5, False)
                    play_bar(pat, t0, 0.5, 0.9, 8 if rel == 1 else 16)
                    riq_bar(pat, t0, 0.7, 8 if rel == 1 else 16)
                    if rel == 1:
                        fill(t0, 'roll', 0.9)
                elif rel == 2:
                    hit('D', t0, 1.0)
                    hit('riqs', t0, 0.9)
                    m.add('beat', KK, t0, 1.0)
                    m.add('beat', CR, t0, 0.65, -0.3); c.ev('drums', t0, 'c', 1.0)
                continue
            # verse / chorus
            pat = orn[rel % 2]
            fill_kind = None
            if last_of_sec:
                fill_kind = 'roll' if rng.random() < 0.7 else 'doholla'
            elif rel % 8 == 7:
                fill_kind = 'doholla' if rng.random() < 0.5 else 'roll'
            elif rel % 4 == 3:
                fill_kind = 'small'
            upto = 8 if fill_kind in ('roll', 'doholla') else (12 if fill_kind == 'small' else 16)
            play_bar(pat, t0, en, 0.95 if sec.name == 'verse' else 1.0, upto)
            riq_bar(pat, t0, 0.55 + 0.4 * en, upto, sixteenths=sec.name == 'chorus' and en > 0.92)
            if fill_kind:
                fill(t0, fill_kind)
            if sec.name == 'chorus':
                for s in kick_pat:
                    if s < upto:
                        t = t0 + s * c.step
                        m.add('beat', KK, t, 0.95)
                        if pat[s] != 'D':
                            c.ev('drums', t, 'k', 0.95)
                for s in (4, 12):
                    if s < upto or s == 12:
                        t = t0 + s * c.step + hum(0.002)
                        m.add('beat', CL[int(rng.integers(2))], t, 0.85, 0.1); c.ev('drums', t, 'cl', 0.9)
                for s in (6, 14):
                    if s < upto and rng.random() < 0.8:
                        t = t0 + s * c.step
                        m.add('perc', SAG, t, 0.6, -0.4); c.ev('drums', t, 'p', 0.5)
                if rel % 8 == 0:
                    m.add('beat', CR, t0, 0.55, -0.3); c.ev('drums', t0, 'c', 0.9)
            elif sec.name == 'verse' and rel == 0:
                m.add('beat', CR, t0, 0.4, -0.3); c.ev('drums', t0, 'c', 0.7)

    # ---------------------------------------------------------------- bass + drone
    c.progress(0.2, 'bass')
    bcache = {}

    def bass(t, midi, dur, vel):
        key = (round(midi * 2) / 2, round(dur, 2))
        if key not in bcache:
            bcache[key] = bass_note(key[0], key[1])
        m.add('bass', bcache[key], t, vel)
        c.ev('bass', t, int(round(midi)), round(dur, 3), round(vel, 2))

    for sec in secs:
        for b in range(sec.bar, sec.bar + sec.bars):
            rel, t0 = b - sec.bar, c.t(b)
            if sec.name in ('verse', 'chorus'):
                bd = bass_deg(sec, rel)
                r = maq.bass(bd)
                end_fill = rel == sec.bars - 1 or rel % 8 == 7
                if sec.name == 'verse':
                    pat = IQAAT[iqa_v]
                    on = [s for s in range(16) if pat[s] == 'D']
                    if rel % 4 == 3 and not end_fill:
                        on = sorted(set(on + [14]))
                else:
                    on = list(bass_dab)
                if end_fill:
                    on = [s for s in on if s < 8] + [8, 10, 12, 14]
                for i, s in enumerate(on):
                    nxt = on[i + 1] if i + 1 < len(on) else 16
                    ln = min(nxt - s, 4) * c.step * (0.85 if sec.name == 'chorus' else 0.92)
                    note = r
                    if sec.name == 'chorus' and s in (6, 14) and rng.random() < 0.6:
                        note = r + 12
                    if end_fill and s >= 8:
                        note = r + [0, 7, 12, 7][(s - 8) // 2]
                    vel = 1.0 if s in (0, 8) else 0.82
                    bass(t0 + s * c.step, note, ln, vel)
            elif sec.name == 'outro':
                if rel < 2:
                    for s in [i for i in range(16) if IQAAT[iqa_v][i] == 'D']:
                        bass(t0 + s * c.step, maq.bass(0), 2 * c.step, 0.9)
                elif rel == 2:
                    bass(t0, maq.bass(0), c.bar_s * 1.6, 1.0)
            elif sec.name == 'bridge' and rel >= 4:
                steps = [0, 8] if rel < 7 else [0, 4]
                for s in steps:
                    bass(t0 + s * c.step, maq.bass(0), (3.6 if rel < 7 else 3.4) * c.step, 0.75 + 0.05 * (rel - 4))
                if rel == 6:
                    for s in (12, 14):
                        bass(t0 + s * c.step, maq.bass(0) + 12, 1.6 * c.step, 0.75)

    # drone: strong in intro/bridge (with events), soft pedal under verses
    for sec in secs:
        if sec.name == 'intro':
            t0, d = c.t(sec.bar), sec.bars * c.bar_s + 0.6
            m.add('drone', drone_seg([root - 12, root - 5], d, 1.2, 0.8), t0, 1.0)
            for b in range(sec.bar, sec.bar + sec.bars, 2):
                c.ev('bass', c.t(b), int(root - 12), round(2 * c.bar_s, 3), 0.6)
        elif sec.name == 'bridge':
            t0, d = c.t(sec.bar), 4 * c.bar_s + 0.8
            m.add('drone', drone_seg([root - 12, root - 5], d, 0.8, 1.0), t0, 1.0)
            for b in range(sec.bar, sec.bar + 4, 2):
                c.ev('bass', c.t(b), int(root - 12), round(2 * c.bar_s, 3), 0.6)
        elif sec.name == 'verse':
            t0, d = c.t(sec.bar), sec.bars * c.bar_s
            m.add('drone', drone_seg([root - 12, root - 5], d, 1.5, 1.0, 700), t0, 0.45)
        elif sec.name == 'outro':
            m.add('drone', drone_seg([root - 12, root - 5], 2 * c.bar_s + 3, 0.05, 2.5), c.t(sec.bar + 2), 0.8)

    # ---------------------------------------------------------------- oud
    c.progress(0.35, 'oud')
    OUD = PluckBank(rng, 0.55, 0.9955, 2.6, oud_post)
    QAN = PluckBank(rng, 0.92, 0.9975, 1.6, qanun_post, det=1.0015, cdel=0.002)
    gdir = [1]

    def gev(t, midi, dur, vel, mute):
        c.ev('guitar', t, int(round(midi)), round(dur, 3), round(vel, 2), gdir[0], 1 if mute else 0)
        gdir[0] = -gdir[0]

    def oud_note(t, midi, dur, vel, stem='oud', pan=-0.22, slide=0.0, trem=None, ev=True, ring=0.18):
        if trem:
            x = tremolo(OUD, midi, dur, trem, 1.0)
        else:
            x = cut(OUD.get(midi, int(rng.integers(2))), dur + ring, 0.06)
            if slide:
                k = min(len(x), int(0.07 * SR))
                cents = np.zeros(len(x))
                cents[:k] = np.linspace(-slide * 100, 0, k)
                x = warp(x, cents)
        m.add(stem, x, t, vel, pan)
        if ev:
            gev(t, midi, dur, vel, dur < 2.1 * c.step and not trem)

    def qanun_run(t, degs, spacing, vel, ring=0.45, ev=True, pan=0.35):
        for k, d in enumerate(degs):
            mm = maq.m(d, root + 12, degs[k + 1] if k + 1 < len(degs) else None)
            x = cut(QAN.get(mm, k), ring, 0.08)
            x = x + 0.6 * cut(QAN.get(mm + 12, k + 1), ring, 0.08)
            m.add('qanun', x, t + k * spacing, vel * (0.75 + 0.25 * (k == len(degs) - 1)), pan + 0.1 * np.sin(k))
        if ev:
            gev(t, maq.m(degs[0], root), len(degs) * spacing, vel, False)

    # intro taqsim (free time, heavy reverb) over the drone
    intro = secs[0]
    tq = taqsim_plan(rng, maq, intro.bars * c.bar_s - c.beat * 0.5)
    for j, (t, d, dg, lng) in enumerate(tq):
        nxt = tq[j + 1][2] if j + 1 < len(tq) else None
        mm = maq.m(dg, root, nxt)
        if lng and d > 0.7:
            oud_note(t, mm, d, 0.9, 'taqsim', -0.1, trem=0.068 if rng.random() < 0.75 else None, ring=0.5)
        else:
            sl = 1.0 if (j and rng.random() < 0.2 and abs(dg - tq[j - 1][2]) == 1) else 0.0
            oud_note(t, mm, d, 0.8 + 0.15 * rng.random(), 'taqsim', -0.1, slide=sl, ring=0.35)
    # qanun glissando into the drop
    t_drop = c.t(secs[1].bar)
    gl = list(range(0, 12))
    qanun_run(t_drop - len(gl) * 0.035, gl, 0.035, 0.7, 0.6)

    # verse riff (1 bar, follows the bass degree)
    def make_riff(base_pat):
        on = sorted(set([s for s in range(16) if base_pat[s] != '.'] + [s for s in range(0, 16, 2) if rng.random() < 0.55]))
        degs, d = [], 0
        for i, s in enumerate(on):
            if s in (0, 8):
                d = 0 if s == 0 else int(rng.choice([0, 2, 4, -1]))
            else:
                d = int(np.clip(d + rng.choice([-1, 1, 1, -1, 0, 2]), -2, 4))
            degs.append(d)
        return list(zip(on, degs))
    riff_a = make_riff(IQAAT[iqa_v])
    riff_b = make_riff(IQAAT[iqa_v])

    def play_riff(sec, b, riff, vel=0.8, upto=16):
        rel, t0 = b - sec.bar, c.t(b)
        bd = bass_deg(sec, rel) if sec.name in ('verse', 'chorus') else 0
        for i, (s, d) in enumerate(riff):
            if s >= upto:
                break
            nxt = riff[i + 1][0] if i + 1 < len(riff) else 16
            ln = (nxt - s) * c.step
            mm = maq.m(bd + d, root)
            oud_note(t0 + s * c.step + hum(0.005), mm, ln * 0.9, vel * (1.0 if s % 4 == 0 else 0.8), ring=0.08)

    c.progress(0.45, 'oud')
    for sec in secs:
        for b in range(sec.bar, sec.bar + sec.bars):
            rel = b - sec.bar
            if sec.name == 'verse':
                fillbar = rel == sec.bars - 1 or rel % 8 == 7
                play_riff(sec, b, riff_b if rel % 4 == 3 else riff_a, 0.78, 8 if fillbar else 16)
            elif sec.name == 'bridge' and rel in (5, 6):
                play_riff(sec, b, riff_a, 0.55 + 0.1 * (rel - 5))
            elif sec.name == 'outro' and rel < 2:
                play_riff(sec, b, riff_a, 0.75)
        if sec.name == 'outro':
            t0 = c.t(sec.bar + 2)
            oud_note(t0, maq.m(0, root), c.bar_s * 1.3, 0.95, trem=0.07)
            qanun_run(t0 + 0.02, list(range(14, -1, -1)), 0.04, 0.6, 0.9, ev=False)

    # ---------------------------------------------------------------- melody: nay + strings (+ oud heterophony, qanun answers)
    c.progress(0.6, 'melody')

    def mel_abs(sec, mel):
        out = []
        for (br, s, ln, d) in mel:
            t = T(sec.bar + br, s)
            out.append((t, ln * c.step, d, 0.85 + 0.15 * (s % 8 == 0)))
        return out

    def render_lead(sec, notes, nay=True, strings=True, oud_het=False, str_g=1.0, nay_g=1.0, ev=True, qanun=True):
        if not notes:
            return
        t_start = notes[0][0] - 0.05
        span = notes[-1][0] + notes[-1][1] - t_start + 1.2
        rel_notes = [(t - t_start, d, dg, v) for t, d, dg, v in notes]
        mbase = root + 12
        if nay:
            sub = ornament(rng, rel_notes, maq, mbase)
            x = nay_render(sub, span, rng)
            m.add('nay', fade(x, 0.01, 0.4), t_start, nay_g, 0.08)
        if strings:
            sub = ornament(rng, rel_notes, maq, mbase, 0.5)
            x = strings_render(sub, span, rng)
            m.add('strings', fade(x, 0.01, 0.5), t_start, str_g, -0.05)
        if ev:
            for j, (t, d, dg, v) in enumerate(notes):
                nxt = notes[j + 1][2] if j + 1 < len(notes) else None
                c.ev('lead', t, int(round(maq.m(dg, mbase, nxt))), round(d, 3), round(v, 2))
        for j, (t, d, dg, v) in enumerate(notes):
            nxt = notes[j + 1][2] if j + 1 < len(notes) else None
            if oud_het:
                mm = maq.m(dg, root, nxt)
                if d >= 5.5 * c.step:
                    oud_note(t, mm, d * 0.95, 0.75, trem=c.step / 2 if c.step / 2 > 0.06 else c.step)
                else:
                    sl = 1.0 if rng.random() < 0.1 else 0.0
                    oud_note(t + hum(0.006), mm, d * 0.95, 0.72, slide=sl, ring=0.12)
            if qanun and d >= 6 * c.step and rng.random() < 0.8:      # qanun answer in the long note
                k = int(rng.integers(5, 9))
                if rng.random() < 0.6:
                    degs = list(range(dg + k, dg - 1, -1))      # cascade down onto the held note
                else:
                    degs = list(range(dg - k, dg + 1))          # sweep up onto it
                degs = [int(np.clip(x, -3, 14)) for x in degs]
                sp = c.step / 2 if c.step / 2 >= 0.06 else c.step / 1.5
                qanun_run(t + 2 * c.step, degs, sp, 0.5, 0.45)

    for sec in secs:
        if sec.name == 'verse':
            second = sec.bar > secs[2].bar
            render_lead(sec, mel_abs(sec, mel_v), nay=True, strings=second, str_g=0.6)
        elif sec.name == 'chorus':
            render_lead(sec, mel_abs(sec, mel_c), nay=True, strings=True, oud_het=True, str_g=1.0)
            # qanun glissando pickup into each chorus
            t0 = c.t(sec.bar)
            qanun_run(t0 - 10 * 0.03, list(range(-2, 8)), 0.03, 0.55, 0.6)
        elif sec.name == 'outro':
            # final cadence phrase (last chorus phrase, compressed into 2 bars)
            last = [n for n in mel_c if n[0] >= cbars - 2]
            notes = [(T(sec.bar + n[0] - (cbars - 2), n[1]), n[2] * c.step, n[3], 0.85) for n in last]
            render_lead(sec, notes, nay=True, strings=True, str_g=0.8, qanun=False)
            # final held tonic chord on strings
            t0 = c.t(sec.bar + 2)
            fin = [(0.0, c.bar_s * 1.7, maq.m(d, root + 12), 0.8, False) for d in (0,)]
            x = strings_render(fin, c.bar_s * 1.7 + 1.0, rng, octs=((0, 1.0), (-12, 0.9), (-5, 0.6)), att=0.05)
            m.add('strings', fade(x, 0.0, 1.0), t0, 0.9)
            c.ev('lead', t0, int(round(maq.m(0, root + 12))), round(c.bar_s * 1.7, 3), 0.8)
        elif sec.name == 'bridge':
            # nay taqsim (free time) over the drone
            d_tq = 4 * c.bar_s - 0.3
            tq = taqsim_plan(rng, maq, d_tq, lo=0, hi=10, top=int(rng.choice([7, 8])))
            t0 = c.t(sec.bar) + 0.15
            notes = [(t0 + t, d, dg + 0, 0.8 + 0.2 * l) for t, d, dg, l in tq]
            render_lead(sec, notes, nay=True, strings=False, nay_g=1.05, qanun=False)
            # build-up: strings climb one scale step per beat, riser noise
            tb = c.t(sec.bar + 4)
            climb = [(tb + i * c.beat, c.beat, i // 2 if i < 8 else i - 4, 0.6 + 0.4 * i / 11) for i in range(12)]
            climb = [(t, d, dg, v) for t, d, dg, v in climb if t < c.t(sec.bar + 7, 2.5)]
            render_lead(sec, climb, nay=False, strings=True, str_g=0.9, qanun=False)
            nr = int(3 * c.bar_s * SR)
            rz = lp_sweep(rng.standard_normal(nr), (300, 9000)) * np.linspace(0, 1, nr) ** 2
            m.add('fx', fade(rz * 0.5, 0.2, 0.05), tb, 1.0)
    for k in c.events:                       # the 3D band reads events in time order
        c.events[k].sort(key=lambda e: e[0])
    c.progress(0.9, 'mixing')
