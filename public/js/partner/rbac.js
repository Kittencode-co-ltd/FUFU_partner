import { showToast }  from '../utils/toast.js';
import { STORAGE_KEYS, CATEGORY_MAP } from '../utils/config.js';

export const ROLES = {
  owner:      { key: 'owner',      label: 'เจ้าของ (Owner)',          icon: 'fa-crown',        color: '#D4AF37', desc: 'เข้าถึงได้ทุกส่วน รวมถึงจัดการพนักงานและการเงิน' },
  vet:        { key: 'vet',        label: 'สัตว์แพทย์ (Vet)',         icon: 'fa-user-doctor',  color: '#0D9488', desc: 'จัดการเวชระเบียน คิวนัดหมาย บันทึกการรักษา' },
  reception:  { key: 'reception',  label: 'พนักงานต้อนรับ (Reception)', icon: 'fa-headset',      color: '#3B82F6', desc: 'จัดการคิว นัดหมาย และรับชำระเงิน' },
  staff:      { key: 'staff',      label: 'พนักงาน (Staff)',           icon: 'fa-user',         color: '#8B5CF6', desc: 'ดูข้อมูลทั่วไป จัดการสินค้าคงคลัง' },
  accountant: { key: 'accountant', label: 'บัญชี (Accountant)',        icon: 'fa-calculator',   color: '#F59E0B', desc: 'จัดการรายรับ-รายจ่าย ออกใบกำกับภาษี' },
  counter:    { key: 'counter',    label: 'เคาน์เตอร์ (Counter)',      icon: 'fa-cash-register', color: '#10B981', desc: 'รับคิว Walk-in ชำระเงิน ออกใบเสร็จ' },
};

const PERMISSIONS = {
  'page:queue':    { owner: true, vet: true, reception: true,  staff: false, accountant: false, counter: true  },
  'page:records':  { owner: true, vet: true, reception: false, staff: false, accountant: false, counter: false },
  'page:income':   { owner: true, vet: false, reception: false, staff: false, accountant: true,  counter: false },
  'page:products': { owner: true, vet: true, reception: true,  staff: true,  accountant: false, counter: false },
  'page:users':    { owner: true, vet: false, reception: false, staff: false, accountant: false, counter: false },
  'page:settings': { owner: true, vet: false, reception: false, staff: false, accountant: false, counter: false },
  'action:create_record':   { owner: true, vet: true,  reception: false, staff: false, accountant: false, counter: false },
  'action:manage_finance':  { owner: true, vet: false, reception: false, staff: false, accountant: true,  counter: false },
  'action:issue_invoice':   { owner: true, vet: false, reception: true,  staff: false, accountant: true,  counter: true  },
  'action:manage_users':    { owner: true, vet: false, reception: false, staff: false, accountant: false, counter: false },
  'action:export_data':     { owner: true, vet: false, reception: false, staff: false, accountant: true,  counter: false },
};

export function getStaffRole() {
  // STAFF_ROLE is set by initDashboard after fetching /api/staff/me for the current store.
  // Falls back to store category role (System A) if staff record not yet loaded.
  const staffRole    = localStorage.getItem(STORAGE_KEYS.STAFF_ROLE);
  const categoryRole = localStorage.getItem(STORAGE_KEYS.ROLE);
  return staffRole || categoryRole || 'owner';
}

export function hasPermission(permission, role) {
  const r = role || getStaffRole();
  return PERMISSIONS[permission]?.[r] !== false;
}

export function renderUserManagement(container) {
  if (!container) return;
  const staffRole = getStaffRole();

  const mockUsers = [
    { id: 'u1', name: 'ดร.สมชาย วงศ์ดี',    email: 'somchai@clinic.com',   role: 'vet',        status: 'active',   lastLogin: '2026-04-27' },
    { id: 'u2', name: 'คุณณัฐพล จงดี',      email: 'natthapon@clinic.com', role: 'reception',  status: 'active',   lastLogin: '2026-04-26' },
    { id: 'u3', name: 'คุณสุดา มีสุข',      email: 'suda@clinic.com',      role: 'staff',      status: 'active',   lastLogin: '2026-04-25' },
    { id: 'u4', name: 'คุณวิไล บัญชี',      email: 'wilai@clinic.com',     role: 'accountant', status: 'active',   lastLogin: '2026-04-20' },
    { id: 'u5', name: 'คุณประจวบ ยุทธ',    email: 'prachuab@clinic.com',  role: 'staff',      status: 'inactive', lastLogin: '2026-03-20' },
  ];

  container.innerHTML = `
    <div class="space-y-4 w-full">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy">👥 จัดการพนักงาน</h3>
          ${staffRole === 'owner' ? '<button class="btn-primary text-sm px-4 py-2" id="invite-btn">+ เชิญพนักงาน</button>' : ''}
        </div>
        <div class="flex gap-2 flex-wrap mb-4">
          <button class="filter-chip active text-xs px-3 py-1.5 rounded-lg border border-primary bg-primary/10 text-primary font-semibold" data-role-filter="all">ทั้งหมด (${mockUsers.length})</button>
          ${Object.values(ROLES).map(r => `
            <button class="filter-chip text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary font-semibold transition-colors" data-role-filter="${r.key}">
              ${r.label.split('(')[0].trim()}
            </button>`).join('')}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-100">
              <tr class="text-xs text-slate-400 font-body">
                <th class="text-left py-2 pr-4">พนักงาน</th>
                <th class="text-left py-2 pr-4">บทบาท</th>
                <th class="text-left py-2 pr-4">สถานะ</th>
                <th class="text-left py-2 pr-4">เข้าใช้ล่าสุด</th>
                <th class="text-left py-2">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              ${mockUsers.map(u => {
                const ri = ROLES[u.role] || ROLES.staff;
                return `
                  <tr class="border-b border-slate-50 hover:bg-slate-50" data-user-role="${u.role}">
                    <td class="py-3 pr-4">
                      <div class="font-semibold text-navy">${u.name}</div>
                      <div class="text-xs text-slate-400 font-body">${u.email}</div>
                    </td>
                    <td class="py-3 pr-4">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style="background:${ri.color}15;color:${ri.color}">
                        <i class="fas ${ri.icon} text-xs"></i>
                        ${ri.label.split('(')[0].trim()}
                      </span>
                    </td>
                    <td class="py-3 pr-4">
                      <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-neutral'}">${u.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span>
                    </td>
                    <td class="py-3 pr-4 text-xs text-slate-400 font-body">${u.lastLogin}</td>
                    <td class="py-3">
                      <button class="btn-outline text-xs px-2 py-1 mr-1" data-action="edit-role" data-uid="${u.id}"><i class="fas fa-pen"></i></button>
                      <button class="btn-outline text-xs px-2 py-1 mr-1" data-action="toggle" data-uid="${u.id}"><i class="fas ${u.status === 'active' ? 'fa-ban' : 'fa-check'}"></i></button>
                      <button class="btn-outline text-xs px-2 py-1"      data-action="reset"  data-uid="${u.id}"><i class="fas fa-key"></i></button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-semibold text-navy mb-3">📋 สิทธิ์ตามบทบาท</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          ${Object.values(ROLES).map(r => `
            <div class="p-3 rounded-xl border border-slate-100" style="background:${r.color}08">
              <div class="flex items-center gap-2 mb-1.5">
                <i class="fas ${r.icon} text-sm" style="color:${r.color}"></i>
                <span class="font-semibold text-xs">${r.label.split('(')[0].trim()}</span>
              </div>
              <div class="text-xs text-slate-500 font-body leading-relaxed">${r.desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  container.querySelector('#invite-btn')?.addEventListener('click', () =>
    showToast('ส่งคำเชิญทางอีเมล (Demo)', 'info')
  );

  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('active','border-primary','bg-primary/10','text-primary');
        c.classList.add('border-slate-200','text-slate-500');
      });
      chip.classList.add('active','border-primary','bg-primary/10','text-primary');
      chip.classList.remove('border-slate-200','text-slate-500');
      const f = chip.dataset.roleFilter;
      container.querySelectorAll('#users-tbody tr').forEach(row => {
        row.style.display = (f === 'all' || row.dataset.userRole === f) ? '' : 'none';
      });
    });
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.action;
      if (a === 'edit-role')  showToast('เปลี่ยนบทบาท (Demo)', 'info');
      if (a === 'toggle')     showToast('เปลี่ยนสถานะสำเร็จ (Demo)');
      if (a === 'reset')      showToast('ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว (Demo)');
    });
  });
}
