"""AI Radio synth engine: pure numpy (+scipy.signal filters). No samples, everything is synthesised.

Style modules (music/styles/<vibe>.py) use this to compose a full 2-3 minute song.
Contract for a style module:
    NAME   = 'Rock'
    BPMS   = [120, 124, 128]            # integer, multiples of 4 preferred (scene loops on 60 s)
    KEYS   = [40, 45, 43]               # candidate root midi notes (tonic)
    TITLES = (['Electric','Neon'], ['Thunder','Highway'])   # (adjectives, nouns) for titles
    def compose(c): ...                 # c is a Ctx, fill c.mix and c.ev
"""
import numpy as np
from scipy import signal

SR = 44100

# ----------------------------------------------------------------------------- basics
def midi_hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def _fit(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


fit = _fit


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1):
    an, dn, rn = int(a * SR), int(d * SR), int(r * SR)
    sn = max(0, n - an - dn - rn)
    e = np.concatenate([
        np.linspace(0, 1, an, endpoint=False), np.linspace(1, s, dn, endpoint=False),
        np.full(sn, s), np.linspace(s, 0, rn)])
    return _fit(e, n)


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def osc(freq, dur, shape='saw', phase=0.0):
    """freq: scalar Hz or array (per sample). dur seconds."""
    n = int(dur * SR)
    f = np.full(n, float(freq)) if np.isscalar(freq) else _fit(np.asarray(freq, dtype=np.float64), n)
    ph = phase + np.cumsum(f) / SR
    fr = ph % 1.0
    if shape == 'sine':
        return np.sin(2 * np.pi * ph)
    if shape == 'saw':
        return 2 * fr - 1
    if shape == 'square':
        return np.where(fr < 0.5, 1.0, -1.0)
    if shape == 'tri':
        return 4 * np.abs(fr - 0.5) - 1
    if shape.startswith('pulse'):
        w = float(shape[5:] or 0.3)
        return np.where(fr < w, 1.0, -1.0)
    raise ValueError(shape)


def saw_bl(freq, dur, phase=0.0):
    """polyBLEP band-limited saw (scalar freq)."""
    n = int(dur * SR)
    dt = freq / SR
    ph = (phase + np.arange(n) * dt) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def noise(dur, rng):
    return rng.standard_normal(int(dur * SR))


def lp(x, fc, order=2):
    fc = min(fc, SR / 2 - 100)
    return signal.sosfilt(signal.butter(order, fc / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc / (SR / 2), 'high', output='sos'), x)


def bp(x, lo, hi, order=2):
    hi = min(hi, SR / 2 - 100)
    return signal.sosfilt(signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos'), x)


def lp_sweep(x, fc_curve, steps=7):
    """Low-pass with a time-varying cutoff (array len(x) or (f0,f1))."""
    n = len(x)
    if not isinstance(fc_curve, np.ndarray):
        fc_curve = np.geomspace(fc_curve[0], fc_curve[1], n)
    fc_curve = _fit(fc_curve, n) if len(fc_curve) != n else fc_curve
    lo, hi = max(60.0, float(fc_curve.min())), min(float(fc_curve.max()), SR / 2 - 200)
    if hi / lo < 1.05:
        return lp(x, lo)
    fcs = np.geomspace(lo, hi, steps)
    ys = np.stack([lp(x, f) for f in fcs])
    pos = np.clip(np.log(np.clip(fc_curve, lo, hi) / lo) / np.log(hi / lo) * (steps - 1), 0, steps - 1 - 1e-9)
    i0 = pos.astype(int)
    w = pos - i0
    idx = np.arange(n)
    return ys[i0, idx] * (1 - w) + ys[i0 + 1, idx] * w


def softclip(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def fold(x, amt=2.0):
    return np.sin(x * amt)


def pluck(freq, dur, rng, decay=0.996, bright=0.5):
    """Karplus-Strong, block-vectorised, fine-tuned by interpolation."""
    n = int(dur * SR)
    N = max(4, int(round(SR / freq - 0.5)))
    f_act = SR / (N + 0.5)
    seed = rng.standard_normal(N)
    seed = lp(seed, 1500 + 9000 * bright, 1) if N > 12 else seed
    out = np.empty(n + N)
    out[:N] = seed
    prev_last = 0.0
    for i in range(N, n + N, N):
        blk = out[i - N:i]
        shifted = np.empty(N)
        shifted[0] = out[i - N - 1] if i - N - 1 >= 0 else 0.0
        shifted[1:] = blk[:-1]
        end = min(N, n + N - i)
        out[i:i + end] = (decay * 0.5 * (blk + shifted))[:end]
    out = out[:n]
    ratio = freq / f_act
    if abs(ratio - 1) > 1e-4:
        out = np.interp(np.arange(n) * ratio, np.arange(n), out)
    return out


def sub808(freq, dur, glide=0.0, drive=1.5, glide_t=0.08):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + glide * np.exp(-t / glide_t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x = softclip(x * expdecay(n, dur * 0.55) * (1 - np.exp(-t / 0.003)), drive)
    return x * np.minimum(1, (dur - t) / 0.03).clip(0, 1)


def epiano(freq, dur, rng, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 14 * t) * 0.5 * bright * np.exp(-t / 0.08)
    mod2 = np.sin(2 * np.pi * freq * t) * 0.8 * bright * np.exp(-t / 0.5)
    x = np.sin(2 * np.pi * freq * t + mod2 + mod)
    return x * adsr(n, 0.003, 0.4, 0.35, 0.25)


# ----------------------------------------------------------------------------- drums (mono arrays)
def kick(rng=None, f0=130, f1=44, dur=0.42, click=0.25, drive=1.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.35))
    clk = np.exp(-t / 0.004) * np.sin(2 * np.pi * 1800 * t) * click
    return softclip(body + clk, drive) * np.minimum(1, (dur - t) / 0.02)


def snare(rng, tone=185, dur=0.26, noise_amt=0.85, snap=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = hp(rng.standard_normal(n), 1200) * np.exp(-t / (dur * 0.28)) * noise_amt
    body = np.sin(2 * np.pi * tone * t * (1 + 0.25 * np.exp(-t / 0.02))) * np.exp(-t / 0.06) * 0.7
    return softclip((nz + body) * snap, 1.4) * np.minimum(1, (dur - t) / 0.02)


def clap(rng, dur=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    base = bp(rng.standard_normal(n), 900, 3500)
    e = sum(np.exp(-np.maximum(t - d, 0) / 0.012) * (t >= d) for d in (0, 0.011, 0.023)) * 0.5
    e = e + np.exp(-np.maximum(t - 0.034, 0) / 0.07) * (t >= 0.034)
    return base * e * 1.4


def hat(rng, dur=0.05, open_=False, tone=7000):
    d = 0.32 if open_ else dur
    n = int(d * SR)
    t = np.arange(n) / SR
    # metallic: sum of detuned squares + noise
    m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (tone * 0.5, tone * 0.71, tone * 0.93, tone * 1.17, tone * 1.43, tone * 1.7)) / 6
    x = hp(0.6 * m + 0.6 * rng.standard_normal(n), 6000)
    return x * np.exp(-t / (0.09 if open_ else dur * 0.45)) * 0.55 * np.minimum(1, (d - t) / 0.01).clip(0, 1)


def tom(rng, freq=110, dur=0.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.3)) + hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.01) * 0.2


def crash(rng, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3500) + 0.3 * hp(rng.standard_normal(n), 800)
    return x * np.exp(-t / (dur * 0.3)) * 0.5


def rim(rng):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) + 0.6 * np.sin(2 * np.pi * 480 * t)) * np.exp(-t / 0.008) * 0.6


def conga(rng, freq=300, dur=0.22, slap=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.12 * np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.05 if slap else 0.09))
    x += bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t / 0.006) * (0.7 if slap else 0.3)
    return x


# ----------------------------------------------------------------------------- harmony helpers
SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10], 'dorian': [0, 2, 3, 5, 7, 9, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10], 'hijaz': [0, 1, 4, 5, 7, 8, 10],
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11], 'minor_pent': [0, 3, 5, 7, 10], 'major_pent': [0, 2, 4, 7, 9],
    'blues': [0, 3, 5, 6, 7, 10], 'bayati': [0, 1.5, 3, 5, 7, 8, 10], 'rast': [0, 2, 3.5, 5, 7, 9, 10.5],
}
CHORDS = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'dom7': [0, 4, 7, 10], 'min7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
          'pow': [0, 7, 12], 'sus4': [0, 5, 7], 'dim': [0, 3, 6], 'min9': [0, 3, 7, 10, 14], 'dom9': [0, 4, 7, 10, 14],
          'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14]}


def scale_note(root, scale, degree):
    """degree may exceed scale length (octaves) or be negative."""
    sc = SCALES[scale] if isinstance(scale, str) else scale
    o, d = divmod(int(degree), len(sc))
    return root + sc[d] + 12 * o


def diatonic_chord(root, scale, degree, size=3, kind=None):
    sc = SCALES[scale]
    if kind:
        r = scale_note(root, scale, degree)
        return [r + i for i in CHORDS[kind]]
    return [scale_note(root, scale, degree + 2 * k) for k in range(size)]


# ----------------------------------------------------------------------------- mixer
class Mixer:
    def __init__(self, seconds, rng):
        self.n = int((seconds + 5) * SR)
        self.rng = rng
        self.stems = {}      # name -> [2,N] array
        self.cfg = {}        # name -> dict(gain, reverb, fx)

    def stem(self, name, gain=1.0, reverb=0.0, fx=None):
        if name not in self.stems:
            self.stems[name] = np.zeros((2, self.n), dtype=np.float32)
        self.cfg[name] = dict(gain=gain, reverb=reverb, fx=fx)

    def add(self, name, x, t, gain=1.0, pan=0.0):
        if name not in self.stems:
            self.stem(name)
        i = int(t * SR)
        if i < 0 or i >= self.n:
            return
        x = np.asarray(x, dtype=np.float32)
        if x.ndim == 1:
            a = (pan + 1) * np.pi / 4
            L, R = np.cos(a) * gain, np.sin(a) * gain
            m = min(len(x), self.n - i)
            s = self.stems[name]
            s[0, i:i + m] += x[:m] * L
            s[1, i:i + m] += x[:m] * R
        else:
            m = min(x.shape[1], self.n - i)
            self.stems[name][:, i:i + m] += x[:, :m] * gain

    def get(self, name):
        return self.stems[name]

    def render(self, rms_target=0.14):
        wet = np.zeros((2, self.n), dtype=np.float32)
        dry = np.zeros((2, self.n), dtype=np.float32)
        for name, s in self.stems.items():
            cfg = self.cfg[name]
            y = s
            if cfg['fx']:
                y = cfg['fx'](y)
            dry += y * cfg['gain']
            if cfg['reverb'] > 0:
                wet += y * cfg['reverb'] * cfg['gain']
        if np.abs(wet).max() > 0:
            dry += reverb(wet, self.rng, rt=1.7, damp=5000)
        # master
        peak = np.abs(dry).max() + 1e-9
        dry /= peak
        rms = np.sqrt((dry ** 2).mean()) + 1e-9
        dry *= min(rms_target / rms, 6.0)
        dry = softclip(dry, 1.6) * 0.92
        # fades
        fi = int(0.02 * SR)
        dry[:, :fi] *= np.linspace(0, 1, fi)
        return dry


def reverb(stereo, rng, rt=1.5, damp=6000, predelay=0.012):
    n = int(rt * 1.2 * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(stereo)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
        ir = lp(ir, damp, 1)
        ir[:int(predelay * SR)] = 0
        ir /= np.sqrt((ir ** 2).sum()) + 1e-9
        out[ch] = signal.oaconvolve(stereo[ch], ir.astype(np.float32), mode='full')[:stereo.shape[1]]
    return out


def echo(x, delay, fb=0.35, taps=4, tone=3500):
    """x: mono or [2,N]; feedback delay with damping."""
    d = int(delay * SR)
    y = x.copy()
    cur = x
    for k in range(1, taps + 1):
        cur = lp(np.roll(cur, d, axis=-1), tone, 1) * fb
        cur[..., :d] = 0
        y = y + cur
    return y


def duck(stereo, times, depth=0.7, rel=0.18, attack=0.004):
    """sidechain-style pump on a stereo array [2,N] at hit times (seconds)."""
    g = np.ones(stereo.shape[1], dtype=np.float32)
    L = int((rel * 4 + attack) * SR)
    t = np.arange(L) / SR
    shape = 1 - depth * np.where(t < attack, t / attack, np.exp(-(t - attack) / rel))
    for tt in times:
        i = int(tt * SR)
        if i >= len(g):
            continue
        m = min(L, len(g) - i)
        g[i:i + m] = np.minimum(g[i:i + m], shape[:m])
    return stereo * g


# ----------------------------------------------------------------------------- song context
class Section:
    def __init__(self, name, bar, bars, energy):
        self.name, self.bar, self.bars, self.energy = name, bar, bars, energy

    def __repr__(self):
        return f'{self.name}@{self.bar}+{self.bars}'


def make_plan(total_k):
    k = total_k
    b = int(8 * k)
    return [('intro', 4, .3), ('verse', b, .5), ('chorus', b, .9), ('verse', b, .55), ('chorus', b, .95),
            ('bridge', 8, .6), ('chorus', b, 1.0), ('outro', 4, .3)]


class Ctx:
    """Everything a style needs. Times in seconds, bars are 0-indexed 4/4."""

    def __init__(self, vibe, seed, bpm, root, brief=None, plan_k=None, target=None):
        self.vibe, self.seed, self.bpm, self.root = vibe, seed, bpm, root
        self.brief = brief or {}
        self.rng = np.random.default_rng(seed)
        self.beat = 60.0 / bpm
        self.bar_s = self.beat * 4
        self.step = self.beat / 4  # 16th
        target = target or float(self.rng.uniform(135, 172))
        best = None
        for k in (1, 1.5, 2):
            bars = sum(p[1] for p in make_plan(k))
            d = bars * self.bar_s
            if d > 178 and k > 1:
                continue
            if best is None or abs(d - target) < best[0]:
                best = (abs(d - target), k)
        self.k = plan_k or best[1]
        self.sections = []
        bar = 0
        for name, bars, en in make_plan(self.k):
            self.sections.append(Section(name, bar, bars, en))
            bar += bars
        self.total_bars = bar
        self.duration = bar * self.bar_s
        self.mix = Mixer(self.duration + 2.5, self.rng)
        self.events = {}

    # time helpers
    def t(self, bar, beat=0.0):
        return (bar * 4 + beat) * self.beat

    def ev(self, inst, t, *data):
        self.events.setdefault(inst, []).append([round(float(t), 3), *[round(d, 3) if isinstance(d, float) else d for d in data]])

    def section_at(self, bar):
        for s in self.sections:
            if s.bar <= bar < s.bar + s.bars:
                return s
        return self.sections[-1]

    def swing(self, step_idx, amount):
        """16th index -> time offset with swing on odd steps."""
        return (step_idx * self.step) + (amount * self.step if step_idx % 2 else 0.0)

    def progress(self, p, stage):
        import json, sys
        print('@@' + json.dumps({'p': round(p, 3), 'stage': stage}), flush=True)


def make_title(rng, adj, noun):
    return f"{adj[int(rng.integers(len(adj)))]} {noun[int(rng.integers(len(noun)))]}"
