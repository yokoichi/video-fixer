import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'docs', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
});
