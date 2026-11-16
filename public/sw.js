const CACHE = 'fufu-v18';

// App shell — all files needed to render the dashboard while offline
const SHELL = [
  '/dashboard',
  '/login',
  '/css/main.css',
  '/js/vendor/dexie.mjs',
  '/js/app.js',
  '/js/theme-init.js',
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
  '/js/partner/cashier.js',
  '/js/partner/pos-retail.js',
  '/js/partner/send-to-cashier.js',
  '/js/partner/sheet.js',
  '/js/partner/profile-menu.js',
  '/js/partner/push-notifications.js',
  '/js/partner/welcome-guide.js',
  '/js/partner/install-app.js',
  '/js/utils/in-app-browser.js',
  '/js/partner/portal-i18n.js',
  '/js/partner/grooming.js',
  '/js/partner/hotel.js',
  '/js/partner/kanban.js',
  '/js/partner/settings.js',
  '/js/partner/documents.js',
  '/js/partner/staff.js',
  '/js/partner/audit.js',
  '/js/partner/reviews.js',
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
    if (['/dashboard', '/login', '/register', '/onboarding', '/receipt', '/dashboard.html', '/login.html'].includes(path)) {
      const cachePath = path.endsWith('.html') ? path.slice(0, -5) : path;
      e.respondWith(fetch(e.request).then(response => {
        if (response.ok && response.type === 'basic') {
          caches.open(CACHE).then(cache => cache.put(cachePath, response.clone()));
        }
        return response;
      }).catch(async () => (await caches.match(cachePath)) || (await caches.match('/login'))));
    } else {
      e.respondWith(fetch(e.request).catch(() => caches.match('/login')));
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

// ── Web Push: show booking/review alerts even when no Portal tab is open ─────
// Payload (from the send-web-push edge function): { title, body, url, tag, system }
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const tag = typeof data.tag === 'string' ? data.tag : undefined;
  e.waitUntil(self.registration.showNotification(data.title || 'FUFU Partner', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: Boolean(tag),
    data: { url: typeof data.url === 'string' ? data.url : '/dashboard' },
  }));
});

// Focus an open Portal tab (and let it switch page) or open a new one. Same-origin URLs only.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let target = new URL('/dashboard', self.location.origin);
  try {
    const url = new URL(e.notification.data?.url || '/dashboard', self.location.origin);
    if (url.origin === self.location.origin) target = url;
  } catch { /* keep /dashboard */ }
  e.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = tabs.find(c => new URL(c.url).pathname === target.pathname);
    if (open) {
      await open.focus();
      open.postMessage({ type: 'fufu-push-open', url: target.pathname + target.search });
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
