import { showToast }  from '../utils/toast.js';
import { apiFetch }   from '../utils/api-client.js';
import { storage }    from '../utils/storage.js';
import { STORAGE_KEYS, CATEGORY_MAP } from '../utils/config.js';

export const ROLES = {
  owner:      { key: 'owner',      label: 'เจ้าของ (Owner)',           icon: 'fa-crown',         color: '#D4AF37', desc: 'เข้าถึงได้ทุกส่วน รวมถึงจัดการพนักงานและการเงิน' },
  vet:        { key: 'vet',        label: 'สัตว์แพทย์ (Vet)',          icon: 'fa-user-doctor',   color: '#2A6374', desc: 'จัดการเวชระเบียน คิวนัดหมาย บันทึกการรักษา' },
  reception:  { key: 'reception',  label: 'พนักงานต้อนรับ (Reception)', icon: 'fa-headset',       color: '#3B82F6', desc: 'จัดการคิว นัดหมาย และรับชำระเงิน' },
  staff:      { key: 'staff',      label: 'พนักงาน (Staff)',            icon: 'fa-user',          color: '#8B5CF6', desc: 'ดูข้อมูลทั่วไป จัดการสินค้าคงคลัง' },
  accountant: { key: 'accountant', label: 'บัญชี (Accountant)',         icon: 'fa-calculator',    color: '#F59E0B', desc: 'จัดการรายรับ-รายจ่าย ออกใบกำกับภาษี' },
  counter:    { key: 'counter',    label: 'เคาน์เตอร์ (Counter)',       icon: 'fa-cash-register', color: '#10B981', desc: 'รับคิว Walk-in ชำระเงิน ออกใบเสร็จ' },
};

const PERMISSIONS = {
  'page:queue':             { owner: true,  vet: true,  reception: true,  staff: false, accountant: false, counter: true  },
  'page:records':           { owner: true,  vet: true,  reception: false, staff: false, accountant: false, counter: false },
  'page:income':            { owner: true,  vet: false, reception: false, staff: false, accountant: true,  counter: false },
  'page:products':          { owner: true,  vet: true,  reception: true,  staff: true,  accountant: false, counter: false },
  'page:users':             { owner: true,  vet: false, reception: false, staff: false, accountant: false, counter: false },
  'page:settings':          { owner: true,  vet: false, reception: false, staff: false, accountant: false, counter: false },
  'action:create_record':   { owner: true,  vet: true,  reception: false, staff: false, accountant: false, counter: false },
  'action:manage_finance':  { owner: true,  vet: false, reception: false, staff: false, accountant: true,  counter: false },
  'action:issue_invoice':   { owner: true,  vet: false, reception: true,  staff: false, accountant: true,  counter: true  },
  'action:manage_users':    { owner: true,  vet: false, reception: false, staff: false, accountant: false, counter: false },
  'action:export_data':     { owner: true,  vet: false, reception: false, staff: false, accountant: true,  counter: false },
};

export function getStaffRole() {
  const staffRole    = localStorage.getItem(STORAGE_KEYS.STAFF_ROLE);
  const categoryRole = localStorage.getItem(STORAGE_KEYS.ROLE);
  return staffRole || categoryRole || 'owner';
}

export function hasPermission(permission, role) {
  const r = role || getStaffRole();
  return PERMISSIONS[permission]?.[r] !== false;
}

// ─── Staff row HTML ───────────────────────────────────────────────────────────

function _staffRow(u, isOwner) {
  const role   = Array.isArray(u.roles) ? u.roles[0] : (u.role || 'staff');
  const ri     = ROLES[role] || ROLES.staff;
  const active = u.is_active !== false;
  return `
    <tr class="border-b border-slate-50 hover:bg-slate-50"
        data-user-role="${role}" data-staff-id="${u.id}" data-active="${active}">
      <td class="py-3 pr-4">
        <div class="font-semibold text-navy">${u.name || '(ไม่ระบุ)'}</div>
        <div class="text-xs text-slate-400 font-body">${u.user_email || ''}</div>
      </td>
      <td class="py-3 pr-4">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style="background:${ri.color}15;color:${ri.color}">
          <i class="fas ${ri.icon} text-xs"></i>
          ${ri.label.split('(')[0].trim()}
        </span>
      </td>
      <td class="py-3 pr-4">
        <span class="badge ${active ? 'badge-success' : 'badge-neutral'}">${active ? 'ใช้งาน' : 'ระงับ'}</span>
      </td>
      <td class="py-3 pr-4 text-xs text-slate-400 font-body">
        ${u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : '—'}
      </td>
      <td class="py-3">
        ${isOwner ? `
          <button class="btn-outline text-xs px-2 py-1 mr-1" data-action="edit-role" title="เปลี่ยนบทบาท"><i class="fas fa-pen"></i></button>
          <button class="btn-outline text-xs px-2 py-1 mr-1" data-action="toggle"    title="${active ? 'ระงับ' : 'เปิดใช้'}"><i class="fas ${active ? 'fa-ban' : 'fa-check'}"></i></button>
          <button class="btn-outline text-xs px-2 py-1"      data-action="reset"     title="รีเซ็ตรหัสผ่าน"><i class="fas fa-key"></i></button>
        ` : '<span class="text-xs text-slate-300">—</span>'}
      </td>
    </tr>`;
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function _openInviteModal(storeId, onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
      <h3 class="font-bold text-navy text-lg">+ เพิ่มพนักงาน</h3>
      <div>
        <label class="input-label">ชื่อ *</label>
        <input id="inv-name" class="input-field" placeholder="ชื่อ-นามสกุล">
      </div>
      <div>
        <label class="input-label">อีเมล *</label>
        <input id="inv-email" class="input-field" type="email" placeholder="staff@email.com">
      </div>
      <div>
        <label class="input-label">บทบาท</label>
        <select id="inv-role" class="input-field">
          ${Object.values(ROLES).filter(r => r.key !== 'owner').map(r =>
            `<option value="${r.key}">${r.label}</option>`
          ).join('')}
        </select>
      </div>
      <div id="inv-err" class="hidden text-xs text-red-500 font-body"></div>
      <div class="flex gap-3 pt-1">
        <button id="inv-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="inv-save"   class="btn-primary flex-1">เพิ่มพนักงาน</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#inv-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#inv-save').addEventListener('click', async () => {
    const name  = modal.querySelector('#inv-name').value.trim();
    const email = modal.querySelector('#inv-email').value.trim();
    const role  = modal.querySelector('#inv-role').value;
    const errEl = modal.querySelector('#inv-err');

    if (!name || !email) {
      errEl.textContent = 'กรุณากรอกชื่อและอีเมล';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = modal.querySelector('#inv-save');
    btn.disabled = true; btn.textContent = 'กำลังเพิ่ม...';

    const res = await apiFetch('/api/staff', {
      method: 'POST',
      body: JSON.stringify({ store_id: storeId, user_email: email, name, roles: [role] }),
    });

    if (res?.success) {
      close();
      const pwMsg = res.temp_password ? ` — รหัสผ่านชั่วคราว: ${res.temp_password}` : '';
      showToast(`เพิ่มพนักงาน ${name} แล้ว${pwMsg}`);
      onSuccess?.();
    } else {
      errEl.textContent = res?.error || 'เกิดข้อผิดพลาด';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'เพิ่มพนักงาน';
    }
  });

  setTimeout(() => modal.querySelector('#inv-name')?.focus(), 50);
}

// ─── Edit role modal ──────────────────────────────────────────────────────────

function _openEditRoleModal(staffId, currentRole, onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs space-y-4">
      <h3 class="font-bold text-navy">เปลี่ยนบทบาท</h3>
      <select id="role-sel" class="input-field">
        ${Object.values(ROLES).filter(r => r.key !== 'owner').map(r =>
          `<option value="${r.key}" ${r.key === currentRole ? 'selected' : ''}>${r.label}</option>`
        ).join('')}
      </select>
      <div class="flex gap-3">
        <button id="role-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="role-save"   class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#role-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#role-save').addEventListener('click', async () => {
    const newRole = modal.querySelector('#role-sel').value;
    const btn = modal.querySelector('#role-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch(`/api/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify({ roles: [newRole] }),
    });

    if (res?.success) { close(); showToast('เปลี่ยนบทบาทแล้ว'); onSuccess?.(); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function _renderTable(staffList, isOwner, container, reload) {
  const tbody = container.querySelector('#users-tbody');
  if (!tbody) return;

  const allChip = container.querySelector('[data-role-filter="all"]');
  if (allChip) allChip.textContent = `ทั้งหมด (${staffList.length})`;

  if (!staffList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-body">
      ยังไม่มีพนักงาน — กด "+ เพิ่มพนักงาน" เพื่อเริ่มต้น</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList.map(u => _staffRow(u, isOwner)).join('');

  if (!isOwner) return;

  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr     = btn.closest('tr');
      const sid    = tr.dataset.staffId;
      const active = tr.dataset.active === 'true';
      const action = btn.dataset.action;

      if (action === 'edit-role') {
        _openEditRoleModal(sid, tr.dataset.userRole, reload);

      } else if (action === 'toggle') {
        if (!confirm(active ? 'ระงับการใช้งานพนักงานคนนี้?' : 'เปิดใช้งานพนักงานคนนี้อีกครั้ง?')) return;
        btn.disabled = true;
        const res = await apiFetch(`/api/staff/${sid}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: !active }),
        });
        if (res?.success) { showToast(active ? 'ระงับการใช้งานแล้ว' : 'เปิดใช้งานแล้ว'); reload(); }
        else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; }

      } else if (action === 'reset') {
        if (!confirm('รีเซ็ตรหัสผ่านพนักงานคนนี้?')) return;
        btn.disabled = true;
        const res = await apiFetch(`/api/staff/${sid}/reset-password`, { method: 'PATCH' });
        if (res?.success) {
          showToast(`รหัสผ่านใหม่: ${res.temp_password} — แจ้งพนักงานด่วน!`);
        } else {
          showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
        }
        btn.disabled = false;
      }
    });
  });
}

// ─── Main render (async) ──────────────────────────────────────────────────────

export async function renderUserManagement(container) {
  if (!container) return;
  const staffRole = getStaffRole();
  const isOwner   = staffRole === 'owner';
  const storeId   = storage.get(STORAGE_KEYS.STORE_ID);

  container.innerHTML = `
    <div class="space-y-4 w-full">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy">👥 จัดการพนักงาน</h3>
          ${isOwner ? '<button class="btn-primary text-sm px-4 py-2" id="invite-btn">+ เพิ่มพนักงาน</button>' : ''}
        </div>
        <div class="flex gap-2 flex-wrap mb-4" id="role-filters">
          <button class="filter-chip active text-xs px-3 py-1.5 rounded-lg border border-primary bg-primary/10 text-primary font-semibold"
                  data-role-filter="all">ทั้งหมด</button>
          ${Object.values(ROLES).map(r => `
            <button class="filter-chip text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500
                           hover:border-primary hover:text-primary font-semibold transition-colors"
                    data-role-filter="${r.key}">${r.label.split('(')[0].trim()}</button>`).join('')}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-100">
              <tr class="text-xs text-slate-400 font-body">
                <th class="text-left py-2 pr-4">พนักงาน</th>
                <th class="text-left py-2 pr-4">บทบาท</th>
                <th class="text-left py-2 pr-4">สถานะ</th>
                <th class="text-left py-2 pr-4">เพิ่มเมื่อ</th>
                <th class="text-left py-2">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="5" class="py-8 text-center text-slate-400 font-body animate-pulse">กำลังโหลด...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-semibold text-navy mb-3">📋 สิทธิ์ตามบทบาท</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

  // Fetch real staff list and re-render on each reload
  const reload = async () => {
    const res      = await apiFetch(`/api/staff?store_id=${storeId}`);
    const staffList = res?.data || [];
    _renderTable(staffList, isOwner, container, reload);
  };
  await reload();

  // Invite button
  container.querySelector('#invite-btn')?.addEventListener('click', () => {
    _openInviteModal(storeId, reload);
  });

  // Role filter chips
  container.querySelector('#role-filters')?.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    container.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.remove('active', 'border-primary', 'bg-primary/10', 'text-primary');
      c.classList.add('border-slate-200', 'text-slate-500');
    });
    chip.classList.add('active', 'border-primary', 'bg-primary/10', 'text-primary');
    chip.classList.remove('border-slate-200', 'text-slate-500');
    const f = chip.dataset.roleFilter;
    container.querySelectorAll('#users-tbody tr[data-staff-id]').forEach(row => {
      row.style.display = (f === 'all' || row.dataset.userRole === f) ? '' : 'none';
    });
  });
}
