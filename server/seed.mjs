// npm run seed [-- --minutes 30 --jobs 4 --vibes rock,pop]
// Pre-generates songs until every vibe has at least --minutes of music in ./tracks (the radio loops them offline).
// Legacy: --per N generates N songs per vibe regardless of what exists.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIBE_IDS } from '../shared/vibes.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKS = path.join(ROOT, 'tracks');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const minutes = Number(arg('minutes', 30)), jobs = Number(arg('jobs', 4)), per = arg('per', null);
const vibes = (arg('vibes', '') || VIBE_IDS.join(',')).split(',').filter(Boolean);
fs.mkdirSync(TRACKS, { recursive: true });

const have = Object.fromEntries(vibes.map((v) => [v, 0])); // seconds on disk per vibe
for (const f of fs.readdirSync(TRACKS)) {
  if (!f.endsWith('.json')) continue;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(TRACKS, f), 'utf8'));
    if ((m.v || 1) >= 2 && m.vibe in have && fs.existsSync(path.join(TRACKS, m.file))) have[m.vibe] += m.duration;
  } catch { /* skip broken */ }
}
const pending = Object.fromEntries(vibes.map((v) => [v, 0])); // expected seconds of in-flight jobs
const perLeft = per == null ? null : Object.fromEntries(vibes.map((v) => [v, Number(per)]));
const AVG = 140;
const needs = (v) => (perLeft ? perLeft[v] > 0 : have[v] + pending[v] < minutes * 60);
let running = 0, done = 0, failed = 0;
function next() {
  while (running < jobs) {
    const v = vibes.filter(needs).sort((a, b) => (have[a] + pending[a]) - (have[b] + pending[b]))[0];
    if (!v) break;
    running++; pending[v] += AVG; if (perLeft) perLeft[v]--;
    const p = spawn(process.env.PYTHON || 'python', ['music/gen.py', '--vibe', v, '--out', 'tracks'], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => process.stderr.write(d));
    p.on('close', (code) => {
      running--; done++; pending[v] -= AVG;
      const m = /@@DONE (.*)/.exec(out);
      if (code === 0 && m) {
        const j = JSON.parse(m[1]); have[v] += j.duration;
        console.log(`[${done}] ${v}: "${j.title}" ${j.duration}s in ${j.genSeconds}s  (${v} total ${(have[v] / 60).toFixed(1)} min)`);
      } else { failed++; console.log(`[${done}] ${v}: FAILED (${code})`); if (failed > 10) process.exit(1); }
      if (running === 0 && !vibes.some(needs)) {
        console.log('\n' + vibes.map((x) => `${x}: ${(have[x] / 60).toFixed(1)} min`).join('\n'));
      }
      next();
    });
  }
}
next();
