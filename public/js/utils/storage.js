import { STORAGE_KEYS } from './config.js';

export const storage = {
  get(key)        { return localStorage.getItem(key); },
  set(key, value) { localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value); },
  remove(key)     { localStorage.removeItem(key); },
  getJSON(key)    { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },

  isAuthenticated() {
    const token = this.get(STORAGE_KEYS.TOKEN);
    return !!token && token !== 'demo_token';
  },

  saveSession({ token, refresh_token, user, store }) {
    this.set(STORAGE_KEYS.TOKEN,         token);
    this.set(STORAGE_KEYS.REFRESH_TOKEN, refresh_token || '');
    this.set(STORAGE_KEYS.USER,          user);
    if (store) this.saveStore(store);
  },

  saveStore({ id, name, category }) {
    const { CATEGORY_MAP } = window.__fufu_config__ || {};
    this.set(STORAGE_KEYS.STORE_ID,       id);
    this.set(STORAGE_KEYS.STORE_NAME,     name);
    this.set(STORAGE_KEYS.STORE_CATEGORY, category);
    this.set(STORAGE_KEYS.ROLE,           CATEGORY_MAP?.[category]?.role || 'vet');
  },

  clearSession() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    // Clear extra keys not tracked in STORAGE_KEYS
    ['fufu_mode', 'fufu_staff_roles', 'fufu_staff_name', 'fufu_staff_permissions', 'fufu_sidebar'].forEach(k => localStorage.removeItem(k));
  },
};
