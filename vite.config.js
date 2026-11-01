import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': API, '/uploads': API, '/hls': API, '/sitemap.xml': API },
    // Les JSON sont réécrits par l'admin : on évite le rechargement automatique de la page en cours d'édition.
    watch: { ignored: ['**/db/**', '**/src/data/**', '**/backups/**', '**/uploads/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
