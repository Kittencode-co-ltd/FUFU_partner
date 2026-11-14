import { apiFetch }                  from './utils/api-client.js';
import { storage }                    from './utils/storage.js';
import { showToast }                  from './utils/toast.js';
import { STORAGE_KEYS, CATEGORY_MAP, REMEMBER_EMAIL_KEY } from './utils/config.js';

// ─── Guards ───────────────────────────────────────────────────────────────────

export function isAuthenticated() {
  return storage.isAuthenticated();
}

/** Redirect to login if not authenticated. Returns false if redirected. */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`;
    return false;
  }
  return true;
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticate with email + password.
 * @returns {{ success: boolean, stores?: [], error?: string }}
 */
export async function doLogin(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!data) return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
  if (!data.success) {
    const waitSeconds = Number(data.retry_after_seconds);
    const attemptsRemaining = Number.isFinite(Number(data.attempts_remaining))
      ? Number(data.attempts_remaining)
      : null;
    const waitLabel = waitSeconds > 0
      ? ` ลองใหม่ใน ${Math.floor(waitSeconds / 60) ? `${Math.floor(waitSeconds / 60)} นาที ` : ''}${waitSeconds % 60} วินาที`
      : attemptsRemaining !== null
        ? ` (เหลืออีก ${attemptsRemaining} ครั้งก่อนพักชั่วคราว)`
        : '';
    return { success: false, error: `${data.error || 'เข้าสู่ระบบไม่สำเร็จ'}${waitLabel}` };
  }

  // Save session (without store yet — user picks store next)
  storage.set(STORAGE_KEYS.TOKEN,          data.token);
  storage.set(STORAGE_KEYS.REFRESH_TOKEN,  data.refresh_token || '');
  storage.set(STORAGE_KEYS.USER,           JSON.stringify(data.user));
  // Cache the full list of accessible stores (owned + staff) so the sidebar
  // store-switcher can show all branches without a separate API call that would
  // only return owned stores.
  if (data.stores?.length) {
    storage.set(STORAGE_KEYS.STORES_LIST, JSON.stringify(data.stores));
  }

  return { success: true, stores: data.stores, token: data.token, user: data.user };
}

// ─── Store selection ──────────────────────────────────────────────────────────

/**
 * Save selected store and navigate to dashboard.
 * @param {{ id: string, name: string, category: string }} store
 */
export function selectStore(store) {
  const catInfo = CATEGORY_MAP[store.category] || {};
  storage.set(STORAGE_KEYS.STORE_ID,       store.id);
  storage.set(STORAGE_KEYS.STORE_NAME,     store.name);
  storage.set(STORAGE_KEYS.STORE_CATEGORY, store.category);
  storage.set(STORAGE_KEYS.ROLE,           catInfo.role || 'vet');
  storage.set(STORAGE_KEYS.STORE_ACTIVE, store.is_active !== false ? 'true' : 'false');

  // Clear per-store staff role — initDashboard will re-fetch from /api/staff/me
  storage.remove(STORAGE_KEYS.STAFF_ROLE);
  localStorage.removeItem('fufu_staff_roles');

  const redirect = new URLSearchParams(location.search).get('redirect') || '/dashboard';
  window.location.href = redirect;
}

/**
 * Render store selection cards into a container element.
 * @param {HTMLElement} container
 * @param {Array} stores
 */
export function renderStoreList(container, stores) {
  if (!stores?.length) {
    container.innerHTML = `
      <p class="text-slate-500 text-sm text-center py-6 font-body">
        ยังไม่มีร้านค้าในบัญชีนี้
      </p>`;
    return;
  }

  container.innerHTML = stores.map(store => {
    const cat = CATEGORY_MAP[store.category] || { label: store.category, emoji: '🏪' };
    return `
      <button
        class="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-slate-100
               hover:border-primary hover:bg-primary-subtle transition-all duration-200 text-left group"
        data-store-id="${store.id}"
        data-store-name="${encodeURIComponent(store.name)}"
        data-store-category="${store.category}"
        data-store-active="${store.is_active !== false}"
      >
        <span class="text-2xl w-12 h-12 flex items-center justify-center bg-slate-50
                     rounded-xl group-hover:bg-white transition-colors">${cat.emoji}</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-navy truncate">${store.name}</div>
          <div class="text-xs text-slate-500 font-body mt-0.5">
            ${cat.label}${store.is_active === false ? ' · <span class="text-red-600 font-semibold">ถูกระงับ</span>' : ''}${store.is_staff ? ` · <span class="text-primary">พนักงาน: ${(store.staff_roles||[]).join(', ')}</span>` : ''}
          </div>
        </div>
        <svg class="w-4 h-4 text-slate-400 group-hover:text-primary flex-shrink-0 transition-colors"
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>`;
  }).join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-store-id]');
    if (!btn) return;
    selectStore({
      id:       btn.dataset.storeId,
      name:     decodeURIComponent(btn.dataset.storeName),
      category: btn.dataset.storeCategory,
      is_active: btn.dataset.storeActive !== 'false',
    });
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function logout() {
  storage.clearSession();
  window.location.href = '/login';
}

// ─── Getters ──────────────────────────────────────────────────────────────────

export function getCurrentUser()  { return storage.getJSON(STORAGE_KEYS.USER) || {}; }
export function getCurrentRole()  { return storage.get(STORAGE_KEYS.ROLE) || 'vet'; }
export function getCurrentStore() {
  return {
    id:       storage.get(STORAGE_KEYS.STORE_ID),
    name:     storage.get(STORAGE_KEYS.STORE_NAME),
    category: storage.get(STORAGE_KEYS.STORE_CATEGORY),
  };
}
