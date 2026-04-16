/**
 * FUFU Partner – Role-Based Access Control
 * Defines roles, permissions, and utility functions for access control.
 * @module partner/rbac
 * 
 * Acceptance Criteria:
 * - [x] Roles defined: owner, vet, reception, staff, accountant.
 * - [x] Permissions matrix maps actions to roles.
 * - [x] Navigation is dynamically filtered based on role.
 * - [x] Owner can view/manage users.
 */

import { showToast } from '../utils/notifications.js';
import { STORAGE_KEYS, FEATURE_FLAGS } from '../utils/config.js';

// ===== ROLE DEFINITIONS =====

/**
 * Available staff roles within a partner store.
 * Each role has a Thai label, icon, color, and description.
 */
export const ROLES = {
  owner: {
    key: 'owner', label: 'เจ้าของ (Owner)',
    icon: 'fa-crown', color: '#D4AF37',
    desc: 'เข้าถึงได้ทุกส่วน รวมถึงจัดการพนักงานและการเงิน',
  },
  vet: {
    key: 'vet', label: 'สัตว์แพทย์ (Vet)',
    icon: 'fa-user-doctor', color: '#0D9488',
    desc: 'จัดการเวชระเบียน คิวนัดหมาย บันทึกการรักษา',
  },
  reception: {
    key: 'reception', label: 'พนักงานต้อนรับ (Reception)',
    icon: 'fa-headset', color: '#3B82F6',
    desc: 'จัดการคิว นัดหมาย และรับชำระเงิน',
  },
  staff: {
    key: 'staff', label: 'พนักงาน (Staff)',
    icon: 'fa-user', color: '#8B5CF6',
    desc: 'ดูข้อมูลทั่วไป จัดการสินค้าคง warehouse',
  },
  accountant: {
    key: 'accountant', label: 'บัญชี (Accountant)',
    icon: 'fa-calculator', color: '#F59E0B',
    desc: 'จัดการรายรับ-รายจ่าย ออกใบกำกับภาษี',
  },
};

// ===== PERMISSION MATRIX =====

/**
 * Permissions mapped to roles.
 * true = allowed, false/undefined = denied.
 */
const PERMISSIONS = {
  // Page access
  'page:dashboard':     { owner: true, vet: true, reception: true, staff: true, accountant: true },
  'page:queue':         { owner: true, vet: true, reception: true, staff: false, accountant: false },
  'page:records':       { owner: true, vet: true, reception: false, staff: false, accountant: false },
  'page:income':        { owner: true, vet: false, reception: false, staff: false, accountant: true },
  'page:products':      { owner: true, vet: true, reception: true, staff: true, accountant: false },
  'page:rooms':         { owner: true, vet: false, reception: true, staff: true, accountant: false },
  'page:users':         { owner: true, vet: false, reception: false, staff: false, accountant: false },
  'page:settings':      { owner: true, vet: false, reception: false, staff: false, accountant: false },
  'page:overview':      { owner: true, vet: false, reception: false, staff: false, accountant: true },

  // Actions
  'action:create_appointment': { owner: true, vet: true, reception: true, staff: false, accountant: false },
  'action:update_appointment': { owner: true, vet: true, reception: true, staff: false, accountant: false },
  'action:delete_appointment': { owner: true, vet: false, reception: false, staff: false, accountant: false },
  'action:create_record':      { owner: true, vet: true, reception: false, staff: false, accountant: false },
  'action:manage_product':     { owner: true, vet: false, reception: false, staff: true, accountant: false },
  'action:manage_finance':     { owner: true, vet: false, reception: false, staff: false, accountant: true },
  'action:issue_invoice':      { owner: true, vet: false, reception: true, staff: false, accountant: true },
  'action:manage_users':       { owner: true, vet: false, reception: false, staff: false, accountant: false },
  'action:manage_settings':    { owner: true, vet: false, reception: false, staff: false, accountant: false },
  'action:export_data':        { owner: true, vet: false, reception: false, staff: false, accountant: true },
  'action:view_salary':        { owner: true, vet: false, reception: false, staff: false, accountant: true },
};

// ===== HELPERS =====

/**
 * Get current staff role within the store (distinct from store category).
 * Falls back to 'owner' for backwards compatibility.
 * @returns {string} Role key
 */
export function getStaffRole() {
  return localStorage.getItem('fufu_staff_role') || 'owner';
}

/**
 * Set the current staff role.
 * @param {string} role
 */
export function setStaffRole(role) {
  localStorage.setItem('fufu_staff_role', role);
}

/**
 * Check if the current user (staff role) has a specific permission.
 * @param {string} permission - Permission key (e.g. 'page:queue')
 * @param {string} [role] - Override role (defaults to current)
 * @returns {boolean}
 */
export function hasPermission(permission, role) {
  if (!FEATURE_FLAGS.ENABLE_RBAC) return true;
  const r = role || getStaffRole();
  return PERMISSIONS[permission]?.[r] === true;
}

/**
 * Filter nav items based on current staff role permissions.
 * @param {Array} navSections - Array of { section, items[] } from navConfig
 * @returns {Array} Filtered nav sections
 */
export function filterNavByRole(navSections) {
  if (!FEATURE_FLAGS.ENABLE_RBAC) return navSections;

  const staffRole = getStaffRole();

  return navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const perm = `page:${item.id}`;
        // If no permission defined, allow by default
        return PERMISSIONS[perm] ? PERMISSIONS[perm][staffRole] === true : true;
      }),
    }))
    .filter(section => section.items.length > 0);
}

/**
 * Add users nav item to nav config for Owner role.
 * @param {Array} navSections
 * @returns {Array}
 */
export function injectRBACNav(navSections) {
  const staffRole = getStaffRole();
  if (staffRole !== 'owner') return navSections;

  // Find the management section and add users
  const managementSection = navSections.find(s =>
    s.section === 'จัดการ' || s.section === 'ภาพรวม'
  );

  if (managementSection && !managementSection.items.find(i => i.id === 'users')) {
    managementSection.items.splice(managementSection.items.length - 1, 0, {
      id: 'users', icon: 'fa-users-gear', label: 'จัดการพนักงาน',
    });
  }

  return navSections;
}

// ===== USER MANAGEMENT =====

/**
 * Get mock staff users for the current store.
 * @returns {Array}
 */
function getMockUsers() {
  // TODO: Replace with Supabase query: SELECT * FROM staff WHERE store_id = ?
  return [
    { id: 'u1', name: 'ดร.สมชาย วงศ์ดี', email: 'somchai@clinic.com', role: 'vet', status: 'active', lastLogin: '2026-04-16' },
    { id: 'u2', name: 'คุณณัฐพล จงดี', email: 'natthapon@clinic.com', role: 'reception', status: 'active', lastLogin: '2026-04-15' },
    { id: 'u3', name: 'คุณสุดา มีสุข', email: 'suda@clinic.com', role: 'staff', status: 'active', lastLogin: '2026-04-14' },
    { id: 'u4', name: 'คุณวิไล บัญชี', email: 'wilai@clinic.com', role: 'accountant', status: 'active', lastLogin: '2026-04-10' },
    { id: 'u5', name: 'คุณประจวบ ยุทธ', email: 'prachuab@clinic.com', role: 'staff', status: 'inactive', lastLogin: '2026-03-20' },
  ];
}

/**
 * Render the user management page content.
 * @param {HTMLElement} container - The #page-users element
 */
export function renderUserManagement(container) {
  if (!container) return;

  const users = getMockUsers();
  const staffRole = getStaffRole();

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">👥 จัดการพนักงาน (User Management)</div>
        ${staffRole === 'owner' ? '<button class="btn-sm btn-primary" id="invite-user-btn"><i class="fas fa-plus" style="margin-right:4px"></i>เชิญพนักงาน</button>' : ''}
      </div>

      <!-- Role filter -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="filter-chip active" data-role-filter="all" style="padding:6px 14px;border:1px solid rgba(203,213,225,0.5);border-radius:8px;background:#fff;cursor:pointer;font-family:'Prompt',sans-serif;font-size:12px">ทั้งหมด (${users.length})</button>
        ${Object.values(ROLES).map(r =>
          `<button class="filter-chip" data-role-filter="${r.key}" style="padding:6px 14px;border:1px solid rgba(203,213,225,0.5);border-radius:8px;background:#fff;cursor:pointer;font-family:'Prompt',sans-serif;font-size:12px">
            <i class="fas ${r.icon}" style="color:${r.color};margin-right:4px"></i>${r.label.split('(')[0].trim()}</button>`
        ).join('')}
      </div>

      <table class="data-table" id="users-table">
        <thead>
          <tr>
            <th>พนักงาน</th>
            <th>บทบาท</th>
            <th>สถานะ</th>
            <th>เข้าใช้ล่าสุด</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          ${users.map(u => {
            const roleInfo = ROLES[u.role] || ROLES.staff;
            return `
              <tr data-user-role="${u.role}">
                <td>
                  <div style="font-weight:500">${u.name}</div>
                  <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">${u.email}</div>
                </td>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:500;background:${roleInfo.color}15;color:${roleInfo.color}">
                    <i class="fas ${roleInfo.icon}" style="font-size:11px"></i>
                    ${roleInfo.label.split('(')[0].trim()}
                  </span>
                </td>
                <td>
                  <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-neutral'}">${u.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span>
                </td>
                <td style="font-family:'Sarabun',sans-serif;font-size:13px;color:var(--text-muted)">${u.lastLogin}</td>
                <td>
                  <button class="btn-sm btn-outline" data-action="edit-role" data-user-id="${u.id}" style="font-size:11px;margin-right:4px" title="เปลี่ยนบทบาท">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="btn-sm btn-outline" data-action="toggle-status" data-user-id="${u.id}" style="font-size:11px;margin-right:4px" title="${u.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'}">
                    <i class="fas ${u.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                  </button>
                  <button class="btn-sm btn-outline" data-action="reset-password" data-user-id="${u.id}" style="font-size:11px" title="รีเซ็ตรหัสผ่าน">
                    <i class="fas fa-key"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Role legend card -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">📋 สิทธิ์การใช้งานตามบทบาท</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${Object.values(ROLES).map(r => `
          <div style="padding:14px;border-radius:12px;border:1px solid rgba(203,213,225,0.3);background:${r.color}08">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <i class="fas ${r.icon}" style="color:${r.color};font-size:14px"></i>
              <span style="font-weight:600;font-size:13px">${r.label}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif;line-height:1.5">${r.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event handlers
  const inviteBtn = container.querySelector('#invite-user-btn');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', () => {
      showToast('ส่งคำเชิญทางอีเมลสำเร็จ (Demo)', 'info');
    });
  }

  // Role filter
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('active');
        c.style.background = '#fff';
      });
      chip.classList.add('active');
      chip.style.background = 'var(--primary-light, #CCFBF1)';

      const filter = chip.dataset.roleFilter;
      container.querySelectorAll('#users-tbody tr').forEach(row => {
        row.style.display = (filter === 'all' || row.dataset.userRole === filter) ? '' : 'none';
      });
    });
  });

  // Action buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'edit-role') showToast('เปิดฟอร์มเปลี่ยนบทบาท (Demo)', 'info');
      else if (action === 'toggle-status') showToast('เปลี่ยนสถานะสำเร็จ (Demo)');
      else if (action === 'reset-password') showToast('ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว (Demo)');
    });
  });
}
