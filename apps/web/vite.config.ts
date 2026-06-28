import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Biblioteca Cordillera',
        short_name: 'Cordillera',
        description: 'Indexa y vende tu biblioteca física',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        icons: [
          { src: '/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // En dev, /api va al Worker de wrangler
      '/api': 'http://localhost:8787',
    },
  },
});
