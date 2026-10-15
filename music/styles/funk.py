"""Funk: 70s/80s groove. Swung 16th hats with ghost snares, syncopated kick, slap bass (thumb, octave pops,
ghost notes, chromatic approaches), wah'd chicken-scratch rhythm guitar, clavinet riff, brass-section stabs
over dorian / mixolydian min7, dom7 and dom9 vamps."""
import numpy as np
from engine import *

NAME = 'Funk'
BPMS = [96, 100, 104, 108, 112]
KEYS = [40, 45, 43, 38, 42, 41]          # E A G D F# F
TITLES = (['Super', 'Funky', 'Cosmic', 'Soul', 'Disco', 'Smooth', 'Hot', 'Boogie', 'Velvet', 'Midnight', 'Groovy', 'Chocolate'],
          ['Machine', 'Strut', 'Fever', 'Thang', 'Train', 'Express', 'Shake', 'Bounce', 'Groove', 'Brother', 'Motion', 'Sauce'])

# (semitones from tonic, chord kind) per bar, 4-bar cycles
MODES = {
    'dorian': dict(
        verse=[[(0, 'min7')] * 2 + [(5, 'dom9')] * 2, [(0, 'min9')] * 4, [(0, 'min7')] * 3 + [(5, 'dom7')], [(0, 'min7'), (5, 'dom9')] * 2],
        chorus=[[(5, 'dom9'), (5, 'dom9'), (0, 'min9'), (0, 'min9')], [(3, 'maj7'), (5, 'dom9'), (0, 'min7'), (0, 'min7')],
                [(10, 'dom9'), (5, 'dom9'), (0, 'min9'), (0, 'min9')], [(5, 'dom9'), (7, 'min7'), (3, 'maj7'), (5, 'dom9')]],
        bridge=[[(8, 'maj7'), (10, 'dom9'), (0, 'min9'), (7, 'dom7')], [(5, 'min7'), (10, 'dom9'), (3, 'maj7'), (7, 'dom9')],
                [(3, 'maj7'), (2, 'min7'), (5, 'dom9'), (7, 'dom9')]]),
    'mixolydian': dict(
        verse=[[(0, 'dom9')] * 4, [(0, 'dom7')] * 3 + [(5, 'dom9')], [(0, 'dom9'), (0, 'dom9'), (10, 'dom9'), (5, 'dom9')]],
        chorus=[[(5, 'dom9'), (5, 'dom9'), (0, 'dom9'), (0, 'dom9')], [(10, 'dom9'), (5, 'dom9'), (0, 'dom9'), (0, 'dom9')],
                [(5, 'dom9'), (7, 'dom9'), (0, 'dom9'), (10, 'dom9')]],
        bridge=[[(5, 'dom9'), (7, 'dom9'), (5, 'dom9'), (7, 'dom7')], [(10, 'maj7'), (5, 'dom9'), (3, 'maj7'), (7, 'dom9')],
                [(2, 'min7'), (7, 'dom9'), (2, 'min7'), (7, 'dom9')]]),
}
KICKS = [[0, 3, 10], [0, 6, 10, 13], [0, 7, 10], [0, 3, 8, 10], [0, 10, 13], [0, 3, 6, 10]]
GHOSTS = [[7, 9, 15], [2, 7, 14], [6, 9, 11], [7, 10, 15], [3, 9, 14]]
# slap bass: (step, kind, len) kinds: T thumb root, O octave pop, 7 flat-seven pop, 5 fifth, G ghost, A approach
SLAPS = [
    [(0, 'T', 2), (3, 'G', 1), (4, 'O', 1), (6, 'T', 1), (7, 'G', 1), (8, 'T', 2), (10, 'O', 1), (11, 'G', 1), (12, '7', 2), (14, 'T', 1), (15, 'A', 1)],
    [(0, 'T', 3), (3, 'T', 1), (5, 'G', 1), (6, 'O', 2), (9, 'T', 1), (10, 'T', 2), (12, 'O', 1), (13, 'G', 1), (14, '5', 1), (15, 'A', 1)],
    [(0, 'T', 2), (2, 'G', 1), (3, 'O', 1), (4, 'G', 1), (6, 'T', 2), (8, 'G', 1), (10, 'T', 1), (11, 'O', 1), (13, 'T', 1), (14, 'O', 1), (15, 'A', 1)],
    [(0, 'T', 4), (4, 'G', 1), (6, 'T', 1), (7, 'O', 1), (9, 'G', 1), (10, 'T', 2), (12, '7', 1), (13, 'O', 1), (14, 'G', 1), (15, 'A', 1)],
    [(0, 'T', 2), (2, 'T', 1), (3, 'O', 1), (5, 'G', 1), (6, '7', 1), (7, 'O', 1), (8, 'T', 2), (11, 'G', 1), (12, 'T', 1), (13, '5', 1), (14, 'O', 1), (15, 'A', 1)],
]
# rhythm guitar: x = open chop, . = muted scratch, - = rest
SCRATCH = ['..x...x...x...x.', '.x..x..x.x..x..x', 'x..x..x...x..x..', '..x..x.x..x..x.x', 'x.-.x.x.-.x.x.-.', '.-x-.-x-.-x-.xx-']
# horn stabs within a 2-bar window (step, len)
STABS = [[(0, 3), (6, 2), (10, 1), (12, 4)], [(14, 2), (16, 3), (22, 2)], [(0, 2), (3, 2), (28, 1), (30, 2)],
         [(2, 1), (4, 3), (18, 1), (20, 3)], [(0, 2), (6, 1), (8, 2), (26, 1), (28, 3)]]


# ----------------------------------------------------------------------------- local voices
def fit_length(c, lo=124.0, hi=176.0):
    """Ctx picks the plan length from a random target; make sure the song lands in [lo, hi] seconds."""
    if lo <= c.duration <= hi:
        return
    opts = [(abs(sum(p[1] for p in make_plan(k)) * c.bar_s - 150), k) for k in (1, 1.5, 2)
            if lo <= sum(p[1] for p in make_plan(k)) * c.bar_s <= hi]
    if opts:
        c.__init__(c.vibe, c.seed, c.bpm, c.root, c.brief, plan_k=min(opts)[1])


def bsaw(freq, n, phase=0.0):
    f = np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, dtype=np.float64)[:n]
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t1 = ph[m] / dt[m]
    y[m] -= t1 + t1 - t1 * t1 - 1
    m = ph > 1 - dt
    t2 = (ph[m] - 1) / dt[m]
    y[m] -= t2 * t2 + t2 + t2 + 1
    return y


def bpulse(freq, n, w=0.3, phase=0.0):
    return bsaw(freq, n, phase) - bsaw(freq, n, phase + w)


def env(dur, a=0.005, d=0.15, s=0.7, rel=0.06):
    n, nr = max(1, int(dur * SR)), max(1, int(rel * SR))
    t = np.arange(n) / SR
    on = np.minimum(t / a, 1.0) * (s + (1 - s) * np.exp(-np.maximum(t - a, 0) / d))
    off = on[-1] * np.linspace(1, 0, nr) ** 2
    return np.concatenate([on, off])


def wah(x, f0, f1, q=1.35, steps=5):
    """Band-pass whose centre glides f0->f1 over the first 90 ms (pedal rocked in time)."""
    n = len(x)
    fcs = np.geomspace(min(f0, f1), max(f0, f1), steps)
    ys = np.stack([bp(x, fc / q, fc * q) for fc in fcs])
    t = np.arange(n) / SR
    k = np.clip(t / 0.09, 0, 1)
    pos = (k if f1 >= f0 else 1 - k) * (steps - 1 - 1e-9)
    i0 = pos.astype(int)
    w = pos - i0
    idx = np.arange(n)
    return ys[i0, idx] * (1 - w) + ys[i0 + 1, idx] * w


def slap(note, kind, dur, rng):
    f = float(midi_hz(note))
    if kind == 'G':
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        x = lp(rng.standard_normal(n), 1100) * np.exp(-t / 0.007) * 0.5 + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018) * 0.5
        x[-200:] *= np.linspace(1, 0, 200)
        return x * 0.7
    pop = kind in ('O', '7')
    e = env(dur, 0.001, 0.09 if pop else 0.14, 0.45, 0.035)
    n = len(e)
    t = np.arange(n) / SR
    ks = pluck(f, n / SR + 0.001, rng, 0.994, 0.95 if pop else 0.55)[:n]
    x = ks + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3) * 0.7
    if pop:
        x += 0.6 * hp(ks, 900) + hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.0025) * 0.5
    else:
        x += bp(rng.standard_normal(n), 700, 3000) * np.exp(-t / 0.003) * 0.45
    return softclip(x * 1.3, 1.5) * e * 0.6


def guitar_hit(notes, kind, dur, f0, f1, rng):
    """Single-coil-ish chord hit: '.' muted scratch, 'x' short open chop. Then wah."""
    muted = kind == '.'
    rel = 0.02 if muted else 0.04
    e = env(dur, 0.001, 0.012 if muted else 0.07, 0.0 if muted else 0.25, rel)
    n = len(e)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for j, m in enumerate(notes):
        off = int(j * 0.0035 * SR)      # strum spread
        s = pluck(float(midi_hz(m)), (n - off) / SR + 0.001, rng, 0.992 if not muted else 0.95, 0.8)[:n - off]
        x[off:] += s
    x /= len(notes)
    if muted:
        x = 0.6 * x + bp(rng.standard_normal(n), 1200, 4500) * np.exp(-t / 0.006) * 0.5
    y = 0.3 * x + wah(x, f0, f1) * 1.4
    return hp(y, 180) * e * 0.8


def clav_note(m, dur, rng):
    f = float(midi_hz(m))
    e = env(dur, 0.0015, 0.1, 0.3, 0.03)
    n = len(e)
    t = np.arange(n) / SR
    x = bpulse(f, n, 0.22, rng.random()) + 0.4 * bsaw(f * 2.001, n)
    x = lp_sweep(x, 900 + 5000 * np.exp(-t / 0.05), 5)
    x += hp(x, 1500) * 0.6
    return x * e * 0.35


def brass(notes, dur, rng, bright=1.0):
    e = env(dur, 0.018, 0.12, 0.7, 0.07)
    n = len(e)
    t = np.arange(n) / SR
    scoop = 2 ** (-0.035 * np.exp(-t / 0.035) / 1.0)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.8 * t) * np.clip((t - 0.2) / 0.2, 0, 1)
    x = np.zeros(n)
    for j, m in enumerate(notes):
        f = float(midi_hz(m)) * scoop * vib
        x += bsaw(f * 1.002, n, rng.random()) + bsaw(f * 0.998, n, rng.random()) * 0.8
    x /= len(notes)
    fc = 700 + 3800 * bright * (1 - np.exp(-t / 0.025)) * (0.65 + 0.35 * np.exp(-t / 0.15))
    x = lp_sweep(x, fc, 6)
    x += hp(rng.standard_normal(n), 3000) * 0.02
    return softclip(x * e * 1.6, 1.3) * 0.45


def tamb(rng):
    n = int(0.15 * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 6500) * np.exp(-t / 0.04) * np.minimum(1, t / 0.003)
    x += sum(np.sin(2 * np.pi * f * t) for f in (5100, 7400, 9300)) * np.exp(-t / 0.03) * 0.06
    return x * 0.4


# ----------------------------------------------------------------------------- composition
def compose(c):
    fit_length(c)
    rng, root = c.rng, c.root
    mode = 'dorian' if rng.random() < 0.6 else 'mixolydian'
    if c.brief.get('scale') in MODES:
        mode = c.brief['scale']
    H = MODES[mode]
    pv = H['verse'][int(rng.integers(len(H['verse'])))]
    pc = H['chorus'][int(rng.integers(len(H['chorus'])))]
    pb = H['bridge'][int(rng.integers(len(H['bridge'])))]
    sw = float(rng.uniform(0.04, 0.16))
    kv = KICKS[int(rng.integers(len(KICKS)))]
    kc = KICKS[int(rng.integers(len(KICKS)))]
    gh = GHOSTS[int(rng.integers(len(GHOSTS)))]
    sv = SLAPS[int(rng.integers(len(SLAPS)))]
    sc = SLAPS[int(rng.integers(len(SLAPS)))]
    gv = SCRATCH[int(rng.integers(len(SCRATCH)))]
    gc = SCRATCH[int(rng.integers(len(SCRATCH)))]
    stab = STABS[int(rng.integers(len(STABS)))]
    opens_c = [[14], [6, 14], [10]][int(rng.integers(3))]
    S = c.step

    m = c.mix
    G = dict(drums=0.85, tamb=1.3, bass=1.0, gtr=4.3, clav=1.3, horns=1.15)
    m.stem('drums', G['drums'], 0.07); m.stem('tamb', G['tamb'], 0.1); m.stem('bass', G['bass'], 0.0, fx=lambda y: lp(y, 7000, 2))
    m.stem('gtr', G['gtr'], 0.08, fx=lambda y: lp(y, 6500, 2)); m.stem('clav', G['clav'], 0.08); m.stem('horns', G['horns'], 0.2)

    def tt(b, s):
        return c.t(b) + c.swing(s, sw)

    def prog_for(sec):
        if sec.name == 'bridge':
            return pb
        return pc if sec.name in ('chorus', 'outro') else pv

    def chord_at(b):
        sec = c.section_at(b)
        p = prog_for(sec)
        off, kind = p[(b - sec.bar) % 4]
        return root + off, kind

    def gvoice(r, kind, lo=62):
        ints = CHORDS[kind]
        ints = ints[1:] if len(ints) >= 4 else ints
        ns = sorted(lo + (r + i - lo) % 12 for i in ints)
        return ns[-3:] if len(ns) > 3 else ns

    def hvoice(r, kind, lo=64):
        ints = CHORDS[kind]
        pick = [ints[1], ints[3] if len(ints) > 3 else ints[2], ints[4] if len(ints) > 4 else ints[2] + 12 - 12 * (len(ints) > 3)]
        ns = sorted(lo + (r + i - lo) % 12 for i in pick)
        return ns + [ns[0] + 12]

    nxt_name = {}
    for i, sec in enumerate(c.sections):
        nxt_name[sec.bar] = c.sections[i + 1].name if i + 1 < len(c.sections) else None
    last_chorus = [s for s in c.sections if s.name == 'chorus'][-1].bar

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    K = kick(rng, 115, 50, 0.32, 0.35, 1.8)
    SN = [snare(rng, 215 + 7 * i, 0.18, 0.8, 1.2) for i in range(3)]
    GS = snare(rng, 230, 0.12, 0.7, 0.8)
    HC = [hat(rng, 0.035, tone=7600) for _ in range(4)]
    HO = hat(rng, open_=True, tone=7600)
    CR = crash(rng, 1.8)
    TM = [tom(rng, f, 0.3) for f in (200, 150, 110)]
    RM = rim(rng)
    TB = [tamb(rng) for _ in range(3)]

    def hit(x, t, g, code, v, pan=0.0, stem='drums'):
        m.add(stem, x, t, g, pan)
        c.ev('drums', t, code, round(float(v), 2))

    for sec in c.sections:
        nxt = nxt_name[sec.bar]
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            kicks, snares, ghosts, hats, opens, rims, tams = [], [4, 12], list(gh), list(range(16)), [], [], []
            if sec.name == 'intro':
                kicks = list(kv)
            elif sec.name == 'verse':
                kicks = list(kv)
                if i % 4 == 3: opens = [14]
            elif sec.name == 'chorus':
                kicks = list(kc)
                opens = list(opens_c)
                tams = [s for s in range(16) if s % 2 == 0] if sec.bar == last_chorus or i >= sec.bars // 2 else [4, 12]
            elif sec.name == 'bridge':
                if i < 4:
                    kicks = [0, 10]; snares = []; ghosts = []; rims = [4, 12]; hats = list(range(0, 16, 2))
                else:
                    kicks = list(kc); opens = [14]
            elif sec.name == 'outro':
                kicks = list(kc); opens = list(opens_c)
                if last:
                    kicks, snares, ghosts, hats, opens = [0], [], [], [], []
            fill = None
            if last and sec.name != 'outro':
                fill = 'toms' if (nxt in ('chorus', 'bridge') and rng.random() < 0.6) else 'snare'
            for s in range(16):
                t = tt(b, s)
                if fill and s >= 12:
                    if fill == 'snare':
                        v = 0.5 + 0.12 * (s - 12)
                        hit(SN[s % 3], t, v * 0.9, 's', v)
                    else:
                        j = min(2, (s - 12) * 3 // 4)
                        hit(TM[j], t, 0.8, 't%d' % (j + 1), 0.85, [-0.3, 0.05, 0.35][j])
                    if s == 12 or s == 15:
                        hit(K, t, 0.8, 'k', 0.8)
                    continue
                if s in kicks:
                    hit(K, t, 1.0 if s == 0 else 0.85, 'k', 1.0 if s == 0 else 0.85)
                if s in snares:
                    hit(SN[int(rng.integers(3))], t, 0.95, 's', 0.95)
                elif s in ghosts and rng.random() < 0.85:
                    v = 0.16 + 0.1 * rng.random()
                    hit(GS, t, v, 's', v)
                if s in rims:
                    hit(RM, t, 0.7, 'p', 0.6, 0.1)
                if s in opens:
                    hit(HO, t, 0.55, 'o', 0.65, 0.3)
                elif s in hats:
                    v = (0.6 if s % 4 == 0 else 0.45 if s % 2 == 0 else 0.22) + 0.08 * rng.random()
                    hit(HC[int(rng.integers(4))], t, v * 1.6, 'h', v, 0.3)
                if s in tams:
                    v = 0.6 if s % 4 == 0 else 0.45
                    hit(TB[int(rng.integers(3))], t, v, 'p', v * 0.8, -0.45, 'tamb')
            if i == 0 and sec.name in ('chorus', 'outro') or (sec.name == 'bridge' and i == 4) or (sec.name == 'outro' and last):
                hit(CR, c.t(b), 0.6, 'c', 1.0, -0.3)

    # ------------------------------------------------------------ slap bass
    c.progress(0.25, 'bass')
    bcache = {}

    def bass(note, kind, t, dur, v):
        key = (int(note), kind, round(dur, 3))
        if key not in bcache:
            bcache[key] = slap(note, kind, dur, rng)
        g = v * (1.15 if kind in ('O', '7') else 0.8 if kind == 'G' else 1.0)
        m.add('bass', bcache[key], t, g)
        c.ev('bass', t, int(note), round(dur if kind != 'G' else 0.06, 3), round(v, 2))

    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            if sec.name == 'intro' and i < 2:
                continue
            r0, kind = chord_at(b)
            r = 28 + (r0 - 28) % 12
            nr0, _ = chord_at(b + 1) if b + 1 < c.total_bars else (r0, kind)
            nr = 28 + (nr0 - 28) % 12
            pat = sc if sec.name in ('chorus', 'outro') else sv
            if sec.name == 'bridge' and i < 4:
                pat = [n for n in sv if n[1] in ('T', 'G', 'A') or n[0] in (6, 7)]
            if sec.name == 'outro' and last:
                pat = [(0, 'T', 12)]
            third = 3 if kind.startswith('min') else 4
            for s, k, ln in pat:
                if last and sec.name != 'outro' and s >= 12:
                    continue
                note = {'T': r, 'O': r + 12, '7': r + 10, '5': r + 7, 'G': r, 'A': nr - 1 if nr != r else r + third + 12 - 12}[k]
                if k == 'A':
                    note = nr - 1 if rng.random() < 0.7 else nr + 1
                    k = 'T'
                dur = ln * S * 0.85
                v = 0.95 if s == 0 else 0.8 if k != 'G' else 0.3
                bass(note, k, tt(b, s), dur, v)

    # ------------------------------------------------------------ rhythm guitar (chicken scratch + wah)
    c.progress(0.4, 'guitar')
    gcache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            if sec.name == 'intro' and i < 2:
                continue
            if sec.name == 'outro' and last:
                continue
            r0, kind = chord_at(b)
            notes = gvoice(r0, kind)
            pat = gc if sec.name in ('chorus', 'outro') else gv
            if sec.name == 'bridge' and i < 4:
                pat = ''.join(ch if ch == 'x' else '-' for ch in pat)
            for s, ch in enumerate(pat):
                if ch == '-' or (last and s >= 12 and sec.name != 'outro'):
                    continue
                rising = s % 4 < 2
                f0, f1 = (550, 1900) if rising else (1900, 650)
                dur = (S * 0.6) if ch == '.' else S * 1.4
                key = (tuple(notes), ch, rising)
                if key not in gcache:
                    gcache[key] = guitar_hit(notes, ch, dur, f0, f1, rng)
                v = 0.9 if ch == 'x' else 0.45
                m.add('gtr', gcache[key], tt(b, s), v, -0.45)
                c.ev('guitar', tt(b, s), int(r0), round(dur, 3), v, 1 if s % 2 == 0 else -1, 1 if ch == '.' else 0)

    # ------------------------------------------------------------ clavinet riff
    c.progress(0.55, 'clav')
    cpos = sorted(rng.choice([0, 2, 3, 5, 6, 7, 8, 10, 11, 13, 14], size=6, replace=False).tolist())
    civ = [int(rng.choice([0, 0, 10, 7, 12, 3 if mode == 'dorian' else 4, 5])) for _ in cpos]
    ccache = {}
    for sec in c.sections:
        if sec.name not in ('verse', 'bridge', 'outro', 'chorus'):
            continue
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            if last or (sec.name == 'chorus' and sec.bar != last_chorus and i % 2 == 0):
                continue
            r0, kind = chord_at(b)
            rr = 48 + (r0 - 48) % 12
            for s, iv in zip(cpos, civ):
                if iv in (3, 4):
                    iv = 3 if kind.startswith('min') else 4
                note = rr + iv
                dur = S * 0.8
                if note not in ccache:
                    ccache[note] = clav_note(note, dur, rng)
                m.add('clav', ccache[note], tt(b, s), 0.85 if s % 4 == 0 else 0.7, 0.45)

    # ------------------------------------------------------------ horns
    c.progress(0.7, 'horns')
    hcache = {}

    def horn_hit(notes, t, dur, v, ev=True):
        key = (tuple(notes), round(dur, 3))
        if key not in hcache:
            hcache[key] = brass(notes, dur, rng)
        m.add('horns', hcache[key], t, v, 0.15)
        if ev:
            c.ev('lead', t, int(notes[-1]), round(dur, 3), round(v, 2))

    pent = 'minor_pent'
    # 2-bar horn riff for last chorus / bridge build / outro
    riff_r = [(0, 2), (2, 1), (3, 3), (8, 2), (10, 2), (12, 4), (16, 2), (18, 2), (20, 2), (22, 2), (24, 6)]
    if rng.random() < 0.5:
        riff_r = [(0, 3), (3, 3), (6, 2), (10, 2), (12, 2), (14, 2), (16, 4), (22, 2), (24, 2), (26, 6)]
    d = int(rng.integers(4, 8))
    riff = []
    for s, ln in riff_r:
        d = int(np.clip(d + rng.choice([-2, -1, -1, 1, 1, 2]), 2, 9))
        riff.append((s, ln, d))
    riff[-1] = (riff[-1][0], riff[-1][1], 5)          # land on the tonic
    hbase = 52 + (root - 52) % 12
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            r0, kind = chord_at(b)
            hv = hvoice(r0, kind)
            if sec.name == 'chorus' and not (sec.bar == last_chorus and i % 4 >= 2):
                if i % 2 == 0:
                    for s, ln in stab:
                        bb = b + s // 16
                        if bb >= sec.bar + sec.bars:
                            continue
                        r1, k1 = chord_at(bb)
                        horn_hit(hvoice(r1, k1), tt(bb, s % 16), ln * S * 0.8, 0.85)
            elif sec.name == 'verse' and i % 4 == 3 and not last:
                for s, ln in ((10, 1), (12, 2), (14, 1)):
                    horn_hit(hv, tt(b, s), ln * S * 0.8, 0.6)
            elif (sec.name == 'bridge' and i >= 4) or (sec.name == 'chorus') or (sec.name == 'outro' and not last):
                if (i % 2) == 0 and not (last and sec.name != 'outro'):
                    for s, ln, dd in riff:
                        bb = b + s // 16
                        if bb >= sec.bar + sec.bars:
                            continue
                        note = scale_note(hbase, pent, dd)
                        horn_hit([note, note + 12], tt(bb, s % 16), ln * S * 0.9, 0.8)
            if sec.name == 'intro' and last:
                horn_hit(hvoice(*chord_at(b + 1)), tt(b, 14), 2 * S * 0.8, 0.8)
            if sec.name == 'outro' and last:
                horn_hit(hv, c.t(b), c.bar_s * 0.9, 0.9)
                gn = gvoice(r0, kind)
                x = guitar_hit(gn, 'x', c.bar_s * 0.8, 600, 1800, rng)
                m.add('gtr', x, c.t(b), 0.9, -0.45)
                c.ev('guitar', c.t(b), int(r0), round(c.bar_s * 0.8, 3), 1.0, 1, 0)

    c.progress(0.88, 'mixing')
