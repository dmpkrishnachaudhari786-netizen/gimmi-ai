import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset URLs relative so the same build works locally,
// on GitHub Pages project sites (https://user.github.io/repo/) and on Netlify.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 900
  }
});
