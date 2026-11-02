import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { publicArticles } from './src/articles.js';

const API = 'http://localhost:3001';

/** Retire de content.json les articles en brouillon ou programmés avant de l'intégrer au site compilé. */
const hideDraftArticles = {
  name: 'hide-draft-articles',
  enforce: 'pre',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/src/data/content.json')) return null;
    const data = JSON.parse(code);
    data.news = publicArticles(data.news);
    return { code: JSON.stringify(data), map: null };
  },
};

export default defineConfig({
  plugins: [hideDraftArticles, react()],
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
