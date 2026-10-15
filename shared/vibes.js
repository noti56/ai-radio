// Single source of truth for the radio "vibes". Imported by the server (node) and the client (vite).
// `bpm` = allowed range for agent briefs. `shape` = Kahoot-style glyph on the vote button.
export const VIBES = [
  { id: 'rock',      label: 'Rock',           emoji: '🎸', color: '#e21b3c', glow: '#ff5a6e', shape: '▲', tagline: 'Loud amps, louder crowd',      bpm: [112, 132] },
  { id: 'pop',       label: 'Pop',            emoji: '🎤', color: '#ff4fa3', glow: '#ff9ccc', shape: '◆', tagline: 'Hooks you cannot escape',      bpm: [100, 124] },
  { id: 'funk',      label: 'Funk',           emoji: '🕺', color: '#f59e0b', glow: '#ffd166', shape: '●', tagline: 'Get on the one',                bpm: [96, 112] },
  { id: 'hiphop',    label: 'Hip Hop',        emoji: '🎧', color: '#8b5cf6', glow: '#c4a8ff', shape: '■', tagline: 'Boom bap & 808s',               bpm: [80, 96] },
  { id: 'house',     label: 'House',          emoji: '🪩', color: '#06b6d4', glow: '#7ae8ff', shape: '★', tagline: 'Four on the floor',             bpm: [122, 128] },
  { id: 'mideast',   label: 'Middle Eastern', emoji: '🪔', color: '#c8892b', glow: '#ffd27a', shape: '✦', tagline: 'Oud, darbuka & maqam',          bpm: [92, 112] },
  { id: 'lofi',      label: 'Lo-Fi',          emoji: '☕', color: '#5b8a72', glow: '#a7e3c4', shape: '☾', tagline: 'Chill beats to relax to',       bpm: [70, 88] },
  { id: 'synthwave', label: 'Synthwave',      emoji: '🌆', color: '#e11d74', glow: '#ff6fb5', shape: '▼', tagline: 'Neon nights, outrun drive',     bpm: [100, 116] },
];
export const VIBE_IDS = VIBES.map((v) => v.id);
export const VIBE_BY_ID = Object.fromEntries(VIBES.map((v) => [v.id, v]));
