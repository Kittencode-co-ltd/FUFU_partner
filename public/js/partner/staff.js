import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

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
        <button id="add-staff-btn" class="btn-primary px-4 py-2">+ เพิ่มพนักงาน</button>
      </div>

      <!-- Role legend -->
      <div class="card p-4">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">สิทธิ์การใช้งาน</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          ${Object.entries(ROLES_CFG).map(([, v]) => `
            <div class="flex items-center gap-2">
              <span class="text-base">${v.icon}</span>
              <div>
                <div class="font-semibold text-navy text-xs">${v.label}</div>
                <div class="text-slate-400 font-body text-xs">${v.desc}</div>
              </div>
            </div>`).join('')}
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
  container.querySelector('#add-staff-btn')
    ?.addEventListener('click', () => _openAddModal(container), { signal: sig });

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-staff-action]');
    if (!btn) return;
    const id     = btn.dataset.staffId;
    const action = btn.dataset.staffAction;
    const member = _staff.find(s => s.id === id);

    if (action === 'edit')           _openEditModal(member, container);
    if (action === 'deactivate')     await _deactivate(id, container);
    if (action === 'reactivate')     await _reactivate(id, container);
  }, { signal: sig });
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function _staffCard(s, inactive = false) {
  const roles = (s.roles || []).map(r => {
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
            ${s.position ? `<span class="text-xs text-slate-500 font-body bg-slate-100 px-2 py-0.5 rounded-full">${s.position}</span>` : ''}
            ${roles}
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400 font-body">
            <span><i class="fas fa-envelope mr-1 opacity-60"></i>${s.user_email}</span>
            ${s.phone ? `<span><i class="fas fa-phone mr-1 opacity-60"></i>${s.phone}</span>` : ''}
            ${startDate ? `<span><i class="fas fa-calendar-alt mr-1 opacity-60"></i>เริ่มงาน ${startDate}</span>` : ''}
            ${s.last_login ? `<span><i class="fas fa-clock mr-1 opacity-60"></i>Login ล่าสุด ${new Date(s.last_login).toLocaleDateString('th-TH')}</span>` : ''}
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

function _openAddModal(container) {
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
          <label class="input-label">ตำแหน่ง</label>
          <select id="sf-position" class="input-field">
            <option value="">— เลือกตำแหน่ง —</option>
            ${POSITIONS.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">วันที่เริ่มงาน</label>
          <input id="sf-start" class="input-field" type="date">
        </div>
        <div>
          <label class="input-label">หมายเหตุ</label>
          <input id="sf-notes" class="input-field" placeholder="เช่น พาร์ทไทม์วันหยุด">
        </div>
      </div>
      <div>
        <label class="input-label">สิทธิ์การใช้งาน *</label>
        <div class="space-y-2 mt-2">
          ${Object.entries(ROLES_CFG).map(([k, v]) => `
            <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                          hover:border-primary hover:bg-primary-subtle transition-all">
              <input type="checkbox" value="${k}" class="w-4 h-4 accent-primary sf-role"
                     ${k === 'counter' ? 'checked' : ''}>
              <span class="text-xl">${v.icon}</span>
              <div>
                <div class="font-semibold text-navy text-sm">${v.label}</div>
                <div class="text-xs text-slate-400 font-body">${v.desc}</div>
              </div>
            </label>`).join('')}
        </div>
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name     = modal.querySelector('#sf-name').value.trim();
    const email    = modal.querySelector('#sf-email').value.trim().toLowerCase();
    const phone    = modal.querySelector('#sf-phone').value.trim();
    const position = modal.querySelector('#sf-position').value;
    const start_date = modal.querySelector('#sf-start').value || null;
    const notes    = modal.querySelector('#sf-notes').value.trim();
    const password = modal.querySelector('#sf-password').value;
    const roles    = [...modal.querySelectorAll('.sf-role:checked')].map(c => c.value);

    if (!name || !email)   { showToast('กรุณากรอกชื่อและอีเมล', 'error'); return; }
    if (!email.includes('@')) { showToast('อีเมลไม่ถูกต้อง', 'error'); return; }
    if (!roles.length)     { showToast('กรุณาเลือกสิทธิ์อย่างน้อย 1 อย่าง', 'error'); return; }
    if (password && password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error'); return; }

    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง...';

    const res = await apiFetch('/api/staff', {
      method: 'POST',
      body: JSON.stringify({ store_id: _storeId, user_email: email, name, roles, phone, position, start_date, notes, password: password || undefined }),
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

function _openEditModal(member, container) {
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
            <label class="input-label">ตำแหน่ง</label>
            <select id="se-position" class="input-field">
              <option value="">— เลือกตำแหน่ง —</option>
              ${POSITIONS.map(p => `<option value="${p}" ${member.position === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="input-label">วันที่เริ่มงาน</label>
            <input id="se-start" class="input-field" type="date" value="${member.start_date || ''}">
          </div>
          <div>
            <label class="input-label">หมายเหตุ</label>
            <input id="se-notes" class="input-field" placeholder="เช่น พาร์ทไทม์วันหยุด" value="${member.notes || ''}">
          </div>
        </div>
      </div>

      <!-- ── สิทธิ์ ── -->
      <div>
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">สิทธิ์การใช้งาน *</div>
        <div class="space-y-2">
          ${Object.entries(ROLES_CFG).map(([k, v]) => {
            const checked = (member.roles || []).includes(k);
            return `
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                            hover:border-primary hover:bg-primary-subtle transition-all
                            ${checked ? 'border-primary bg-primary-subtle' : 'border-slate-100'}">
                <input type="checkbox" value="${k}" class="w-4 h-4 accent-primary se-role"
                       ${checked ? 'checked' : ''}>
                <span class="text-xl">${v.icon}</span>
                <div>
                  <div class="font-semibold text-navy text-sm">${v.label}</div>
                  <div class="text-xs text-slate-400 font-body">${v.desc}</div>
                </div>
              </label>`;
          }).join('')}
        </div>
      </div>

      <!-- ── รหัสผ่าน ── -->
      <div class="border-t border-slate-100 pt-4">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">รหัสผ่าน Login</div>
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
          <div class="text-sm font-semibold text-navy">อีเมล: ${member.user_email}</div>

          <!-- ตั้งรหัสเอง -->
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

          <!-- สุ่มรหัสชั่วคราว -->
          <button id="reset-pw-btn"
            class="w-full text-sm px-4 py-2.5 rounded-lg border border-amber-300 text-amber-700
                   bg-amber-50 hover:bg-amber-100 font-semibold transition-colors">
            🔑 สุ่มรหัสผ่านชั่วคราวใหม่
          </button>
        </div>
      </div>
    </div>`);

  // Set a custom (permanent) password
  modal.querySelector('#set-pw-btn').addEventListener('click', async () => {
    const pwInput = modal.querySelector('#se-password');
    const password = pwInput.value;
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

  // Save basic info + roles
  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name     = modal.querySelector('#se-name').value.trim();
    const phone    = modal.querySelector('#se-phone').value.trim();
    const position = modal.querySelector('#se-position').value;
    const start_date = modal.querySelector('#se-start').value || null;
    const notes    = modal.querySelector('#se-notes').value.trim();
    const roles    = [...modal.querySelectorAll('.se-role:checked')].map(c => c.value);

    if (!name)         { showToast('กรุณากรอกชื่อ', 'error'); return; }
    if (!roles.length) { showToast('กรุณาเลือกสิทธิ์อย่างน้อย 1 อย่าง', 'error'); return; }

    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch(`/api/staff/${member.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, roles, phone, position, start_date, notes }),
    });

    if (res?.success) {
      modal.remove();
      if (res.migration_needed) {
        showToast(`บันทึกชื่อ/สิทธิ์แล้ว — ต้องรัน DB migration เพื่อบันทึก เบอร์/ตำแหน่ง/หมายเหตุ`, 'info');
      } else {
        showToast(`อัพเดท ${name} แล้ว`);
      }
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
              <i class="fas fa-copy"></i>
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

// ─── Modal helper ─────────────────────────────────────────────────────────────

function _modal(title, body) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 my-8">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-navy text-lg">${title}</h3>
        <button id="modal-x" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <i class="fas fa-times"></i>
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
