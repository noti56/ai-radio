"""python music/reencode.py [kbps]  : re-encode every tracks/*.mp3 to a smaller bitrate (default 96k) and update nothing else.
Used to keep the repo small enough for GitHub. Idempotent: files already <= the target size ratio are skipped."""
import glob, os, shutil, subprocess, sys
kbps = int(sys.argv[1]) if len(sys.argv) > 1 else 96
ff = shutil.which('ffmpeg') or os.environ.get('FFMPEG')
if not ff: sys.exit('ffmpeg not found')
here = os.path.dirname(os.path.abspath(__file__))
for f in sorted(glob.glob(os.path.join(here, '..', 'tracks', '*.mp3'))):
    tmp = f + '.tmp.mp3'
    probe = subprocess.run([ff, '-i', f], capture_output=True, text=True).stderr
    if f'{kbps} kb/s' in probe: continue
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', f, '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', tmp], check=True)
    os.replace(tmp, f); print('re-encoded', os.path.basename(f))
