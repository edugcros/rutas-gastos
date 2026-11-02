import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';

function offlineServiceWorker() {
  return {
    name: 'rutas-gastos-offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Precache every production JS/CSS chunk and emitted static asset.
      // Public files (manifest/icons) are copied by Vite and listed explicitly.
      const builtAssets = Object.keys(bundle)
        .filter((fileName) => fileName !== 'sw.js' && !fileName.endsWith('.map'))
        .filter((fileName) => /\.(?:html|js|css|mjs|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico|json)$/i.test(fileName))
        .map((fileName) => `/${fileName.replace(/^\//, '')}`);

      const publicAssets = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-maskable-512.png',
      ];
      const precacheUrls = [...new Set([...publicAssets, ...builtAssets])];
      const revision = createHash('sha256').update(precacheUrls.join('\n')).digest('hex').slice(0, 12);

      const source = `
const CACHE_PREFIX = 'rutas-gastos-shell-';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(revision)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};
const PRECACHE_PATHS = new Set(PRECACHE_URLS.map((path) => new URL(path, self.location.origin).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Installation succeeds only after the complete app shell is available offline.
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: try network first, then return the cached application entry point.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', networkResponse.clone());
          await cache.put('/', networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Production JS/CSS/images/fonts are precached and served cache-first.
  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        return Response.error();
      }
    })());
  }
});
`;

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), offlineServiceWorker()],
  build: {
    rollupOptions: {
      output: {
        // Split vendor code so app changes don't invalidate the large UI-library chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\/]node_modules[\/](@mui|@emotion)[\/]/.test(id)) return 'vendor-mui';
          if (/[\/]node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'vendor-react';
          if (/[\/]node_modules[\/](axios|lucide-react|@googlemaps)[\/]/.test(id)) return 'vendor-misc';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173 },
});
