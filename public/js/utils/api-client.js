import { API_BASE, STORAGE_KEYS } from './config.js';

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Bearer token and handles 401 redirect.
 * @param {string} path - e.g. '/api/auth/login'
 * @param {RequestInit} options
 * @returns {Promise<any>} parsed JSON
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — clear state and redirect
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    window.location.href = '/login.html';
    return null;
  }

  return res.json();
}
