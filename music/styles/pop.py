"""Pop: bright modern pop. Four-on-the-floor or half-time kick, claps/snaps on 2 & 4, plucky synth chords
over piano / e-piano, a repeating sing-along synth-bell hook, warm sub bass, glittery 16th arps, sidechain pump."""
import numpy as np
from engine import *

NAME = 'Pop'
BPMS = [100, 104, 108, 112, 116, 120, 124]
KEYS = [48, 50, 52, 53, 55, 57, 51]          # C D E F G A Eb (major tonic)
TITLES = (['Golden', 'Sunny', 'Neon', 'Sugar', 'Electric', 'Summer', 'Starry', 'Paper', 'Velvet', 'Lucky', 'Pink', 'Endless'],
          ['Heartbeat', 'Daydream', 'Lights', 'Weekend', 'Fireworks', 'Satellite', 'Kiss', 'Polaroid', 'Sunrise', 'Parade', 'Rollercoaster', 'Crush'])

PROGS = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 0, 4, 5], [0, 3, 5, 4], [0, 4, 3, 3], [3, 4, 5, 0], [0, 2, 3, 4]]
BRIDGES = [[3, 4, 5, 5], [5, 3, 4, 4], [1, 4, 0, 5], [3, 3, 4, 4], [5, 2, 3, 4]]
# 2-bar hook rhythms (16th step, length)
HOOKS = [
    [(0, 2), (2, 2), (4, 2), (6, 4), (12, 2), (14, 2), (16, 2), (18, 2), (20, 4), (26, 6)],
    [(0, 3), (3, 3), (6, 2), (8, 4), (14, 2), (16, 3), (19, 3), (22, 2), (24, 8)],
    [(2, 2), (4, 2), (6, 2), (8, 2), (10, 4), (18, 2), (20, 2), (22, 2), (24, 2), (26, 6)],
    [(0, 4), (4, 2), (6, 2), (8, 6), (14, 2), (16, 4), (20, 2), (22, 2), (24, 8)],
    [(0, 2), (2, 1), (3, 3), (6, 2), (8, 2), (10, 6), (16, 2), (18, 1), (19, 3), (22, 2), (24, 8)],
    [(0, 2), (2, 2), (4, 4), (10, 2), (12, 2), (14, 2), (16, 4), (20, 4), (24, 4), (28, 4)],
]
PLUCK_PATS = [[0, 3, 6, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 9, 12], [0, 6, 8, 14], [0, 3, 6, 10, 13]]
VERSE_KICK = [[0, 10], [0, 7, 10], [0, 6, 10], [0, 10, 13], [0, 3, 10]]
VERSE_BASS = [[(0, 6), (6, 4), (10, 6)], [(0, 10), (10, 6)], [(0, 3), (3, 3), (6, 4), (10, 6)], [(0, 6), (6, 2), (8, 2), (10, 4), (14, 2)]]
CHORUS_BASS = [[(0, 2, 0), (2, 2, 0), (4, 2, 0), (6, 2, 12), (8, 2, 0), (10, 2, 0), (12, 2, 0), (14, 2, 12)],
               [(0, 3, 0), (3, 3, 0), (6, 2, 12), (8, 3, 0), (11, 3, 0), (14, 2, 12)],
               [(0, 2, 0), (2, 2, 0), (6, 2, 0), (8, 2, 0), (10, 2, 0), (14, 2, 12)],
               [(0, 4, 0), (4, 2, 0), (6, 2, 0), (8, 4, 0), (12, 2, 12), (14, 2, 0)]]


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
    """Band-limited (polyBLEP) saw. freq scalar or per-sample array, n samples."""
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


def env(dur, a=0.005, d=0.15, s=0.7, rel=0.08):
    """Gate of `dur` seconds then a release tail (total dur+rel). Never clicks."""
    n, nr = max(1, int(dur * SR)), max(1, int(rel * SR))
    t = np.arange(n) / SR
    on = np.minimum(t / a, 1.0) * (s + (1 - s) * np.exp(-np.maximum(t - a, 0) / d))
    off = on[-1] * np.linspace(1, 0, nr) ** 2
    return np.concatenate([on, off])


def pluck_chord(notes, dur, rng, bright=1.0):
    rel = 0.06
    e = env(dur, 0.002, 0.16, 0.12, rel)
    n = len(e)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        f = float(midi_hz(m))
        x += bsaw(f * 1.0035, n, rng.random()) + bsaw(f * 0.9965, n, rng.random())
        x += 0.5 * np.sin(2 * np.pi * f * t)
    fc = 600 + 5200 * bright * np.exp(-t / 0.07)
    x = lp_sweep(x, fc, 6)
    return x * e * (0.5 / len(notes))


def piano_note(m, dur, rng):
    f = float(midi_hz(m))
    n = int((dur + 0.35) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    tau0 = 1.4 * (220.0 / f) ** 0.35
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 12000:
            break
        x += np.sin(2 * np.pi * fk * t + rng.random() * 6.28) * (1.0 / k ** 1.25) * np.exp(-t / (tau0 / k ** 0.6))
    x += bp(rng.standard_normal(n), 1200, 5000) * np.exp(-t / 0.004) * 0.08
    damp = np.where(t > dur, np.exp(-(t - dur) / 0.07), 1.0)
    x *= damp * np.minimum(1, t / 0.002)
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return x * 0.35


def bass_note(m, dur, rng):
    f = float(midi_hz(m))
    e = env(dur, 0.004, 0.18, 0.75, 0.05)
    n = len(e)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * lp(bsaw(f, n, 0.0), 700, 2) + 0.15 * np.sin(4 * np.pi * f * t)
    return softclip(x * e * 1.2, 1.4) * 0.6


def lead_note(m, dur, rng, bright=1.0):
    f = float(midi_hz(m))
    e = env(dur, 0.008, 0.2, 0.7, 0.12)
    n = len(e)
    t = np.arange(n) / SR
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    body = bsaw(f * vib, n, rng.random()) + 0.6 * bsaw(f * vib * 1.005, n, rng.random())
    body = lp(body, 1800 + 1800 * bright, 2)
    idx = 2.2 * np.exp(-t / 0.18)
    bell = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.7)
    return (0.45 * body * e + 0.55 * bell * e) * 0.5


def arp_note(m, rng):
    f = float(midi_hz(m))
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05) + 0.12 * np.sin(6 * np.pi * f * t + 1)
    e = np.exp(-t / 0.09) * np.minimum(1, t / 0.0015)
    e[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return x * e * 0.4


def snap(rng):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1800, 6000) * np.exp(-t / 0.014) + np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.005) * 0.4
    return x * 0.9


def shaker(rng):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 5000) * (t / 0.02) * np.exp(-t / 0.018)
    return x * 0.35


def riser(dur, rng):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp_sweep(hp(rng.standard_normal(n), 200), np.geomspace(300, 9000, n), 7)
    e = (t / dur) ** 2
    e[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return x * e * 0.4


# ----------------------------------------------------------------------------- composition
def compose(c):
    fit_length(c)
    rng, root = c.rng, c.root
    scale = 'major'
    pv = PROGS[int(rng.integers(len(PROGS)))]
    pc = PROGS[int(rng.integers(len(PROGS)))]
    pb = BRIDGES[int(rng.integers(len(BRIDGES)))]
    if c.brief.get('progression'):
        pv = pc = c.brief['progression']
    add9 = rng.random() < 0.5
    use_epiano = rng.random() < 0.5
    pluck_pat = PLUCK_PATS[int(rng.integers(len(PLUCK_PATS)))]
    vkick = VERSE_KICK[int(rng.integers(len(VERSE_KICK)))]
    vbass = VERSE_BASS[int(rng.integers(len(VERSE_BASS)))]
    cbass = CHORUS_BASS[int(rng.integers(len(CHORUS_BASS)))]
    arp_mode = int(rng.integers(3))
    half_time_chorus = rng.random() < 0.25
    S = c.step

    m = c.mix
    G = dict(drums=0.88, clap=1.05, bass=0.68, keys=0.9, pluck=1.8, lead=1.15, arp=0.85, fx=0.5)
    m.stem('drums', G['drums'], 0.06); m.stem('clap', G['clap'], 0.22); m.stem('bass', G['bass'], 0.0)
    m.stem('keys', G['keys'], 0.25); m.stem('pluck', G['pluck'], 0.18); m.stem('lead', G['lead'], 0.25)
    m.stem('arp', G['arp'], 0.35); m.stem('fx', G['fx'], 0.3)

    def prog_for(sec):
        if sec.name == 'bridge':
            return pb
        return pc if sec.name in ('chorus', 'outro') else pv

    def chord_deg(sec, b):
        p = prog_for(sec)
        return p[(b - sec.bar) % 4]

    def voicing(deg):
        tri = diatonic_chord(root, scale, deg, 3)
        if add9 and deg in (0, 3):
            tri = tri + [scale_note(root, scale, deg + 1)]
        lo = 55
        return sorted(lo + (n - lo) % 12 for n in tri)

    def bass_root(deg):
        r = scale_note(root, scale, deg)
        return 31 + (r - 31) % 12

    nxt_name = {}
    for i, sec in enumerate(c.sections):
        nxt_name[sec.bar] = c.sections[i + 1].name if i + 1 < len(c.sections) else None
    verse_idx = {}
    vi = 0
    for sec in c.sections:
        if sec.name == 'verse':
            verse_idx[sec.bar] = vi; vi += 1
    chorus_bars = [s for s in c.sections if s.name == 'chorus']
    last_chorus = chorus_bars[-1].bar

    # ------------------------------------------------------------ drums
    c.progress(0.05, 'drums')
    K = kick(rng, 150, 47, 0.38, 0.35, 2.0)
    KS = kick(rng, 120, 45, 0.3, 0.2, 1.6)
    SN = [snare(rng, 200 + 8 * i, 0.22, 0.9) for i in range(3)]
    CL = [clap(rng) for _ in range(3)]
    SP = [snap(rng) for _ in range(2)]
    HC = [hat(rng, 0.04, tone=8000) for _ in range(3)]
    HO = hat(rng, open_=True, tone=8000)
    SH = [shaker(rng) for _ in range(3)]
    CR = crash(rng, 2.0)
    TM = [tom(rng, f, 0.35) for f in (180, 140, 105)]
    kick_times = []

    def hit(stem, x, t, g, code, v, pan=0.0):
        m.add(stem, x, t, g, pan)
        c.ev('drums', t, code, round(float(v), 2))

    for sec in c.sections:
        nxt = nxt_name[sec.bar]
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            t0 = c.t(b)
            last = i == sec.bars - 1
            kicks, claps, snaps, snares, hats, opens, shk = [], [], [], [], [], [], []
            if sec.name == 'intro':
                if i >= 1: hats = list(range(2, 16, 4))
                if i >= 2: snaps = [4, 12]
            elif sec.name == 'verse':
                kicks = list(vkick)
                if verse_idx[sec.bar] == 0 and i < sec.bars // 2:
                    snaps = [4, 12]
                else:
                    claps = [4, 12]
                hats = list(range(0, 16, 2))
                if verse_idx[sec.bar] > 0 or i >= sec.bars // 2:
                    shk = [s for s in range(16) if s % 2]
            elif sec.name == 'chorus':
                if half_time_chorus and sec.bar != last_chorus:
                    kicks = [0, 3, 10]; claps = [8]; snares = [8]
                    hats = list(range(0, 16, 2)); opens = [6, 14]
                else:
                    kicks = [0, 4, 8, 12]; claps = [4, 12]; snares = [4, 12]
                    hats = [s for s in range(16) if s % 2]; opens = [2, 6, 10, 14]
                if i % 4 == 3 and rng.random() < 0.5:
                    kicks = kicks + [14]
            elif sec.name == 'bridge':
                if i < 4:
                    claps = [12] if i % 2 else []
                    hats = [] if i < 2 else list(range(0, 16, 4))
                else:
                    kicks = [0, 4, 8, 12]; claps = [4, 12]; hats = list(range(2, 16, 4))
                    if i >= 6: shk = list(range(16))
            elif sec.name == 'outro':
                if i < sec.bars - 1:
                    kicks = [0, 8]; claps = [4, 12]; hats = list(range(0, 16, 2))
                else:
                    kicks = [0]
            fill = None
            if last and nxt in ('chorus',) and sec.name != 'intro':
                fill = 'roll'
            elif last and nxt in ('verse', 'bridge', 'outro') and sec.name != 'intro':
                fill = 'tom' if rng.random() < 0.6 else 'roll'
            elif last and sec.name == 'intro':
                fill = 'roll'
            if fill:
                kicks = [k for k in kicks if k < 8]
                claps = [k for k in claps if k < 8]; snares = [k for k in snares if k < 8]
                snaps = [k for k in snaps if k < 8]
                hats = [k for k in hats if k < 8]; opens = [k for k in opens if k < 8]; shk = []
            for s in range(16):
                t = t0 + s * S
                if s in kicks:
                    kx = K if sec.name in ('chorus', 'bridge', 'outro') else KS
                    hit('drums', kx, t, 1.0, 'k', 1.0); kick_times.append(t)
                if s in snares:
                    hit('drums', SN[int(rng.integers(3))], t, 0.55, 's', 0.8)
                if s in claps:
                    v = 0.85 + rng.random() * 0.1
                    hit('clap', CL[int(rng.integers(3))], t, v, 'cl', v)
                if s in snaps:
                    hit('clap', SP[int(rng.integers(2))], t, 0.7, 'p', 0.7, 0.2)
                if s in opens:
                    hit('drums', HO, t, 0.8, 'o', 0.6, 0.3)
                elif s in hats:
                    v = 0.32 + 0.18 * (s % 4 == 0) + 0.08 * rng.random()
                    hit('drums', HC[int(rng.integers(3))], t, v * 2.6, 'h', v, 0.3)
                if s in shk:
                    v = 0.5 + 0.4 * (s % 4 == 2) + 0.1 * rng.random()
                    m.add('drums', SH[int(rng.integers(3))], t, v * 2.0, -0.35)
                    c.ev('drums', t, 'p', round(v * 0.6, 2))
                if fill and s >= 8:
                    if fill == 'roll':
                        if s >= 12 or s % 2 == 0:
                            v = 0.35 + 0.65 * (s - 8) / 7
                            hit('drums', SN[s % 3], t, v * 0.8, 's', v)
                    else:
                        if s in (8, 10, 12, 13, 14, 15):
                            j = {8: 0, 10: 0, 12: 1, 13: 1, 14: 2, 15: 2}[s]
                            hit('drums', TM[j], t, 0.75, 't%d' % (j + 1), 0.85, [-0.3, 0.0, 0.3][j])
                        if s == 8:
                            hit('drums', K, t, 0.8, 'k', 0.8); kick_times.append(t)
            if (i == 0 and sec.name in ('chorus', 'outro')) or (sec.name == 'chorus' and i % 8 == 0 and i) \
                    or (sec.name == 'bridge' and i == 4) or (sec.name == 'verse' and i == 0 and verse_idx[sec.bar] > 0):
                hit('drums', CR, t0, 0.6, 'c', 1.0, -0.3)
            if last and nxt in ('chorus',) or (sec.name == 'bridge' and i == 3):
                m.add('fx', riser(c.bar_s, rng), t0, 0.9 if sec.name != 'intro' else 0.6)

    # ------------------------------------------------------------ bass
    c.progress(0.25, 'bass')
    bcache = {}

    def play_bass(note, t, dur, v):
        key = (int(note), round(dur, 3))
        if key not in bcache:
            bcache[key] = bass_note(note, dur, rng)
        m.add('bass', bcache[key], t, v)
        c.ev('bass', t, int(note), round(dur, 3), round(v, 2))

    scale_pcs = set((root + x) % 12 for x in SCALES['major'])
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            deg = chord_deg(sec, b)
            r = bass_root(deg)
            nb_sec = c.section_at(b + 1)
            nr = bass_root(chord_deg(nb_sec, b + 1)) if b + 1 < c.total_bars else r
            last = i == sec.bars - 1
            notes = []
            if sec.name == 'intro':
                if i >= 2:
                    notes = [(0, 16 if not last else 8, 0)]
            elif sec.name == 'verse':
                notes = [(s, ln, 0) for s, ln in vbass]
            elif sec.name == 'chorus':
                notes = list(cbass)
            elif sec.name == 'bridge':
                notes = [(0, 16, 0)] if i < 4 else [(s, 2, 12 if s in (6, 14) else 0) for s in range(0, 16, 2)]
            elif sec.name == 'outro':
                notes = [(0, 8, 0), (8, 8, 0)] if not last else [(0, 16, 0)]
            if last and sec.name not in ('outro',) and notes:
                notes = [n for n in notes if n[0] < 8]
            # approach note into the next chord
            if notes and sec.name in ('verse', 'chorus') and i % 4 == 3 and nr != r and not last:
                ap = nr - 1 if (nr - 1) % 12 in scale_pcs else nr - 2
                if ap < 29: ap += 12
                notes = [n for n in notes if n[0] < 14] + [(14, 2, ap - r)]
            for s, ln, off in notes:
                dur = ln * S * 0.92
                play_bass(r + off, c.t(b) + s * S, dur, 0.9 if s % 4 == 0 else 0.75)

    # ------------------------------------------------------------ keys + plucks
    c.progress(0.45, 'chords')
    kcache, pcache = {}, {}

    def keys_chord(notes, t, dur, g, pan=0.0):
        key = (tuple(notes), round(dur, 3))
        if key not in kcache:
            if use_epiano:
                kcache[key] = sum(epiano(float(midi_hz(n)) * (1 + 0.0007 * (j - 1)), dur + 0.25, rng, 0.8) for j, n in enumerate(notes)) * 0.3
            else:
                kcache[key] = sum(piano_note(n, dur, rng) for n in notes) * 0.8
        m.add('keys', kcache[key], t, g, pan)

    def pluck_hit(notes, t, dur, g, bright=1.0):
        key = (tuple(notes), round(dur, 3), bright)
        if key not in pcache:
            pcache[key] = pluck_chord([n + 12 for n in notes], dur, rng, bright)
        m.add('pluck', pcache[key], t, g, 0.0)

    for sec in c.sections:
        vidx = verse_idx.get(sec.bar, 0)
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            notes = voicing(chord_deg(sec, b))
            t0 = c.t(b)
            last = i == sec.bars - 1
            dirn = 1
            plucks, keyhits = [], []
            if sec.name == 'intro':
                keyhits = [(0, 6), (6, 4), (10, 6)] if i % 2 == 0 else [(0, 16)]
            elif sec.name == 'verse':
                keyhits = [(0, 6), (6, 4), (10, 6)] if (i % 2 == 0) else [(0, 10), (10, 6)]
                if vidx > 0 or i >= sec.bars // 2:
                    plucks = [s for s in pluck_pat if s % 4 != 0 or s == 0][:4]
            elif sec.name == 'chorus':
                keyhits = [(0, 16)]
                plucks = list(pluck_pat)
            elif sec.name == 'bridge':
                keyhits = [(0, 16)]
                if i >= 4:
                    plucks = [0, 4, 8, 12] if i < 6 else list(range(0, 16, 2))
            elif sec.name == 'outro':
                keyhits = [(0, 16)]
                plucks = list(pluck_pat) if not last else [0]
            if last and sec.name != 'outro':
                plucks = [s for s in plucks if s < 8]
            for s, ln in keyhits:
                dur = ln * S * 0.95
                keys_chord(notes, t0 + s * S, dur, 0.9 if s == 0 else 0.75, -0.15)
                if not plucks:
                    c.ev('guitar', t0 + s * S, int(notes[0]), round(dur, 3), 0.8, dirn, 0)
                    dirn = -dirn
            for j, s in enumerate(plucks):
                nxt_s = plucks[j + 1] if j + 1 < len(plucks) else 16
                dur = max(1, min(nxt_s - s, 4)) * S * 0.9
                bright = 0.6 if sec.name == 'verse' else 1.0
                g = 0.85 if s % 4 == 0 else 0.7
                pluck_hit(notes, t0 + s * S, dur, g, bright)
                c.ev('guitar', t0 + s * S, int(notes[0]), round(dur, 3), round(g, 2), dirn, 1 if dur < 2.5 * S else 0)
                dirn = -dirn

    # ------------------------------------------------------------ arps
    c.progress(0.6, 'arps')
    acache = {}
    for sec in c.sections:
        if sec.name not in ('intro', 'chorus', 'bridge', 'outro'):
            continue
        for b in range(sec.bar, sec.bar + sec.bars):
            i = b - sec.bar
            if sec.name == 'outro' and i == sec.bars - 1:
                continue
            if sec.name == 'chorus' and sec.bar != last_chorus and i < sec.bars // 2 and sec.bars > 4:
                continue
            notes = voicing(chord_deg(sec, b))
            tones = [n + 12 for n in notes[:3]] + [n + 24 for n in notes[:3]]
            if arp_mode == 1:
                seq = tones + tones[-2:0:-1]
            elif arp_mode == 2:
                seq = [tones[k] for k in (0, 2, 4, 1, 3, 5, 4, 2)]
            else:
                seq = tones
            stride = 2 if sec.name == 'intro' else 1
            for s in range(0, 16, stride):
                nn = seq[(s // stride) % len(seq)]
                if nn not in acache:
                    acache[nn] = arp_note(nn, rng)
                v = 0.8 if s % 4 == 0 else 0.55
                m.add('arp', acache[nn], c.t(b) + s * S, v, 0.45 if (s // stride) % 2 else -0.45)

    # ------------------------------------------------------------ hook / melody
    c.progress(0.72, 'melody')
    base = 60 + (root - 60) % 12

    def chord_set(deg):
        return {deg % 7, (deg + 2) % 7, (deg + 4) % 7}

    def snapd(d, deg):
        cs = chord_set(deg)
        best = None
        for dd in range(d - 3, d + 4):
            if dd % 7 in cs and (best is None or abs(dd - d) < abs(best - d)):
                best = dd
        return best

    def make_phrase(rhythm, prog, lo, hi, start):
        """4-bar phrase: 2-bar rhythm twice; second half reuses the interval contour (sequence)."""
        steps = [int(rng.choice([-2, -1, -1, 1, 1, 2, 3, -3, 0])) for _ in rhythm]
        out = []
        for half in range(2):
            d = start if half == 0 else snapd(out[0][2] + int(rng.choice([-2, 2, 1, -1])), prog[2])
            prev = None
            for j, (s, ln) in enumerate(rhythm):
                ss = s + 32 * half
                deg = prog[(ss // 16) % 4]
                st = steps[j] if j > 0 else 0
                if not lo <= d + st <= hi:
                    st = -st
                d = int(np.clip(d + st, lo, hi))
                if ss % 8 == 0 or ln >= 4:
                    nd = snapd(d, deg)
                    if nd == prev:               # avoid sitting on one pitch: next chord tone in contour direction
                        nd = snapd(d + (2 if st >= 0 else -2), deg)
                    if not lo - 1 <= nd <= hi + 1:
                        nd = snapd(d - 2 if nd > hi else d + 2, deg)
                    d = nd
                out.append((ss, ln, d))
                prev = d
        # resolve the last note to a stable tone of the last chord
        ss, ln, d = out[-1]
        out[-1] = (ss, ln, snapd(d, prog[3]))
        return out

    hook_r = HOOKS[int(rng.integers(len(HOOKS)))]
    hook = make_phrase(hook_r, pc, 0, 9, snapd(int(rng.integers(2, 6)), pc[0]))
    vr = HOOKS[int(rng.integers(len(HOOKS)))]
    vr = [n for n in vr if rng.random() < 0.75] or vr
    verse_mel = make_phrase(vr, pv, -3, 5, snapd(int(rng.integers(-1, 3)), pv[0]))
    lcache = {}

    def play_lead(note, t, dur, g, bright=1.0, ev=True, pan=0.08):
        key = (int(note), round(dur, 3), bright)
        if key not in lcache:
            lcache[key] = lead_note(note, dur, rng, bright)
        m.add('lead', lcache[key], t, g, pan)
        if ev:
            c.ev('lead', t, int(note), round(dur, 3), round(g, 2))

    for sec in c.sections:
        if sec.name in ('chorus', 'outro'):
            phrase, g, br = hook, 0.85, 1.0
        elif sec.name == 'verse':
            phrase, g, br = verse_mel, 0.6, 0.4
        elif sec.name == 'bridge':
            for b in range(sec.bar, sec.bar + sec.bars):
                i = b - sec.bar
                if i == sec.bars - 1:
                    continue
                deg = chord_deg(sec, b)
                for half in (0, 8):
                    d = snapd(4 + (i % 4) - (half // 8), deg)
                    play_lead(scale_note(base, scale, d), c.t(b) + half * S, 8 * S * 0.95, 0.6, 0.5)
            continue
        else:
            continue
        for b4 in range(sec.bar, sec.bar + sec.bars, 4):
            rep = (b4 - sec.bar) // 4
            if sec.name == 'verse' and rep % 2 == 0 and verse_idx[sec.bar] == 0 and rep == 0 and sec.bars > 4:
                continue           # first verse eases in
            for ss, ln, d in phrase:
                bar = b4 + ss // 16
                if bar >= sec.bar + sec.bars:
                    continue
                if bar == sec.bar + sec.bars - 1 and sec.name != 'outro' and ss % 16 >= 8:
                    continue
                note = scale_note(base, scale, d)
                t = c.t(b4) + ss * S
                dur = ln * S * 0.92
                play_lead(note, t, dur, g, br)
                if sec.name == 'chorus' and sec.bar == last_chorus:
                    play_lead(note + 12, t, dur, g * 0.35, 1.2, ev=False, pan=-0.3)

    # ------------------------------------------------------------ fx / sidechain
    c.progress(0.88, 'mixing')
    kt = sorted(kick_times)
    m.stem('bass', G['bass'], 0.0, fx=lambda y: duck(y, kt, 0.35, 0.09))
    m.stem('pluck', G['pluck'], 0.18, fx=lambda y: duck(y, kt, 0.45, 0.12))
    m.stem('keys', G['keys'], 0.25, fx=lambda y: duck(hp(y, 150), kt, 0.35, 0.14))
    m.stem('lead', G['lead'], 0.25, fx=lambda y: echo(y, 3 * S, 0.22, 3, 3500))
    m.stem('arp', G['arp'], 0.35, fx=lambda y: duck(echo(y, 3 * S, 0.3, 3, 4500), kt, 0.4, 0.12))
