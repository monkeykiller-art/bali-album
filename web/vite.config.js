/* BALI 2026 · React build config
   Multi-page: index.html (album) + admin.html (photo manager) +
   text.html (text & style manager).
   Build output lands directly in ../bali-album so the existing server.js
   static handler keeps serving the same URLs (/bali-album/index.html ...).
   Dev server proxies the management API + photo folders to server.js on 8123. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/bali-album/',
  build: {
    outDir: resolve(__dirname, '../bali-album'),
    emptyOutDir: false,
    assetsDir: 'vite-assets',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        text: resolve(__dirname, 'text.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8123',
      '/photos2': 'http://localhost:8123',
      '/photos': 'http://localhost:8123',
    },
  },
});
