"""Rock: distorted double-tracked power chords, driving picked bass, 8th-note kit, pentatonic lead.
This is the REFERENCE style: copy its structure (sections loop, per-instrument events, stems, progress calls)."""
import numpy as np
from engine import *

NAME = 'Rock'
BPMS = [112, 120, 124, 128, 132]
KEYS = [40, 43, 45, 38, 41]            # E, G, A, D, F
TITLES = (['Electric', 'Burning', 'Midnight', 'Broken', 'Rebel', 'Wild', 'Iron', 'Last'],
          ['Highway', 'Thunder', 'Riot', 'Engine', 'Fire', 'Echo', 'Skyline', 'Revolution'])

PROGS_V = [[0, 5, 2, 6], [0, 0, 5, 6], [0, 3, 5, 4], [0, 2, 3, 6]]
PROGS_C = [[5, 2, 6, 0], [3, 5, 6, 6], [5, 6, 0, 0], [2, 6, 5, 4]]


def _power_chord(root, dur, rng, detune, mute=False, drive=7.0):
    """Distorted guitar power chord: root + fifth + octave."""
    n = int(dur * SR)
    notes = [root, root + 7, root + 12]
    x = np.zeros(n)
    for i, m in enumerate(notes):
        f = midi_hz(m) * (1 + detune * (1 + 0.3 * i))
        x += osc(f, dur, 'saw', phase=rng.random()) * (0.9 if i < 2 else 0.6)
        x += osc(f * 1.004, dur, 'saw', phase=rng.random()) * 0.4
    x = lp(x, 2600 if mute else 5200, 2)
    e = adsr(n, 0.004, 0.12, 0.55 if not mute else 0.15, 0.06 if mute else 0.15)
    x = softclip(x * e * drive * 0.25, 3.0)
    x = hp(x, 110)
    x = lp(x, 4200, 2) + 0.35 * bp(x, 900, 2200)       # cabinet-ish
    return x * 0.5


def compose(c):
    rng, root = c.rng, c.root
    scale = c.brief.get('scale', 'minor')
    pv = PROGS_V[int(rng.integers(len(PROGS_V)))]
    pc = PROGS_C[int(rng.integers(len(PROGS_C)))]
    if c.brief.get('progression'):
        pv = pc = c.brief['progression']

    m = c.mix
    m.stem('drums', 1.0, 0.10); m.stem('bass', 0.95, 0.02); m.stem('gtr', 0.8, 0.10); m.stem('lead', 0.55, 0.28)

    K = kick(rng, 120, 48, 0.4, 0.3, 2.2)
    SN = [snare(rng, 190 + 6 * i, 0.26) for i in range(3)]
    HC = [hat(rng, 0.05) for _ in range(3)]
    HO = hat(rng, open_=True)
    CR = crash(rng, 1.8)
    TM = [tom(rng, f) for f in (150, 110, 82)]

    def chord_for(sec, bar):
        prog = pc if sec.name in ('chorus', 'outro') else pv
        deg = prog[(bar - sec.bar) % 4]
        return scale_note(root, scale, deg)

    c.progress(0.05, 'drums')
    # ------------------------------------------------------------ drums
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            t0 = c.t(b)
            last = (b - sec.bar) % 8 == 7 and sec.name != 'outro'
            en = sec.energy
            if sec.name == 'intro' and b - sec.bar < 2:
                pat_k, pat_s, hats = [], [], range(0, 16, 4)
            else:
                pat_k = [0, 6, 10] if en > 0.7 else [0, 8]
                if rng.random() < .3: pat_k = pat_k + [14]
                pat_s = [4, 12]
                hats = range(0, 16, 2)
            if sec.name == 'bridge':
                pat_k, pat_s, hats = [0, 8], [8], range(0, 16, 4)
            for s in range(16):
                t = t0 + s * c.step
                if last and s >= 8:        # fill
                    if s % 2 == 0 or s >= 12:
                        i = (s - 8) // 2 if s < 12 else 3 + (s - 12) % 2
                        tm = [0, 1, 2, 2, 1][min(i, 4)]
                        m.add('drums', TM[tm], t, 0.8, [-.4, 0, .4][tm])
                        c.ev('drums', t, 't%d' % (tm + 1), 0.9)
                    continue
                if s in pat_k:
                    m.add('drums', K, t, 1.0); c.ev('drums', t, 'k', 1.0)
                if s in pat_s:
                    m.add('drums', SN[int(rng.integers(3))], t, 0.9); c.ev('drums', t, 's', 0.95)
                if s in hats:
                    op = en > 0.8 and s % 8 == 6
                    v = 0.5 + 0.25 * (s % 4 == 0) + rng.random() * 0.1
                    m.add('drums', HO if op else HC[int(rng.integers(3))], t, v, 0.25)
                    c.ev('drums', t, 'o' if op else 'h', v)
            if (b == sec.bar and sec.name in ('chorus', 'bridge', 'verse')) or (b - sec.bar) % 8 == 0 and sec.name == 'chorus':
                m.add('drums', CR, t0, 0.7, -0.3); c.ev('drums', t0, 'c', 1.0)

    # ------------------------------------------------------------ bass
    c.progress(0.3, 'bass')
    bass_cache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            r = chord_for(sec, b) - 12
            if sec.name == 'intro' and b - sec.bar < 2:
                continue
            for s in range(0, 16, 2):
                t = c.t(b) + s * c.step
                if sec.name == 'bridge' and s % 8: continue
                note = r + (12 if (s == 14 and rng.random() < .25) else 0)
                dur = c.step * (1.9 if sec.energy > .7 else 1.6)
                key = (note, round(dur, 3))
                if key not in bass_cache:
                    f = midi_hz(note)
                    x = pluck(f, dur + .1, rng, 0.994, 0.35)
                    x = softclip(x * 2.2 + 0.5 * np.sin(2 * np.pi * f * np.arange(len(x)) / SR) * expdecay(len(x), .3), 1.6)
                    bass_cache[key] = lp(x, 1800, 2) * 0.6
                m.add('bass', bass_cache[key], t, 0.9 if s % 4 == 0 else 0.75)
                c.ev('bass', t, int(note), dur, 0.9 if s % 4 == 0 else 0.7)

    # ------------------------------------------------------------ guitars (two takes, hard panned)
    c.progress(0.5, 'guitars')
    gcache = {}
    for sec in c.sections:
        for b in range(sec.bar, sec.bar + sec.bars):
            r = chord_for(sec, b)
            if sec.name == 'intro' and b - sec.bar < 2:
                continue
            events = []
            if sec.name in ('chorus', 'outro'):
                events = [(0, 6, False), (6, 2, False), (8, 8, False)] if sec.energy > .8 else [(0, 8, False), (8, 8, False)]
            elif sec.name == 'bridge':
                events = [(0, 16, False)]
            else:
                events = [(s, 2, True) for s in range(0, 16, 2)]    # palm-muted 8ths
            for s, ln, mute in events:
                t = c.t(b) + s * c.step
                dur = ln * c.step * (0.9 if not mute else 0.7)
                for take, pan in ((0, -0.7), (1, 0.7)):
                    key = (r, round(dur, 3), mute, take)
                    if key not in gcache:
                        gcache[key] = _power_chord(r + 12, dur, rng, 0.0015 * (1 if take else -1), mute)
                    m.add('gtr', gcache[key], t, 0.8 if not mute else 0.65, pan)
                c.ev('guitar', t, int(r), dur, 0.7 if mute else 0.95, 1 if (s // 2) % 2 == 0 else -1, 1 if mute else 0)

    # ------------------------------------------------------------ lead
    c.progress(0.75, 'lead')
    pent = 'minor_pent'
    for sec in c.sections:
        if sec.name not in ('chorus', 'bridge'):
            continue
        deg = 7
        for b in range(sec.bar, sec.bar + sec.bars, 1):
            if (b - sec.bar) % 2 and sec.name == 'chorus' and rng.random() < .3:
                continue
            pos = 0
            while pos < 16:
                ln = int(rng.choice([2, 4, 4, 6, 8]))
                ln = min(ln, 16 - pos)
                if rng.random() < .2:
                    pos += ln; continue
                deg = int(np.clip(deg + rng.integers(-2, 3), 3, 11))
                note = scale_note(root + 12, pent, deg)
                t = c.t(b) + pos * c.step
                dur = ln * c.step
                n = int(dur * SR)
                vib = 1 + 0.008 * np.sin(2 * np.pi * 5.5 * np.arange(n) / SR) * np.minimum(1, np.arange(n) / (0.2 * SR))
                x = osc(midi_hz(note) * vib, dur, 'saw') + 0.5 * osc(midi_hz(note) * vib * 1.003, dur, 'square')
                x = lp(softclip(x * adsr(n, 0.01, 0.1, 0.7, 0.1), 2.5), 3800)
                m.add('lead', x * 0.5, t, 0.8, 0.1)
                c.ev('lead', t, int(note), dur, 0.8)
                pos += ln
    c.progress(0.9, 'mixing')
