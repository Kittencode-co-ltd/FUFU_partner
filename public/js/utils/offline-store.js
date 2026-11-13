import Dexie from '/js/vendor/dexie.mjs';
import { storage } from './storage.js';
import { STORAGE_KEYS } from './config.js';

const db = new Dexie('fufu_offline');

db.version(1).stores({
  api_cache:  'url, cached_at',
  sync_queue: '++id, url, method, status, created_at',
});

const CACHE_PATTERNS = [
  '/api/queue',
  '/api/medical-records',
  '/api/pets',
  '/api/inventory',
  '/api/appointments',
  '/api/finance/summary',
  '/api/staff',
];

// Money and receipt actions must never be queued for later replay
const BLOCK_OFFLINE = ['/api/pos/checkout', '/api/cashier'];

export function shouldCacheGet(path) {
  return CACHE_PATTERNS.some(p => path.startsWith(p));
}

export function isBlockedOffline(path) {
  return BLOCK_OFFLINE.some(p => path.startsWith(p));
}

export function dispatchSyncStatus(pending) {
  document.dispatchEvent(new CustomEvent('fufu:sync-status', { detail: { pending } }));
}

export async function cacheResponse(url, data) {
  await db.api_cache.put({ url, data, cached_at: Date.now() });
}

export async function readFromCache(url) {
  const row = await db.api_cache.get(url);
  if (!row) return null;
  return { ...row.data, _cached: true, _cached_at: row.cached_at };
}

export async function enqueueSync(url, method, body) {
  await db.sync_queue.add({
    url,
    method,
    body: body != null ? body : null,
    status: 'pending',
    created_at: Date.now(),
  });
  return db.sync_queue.where('status').equals('pending').count();
}

export async function getPendingCount() {
  return db.sync_queue.where('status').equals('pending').count();
}

export async function flushSyncQueue() {
  const pending = await db.sync_queue.where('status').equals('pending').sortBy('created_at');
  if (!pending.length) return { synced: 0, failed: 0 };

  const token = storage.get(STORAGE_KEYS.TOKEN);
  let synced = 0, failed = 0;

  for (const item of pending) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(item.body != null ? { body: item.body } : {}),
      });

      if (res.ok) {
        await db.sync_queue.delete(item.id);
        synced++;
      } else {
        await db.sync_queue.update(item.id, { status: 'failed' });
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export { db };
