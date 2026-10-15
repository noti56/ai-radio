import { defineConfig } from 'vite';
import radio from './server/radio.js';

// `npm run dev` => `vite --host` : serves the app + the party-room websocket on your LAN.
export default defineConfig({
  plugins: [radio()],
  server: { host: true, port: 5173, strictPort: false, watch: { ignored: ['**/tracks/**', '**/music/**', '**/__pycache__/**'] } },
  preview: { host: true, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
