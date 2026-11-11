const CACHE = 'fufu-v5';

// App shell — all files needed to render the dashboard while offline
const SHELL = [
  '/dashboard.html',
  '/login.html',
  '/css/main.css',
  '/js/vendor/dexie.mjs',
  '/js/app.js',
  '/js/auth.js',
  '/js/utils/api-client.js',
  '/js/utils/offline-store.js',
  '/js/utils/sync-engine.js',
  '/js/utils/config.js',
  '/js/utils/storage.js',
  '/js/utils/toast.js',
  '/js/utils/formatters.js',
  '/js/utils/validators.js',
  '/js/partner/dashboard.js',
  '/js/partner/queue.js',
  '/js/partner/opd-card.js',
  '/js/partner/medical.js',
  '/js/partner/finance.js',
  '/js/partner/pos.js',
  '/js/partner/ipd.js',
  '/js/partner/pets.js',
  '/js/partner/inventory.js',
  '/js/partner/home.js',
  '/js/partner/grooming.js',
  '/js/partner/hotel.js',
  '/js/partner/kanban.js',
  '/js/partner/settings.js',
  '/js/partner/documents.js',
  '/js/partner/staff.js',
  '/js/partner/audit.js',
  '/js/partner/rbac.js',
  '/js/partner/data-masking.js',
  '/js/partner/invoice.js',
];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve static assets from cache; skip all API calls ────────────────
self.addEventListener('fetch', e => {
  // Let the app (api-client.js) handle all API calls — do not intercept
  if (e.request.url.includes('/api/')) return;

  // The public landing page must reach Next.js. Keep the portal shell available offline.
  if (e.request.mode === 'navigate') {
    const path = new URL(e.request.url).pathname;
    if (path === '/dashboard.html' || path === '/login.html') {
      const shell = path;
      e.respondWith(caches.match(shell).then(r => r || fetch(e.request)));
    } else {
      e.respondWith(fetch(e.request).catch(() => caches.match('/login.html')));
    }
    return;
  }

  // Static assets: cache-first.
  // App shell files are versioned via CACHE name and refreshed wholesale on SW update,
  // so background network writes on every load are unnecessary write I/O.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => null);
    })
  );
});

// ── Background Sync (Chrome/Android): notify all open tabs to flush queue ────
self.addEventListener('sync', e => {
  if (e.tag === 'fufu-sync') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'fufu-sync' }));
      })
    );
  }
});
