# AI Radio

A never-ending voxel party radio. A band of Claude models (Sonnet = guitar, Haiku = bass, Opus = drums) plays on a
three.js voxel stage whose scenery changes per **vibe**. Music is synthesised with numpy (`music/`) into a library, and optionally composed live on every vote. It always keeps
playing: when a song is about to end the next song of the same vibe is queued.

## Run it
```
npm install
npm run dev                              # = vite --host   -> prints your LAN URL
```
That is all you need: the repo ships a **library of songs** (`tracks/`, >= 30 min per vibe, several songs each) and the radio
loops them. A vote switches vibe immediately and the vibe's songs keep looping. No Claude / no API key / no Python required to listen.

Optional **live generation** (a fresh song is composed on every vote): `pip install numpy scipy soundfile` + `ffmpeg` on PATH.
It turns itself on when Python + numpy are found; `RADIO_LIVE=0` forces library mode.

* Everyone opens the app, picks a **name + avatar**, then chooses **Join & vote** (guest) or **I'm the speaker** (host).
* The host phone (plugged into the speaker) taps *Start the radio*, then only has Play/Pause (and Invite → QR code). Only one device can be host.
* Voting is democratic: every device has the vibe buttons, voter names/avatars show live on each button.
* Every generated song is saved in `tracks/` (`.mp3` + `.json` with the note events that drive the animation).
* Refill / extend the library: `npm run seed` (tops every vibe up to 30 min; `-- --minutes 45 --jobs 6`).
  `python music/reencode.py 96` shrinks the mp3s (96 kbps keeps the repo small).

## How it works
| Piece | Where |
|---|---|
| Vite plugin: party room (WebSocket `/radio-ws`), roles, voting rounds, agent jobs, track streaming | `server/radio.js` |
| numpy synth engine + styles (rock, pop, funk, hiphop, house, mideast, lofi, synthwave) | `music/engine.py`, `music/styles/*.py`, `music/gen.py` |
| Voxel engine, band with IK arms, instruments | `src/scene/voxel.js`, `band.js`, `instruments.js` |
| Deterministic vibe scenes (pure functions of song time + note events) | `src/scene/vibes/*.js` |
| Host audio engine (2 decks, DJ crossfade) | `src/audio/hostPlayer.js` |

Env vars: `RADIO_LIVE=0` (library mode), `RADIO_ROUND_SECONDS=12`, `RADIO_JOBS=3` (parallel generators), `PYTHON=python`, `RADIO_MP3_KBPS=96`.
Debug scenes without the server logic: `/?demo=house&track=<trackId>&at=30&freeze&clean`.

## License
MIT (see `LICENSE`).
