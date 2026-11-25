import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  root: 'src',
  base: './',
  cacheDir: '../node_modules/.vite',
  plugins: [react(), tailwind()],
  build: { outDir: '../dist/renderer', emptyOutDir: true, sourcemap: false },
});
