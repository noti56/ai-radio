"""Lo-fi chill hip-hop: dusty swung boom-bap drums (low-passed, saturated), jazzy min9/maj7/dom9 e-piano chords
with detune and tape wow/flutter, mellow walking sub bass, sparse pentatonic melody, vinyl crackle and rain."""
import numpy as np
from engine import *

NAME = 'Lo-Fi'
BPMS = [76, 80, 84, 88]
KEYS = [48, 50, 51, 53, 55, 46]          # C D Eb F G Bb
TITLES = (['Rainy', 'Sleepy', 'Late', 'Dusty', 'Quiet', 'Soft', 'Faded', 'Cozy', 'Blue', 'Lazy', 'Warm', 'Hazy'],
          ['Window', 'Sunday', 'Tea', 'Library', 'Tape', 'Memories', 'Notebook', 'Streetlight', 'Afternoon', 'Cassette', 'Clouds', 'Bedroom'])

# (semitones from key root, chord kind) per bar; 'maj' family uses major pentatonic, 'min' family minor pentatonic
PROGS = {
    'maj': [[(2, 'min9'), (7, 'dom9'), (0, 'maj7'), (9, 'min7')],
            [(5, 'maj7'), (4, 'min7'), (2, 'min9'), (0, 'maj7')],
            [(0, 'maj7'), (9, 'min9'), (2, 'min9'), (7, 'dom9')],
            [(9, 'min9'), (5, 'maj7'), (0, 'maj7'), (7, 'dom9')],
            [(5, 'maj7'), (7, 'dom9'), (4, 'min7'), (9, 'min9')]],
    'min': [[(0, 'min9'), (5, 'min9'), (10, 'dom9'), (3, 'maj7')],
            [(0, 'min7'), (8, 'maj7'), (5, 'min9'), (7, 'min7')],
            [(0, 'min9'), (10, 'dom9'), (8, 'maj7'), (7, 'min7')],
            [(5, 'min9'), (0, 'min9'), (8, 'maj7'), (10, 'dom9')]],
}
KICK2 = [([0, 10], [0, 7, 10]), ([0, 9], [0, 3, 10]), ([0, 7, 10], [2, 10]), ([0, 10, 11], [0, 6, 10]), ([0, 3, 10], [0, 10, 14])]
CHORD_RH = [[(0, 16)], [(0, 6), (6, 10)], [(0, 10), (10, 6)], [(0, 3), (3, 7), (10, 6)], [(0, 8), (8, 8)], [(0, 14), (14, 2)]]
BASS_RH = [[(0, 7, 'r'), (8, 5, '5'), (14, 2, 'a')], [(0, 10, 'r'), (10, 4, 'r'), (14, 2, 'a')],
           [(0, 6, 'r'), (7, 3, '3'), (10, 4, '5'), (14, 2, 'a')], [(0, 14, 'r'), (14, 2, 'a')], [(0, 6, 'r'), (6, 8, '8'), (14, 2, 'a')]]
MEL_RH = [[(0, 4), (6, 2), (8, 6), (20, 2), (22, 6)], [(2, 2), (4, 6), (12, 4), (18, 2), (20, 2), (24, 8)],
          [(0, 6), (10, 2), (12, 4), (24, 4), (28, 4)], [(4, 2), (6, 2), (8, 8), (19, 3), (22, 6)],
          [(0, 2), (2, 2), (4, 8), (16, 3), (19, 3), (22, 10)]]


# ----------------------------------------------------------------------------- local voices
def fit_length(c, lo=124.0, hi=176.0):
    """Ctx picks the plan length from a random target; make sure the song lands in [lo, hi] seconds."""
    if lo <= c.duration <= hi:
        return
    opts = [(abs(sum(p[1] for p in make_plan(k)) * c.bar_s - 150), k) for k in (1, 1.5, 2)
            if lo <= sum(p[1] for p in make_plan(k)) * c.bar_s <= hi]
    if opts:
        c.__init__(c.vibe, c.seed, c.bpm, c.root, c.brief, plan_k=min(opts)[1])


def env(dur, a=0.005, d=0.15, s=0.7, rel=0.06):
    n, nr = max(1, int(dur * SR)), max(1, int(rel * SR))
    t = np.arange(n) / SR
    on = np.minimum(t / a, 1.0) * (s + (1 - s) * np.exp(-np.maximum(t - a, 0) / d))
    off = on[-1] * np.linspace(1, 0, nr) ** 2
    return np.concatenate([on, off])


def rhodes(m, dur, rng, vel=1.0):
    """Two slightly detuned FM tines (chorus), soft bark, release tail after the gate."""
    f = float(midi_hz(m))
    d = 0.0028
    x = epiano(f * (1 + d), dur + 0.3, rng, 0.55 + 0.3 * vel) + epiano(f * (1 - d), dur + 0.3, rng, 0.5 + 0.3 * vel)
    n = len(x)
    t = np.arange(n) / SR
    x *= np.where(t > dur, np.exp(-(t - dur) / 0.09), 1.0)
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return x * 0.5


def sub_bass(m, dur, rng):
    f = float(midi_hz(m))
    e = env(dur, 0.012, 0.3, 0.75, 0.07)
    n = len(e)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    x += 0.05 * lp(rng.standard_normal(n), 300) * np.exp(-t / 0.02)          # finger thump
    return softclip(x * e * 1.1, 1.3) * 0.55


def mel_note(m, dur, rng, kind):
    f = float(midi_hz(m))
    if kind == 'kalimba':
        n = int((dur + 0.6) * SR)
        t = np.arange(n) / SR
        x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.35 * np.sin(2 * np.pi * f * 5.95 * t) * np.exp(-t / 0.05)
        x += 0.15 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.2)
        x *= np.minimum(1, t / 0.002)
        x[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
        return x * 0.45
    e = env(dur, 0.06, 0.3, 0.8, 0.18)
    n = len(e)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 4.8 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    x += bp(rng.standard_normal(n), f * 1.5, min(f * 5, 9000)) * 0.05        # breath
    return x * e * 0.4


def dusty_kick(rng):
    return lp(kick(rng, 95, 46, 0.4, 0.05, 1.3), 1800, 2) * 0.9


def dusty_snare(rng, tone):
    x = snare(rng, tone, 0.24, 0.55, 0.8) * 0.8
    r = rim(rng)
    x[:len(r)] += r * 0.25
    return lp(x, 7500, 2)


def dusty_hat(rng):
    return lp(hat(rng, 0.045, tone=6500), 9000, 1) * 0.9


def shaker(rng):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    return lp(hp(rng.standard_normal(n), 4000), 9000) * (t / 0.025) * np.exp(-t / 0.02) * 0.3


def tape(y, rng, depth_ms=2.0, rate=0.55):
    """Wow + flutter via modulated delay on a [2,N] array."""
    n = y.shape[1]
    t = np.arange(n) / SR
    ph = rng.random() * 6.28
    dl = depth_ms * 1e-3 * SR * (1 + np.sin(2 * np.pi * rate * t + ph)) + 0.03e-3 * SR * (1 + np.sin(2 * np.pi * 6.3 * t))
    idx = np.arange(n) - dl
    out = np.empty_like(y)
    for ch in range(2):
        out[ch] = np.interp(idx, np.arange(n), y[ch])
    return out


def crackle(dur, rng):
    n = int(dur * SR)
    x = np.zeros(n)
    k = int(dur * 18)
    pos = rng.integers(0, n, k)
    x[pos] = rng.standard_normal(k) * rng.exponential(1.0, k)
    k2 = int(dur * 1.2)                      # occasional bigger pops
    pos2 = rng.integers(0, n, k2)
    x[pos2] += rng.standard_normal(k2) * 2
    x = bp(x, 900, 7000, 1)
    q = 5 * x.std()
    x = np.tanh(x / q) * q
    hiss = bp(rng.standard_normal(n), 2500, 9000, 1) * 0.015
    return (x * 0.5 + hiss).astype(np.float32)


def rain(dur, rng):
    n = int(dur * SR)
    base = bp(rng.standard_normal(n), 500, 7000, 1)
    mod = np.interp(np.arange(n), np.linspace(0, n, int(dur * 3) + 2), 0.7 + 0.3 * rng.random(int(dur * 3) + 2))
    x = base * mod * 0.12
    # droplets: short falling sine blips
    dn = int(0.03 * SR)
    tt = np.arange(dn) / SR
    for _ in range(int(dur * 6)):
        i = int(rng.integers(0, n - dn))
        f = rng.uniform(1800, 4500)
        x[i:i + dn] += np.sin(2 * np.pi * f * tt * (1 - 4 * tt)) * np.exp(-tt / 0.006) * rng.uniform(0.02, 0.08)
    return x.astype(np.float32)


# ----------------------------------------------------------------------------- composition
def compose(c):
    fit_length(c)
    rng, root = c.rng, c.root
    fam = 'maj' if rng.random() < 0.6 else 'min'
    P = PROGS[fam]
    idx = rng.permutation(len(P))
    pv, pc, pb = P[idx[0]], P[idx[1]], P[idx[2 % len(P)]]
    pent = 'major_pent' if fam == 'maj' else 'minor_pent'
    sw = float(rng.uniform(0.22, 0.38))
    kp = KICK2[int(rng.integers(len(KICK2)))]
    crh_v = CHORD_RH[int(rng.integers(len(CHORD_RH)))]
    crh_c = CHORD_RH[int(rng.integers(len(CHORD_RH)))]
    brh = BASS_RH[int(rng.integers(len(BASS_RH)))]
    mel_kind = 'kalimba' if rng.random() < 0.45 else 'flute'
    S = c.step
    lay = 0.012                      # laid-back snare

    m = c.mix
    G = dict(drums=0.95, bass=0.7, keys=1.0, keyslp=1.3, lead=1.3, vinyl=3.0, rain=1.5)

    def tt(b, s):
        return c.t(b) + c.swing(s, sw)

    def prog_for(sec):
        if sec.name == 'bridge':
            return pb
        return pc if sec.name in ('chorus', 'outro') else pv

    def chord_at(b):
        sec = c.section_at(b)
        off, kind = prog_for(sec)[(b - sec.bar) % 4]
        return root + off, kind

    def voicing(r, kind, lo=55):
        ns = sorted(lo + (r + i - lo) % 12 for i in CHORDS[kind][1:])
        lh = 43 + (r - 43) % 12
        return [lh] + ns

    last_chorus = [s for s in c.sections if s.name == 'chorus'][-1].bar

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    K = dusty_kick(rng)
    SN = [dusty_snare(rng, 175 + 10 * i) for i in range(3)]
    HC = [dusty_hat(rng) for _ in range(4)]
    HO = lp(hat(rng, open_=True, tone=6500), 8000, 1) * 0.6
    SH = [shaker(rng) for _ in range(3)]
    RM = lp(rim(rng), 6000)
    kick_times = []

    def hit(x, t, g, code, v, pan=0.0):
        m.add('drums', x, t, g, pan)
        c.ev('drums', t, code, round(float(v), 2))

    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            kicks, snares, hats, opens, shk, rims = list(kp[i % 2]), [4, 12], list(range(0, 16, 2)), [], [], []
            if sec.name == 'intro':
                kicks, snares = [], []
                hats = list(range(0, 16, 4)) if i >= 2 else []
                rims = [12] if i >= 2 else []
            elif sec.name == 'verse':
                if i % 4 == 3: hats = hats + [7]
            elif sec.name == 'chorus':
                shk = [s for s in range(16) if s % 2]
                if i % 2: opens = [14]
            elif sec.name == 'bridge':
                if i < 4:
                    kicks, snares, hats, rims = [], [], ([] if i < 2 else list(range(0, 16, 4))), ([] if i < 2 else [4, 12])
                else:
                    kicks = [0, 10]; snares = []; rims = [4, 12]
            elif sec.name == 'outro':
                if i >= sec.bars - 2:
                    kicks, snares = ([0] if i == sec.bars - 2 else []), []
                    hats = list(range(0, 16, 4)) if i == sec.bars - 2 else []
            if last and sec.name in ('verse', 'chorus', 'bridge'):
                # little stop / pickup before the next section
                kicks = [k for k in kicks if k < 12]
                hats = [h for h in hats if h < 12]
                snares = [4, 12, 15] if rng.random() < 0.5 else [4]
            for s in range(16):
                t = tt(b, s)
                if s in kicks:
                    v = 0.95 if s == 0 else 0.8
                    hit(K, t, v, 'k', v); kick_times.append(t)
                if s in snares:
                    v = 0.85 if s != 15 else 0.4
                    hit(SN[int(rng.integers(3))], t + lay, v, 's', v)
                if s in rims:
                    hit(RM, t + lay, 0.55, 'p', 0.5, 0.15)
                if s in opens:
                    hit(HO, t, 1.0, 'o', 0.5, 0.25)
                elif s in hats:
                    v = (0.5 if s % 4 == 0 else 0.34) + 0.12 * rng.random()
                    hit(HC[int(rng.integers(4))], t, v * 2.4, 'h', v, 0.25)
                if s in shk:
                    v = 0.35 + 0.15 * rng.random()
                    hit(SH[int(rng.integers(3))], t, v * 4.5, 'p', v * 0.7, -0.35)

    # ------------------------------------------------------------ bass
    c.progress(0.25, 'bass')
    bcache = {}

    def bass(note, t, dur, v):
        key = (int(note), round(dur, 3))
        if key not in bcache:
            bcache[key] = sub_bass(note, dur, rng)
        m.add('bass', bcache[key], t, v)
        c.ev('bass', t, int(note), round(dur, 3), round(v, 2))

    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            last = i == sec.bars - 1
            r0, kind = chord_at(b)
            r = 33 + (r0 - 33) % 12
            nr0, _ = chord_at(b + 1) if b + 1 < c.total_bars else (r0, kind)
            nr = 33 + (nr0 - 33) % 12
            third = 3 if kind.startswith('min') else 4
            pat = brh
            if sec.name == 'intro':
                if i < 2:
                    continue
                pat = [(0, 16, 'r')]
            elif sec.name == 'bridge' and i < 4:
                pat = [(0, 16, 'r')]
            elif sec.name == 'outro':
                if i == sec.bars - 1:
                    continue
                pat = [(0, 16, 'r')] if i == sec.bars - 2 else pat
            if last and sec.name != 'outro':
                pat = [p for p in pat if p[2] != 'a']
            for s, ln, k in pat:
                if k == 'a':
                    if nr == r:
                        note = r + 7 - 12 if r + 7 - 12 >= 31 else r + 7
                    else:
                        note = nr - 1 if rng.random() < 0.6 else nr + (2 if nr + 2 - r != 0 else 1)
                else:
                    note = r + {'r': 0, '5': 7, '3': third, '8': 12}[k]
                bass(note, tt(b, s), ln * S * 0.9, 0.9 if s == 0 else 0.75)

    # ------------------------------------------------------------ e-piano chords
    c.progress(0.4, 'keys')
    kcache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            if sec.name == 'outro' and i == sec.bars - 1:
                rh = [(0, 16)]
            elif sec.name in ('chorus', 'outro'):
                rh = crh_c
            elif sec.name == 'bridge':
                rh = [(0, 16)] if i < 4 else crh_v
            else:
                rh = crh_v
            r0, kind = chord_at(b)
            notes = voicing(r0, kind)
            stem = 'keyslp' if sec.name == 'intro' or (sec.name == 'outro' and i >= sec.bars - 2) else 'keys'
            for j, (s, ln) in enumerate(rh):
                dur = ln * S * 0.97 + (0.6 if (sec.name == 'outro' and i == sec.bars - 1) else 0)
                v = 0.9 if s == 0 else 0.7
                key = (tuple(notes), round(dur, 3), v)
                if key not in kcache:
                    n = int((dur + 0.35) * SR) + int(0.1 * SR)
                    x = np.zeros(n)
                    for q, nn in enumerate(notes):
                        y = rhodes(nn, dur, rng, v) * (0.7 if q == 0 else 1.0)
                        o = int(q * 0.012 * SR) if j == 0 else int(q * 0.006 * SR)      # lazy roll
                        x[o:o + len(y)] += y[:n - o]
                    kcache[key] = x * 0.4
                t = tt(b, s)
                m.add(stem, kcache[key], t, v, -0.1)
                c.ev('guitar', t, int(r0), round(dur, 3), v, 1 if j % 2 == 0 else -1, 0)

    # ------------------------------------------------------------ melody
    c.progress(0.55, 'melody')
    mbase = 55 + (root - 55) % 12          # G3..F#4, melody sits roughly an octave above

    def phrase(rh, lo, hi):
        d = int(rng.integers(lo + 1, hi - 1))
        out = []
        for j, (s, ln) in enumerate(rh):
            up = j < len(rh) // 2                  # arch contour: rise, then fall back
            st = int(rng.choice([1, 1, 2, -1, 0, 3] if up else [-1, -1, -2, 1, 0, -3]))
            d = int(np.clip(d + (st if lo <= d + st <= hi else -st), lo, hi))
            out.append((s, ln, d))
        return out

    mel_c = phrase(MEL_RH[int(rng.integers(len(MEL_RH)))], 3, 8)
    mel_c2 = [(s, ln, d) for s, ln, d in mel_c[:-1]] + [(mel_c[-1][0], mel_c[-1][1], 5)]     # answer resolves home
    mel_v = phrase([x for x in MEL_RH[int(rng.integers(len(MEL_RH)))] if rng.random() < 0.6] or MEL_RH[0], 2, 7)
    lcache = {}
    for sec in c.sections:
        if sec.name not in ('chorus', 'verse', 'bridge', 'outro'):
            continue
        for b2 in range(sec.bar, sec.bar + sec.bars, 2):
            i = b2 - sec.bar
            rep = i // 2
            if sec.name == 'verse':
                if c.section_at(sec.bar) is sec and (rep % 2 == 0 or i >= sec.bars - 2):
                    continue
                ph = mel_v
            elif sec.name == 'bridge':
                if i < 4:
                    continue
                ph = [(s, ln, d + 2) for s, ln, d in mel_v]
            elif sec.name == 'outro':
                if i > 0:
                    continue
                ph = mel_c2
            else:
                ph = mel_c if rep % 2 == 0 else mel_c2
            for s, ln, d in ph:
                bar = b2 + s // 16
                if bar >= sec.bar + sec.bars:
                    continue
                note = scale_note(mbase, pent, d)
                dur = ln * S * 0.95
                key = (note, round(dur, 3))
                if key not in lcache:
                    lcache[key] = mel_note(note, dur, rng, mel_kind)
                t = tt(b2, s)
                v = 0.85 if sec.name == 'chorus' else 0.65
                m.add('lead', lcache[key], t, v, 0.15)
                c.ev('lead', t, int(note), round(dur, 3), v)

    # ------------------------------------------------------------ texture
    c.progress(0.7, 'texture')
    total = c.duration + 2.4
    m.add('vinyl', crackle(total, rng), 0.0, 1.0, 0.0)
    rn = rain(total, rng)
    # rain level per section: loud in intro / bridge breakdown / outro, soft under the beat
    lvl = np.ones(len(rn), dtype=np.float32) * 0.35
    for sec in c.sections:
        a, z = int(sec.bar * c.bar_s * SR), int((sec.bar + sec.bars) * c.bar_s * SR)
        if sec.name in ('intro', 'outro') or sec.name == 'bridge':
            lvl[a:z] = 1.0
    lvl[int((c.sections[-1].bar + c.sections[-1].bars) * c.bar_s * SR):] = 1.0
    k = int(0.8 * SR)
    lvl = np.convolve(lvl, np.ones(k, dtype=np.float32) / k, mode='same')
    m.add('rain', np.stack([rn * lvl, np.roll(rn, 9973) * lvl]), 0.0, 1.0)

    # ------------------------------------------------------------ stems / fx
    c.progress(0.85, 'mixing')
    kt = sorted(kick_times)
    m.stem('drums', G['drums'], 0.08, fx=lambda y: softclip(lp(y, 9500, 2) * 1.2, 1.3))
    m.stem('bass', G['bass'], 0.0, fx=lambda y: lp(y, 420, 2))
    m.stem('keys', G['keys'], 0.3, fx=lambda y: duck(tape(lp(softclip(y * 1.4, 1.2), 7000, 2), rng), kt, 0.22, 0.15))
    m.stem('keyslp', G['keyslp'], 0.35, fx=lambda y: tape(lp(y, 700, 2), rng))
    m.stem('lead', G['lead'], 0.35, fx=lambda y: tape(lp(echo(y, 3 * S, 0.3, 3, 3000), 6000, 2), rng, 2.4))
    m.stem('vinyl', G['vinyl'], 0.0)
    m.stem('rain', G['rain'], 0.0)
