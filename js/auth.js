/**
 * FUFU Partner – Authentication Module
 * Login, logout, store selection, and auth guard.
 * @module auth
 */

import { API_BASE, STORAGE_KEYS } from './utils/config.js';
import { showToast } from './utils/notifications.js';

// ===== AUTH GUARD =====

/**
 * Check if the current user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  return token && token !== 'demo_token';
}

/**
 * Protect a page — redirect unauthenticated users to login.
 * Supports ?redirect= query parameter to return after login.
 * Call this at the top of protected page initializers.
 * @param {string} currentPage - The current page path for redirect
 */
export function requireAuth(currentPage = 'dashboard.html') {
  if (!isAuthenticated()) {
    const redirectUrl = encodeURIComponent(currentPage);
    window.location.href = `login.html?redirect=${redirectUrl}`;
    return false;
  }
  return true;
}

/**
 * Get the redirect URL from query params (after login).
 * @returns {string} - Defaults to 'dashboard.html'
 */
export function getRedirectUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('redirect') || 'dashboard.html';
}

/**
 * Get the current user from localStorage.
 * @returns {Object}
 */
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  } catch {
    return {};
  }
}

/**
 * Get the current partner role.
 * @returns {string} - 'vet', 'shop', 'service', or 'admin'
 */
export function getCurrentRole() {
  return localStorage.getItem(STORAGE_KEYS.ROLE) || 'vet';
}

// ===== LOGIN =====

/**
 * Perform login via the backend API.
 * On success, shows store selection or redirects directly.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} - { success, stores, token, user, error }
 */
export async function doLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const data = await res.json();

    if (data.success && data.token) {
      return {
        success: true,
        token: data.token,
        user: data.user,
        stores: data.stores || [],
      };
    } else {
      return {
        success: false,
        error: data.error || 'เข้าสู่ระบบไม่สำเร็จ',
      };
    }
  } catch (e) {
    console.error('[Auth] Login error:', e);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
    };
  }
}

// ===== STORE SELECTION =====

/**
 * Map store category to display role for dashboard.
 * @param {string} category
 * @returns {string}
 */
export function categoryToRole(category) {
  if (category === 'vet_clinic') return 'vet';
  if (category === 'pet_grooming' || category === 'pet_hotel') return 'service';
  return 'shop';
}

/**
 * Map store category to Thai display name.
 * @param {string} category
 * @returns {string}
 */
export function categoryToLabel(category) {
  const labels = {
    vet_clinic: 'คลินิกสัตว์แพทย์',
    pet_shop: 'ร้านค้าสัตว์เลี้ยง',
    pet_hotel: 'โรงแรมสัตว์เลี้ยง',
    pet_grooming: 'บริการอาบน้ำตัดขน',
  };
  return labels[category] || 'ร้านค้าสัตว์เลี้ยง';
}

/**
 * Get the icon HTML for a store category.
 * @param {string} category
 * @returns {string} - HTML string
 */
export function getCategoryIcon(category) {
  const icons = {
    vet_clinic: '<div class="store-icon fi-vet"><i class="fas fa-stethoscope"></i></div>',
    pet_shop: '<div class="store-icon fi-shop"><i class="fas fa-store"></i></div>',
    pet_hotel: '<div class="store-icon fi-hotel"><i class="fas fa-bed"></i></div>',
    pet_grooming: '<div class="store-icon fi-groom"><i class="fas fa-cut"></i></div>',
  };
  return icons[category] || '<div class="store-icon fi-shop"><i class="fas fa-paw"></i></div>';
}

/**
 * Save selected store to localStorage and redirect to dashboard.
 * @param {string} storeId
 * @param {string} category
 * @param {string} token
 * @param {string} userEmail
 */
export function selectStore(storeId, category, token, userEmail) {
  const fufuRole = categoryToRole(category);

  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.ROLE, fufuRole);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ email: userEmail, id: 'login' }));
  localStorage.setItem(STORAGE_KEYS.STORE_ID, storeId);
  localStorage.setItem(STORAGE_KEYS.STORE_CATEGORY, category);

  // Redirect to the original intended page or dashboard
  const redirectUrl = getRedirectUrl();
  window.location.href = redirectUrl;
}

/**
 * Render the store selection UI into the store list container.
 * Called after successful login when multiple stores exist.
 * @param {Array} stores
 * @param {string} token
 * @param {Object} user
 */
export function renderStoreSelection(stores, token, user) {
  if (!stores || stores.length === 0) {
    showToast('คุณยังไม่ได้ลงทะเบียนร้านค้าใดๆ', 'error');
    return;
  }

  // Hide login card, show store card
  const loginCard = document.getElementById('loginCard');
  const storeCard = document.getElementById('storeCard');
  if (loginCard) loginCard.style.display = 'none';
  if (storeCard) storeCard.style.display = 'block';

  const storeList = document.getElementById('storeList');
  if (!storeList) return;

  storeList.innerHTML = stores.map(store => {
    const iconHtml = getCategoryIcon(store.category);
    const catDisplay = categoryToLabel(store.category);

    return `
      <div class="store-item" data-store-id="${store.id}" data-category="${store.category}">
        ${iconHtml}
        <div class="store-details">
          <div class="store-name">${store.name || 'ไม่ได้ตั้งชื่อร้าน'}</div>
          <div class="store-category">${catDisplay}</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:12px;"></i>
      </div>
    `;
  }).join('');

  // Attach click handlers using event delegation
  storeList.addEventListener('click', (e) => {
    const storeItem = e.target.closest('.store-item');
    if (!storeItem) return;
    
    const storeId = storeItem.dataset.storeId;
    const category = storeItem.dataset.category;
    selectStore(storeId, category, token, user.email);
  });
}

// ===== LOGOUT =====

/**
 * Clear all auth state and redirect to landing/login page.
 * @param {string} redirectTo - Page to redirect to after logout
 */
export function logout(redirectTo = 'index.html') {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ROLE);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.STORE_ID);
  localStorage.removeItem(STORAGE_KEYS.STORE_CATEGORY);
  window.location.href = redirectTo;
}
