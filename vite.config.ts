import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Edition media is cached per page at runtime (Phase 3), not precached with the shell.
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
      manifest: {
        name: 'The Art of Reset',
        short_name: 'Art of Reset',
        display: 'standalone',
        background_color: '#050f22',
        theme_color: '#050f22',
        icons: [],
      },
    }),
  ],
});
