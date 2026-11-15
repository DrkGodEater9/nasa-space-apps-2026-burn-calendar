// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works on any host or sub-path (GitHub Pages, Netlify, Vercel).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Libraries in their own files: they rarely change, so browsers keep them cached across
        // deploys of the app code, and the three files download in parallel.
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
