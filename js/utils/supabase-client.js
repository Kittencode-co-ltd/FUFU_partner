/**
 * FUFU Partner – Supabase Client Utilities
 * Provides helpers for direct Supabase REST API access.
 * Note: Most operations go through api.js backend,
 * this is for optional direct-connect mode.
 * @module supabase-client
 */

import { getSupabaseConfig, STORAGE_KEYS } from './config.js';

/**
 * Fetch data from Supabase REST API directly.
 * Returns null if token is missing or request fails.
 * @param {string} table - Table name
 * @param {Object} filters - Key-value filter pairs (column: value)
 * @returns {Promise<Array|null>}
 */
export async function fetchFromSupabase(table, filters = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return null;

  const { url, key } = getSupabaseConfig();
  if (!url || url.includes('YOUR_PROJECT')) return null;

  try {
    let endpoint = `${url}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k, v]) => {
      endpoint += `&${k}=eq.${v}`;
    });

    const res = await fetch(endpoint, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn(`[Supabase] Failed to fetch ${table}:`, res.status);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error(`[Supabase] Error fetching ${table}:`, e);
    return null;
  }
}

/**
 * Make an authenticated request to the Express.js backend API.
 * @param {string} path - API path (e.g. '/api/my-stores')
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Object|null>}
 */
export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const { API_BASE } = await import('./config.js');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
    return await res.json();
  } catch (e) {
    console.error(`[API] Error calling ${path}:`, e);
    return null;
  }
}

/**
 * Insert data to Supabase REST API directly.
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @returns {Promise<Object|null>}
 */
export async function insertToSupabase(table, data) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return null;

  const { url, key } = getSupabaseConfig();
  if (!url || url.includes('YOUR_PROJECT')) return null;

  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      console.warn(`[Supabase] Failed to insert to ${table}:`, res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error(`[Supabase] Error inserting to ${table}:`, e);
    return null;
  }
}

/**
 * Update data in Supabase REST API directly.
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} filters - Key-value filter pairs (e.g. { id: 123 })
 * @returns {Promise<Object|null>}
 */
export async function updateInSupabase(table, data, filters = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return null;

  const { url, key } = getSupabaseConfig();
  if (!url || url.includes('YOUR_PROJECT')) return null;

  try {
    let endpoint = `${url}/rest/v1/${table}`;
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      queryParams.append(k, `eq.${v}`);
    });
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      console.warn(`[Supabase] Failed to update ${table}:`, res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error(`[Supabase] Error updating ${table}:`, e);
    return null;
  }
}

/**
 * Delete data from Supabase REST API directly.
 * @param {string} table - Table name
 * @param {Object} filters - Key-value filter pairs (e.g. { id: 123 })
 * @returns {Promise<boolean>}
 */
export async function deleteFromSupabase(table, filters = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return false;

  const { url, key } = getSupabaseConfig();
  if (!url || url.includes('YOUR_PROJECT')) return false;

  try {
    let endpoint = `${url}/rest/v1/${table}`;
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      queryParams.append(k, `eq.${v}`);
    });
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }

    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.warn(`[Supabase] Failed to delete from ${table}:`, res.status, await res.text());
      return false;
    }

    return true;
  } catch (e) {
    console.error(`[Supabase] Error deleting from ${table}:`, e);
    return false;
  }
}
