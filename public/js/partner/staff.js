import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';

const PERM_MODULES = ['queue','opd','ipd','stock','finance','pos','settings'];
const PERM_ACTIONS = ['view','create','edit','delete'];

const MODULE_LABELS = {
  queue: 'คิว', opd: 'OPD', ipd: 'IPD', stock: 'สต็อก',
  finance: 'การเงิน', pos: 'POS / ขายหน้าร้าน', settings: 'ตั้งค่า',
};

// ── Presets per store category ────────────────────────────────────────────────
const ROLE_PRESETS = {
  vet_clinic: [
    {
      name: 'สัตวแพทย์', color: '#0EA5E9', icon: '👨‍⚕️',
      desc: 'ดู OPD, บันทึกประวัติ, สั่งยา',
      permissions: {
        queue:   ['view'],
        opd:     ['view','create','edit'],
        ipd:     ['view','create','edit'],
        stock:   ['view'],
        finance: [],
        pos:     [],
        settings:[],
      },
    },
    {
      name: 'พยาบาลสัตว์', color: '#10B981', icon: '🩺',
      desc: 'รับคิว, ช่วย OPD, ดูสต็อก',
      permissions: {
        queue:   ['view','create','edit'],
        opd:     ['view','create'],
        ipd:     ['view'],
        stock:   ['view'],
        finance: [],
        pos:     [],
        settings:[],
      },
    },
    {
      name: 'เคาน์เตอร์', color: '#8B5CF6', icon: '📋',
      desc: 'รับคิว, POS, ดูการเงิน',
      permissions: {
        queue:   ['view','create','edit','delete'],
        opd:     ['view'],
        ipd:     [],
        stock:   ['view'],
        finance: ['view'],
        pos:     ['view','create','edit'],
        settings:[],
      },
    },
    {
      name: 'สต็อก / เภสัช', color: '#F59E0B', icon: '📦',
      desc: 'จัดยา, รับ-จ่ายสินค้า',
      permissions: {
        queue:   ['view'],
        opd:     ['view'],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: [],
        pos:     ['view'],
        settings:[],
      },
    },
    {
      name: 'การเงิน', color: '#EF4444', icon: '💰',
      desc: 'รายได้, ใบเสร็จ, รายงาน',
      permissions: {
        queue:   ['view'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view','create','edit','delete'],
        pos:     ['view'],
        settings:[],
      },
    },
  ],

  pet_shop: [
    {
      name: 'ผู้จัดการ', color: '#6366F1', icon: '👔',
      desc: 'เข้าถึงทุกส่วนของร้าน',
      permissions: {
        queue:   ['view','create','edit','delete'],
        opd:     [],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: ['view','create','edit','delete'],
        pos:     ['view','create','edit','delete'],
        settings:['view','edit'],
      },
    },
    {
      name: 'พนักงานขาย', color: '#10B981', icon: '🛍️',
      desc: 'POS, ดูสต็อก',
      permissions: {
        queue:   ['view','create'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: [],
        pos:     ['view','create','edit'],
        settings:[],
      },
    },
    {
      name: 'สต็อก', color: '#F59E0B', icon: '📦',
      desc: 'รับ-จ่าย, นับสต็อก',
      permissions: {
        queue:   [],
        opd:     [],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: [],
        pos:     ['view'],
        settings:[],
      },
    },
    {
      name: 'การเงิน', color: '#EF4444', icon: '💰',
      desc: 'รายได้, ใบเสร็จ',
      permissions: {
        queue:   ['view'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view','create','edit','delete'],
        pos:     ['view'],
        settings:[],
      },
    },
  ],

  pet_hotel: [
    {
      name: 'ผู้จัดการ', color: '#6366F1', icon: '👔',
      desc: 'เข้าถึงทุกส่วนของโรงแรม',
      permissions: {
        queue:   ['view','create','edit','delete'],
        opd:     [],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: ['view','create','edit','delete'],
        pos:     ['view','create','edit','delete'],
        settings:['view','edit'],
      },
    },
    {
      name: 'พนักงานต้อนรับ', color: '#8B5CF6', icon: '🏨',
      desc: 'เช็คอิน/เช็คเอาท์, คิว',
      permissions: {
        queue:   ['view','create','edit'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view'],
        pos:     ['view','create'],
        settings:[],
      },
    },
    {
      name: 'ดูแลสัตว์', color: '#10B981', icon: '🐾',
      desc: 'ดูข้อมูลห้องพัก, บันทึกการดูแล',
      permissions: {
        queue:   ['view','edit'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: [],
        pos:     [],
        settings:[],
      },
    },
    {
      name: 'การเงิน', color: '#EF4444', icon: '💰',
      desc: 'รายได้, ใบเสร็จ',
      permissions: {
        queue:   ['view'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view','create','edit','delete'],
        pos:     ['view'],
        settings:[],
      },
    },
  ],

  pet_grooming: [
    {
      name: 'ผู้จัดการ', color: '#6366F1', icon: '👔',
      desc: 'เข้าถึงทุกส่วน',
      permissions: {
        queue:   ['view','create','edit','delete'],
        opd:     [],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: ['view','create','edit','delete'],
        pos:     ['view','create','edit','delete'],
        settings:['view','edit'],
      },
    },
    {
      name: 'ช่างตัดแต่ง', color: '#EC4899', icon: '✂️',
      desc: 'รับงาน, บันทึกผลงาน',
      permissions: {
        queue:   ['view','create','edit'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: [],
        pos:     [],
        settings:[],
      },
    },
    {
      name: 'พนักงานต้อนรับ', color: '#8B5CF6', icon: '📋',
      desc: 'รับคิว, POS',
      permissions: {
        queue:   ['view','create','edit'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view'],
        pos:     ['view','create','edit'],
        settings:[],
      },
    },
    {
      name: 'สต็อก', color: '#F59E0B', icon: '📦',
      desc: 'จัดการวัสดุอุปกรณ์',
      permissions: {
        queue:   [],
        opd:     [],
        ipd:     [],
        stock:   ['view','create','edit','delete'],
        finance: [],
        pos:     ['view'],
        settings:[],
      },
    },
    {
      name: 'การเงิน', color: '#EF4444', icon: '💰',
      desc: 'รายได้, ใบเสร็จ',
      permissions: {
        queue:   ['view'],
        opd:     [],
        ipd:     [],
        stock:   ['view'],
        finance: ['view','create','edit','delete'],
        pos:     ['view'],
        settings:[],
      },
    },
  ],
};

const ROLES_CFG = {
  counter:  { label: 'เคาน์เตอร์',   icon: '📋', desc: 'รับคนไข้, นัดหมาย, POS' },
  doctor:   { label: 'แพทย์',         icon: '👨‍⚕️', desc: 'OPD, ประวัติ, สั่งยา' },
  pharmacy: { label: 'สต็อก/เภสัช',  icon: '📦', desc: 'จัดยา, รับสินค้า' },
  finance:  { label: 'การเงิน',       icon: '💰', desc: 'รายได้, ใบเสร็จ' },
  all:      { label: 'Full Access',   icon: '🏥', desc: 'เข้าถึงทุกส่วน' },
};

const POSITIONS = [
  'สัตวแพทย์', 'พยาบาลสัตว์', 'ผู้ช่วยสัตวแพทย์',
  'เคาน์เตอร์ / แคชเชียร์', 'พนักงาน Grooming',
  'พนักงานสต็อก', 'พนักงานทั่วไป', 'ผู้จัดการ', 'อื่นๆ',
];

let _storeId = '';
let _staff   = [];
let _abort   = null;  // AbortController for listener cleanup

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderStaff(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
}

async function _render(container) {
  // Cancel all previous event listeners before re-rendering
  if (_abort) _abort.abort();
  _abort = new AbortController();
  const sig = _abort.signal;

  const res = await apiFetch(`/api/staff?store_id=${_storeId}`);
  _staff = res?.data || [];
  const active   = _staff.filter(s => s.is_active);
  const inactive = _staff.filter(s => !s.is_active);

  container.innerHTML = `
    <div class="space-y-5 w-full">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-bold text-navy text-xl">จัดการพนักงาน</h2>
          <p class="text-sm text-slate-400 font-body mt-0.5">Active ${active.length} คน</p>
        </div>
        <div class="flex gap-2">
          <button id="manage-roles-btn" class="btn-outline px-4 py-2 text-sm">
            <span class="opacity-70 mr-1">${icon('shield-alt','w-3.5 h-3.5')}</span>จัดการสิทธิ์
          </button>
          <button id="add-staff-btn" class="btn-primary px-4 py-2">+ เพิ่มพนักงาน</button>
        </div>
      </div>

      <!-- Active staff -->
      <div class="space-y-2" id="active-list">
        ${active.length === 0
          ? `<div class="card p-8 text-center text-slate-400 font-body">ยังไม่มีพนักงาน</div>`
          : active.map(s => _staffCard(s)).join('')}
      </div>

      ${inactive.length > 0 ? `
        <details class="card p-4">
          <summary class="text-sm text-slate-400 font-body cursor-pointer select-none">
            พนักงานที่ถูก deactivate (${inactive.length})
          </summary>
          <div class="space-y-2 mt-3">${inactive.map(s => _staffCard(s, true)).join('')}</div>
        </details>` : ''}
    </div>`;

  // ── Event delegation — single listener, cleaned up on re-render ──
  container.querySelector('#manage-roles-btn')
    ?.addEventListener('click', () => _openRolesPanel(_storeId), { signal: sig });

  container.querySelector('#add-staff-btn')
    ?.addEventListener('click', () => _openAddModal(container), { signal: sig });

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-staff-action]');
    if (!btn) return;
    const id     = btn.dataset.staffId;
    const action = btn.dataset.staffAction;
    const member = _staff.find(s => s.id === id);

    if (action === 'edit')           await _openEditModal(member, container);
    if (action === 'deactivate')     await _deactivate(id, container);
    if (action === 'reactivate')     await _reactivate(id, container);
  }, { signal: sig });
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function _staffCard(s, inactive = false) {
  // position badge: prefer s.position (role name from roles table), fallback to s.roles[] labels
  const positionBadge = s.position
    ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full"
             style="background:${s.role_color ? s.role_color + '22' : '#e2e8f0'};
                    color:${s.role_color || '#475569'}">${s.position}</span>`
    : (s.roles || []).map(r => {
        const cfg = ROLES_CFG[r] || { icon: '?', label: r };
        return `<span class="badge badge-teal text-xs">${cfg.icon} ${cfg.label}</span>`;
      }).join('');

  const startDate = s.start_date
    ? new Date(s.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return `
    <div class="card p-4 ${inactive ? 'opacity-50' : ''}">
      <div class="flex items-start gap-4">
        <!-- Avatar -->
        <div class="w-11 h-11 rounded-xl bg-primary-subtle flex items-center justify-center
                    font-bold text-primary-dark text-lg flex-shrink-0">
          ${s.name.charAt(0).toUpperCase()}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="font-semibold text-navy">${s.name}</span>
            ${positionBadge}
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400 font-body">
            <span class="flex items-center gap-1"><span class="opacity-50">${icon('envelope','w-3 h-3')}</span>${s.user_email}</span>
            ${s.phone ? `<span class="flex items-center gap-1"><span class="opacity-50">${icon('phone','w-3 h-3')}</span>${s.phone}</span>` : ''}
            ${startDate ? `<span class="flex items-center gap-1"><span class="opacity-50">${icon('calendar-alt','w-3 h-3')}</span>เริ่มงาน ${startDate}</span>` : ''}
            ${s.last_login ? `<span class="flex items-center gap-1"><span class="opacity-50">${icon('clock','w-3 h-3')}</span>Login ล่าสุด ${new Date(s.last_login).toLocaleDateString('th-TH')}</span>` : ''}
          </div>
          ${s.notes ? `<div class="text-xs text-slate-400 font-body mt-1 italic">${s.notes}</div>` : ''}
        </div>

        <!-- Actions -->
        <div class="flex gap-2 flex-shrink-0">
          ${!inactive ? `
            <button data-staff-action="edit" data-staff-id="${s.id}"
              class="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors font-semibold">
              แก้ไข
            </button>
            <button data-staff-action="deactivate" data-staff-id="${s.id}"
              class="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              ปิดสิทธิ์
            </button>` : `
            <button data-staff-action="reactivate" data-staff-id="${s.id}"
              class="text-xs border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors">
              เปิดสิทธิ์
            </button>`}
        </div>
      </div>
    </div>`;
}

// ─── Add modal ────────────────────────────────────────────────────────────────

async function _openAddModal(container) {
  const rolesRes  = await apiFetch(`/api/roles?store_id=${_storeId}`);
  const storeRoles = rolesRes?.data || [];

  const modal = _modal('เพิ่มพนักงาน', `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="input-label">ชื่อ-นามสกุล *</label>
          <input id="sf-name" class="input-field" placeholder="ดร.สมชาย ใจดี">
        </div>
        <div class="col-span-2">
          <label class="input-label">อีเมล (ใช้ Login) *</label>
          <input id="sf-email" class="input-field" type="email" placeholder="somchai@email.com">
        </div>
        <div class="col-span-2">
          <label class="input-label">รหัสผ่านสำหรับ Login</label>
          <input id="sf-password" class="input-field" type="text" autocomplete="new-password"
                 placeholder="เว้นว่างเพื่อสุ่มรหัสชั่วคราวให้อัตโนมัติ">
          <p class="text-xs text-slate-400 font-body mt-1">ตั้งรหัสเอง (อย่างน้อย 6 ตัว) หรือเว้นว่างให้ระบบสุ่มให้</p>
        </div>
        <div>
          <label class="input-label">เบอร์โทรศัพท์</label>
          <input id="sf-phone" class="input-field" placeholder="081-234-5678">
        </div>
        <div>
          <label class="input-label">วันที่เริ่มงาน</label>
          <input id="sf-start" class="input-field" type="date">
        </div>
        <div class="col-span-2">
          <label class="input-label">หมายเหตุ</label>
          <input id="sf-notes" class="input-field" placeholder="เช่น พาร์ทไทม์วันหยุด">
        </div>
      </div>

      <div>
        <label class="input-label">ตำแหน่ง / สิทธิ์การใช้งาน *</label>
        ${_renderRoleSelector(storeRoles, [], 'sf')}
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name       = modal.querySelector('#sf-name').value.trim();
    const email      = modal.querySelector('#sf-email').value.trim().toLowerCase();
    const phone      = modal.querySelector('#sf-phone').value.trim();
    const start_date = modal.querySelector('#sf-start').value || null;
    const notes      = modal.querySelector('#sf-notes').value.trim();
    const password   = modal.querySelector('#sf-password').value;

    const selectedRole = storeRoles.find(r => r.id === modal.querySelector('.sf-role-radio:checked')?.value);

    if (!name || !email)      { showToast('กรุณากรอกชื่อและอีเมล', 'error'); return; }
    if (!email.includes('@')) { showToast('อีเมลไม่ถูกต้อง', 'error'); return; }
    if (!selectedRole)        { showToast('กรุณาเลือกตำแหน่ง', 'error'); return; }
    if (password && password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error'); return; }

    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง...';

    const res = await apiFetch('/api/staff', {
      method: 'POST',
      body: JSON.stringify({
        store_id: _storeId,
        user_email: email,
        name,
        roles: _permissionsToModes(selectedRole.permissions),
        phone,
        position: selectedRole.name,
        role_color: selectedRole.color,
        start_date,
        notes,
        password: password || undefined,
      }),
    });

    if (res?.success) {
      modal.remove();
      if (res.is_new_account && res.temp_password) {
        _showPasswordModal('สร้าง account สำเร็จ! 🎉', name, email, res.temp_password);
      } else {
        showToast(`เพิ่ม ${name} แล้ว`);
      }
      await _render(container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

async function _openEditModal(member, container) {
  const rolesRes   = await apiFetch(`/api/roles?store_id=${_storeId}`);
  const storeRoles = rolesRes?.data || [];

  const modal = _modal(`แก้ไขข้อมูล — ${member.name}`, `
    <div class="space-y-5">

      <!-- ── ข้อมูลพื้นฐาน ── -->
      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">ข้อมูลพื้นฐาน</div>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="input-label">ชื่อ-นามสกุล *</label>
            <input id="se-name" class="input-field" value="${member.name}">
          </div>
          <div>
            <label class="input-label">เบอร์โทรศัพท์</label>
            <input id="se-phone" class="input-field" placeholder="081-234-5678" value="${member.phone || ''}">
          </div>
          <div>
            <label class="input-label">วันที่เริ่มงาน</label>
            <input id="se-start" class="input-field" type="date" value="${member.start_date || ''}">
          </div>
          <div class="col-span-2">
            <label class="input-label">หมายเหตุ</label>
            <input id="se-notes" class="input-field" placeholder="เช่น พาร์ทไทม์วันหยุด" value="${member.notes || ''}">
          </div>
        </div>
      </div>

      <!-- ── ตำแหน่ง / สิทธิ์ ── -->
      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">ตำแหน่ง / สิทธิ์การใช้งาน *</div>
        ${_renderRoleSelector(storeRoles, member.position ? [member.position] : [], 'se')}
      </div>

      <!-- ── รหัสผ่าน ── -->
      <div class="border-t border-slate-100 pt-4">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">รหัสผ่าน Login</div>
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
          <div class="text-sm font-semibold text-navy">อีเมล: ${member.user_email}</div>

          <div class="flex items-end gap-2">
            <div class="flex-1">
              <label class="input-label">ตั้งรหัสผ่านเอง</label>
              <input id="se-password" class="input-field" type="text" autocomplete="new-password"
                     placeholder="อย่างน้อย 6 ตัวอักษร">
            </div>
            <button id="set-pw-btn"
              class="flex-shrink-0 text-sm px-4 py-2.5 rounded-lg bg-primary text-white
                     hover:bg-primary-dark font-semibold transition-colors whitespace-nowrap">
              ตั้งรหัส
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex-1 border-t border-slate-200"></div>
            <span class="text-xs text-slate-400 font-body">หรือ</span>
            <div class="flex-1 border-t border-slate-200"></div>
          </div>

          <button id="reset-pw-btn"
            class="w-full text-sm px-4 py-2.5 rounded-lg border border-amber-300 text-amber-700
                   bg-amber-50 hover:bg-amber-100 font-semibold transition-colors">
            🔑 สุ่มรหัสผ่านชั่วคราวใหม่
          </button>
        </div>
      </div>
    </div>`);

  modal.querySelector('#set-pw-btn').addEventListener('click', async () => {
    const password = modal.querySelector('#se-password').value;
    if (!password || password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error'); return; }
    const btn = modal.querySelector('#set-pw-btn');
    btn.disabled = true; btn.textContent = 'กำลังตั้ง...';
    const res = await apiFetch(`/api/staff/${member.id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    btn.disabled = false; btn.textContent = 'ตั้งรหัส';
    if (res?.success) {
      modal.remove();
      _showPasswordModal('ตั้งรหัสผ่านสำเร็จ 🔑', res.name, res.email, res.temp_password);
    } else {
      showToast(res?.error || 'ตั้งรหัสผ่านไม่สำเร็จ', 'error');
    }
  });

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name       = modal.querySelector('#se-name').value.trim();
    const phone      = modal.querySelector('#se-phone').value.trim();
    const start_date = modal.querySelector('#se-start').value || null;
    const notes      = modal.querySelector('#se-notes').value.trim();
    const selectedRole = storeRoles.find(r => r.id === modal.querySelector('.se-role-radio:checked')?.value);

    if (!name)         { showToast('กรุณากรอกชื่อ', 'error'); return; }
    if (!selectedRole) { showToast('กรุณาเลือกตำแหน่ง', 'error'); return; }

    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch(`/api/staff/${member.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        roles: _permissionsToModes(selectedRole.permissions),
        phone,
        position: selectedRole.name,
        role_color: selectedRole.color,
        start_date,
        notes,
      }),
    });

    if (res?.success) {
      modal.remove();
      showToast(`อัพเดท ${name} แล้ว`);
      await _render(container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  // Reset password
  modal.querySelector('#reset-pw-btn').addEventListener('click', async () => {
    const btn = modal.querySelector('#reset-pw-btn');
    btn.disabled = true; btn.textContent = 'กำลังรีเซ็ต...';

    const res = await apiFetch(`/api/staff/${member.id}/reset-password`, { method: 'PATCH' });

    btn.disabled = false; btn.textContent = '🔑 รีเซ็ตรหัสผ่าน';

    if (res?.success) {
      modal.remove();
      _showPasswordModal('รีเซ็ตรหัสผ่านสำเร็จ 🔑', res.name, res.email, res.temp_password);
    } else {
      showToast(res?.error || 'รีเซ็ตรหัสผ่านไม่สำเร็จ', 'error');
    }
  });
}

// ─── Temp password display ─────────────────────────────────────────────────────

function _showPasswordModal(title, name, email, password) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
      <h3 class="font-bold text-navy text-lg text-center">${title}</h3>
      <div class="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-body">
        <div class="flex justify-between"><span class="text-slate-500">ชื่อ</span><span class="font-semibold text-navy">${name}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">อีเมล</span><span class="font-semibold text-navy text-xs break-all">${email}</span></div>
        <div class="flex justify-between items-center pt-1 border-t border-slate-200">
          <span class="text-slate-500">รหัสผ่านชั่วคราว</span>
          <div class="flex items-center gap-2">
            <span id="tmp-pw" class="font-mono font-bold text-primary text-base bg-primary-subtle px-3 py-1 rounded-lg select-all">${password}</span>
            <button id="copy-pw" class="text-slate-400 hover:text-primary transition-colors" title="คัดลอก">
              ${icon('copy','w-3.5 h-3.5')}
            </button>
          </div>
        </div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-body">
        ⚠️ ส่งข้อมูลนี้ให้พนักงาน และแนะนำให้เปลี่ยนรหัสผ่านหลัง login ครั้งแรก
      </div>
      <button id="close-pw" class="btn-primary w-full">รับทราบ</button>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#close-pw').addEventListener('click', () => m.remove());
  m.querySelector('#copy-pw').addEventListener('click', () => {
    navigator.clipboard.writeText(password).then(() => showToast('คัดลอกแล้ว'));
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function _deactivate(id, container) {
  const res = await apiFetch(`/api/staff/${id}`, { method: 'DELETE' });
  if (res?.success) { showToast('ปิดสิทธิ์เรียบร้อย', 'info'); await _render(container); }
  else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

async function _reactivate(id, container) {
  const res = await apiFetch(`/api/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: true }),
  });
  if (res?.success) { showToast('เปิดสิทธิ์เรียบร้อย'); await _render(container); }
  else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

// Renders a radio-card selector for store roles; prefix = 'sf' (add) or 'se' (edit)
function _renderRoleSelector(storeRoles, selectedNames, prefix) {
  if (!storeRoles.length) {
    return `
      <div class="rounded-xl border border-dashed border-slate-200 p-4 text-center space-y-2">
        <p class="text-sm text-slate-400 font-body">ยังไม่มีตำแหน่งในร้านนี้</p>
        <p class="text-xs text-slate-400 font-body">
          กลับไปที่ "จัดการสิทธิ์" เพื่อสร้างตำแหน่งก่อน
        </p>
      </div>`;
  }

  return `
    <div class="space-y-2 mt-2">
      ${storeRoles.map(r => {
        const canView   = PERM_MODULES.filter(m => (r.permissions?.[m] || []).length > 0)
                            .map(m => MODULE_LABELS[m] || m).join(', ') || '—';
        const checked   = selectedNames.includes(r.name);
        return `
          <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                        transition-all hover:border-primary hover:bg-primary-subtle
                        ${checked ? 'border-primary bg-primary-subtle' : 'border-slate-100'}">
            <input type="radio" name="${prefix}-role" value="${r.id}"
                   class="${prefix}-role-radio w-4 h-4 accent-primary"
                   ${checked ? 'checked' : ''}>
            <div class="w-7 h-7 rounded-lg flex-shrink-0"
                 style="background:${r.color || '#6B7280'}22">
              <div class="w-full h-full rounded-lg flex items-center justify-center">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${r.color || '#6B7280'}"></div>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-navy text-sm">${r.name}</div>
              <div class="text-xs text-slate-400 font-body truncate">เข้าถึง: ${canView}</div>
            </div>
          </label>`;
      }).join('')}
    </div>`;
}

// Maps custom role permissions → dashboard mode keys (staff.roles[])
function _permissionsToModes(permissions) {
  if (!permissions) return ['counter'];
  const has = (mod, act) => (permissions[mod] || []).includes(act);

  if (has('settings', 'view')) return ['all'];

  const modes = [];
  if (has('opd', 'view') || has('ipd', 'view'))    modes.push('doctor');
  if (has('stock', 'view'))                         modes.push('pharmacy');
  if (has('finance', 'view'))                       modes.push('finance');
  if (has('queue', 'view') || has('pos', 'view'))   modes.push('counter');

  return modes.length ? [...new Set(modes)] : ['counter'];
}

// ─── Role & Permission panel ──────────────────────────────────────────────────

function _openRolesPanel(storeId) {
  const category = storage.get(STORAGE_KEYS.STORE_CATEGORY) || 'vet_clinic';
  const presets  = ROLE_PRESETS[category] || [];

  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto';
  panel.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">

      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-100">
        <div>
          <h3 class="font-bold text-navy text-lg flex items-center gap-2"><span class="text-primary opacity-70">${icon('shield-alt','w-5 h-5')}</span> Role & Permission</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">กำหนดตำแหน่งและสิทธิ์การเข้าถึงของพนักงาน</p>
        </div>
        <button id="rp-close" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          ${icon('times','w-4 h-4')}
        </button>
      </div>

      <div class="p-6 space-y-6">

        <!-- Preset section -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Preset — ใช้เป็น Template</span>
            <div class="flex-1 border-t border-slate-100"></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" id="rp-presets">
            ${presets.map((p, i) => `
              <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                     style="background:${p.color}22">${p.icon}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-navy text-sm">${p.name}</div>
                  <div class="text-xs text-slate-400 font-body truncate">${p.desc}</div>
                </div>
                <button data-use-preset="${i}"
                  class="text-xs border border-primary text-primary px-2.5 py-1.5 rounded-lg
                         hover:bg-primary-subtle transition-colors flex-shrink-0 whitespace-nowrap">
                  + ใช้
                </button>
              </div>`).join('')}
          </div>
        </div>

        <!-- Custom roles section -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Role ของร้านนี้</span>
            <div class="flex-1 border-t border-slate-100"></div>
            <button id="rp-add-btn" class="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg
                                           hover:border-primary hover:text-primary transition-colors">
              + สร้างใหม่
            </button>
          </div>
          <div id="rp-loading" class="text-slate-400 font-body text-sm py-2">กำลังโหลด...</div>
          <div id="rp-list" class="space-y-2 hidden"></div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(panel);

  const close = () => panel.remove();
  panel.querySelector('#rp-close').addEventListener('click', close);
  panel.addEventListener('click', e => { if (e.target === panel) close(); });

  const reload = () => _loadRolesIntoPanel(panel, storeId);

  // Use preset → open modal pre-filled, save as new role
  panel.querySelector('#rp-presets').addEventListener('click', e => {
    const btn = e.target.closest('[data-use-preset]');
    if (!btn) return;
    const preset = presets[+btn.dataset.usePreset];
    _openRoleModal({ ...preset, id: null }, storeId, reload);
  });

  panel.querySelector('#rp-add-btn').addEventListener('click', () => _openRoleModal(null, storeId, reload));
  reload();
}

async function _loadRolesIntoPanel(panel, storeId) {
  const loadingEl = panel.querySelector('#rp-loading');
  const listEl    = panel.querySelector('#rp-list');
  if (!loadingEl || !listEl) return;

  loadingEl.classList.remove('hidden');
  listEl.classList.add('hidden');

  const res   = await apiFetch(`/api/roles?store_id=${storeId}`);
  const roles = res?.data || [];

  loadingEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  if (!roles.length) {
    listEl.innerHTML = `
      <div class="text-center py-6 text-slate-400 font-body text-sm border border-dashed border-slate-200 rounded-xl">
        ยังไม่มี Role — กด "+ สร้างใหม่" หรือเลือก Template จาก Preset ด้านบน
      </div>`;
    return;
  }

  listEl.innerHTML = roles.map(r => {
    const perms = r.permissions || {};
    const canView = PERM_MODULES.filter(m => (perms[m] || []).length > 0)
      .map(m => MODULE_LABELS[m] || m).join(', ') || '—';
    return `
      <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${r.color || '#6B7280'}"></div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-navy text-sm">${r.name}</div>
          <div class="text-xs text-slate-400 font-body truncate">เข้าถึง: ${canView}</div>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button data-edit-role="${r.id}" data-role='${JSON.stringify(r).replace(/'/g,"&#39;")}'
            class="text-xs border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg
                   hover:border-primary hover:text-primary transition-colors">แก้ไข</button>
          <button data-delete-role="${r.id}"
            class="text-xs border border-red-200 text-red-400 px-2.5 py-1.5 rounded-lg
                   hover:bg-red-50 transition-colors">ลบ</button>
        </div>
      </div>`;
  }).join('');

  // Replace listener to avoid stacking (clone node trick)
  const fresh = listEl.cloneNode(true);
  listEl.replaceWith(fresh);
  panel.querySelector('#rp-list')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-role]');
    const delBtn  = e.target.closest('[data-delete-role]');
    const reload  = () => _loadRolesIntoPanel(panel, storeId);

    if (editBtn) {
      const role = JSON.parse(editBtn.dataset.role.replace(/&#39;/g,"'"));
      _openRoleModal(role, storeId, reload);
    }
    if (delBtn) {
      if (!confirm('ลบ Role นี้?')) return;
      const res = await apiFetch(`/api/roles/${delBtn.dataset.deleteRole}`, { method: 'DELETE' });
      if (res?.success) { showToast('ลบ Role แล้ว', 'info'); reload(); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function _openRoleModal(role, storeId, onSave) {
  const isEdit   = !!(role?.id);
  const perms    = role?.permissions || {};
  const modal    = document.createElement('div');
  modal.className = 'fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto';

  const actionLabels = { view: 'ดู', create: 'สร้าง', edit: 'แก้ไข', delete: 'ลบ' };

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl w-full max-w-xl my-8">

      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-100">
        <h3 class="font-bold text-navy text-lg">
          ${isEdit ? `แก้ไข Role — ${role.name}` : '+ สร้าง Role ใหม่'}
        </h3>
        <button id="rl-x" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
          ${icon('times','w-4 h-4')}
        </button>
      </div>

      <div class="p-6 space-y-5">

        <!-- Name + color -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="input-label">ชื่อตำแหน่ง *</label>
            <input id="rl-name" class="input-field" value="${role?.name || ''}" placeholder="เช่น สัตวแพทย์">
          </div>
          <div>
            <label class="input-label">สี</label>
            <input id="rl-color" class="input-field h-[42px]" type="color" value="${role?.color || '#6B7280'}">
          </div>
        </div>

        <!-- Permission matrix -->
        <div>
          <label class="input-label mb-3">สิทธิ์การเข้าถึง</label>
          <div class="rounded-xl border border-slate-100 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-slate-50">
                <tr>
                  <th class="text-left px-4 py-2.5 text-slate-500 font-semibold">Module</th>
                  ${PERM_ACTIONS.map(a => `
                    <th class="text-center px-2 py-2.5 text-slate-500 font-semibold text-xs">
                      ${actionLabels[a] || a}
                    </th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${PERM_MODULES.map((mod, i) => `
                  <tr class="${i % 2 === 1 ? 'bg-slate-50/50' : ''}">
                    <td class="px-4 py-2.5 font-medium text-navy text-sm">
                      ${MODULE_LABELS[mod] || mod}
                    </td>
                    ${PERM_ACTIONS.map(act => `
                      <td class="text-center px-2 py-2.5">
                        <input type="checkbox" class="perm-cb w-4 h-4 accent-primary cursor-pointer"
                               data-mod="${mod}" data-act="${act}"
                               ${(perms[mod] || []).includes(act) ? 'checked' : ''}>
                      </td>`).join('')}
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-xs text-slate-400 font-body mt-2">
            เลือก "ดู" อย่างน้อย 1 module เพื่อให้พนักงานเข้าหน้านั้นได้
          </p>
        </div>

      </div>

      <!-- Footer -->
      <div class="flex gap-3 p-6 border-t border-slate-100">
        <button id="rl-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="rl-save" class="btn-primary flex-1">${isEdit ? 'บันทึก' : 'สร้าง Role'}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#rl-cancel').addEventListener('click', close);
  modal.querySelector('#rl-x').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#rl-save').addEventListener('click', async () => {
    const name  = modal.querySelector('#rl-name').value.trim();
    const color = modal.querySelector('#rl-color').value;
    if (!name) { showToast('กรุณากรอกชื่อตำแหน่ง', 'error'); return; }

    const permissions = {};
    PERM_MODULES.forEach(mod => { permissions[mod] = []; });
    modal.querySelectorAll('.perm-cb:checked').forEach(cb => {
      const { mod, act } = cb.dataset;
      if (!permissions[mod].includes(act)) permissions[mod].push(act);
    });

    const btn = modal.querySelector('#rl-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = isEdit
      ? await apiFetch(`/api/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ name, color, permissions }) })
      : await apiFetch('/api/roles', { method: 'POST', body: JSON.stringify({ store_id: storeId, name, color, permissions }) });

    if (res?.success) {
      showToast(isEdit ? `บันทึก "${name}" แล้ว ✓` : `สร้าง "${name}" แล้ว ✓`);
      modal.remove();
      onSave();
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = isEdit ? 'บันทึก' : 'สร้าง Role';
    }
  });
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

function _modal(title, body) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 my-8">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-navy text-lg">${title}</h3>
        <button id="modal-x" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          ${icon('times','w-4 h-4')}
        </button>
      </div>
      <div>${body}</div>
      <div class="flex gap-3 pt-2 border-t border-slate-100">
        <button id="modal-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="modal-confirm" class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  const close = () => m.remove();
  m.querySelector('#modal-cancel').addEventListener('click', close);
  m.querySelector('#modal-x').addEventListener('click', close);
  // click backdrop to close
  m.addEventListener('click', e => { if (e.target === m) close(); });
  return m;
}
