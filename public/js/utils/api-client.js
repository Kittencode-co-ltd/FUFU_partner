import { API_BASE, STORAGE_KEYS } from './config.js';
import { storage } from './storage.js';
import {
  shouldCacheGet, isBlockedOffline,
  cacheResponse, readFromCache, enqueueSync, dispatchSyncStatus,
} from './offline-store.js';

let _refreshing = null;

async function _tryRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success || !data.token) return false;
      storage.set(STORAGE_KEYS.TOKEN, data.token);
      if (data.refresh_token) storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { _refreshing = null; });
  return _refreshing;
}

function _clearSession() {
  storage.clearSession();
  window.location.href = '/login.html';
}

async function _fetchOnce(path, options) {
  const token = storage.get(STORAGE_KEYS.TOKEN);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/**
 * Authenticated fetch wrapper.
 * - Online  GET:  network → cache result → return data
 * - Online  POST/PATCH/DELETE: network → return data
 * - Offline GET:  serve from IndexedDB cache (or null if never cached)
 * - Offline POST/PATCH/DELETE: queue in sync_queue → return { success, queued }
 * - Offline payment paths: always blocked
 */
export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // ── Offline path ────────────────────────────────────────────────────────────
  if (!navigator.onLine) {
    if (isBlockedOffline(path)) {
      return { success: false, offline: true, error: 'ต้องออนไลน์เพื่อดำเนินการนี้' };
    }
    if (method === 'GET') {
      const cached = await readFromCache(`${API_BASE}${path}`);
      if (cached) return cached;
      return { success: false, offline: true, error: 'ไม่มีข้อมูล offline — กรุณาเชื่อมต่ออินเทอร์เน็ต' };
    }
    // Queue the mutation for later replay
    const count = await enqueueSync(`${API_BASE}${path}`, method, options.body ?? null);
    dispatchSyncStatus(count);
    return { success: true, offline: true, queued: true };
  }

  // ── Online path ─────────────────────────────────────────────────────────────
  let res;
  try {
    res = await _fetchOnce(path, options);
  } catch {
    // Network error while nominally online (flaky connection)
    if (method === 'GET') {
      const cached = await readFromCache(`${API_BASE}${path}`);
      if (cached) return cached;
    }
    return null;
  }

  // Token refresh on 401
  // Invalid credentials from the login endpoint are a normal form error. Do not
  // treat them as an expired session and redirect away from the login page.
  if (res.status === 401 && path !== '/api/auth/login') {
    const refreshed = await _tryRefresh();
    if (!refreshed) { _clearSession(); return null; }
    try { res = await _fetchOnce(path, options); } catch { return null; }
    if (res.status === 401) { _clearSession(); return null; }
  }

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  const data = await res.json();

  // Cache successful GET responses for offline use
  if (method === 'GET' && data?.success && shouldCacheGet(path)) {
    cacheResponse(`${API_BASE}${path}`, data).catch(() => {});
  }

  return data;
}
