/**
 * FUFU Public – Pet Owner Auth Module (Mock)
 * LocalStorage-based mock authentication for public portal.
 * @module landing/pet-owner-auth
 * 
 * Acceptance Criteria:
 * - [x] Provides login/logout functions using localStorage.
 * - [x] Checks if pet owner is authenticated.
 * - [x] Returns demo user data.
 */

import { STORAGE_KEYS, FEATURE_FLAGS } from '../utils/config.js';
import { showToast } from '../utils/notifications.js';

// Demo Pet Owner Data
const DEMO_OWNER = {
  id: 'owner_123',
  name: 'สมชาย ใฝ่รักสัตว์',
  email: 'somchai.pet@example.com',
  phone: '0891234567',
  pets: [
    { id: 'pet_1', name: 'บัดดี้', type: 'dog', breed: 'Golden Retriever', age: '3 ปี' },
    { id: 'pet_2', name: 'เหมียวรี่', type: 'cat', breed: 'แมวไทย', age: '2 ปี' }
  ]
};

/**
 * Check if the pet owner is authenticated.
 * @returns {boolean}
 */
export function isOwnerAuthenticated() {
  if (!FEATURE_FLAGS.ENABLE_PET_OWNER_PORTAL) return false;
  return !!localStorage.getItem(STORAGE_KEYS.PET_OWNER_ID);
}

/**
 * Get current authenticated pet owner data.
 * @returns {Object|null}
 */
export function getOwnerData() {
  const dataStr = localStorage.getItem(STORAGE_KEYS.PET_OWNER_DATA);
  if (dataStr) {
    try {
      return JSON.parse(dataStr);
    } catch(e) {
      return null;
    }
  }
  return null;
}

/**
 * Simulate pet owner login.
 */
export function loginOwner() {
  if (!FEATURE_FLAGS.ENABLE_PET_OWNER_PORTAL) return;
  
  localStorage.setItem(STORAGE_KEYS.PET_OWNER_ID, DEMO_OWNER.id);
  localStorage.setItem(STORAGE_KEYS.PET_OWNER_DATA, JSON.stringify(DEMO_OWNER));
  
  showToast('เข้าสู่ระบบสำหรับเจ้าของสัตว์เลี้ยงสำเร็จ!');
  updateOwnerNav();
}

/**
 * Simulate pet owner logout.
 */
export function logoutOwner() {
  localStorage.removeItem(STORAGE_KEYS.PET_OWNER_ID);
  localStorage.removeItem(STORAGE_KEYS.PET_OWNER_DATA);
  
  showToast('ออกจากระบบเรียบร้อยแล้ว');
  updateOwnerNav();
}

/**
 * Update the navigation bar based on auth state.
 */
export function updateOwnerNav() {
  if (!FEATURE_FLAGS.ENABLE_PET_OWNER_PORTAL) return;

  const navItemContainer = document.getElementById('pet-owner-nav-container');
  if (!navItemContainer) return;

  if (isOwnerAuthenticated()) {
    const owner = getOwnerData();
    navItemContainer.innerHTML = `
      <div class="owner-profile-dropdown" style="position:relative; display:inline-block; margin-left: 10px;">
        <button id="owner-profile-btn" class="btn btn-outline" style="border-radius: 50px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-user-circle"></i> ${owner.name.split(' ')[0]}
        </button>
        <div id="owner-dropdown-menu" style="display:none; position:absolute; top:100%; right:0; background:#fff; box-shadow:0 4px 6px rgba(0,0,0,0.1); border-radius:8px; padding:8px; min-width:150px; z-index:100; margin-top:8px;">
          <a href="#" style="display:block; padding:8px; color:var(--text-main); text-decoration:none;"><i class="fas fa-paw" style="margin-right:6px"></i>สัตว์เลี้ยงของฉัน</a>
          <a href="#" style="display:block; padding:8px; color:var(--text-main); text-decoration:none;"><i class="fas fa-history" style="margin-right:6px"></i>ประวัติการจอง</a>
          <div style="border-top:1px solid #eee; margin:4px 0;"></div>
          <a href="#" id="owner-logout-btn" style="display:block; padding:8px; color:#EF4444; text-decoration:none;"><i class="fas fa-sign-out-alt" style="margin-right:6px"></i>ออกจากระบบ</a>
        </div>
      </div>
    `;

    // Dropdown toggle logic
    const profileBtn = navItemContainer.querySelector('#owner-profile-btn');
    const dropdown = navItemContainer.querySelector('#owner-dropdown-menu');
    profileBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Logout logic
    navItemContainer.querySelector('#owner-logout-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      logoutOwner();
    });

  } else {
    navItemContainer.innerHTML = `
      <button id="owner-login-btn" class="btn btn-outline" style="margin-left: 10px; border-radius: 50px;">
        <i class="fas fa-user" style="margin-right:4px"></i> สำหรับเจ้าของสัตว์เลี้ยง
      </button>
    `;
    
    navItemContainer.querySelector('#owner-login-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      loginOwner(); // Directly login with mock data
    });
  }
}
