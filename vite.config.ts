import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /<repo>/ — the deploy workflow passes it as BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),

    // Installable PWA: web manifest + auto-updating service worker (precaches the app shell for offline use).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Tabi · הטיול שלנו ליפן',
        short_name: 'Tabi',
        description: 'ניהול טיול של 30 יום ביפן: לו״ז יומי, מפה חיה וניווט.',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4f1',
        theme_color: '#f6f4f1',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        // Map tiles and Google/OSM API responses are intentionally NOT cached by the service worker
        // (Google Maps Platform ToS; tiles are large). Firestore keeps its own offline cache.
        runtimeCaching: [
          {
            // Mascot frames and the city photos: too many to precache; kept once seen, so they also show offline.
            urlPattern: ({ sameOrigin, url }) => sameOrigin && /\/(mascot|photos)\/.*\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'artwork', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
