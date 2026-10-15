"""CLI: python music/gen.py --vibe rock [--seed N] [--out tracks] [--brief '{json}']
Prints progress lines '@@{"p":0.4,"stage":"drums"}' and finally '@@DONE {meta json}'."""
import argparse, importlib, json, os, shutil, subprocess, sys, time
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'styles'))
import engine as E  # noqa: E402


def b36(n):
    s = ''
    while n:
        n, r = divmod(n, 36)
        s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
    return s or '0'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vibe', required=True)
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'tracks'))
    ap.add_argument('--brief', default='{}')
    a = ap.parse_args()
    t0 = time.time()
    seed = a.seed if a.seed is not None else int(time.time() * 1000) % 2_000_000_000
    brief = json.loads(a.brief or '{}')
    style = importlib.import_module(a.vibe)
    rng = np.random.default_rng(seed)
    bpm = int(brief.get('bpm') or rng.choice(style.BPMS))
    root = int(brief.get('root') or rng.choice(style.KEYS))
    c = E.Ctx(a.vibe, seed, bpm, root, brief)
    c.progress(0.01, 'composing')
    style.compose(c)
    audio = c.mix.render()
    n_out = int((c.duration + 2.2) * E.SR)           # short reverb tail
    audio = audio[:, :n_out].copy()
    fo = int(1.6 * E.SR)
    audio[:, -fo:] *= np.linspace(1, 0, fo)
    c.progress(0.95, 'encoding')
    title = brief.get('title') or E.make_title(c.rng, *style.TITLES)
    tid = f"{a.vibe}-{b36(int(time.time()))}-{seed % 10000:04d}"
    os.makedirs(a.out, exist_ok=True)
    wav = os.path.join(a.out, tid + '.wav')
    sf.write(wav, audio.T, E.SR, subtype='PCM_16')
    ff = shutil.which('ffmpeg') or os.environ.get('FFMPEG')
    fname = tid + '.wav'
    if ff:
        mp3 = os.path.join(a.out, tid + '.mp3')
        r = subprocess.run([ff, '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', os.environ.get('RADIO_MP3_KBPS', '96') + 'k', mp3])
        if r.returncode == 0:
            os.remove(wav)
            fname = tid + '.mp3'
    meta = {
        'v': 2, 'id': tid, 'vibe': a.vibe, 'title': title, 'bpm': bpm, 'root': root, 'seed': seed,
        'duration': round(audio.shape[1] / E.SR, 2), 'file': fname, 'createdAt': int(time.time() * 1000),
        'genSeconds': round(time.time() - t0, 1), 'agent': brief.get('agent', 'local'),
        'sections': [{'name': s.name, 'start': round(s.bar * c.bar_s, 2), 'end': round((s.bar + s.bars) * c.bar_s, 2), 'energy': s.energy} for s in c.sections],
        'events': c.events,
    }
    with open(os.path.join(a.out, tid + '.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print('@@DONE ' + json.dumps({k: v for k, v in meta.items() if k != 'events'}), flush=True)


if __name__ == '__main__':
    main()
