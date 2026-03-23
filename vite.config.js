import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/star_chart/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    open: true,
  },
});
