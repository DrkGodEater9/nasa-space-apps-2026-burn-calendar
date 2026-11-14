// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works on any host or sub-path (GitHub Pages, Netlify, Vercel).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
