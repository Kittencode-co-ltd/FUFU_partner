/**
 * FUFU Partner – Central Configuration
 * API endpoints, environment config, and constants.
 * @module config
 */

/** Base URL for the backend API (Express.js proxy to Supabase) */
export const API_BASE = window.location.hostname === 'localhost'
  ? `http://localhost:${window.location.port || 3000}`
  : window.location.origin;

/** Supabase direct REST config (from localStorage or defaults) */
export function getSupabaseConfig() {
  return {
    url: localStorage.getItem('fufu_supa_url') || 'https://YOUR_PROJECT.supabase.co',
    key: localStorage.getItem('fufu_supa_key') || 'YOUR_ANON_KEY',
  };
}

/** Save Supabase config to localStorage */
export function saveSupabaseConfig(url, key, partnerId) {
  if (url) localStorage.setItem('fufu_supa_url', url);
  if (key) localStorage.setItem('fufu_supa_key', key);
  if (partnerId) localStorage.setItem('fufu_partner_id', partnerId);
}

/** Auth token keys in localStorage */
export const STORAGE_KEYS = {
  TOKEN: 'fufu_token',
  ROLE: 'fufu_role',
  USER: 'fufu_user',
  STORE_ID: 'selected_store_id',
  STORE_CATEGORY: 'selected_store_category',
  SUPA_URL: 'fufu_supa_url',
  SUPA_KEY: 'fufu_supa_key',
  PARTNER_ID: 'fufu_partner_id',
  // Pet Owner specific keys
  PET_OWNER_ID: 'fufu_public_owner_id',
  PET_OWNER_DATA: 'fufu_public_owner_data',
};

/** Application version */
export const APP_VERSION = 'v0.2';

/** Commission rate (GP) */
export const COMMISSION_RATE = 0.05;

/**
 * Feature Flags for gradual rollout
 * Used to toggle experimental or new features
 */
export const FEATURE_FLAGS = {
  // Phase 1: Public Flow
  ENABLE_PET_OWNER_PORTAL: true,
  // Phase 2: Partner Core
  ENABLE_RBAC: true,
  ENABLE_CALENDAR_VIEW: false, // Turn off until fully implemented
  ENABLE_TV_MODE: true,
  // Phase 3: Advanced Modules
  ENABLE_MEDICAL_MODULE: true,
  ENABLE_HOTEL_MODULE: true,
  ENABLE_INVENTORY_ALERTS: true,
  ENABLE_FINANCE_EXPORT: true,
  ENABLE_PROMPTPAY: false,
};
