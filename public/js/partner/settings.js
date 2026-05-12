import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const DAYS_TH = { mon:'จันทร์', tue:'อังคาร', wed:'พุธ', thu:'พฤหัส', fri:'ศุกร์', sat:'เสาร์', sun:'อาทิตย์' };
const PERM_MODULES = ['queue','opd','ipd','stock','finance','settings'];
const PERM_ACTIONS = ['view','create','edit','delete'];

export async function renderSettings(container) {
  const user    = storage.getJSON(STORAGE_KEYS.USER) || {};
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const isStaff     = !!storage.getJSON('fufu_staff_roles');
  const ppId        = localStorage.getItem(STORAGE_KEYS.PROMPTPAY_ID) || '';
  const maskLevel   = localStorage.getItem(STORAGE_KEYS.MASKING_LEVEL) || '1';
  const staffRole   = storage.get(STORAGE_KEYS.STAFF_ROLE) || 'owner';
  const canManage   = ['owner', 'vet'].includes(staffRole) && !isStaff;

  // Load full store info from API (includes phone, address, tax_id etc.)
  const storesRes = await apiFetch('/api/stores');
  const store = (storesRes?.data || []).find(s => s.id === storeId) || {
    id: storeId,
    name: storage.get(STORAGE_KEYS.STORE_NAME),
    category: storage.get(STORAGE_KEYS.STORE_CATEGORY),
  };
  // Cache full store info in localStorage so documents can use it without API call
  if (store?.id) localStorage.setItem(STORAGE_KEYS.STORE_INFO, JSON.stringify(store));

  container.innerHTML = `
    <div class="space-y-5 max-w-2xl">

      <!-- ── ข้อมูลร้านค้า ── -->
      ${canManage ? `
      <div class="card p-5 space-y-4">
        <div>
          <h3 class="font-bold text-navy text-lg">🏥 ข้อมูลร้านค้า</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">ข้อมูลนี้ปรากฏบนใบเสร็จ, ฉลากยา และเอกสารทั้งหมด</p>
        </div>
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="input-label">ชื่อร้าน / คลินิก *</label>
              <input id="si-name" class="input-field" value="${store.name || ''}" placeholder="FUFU Vet Clinic">
            </div>
            <div>
              <label class="input-label">สาขา</label>
              <input id="si-branch" class="input-field" value="${store.branch_name || ''}" placeholder="สาขาหลัก">
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="input-label">เบอร์โทรศัพท์</label>
              <input id="si-phone" class="input-field" value="${store.phone || ''}" placeholder="02-xxx-xxxx">
            </div>
            <div>
              <label class="input-label">เลขประจำตัวผู้เสียภาษี (Tax ID)</label>
              <input id="si-taxid" class="input-field" value="${store.tax_id || ''}" placeholder="0000000000000">
            </div>
          </div>
          <div>
            <label class="input-label">ที่อยู่</label>
            <textarea id="si-address" rows="2" class="input-field resize-none"
              placeholder="123 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310">${store.address || ''}</textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="input-label">เว็บไซต์ / Line</label>
              <input id="si-website" class="input-field" value="${store.website || ''}" placeholder="@fufuvet หรือ fufuvet.com">
            </div>
            <div>
              <label class="input-label">หมายเหตุบนใบเสร็จ</label>
              <input id="si-note" class="input-field" value="${store.receipt_header_note || ''}" placeholder="เช่น ขอบคุณที่ไว้วางใจ">
            </div>
          </div>
        </div>
        <button id="save-store-info" class="btn-primary px-6 py-2">บันทึกข้อมูลร้านค้า</button>
      </div>` : ''}

      <!-- ── บัญชีของฉัน ── -->
      <div class="card p-5 space-y-3">
        <h3 class="font-bold text-navy text-lg">บัญชีของฉัน</h3>
        <div class="space-y-1 font-body text-sm">
          <div class="flex justify-between py-2 border-b border-slate-50">
            <span class="text-slate-400">อีเมล</span>
            <span class="font-semibold text-navy">${user.email || '—'}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-slate-50">
            <span class="text-slate-400">ร้านค้า</span>
            <span class="font-semibold text-navy">${store.name || '—'}</span>
          </div>
          <div class="flex justify-between py-2">
            <span class="text-slate-400">บทบาท</span>
            <span class="font-semibold text-navy">${isStaff ? 'พนักงาน' : 'เจ้าของกิจการ'}</span>
          </div>
        </div>
      </div>

      <!-- ── PromptPay QR ── -->
      <div class="card p-5 space-y-4">
        <div>
          <h3 class="font-bold text-navy text-lg">PromptPay QR</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">ใช้สำหรับแสดง QR ในหน้า POS เมื่อลูกค้าชำระด้วยพร้อมเพย์</p>
        </div>
        <div>
          <label class="input-label">เบอร์โทร / เลขประจำตัวผู้เสียภาษี</label>
          <input id="pp-id" class="input-field" placeholder="0812345678 หรือ 1234567890123"
            value="${ppId}">
          <p class="text-xs text-slate-400 font-body mt-1">เบอร์มือถือ 10 หลัก หรือเลขภาษี 13 หลัก</p>
        </div>
        <button id="save-pp" class="btn-primary px-6 py-2">บันทึก PromptPay ID</button>
      </div>

      <!-- ── Data Masking ── -->
      <div class="card p-5 space-y-4">
        <div>
          <h3 class="font-bold text-navy text-lg">ระดับการซ่อนข้อมูล</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">กำหนดว่าพนักงานจะเห็นข้อมูลส่วนตัวลูกค้าในระดับใด</p>
        </div>
        <div class="space-y-2">
          ${[
            ['1', 'เต็ม (เห็นทั้งหมด)', 'เจ้าของ/ผู้จัดการ — เห็นชื่อ เบอร์ ที่อยู่ ครบ'],
            ['2', 'บางส่วน (Partial)', 'สัตวแพทย์/พยาบาล — เห็นชื่อจริง เบอร์ 4 ตัวท้ายปิด'],
            ['3', 'น้อยที่สุด (Minimal)', 'พนักงานทั่วไป — เห็นแค่ชื่อย่อ เบอร์ปิดทั้งหมด'],
          ].map(([val, label, desc]) => `
            <label class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                          ${maskLevel === val ? 'border-primary bg-primary-subtle' : 'border-slate-100 hover:border-primary'}">
              <input type="radio" name="mask-level" value="${val}" class="mt-0.5 accent-primary"
                     ${maskLevel === val ? 'checked' : ''}>
              <div>
                <div class="font-semibold text-navy text-sm">${label}</div>
                <div class="text-xs text-slate-400 font-body">${desc}</div>
              </div>
            </label>`).join('')}
        </div>
        <button id="save-mask" class="btn-primary px-6 py-2">บันทึกระดับการซ่อนข้อมูล</button>
      </div>

      ${canManage ? `
      <!-- ── FEAT-05: เวลาทำการ ── -->
      <div class="card p-5 space-y-4" id="biz-hours-card">
        <div>
          <h3 class="font-bold text-navy text-lg">⏰ เวลาทำการ</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">ข้อมูลนี้ส่งให้ App ลูกค้าเพื่อกำหนดช่วงจองที่อนุญาต</p>
        </div>
        <div id="biz-hours-loading" class="text-slate-400 font-body text-sm">กำลังโหลด...</div>
        <div id="biz-hours-rows" class="space-y-2 hidden"></div>
        <button id="save-biz-hours" class="btn-primary px-6 py-2 hidden">บันทึกเวลาทำการ</button>
      </div>

      <!-- ── FEAT-05: ค่ารักษาเบื้องต้น ── -->
      <div class="card p-5 space-y-4">
        <div>
          <h3 class="font-bold text-navy text-lg">💊 ค่ารักษาเริ่มต้น</h3>
          <p class="text-sm text-slate-400 font-body mt-0.5">ใช้ pre-fill ใน POS — แก้ได้ต่อ visit</p>
        </div>
        <div id="rates-loading" class="text-slate-400 font-body text-sm">กำลังโหลด...</div>
        <div id="rates-rows" class="space-y-2 hidden"></div>
        <button id="save-rates" class="btn-primary px-6 py-2 hidden">บันทึกค่ารักษา</button>
      </div>

      <!-- ── FEAT-04: Role & Permission ── -->
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-bold text-navy text-lg">🔐 Role & Permission</h3>
            <p class="text-sm text-slate-400 font-body mt-0.5">กำหนด Role และสิทธิ์การเข้าถึงของพนักงาน</p>
          </div>
          <button id="add-role-btn" class="btn-primary text-sm px-3 py-2">+ เพิ่ม Role</button>
        </div>
        <div id="roles-loading" class="text-slate-400 font-body text-sm">กำลังโหลด...</div>
        <div id="roles-list" class="space-y-2 hidden"></div>
      </div>
      ` : ''}

      <!-- ── เปลี่ยนรหัสผ่าน ── -->
      <div class="card p-5 space-y-4">
        <h3 class="font-bold text-navy text-lg">เปลี่ยนรหัสผ่าน</h3>
        <div>
          <label class="input-label">รหัสผ่านใหม่ *</label>
          <div class="relative">
            <input id="new-pw" type="password" class="input-field pr-12"
              placeholder="อย่างน้อย 8 ตัวอักษร" minlength="8">
            <button type="button" id="toggle-pw"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy p-1">👁</button>
          </div>
        </div>
        <div>
          <label class="input-label">ยืนยันรหัสผ่านใหม่ *</label>
          <input id="confirm-pw" type="password" class="input-field"
            placeholder="พิมพ์รหัสผ่านอีกครั้ง">
        </div>
        <div id="pw-strength" class="hidden">
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div id="pw-bar" class="h-full rounded-full transition-all duration-300"></div>
          </div>
          <p id="pw-label" class="text-xs font-body mt-1"></p>
        </div>
        <button id="change-pw-btn" class="btn-primary w-full">เปลี่ยนรหัสผ่าน</button>
      </div>

    </div>`;

  // ── Store Info ─────────────────────────────────────────────────────────────
  container.querySelector('#save-store-info')?.addEventListener('click', async () => {
    const btn  = container.querySelector('#save-store-info');
    const name = container.querySelector('#si-name')?.value.trim();
    if (!name) { showToast('กรุณากรอกชื่อร้านค้า', 'error'); return; }

    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const payload = {
      name,
      branch_name:          container.querySelector('#si-branch')?.value.trim()  || null,
      phone:                container.querySelector('#si-phone')?.value.trim()   || null,
      tax_id:               container.querySelector('#si-taxid')?.value.trim()   || null,
      address:              container.querySelector('#si-address')?.value.trim() || null,
      website:              container.querySelector('#si-website')?.value.trim() || null,
      receipt_header_note:  container.querySelector('#si-note')?.value.trim()    || null,
    };

    const res = await apiFetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    btn.disabled = false; btn.textContent = 'บันทึกข้อมูลร้านค้า';

    if (res?.success) {
      // Update localStorage cache so documents pick it up immediately
      const updated = { ...store, ...payload };
      localStorage.setItem(STORAGE_KEYS.STORE_INFO, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEYS.STORE_NAME, name);
      showToast('บันทึกข้อมูลร้านค้าแล้ว ✓');
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // ── PromptPay ──────────────────────────────────────────────────────────────
  container.querySelector('#save-pp')?.addEventListener('click', () => {
    const val = container.querySelector('#pp-id').value.trim().replace(/[-\s]/g, '');
    if (val && !/^\d{10}$|^\d{13}$/.test(val)) {
      showToast('กรุณาใส่เบอร์ 10 หลัก หรือเลขภาษี 13 หลัก', 'error'); return;
    }
    localStorage.setItem(STORAGE_KEYS.PROMPTPAY_ID, val);
    showToast(val ? 'บันทึก PromptPay ID แล้ว ✓' : 'ลบ PromptPay ID แล้ว', 'info');
  });

  // ── Masking ────────────────────────────────────────────────────────────────
  container.querySelector('#save-mask')?.addEventListener('click', () => {
    const level = container.querySelector('input[name="mask-level"]:checked')?.value || '1';
    localStorage.setItem(STORAGE_KEYS.MASKING_LEVEL, level);
    const labels = { '1': 'เต็ม', '2': 'บางส่วน', '3': 'น้อยที่สุด' };
    showToast(`บันทึกระดับ "${labels[level]}" แล้ว ✓`, 'info');
  });

  // ── Password toggle ─────────────────────────────────────────────────────────
  container.querySelector('#toggle-pw')?.addEventListener('click', () => {
    const inp = container.querySelector('#new-pw');
    inp.type  = inp.type === 'password' ? 'text' : 'password';
  });

  // ── Strength indicator ──────────────────────────────────────────────────────
  container.querySelector('#new-pw')?.addEventListener('input', (e) => {
    const pw      = e.target.value;
    const wrapper = container.querySelector('#pw-strength');
    const bar     = container.querySelector('#pw-bar');
    const label   = container.querySelector('#pw-label');
    if (!pw) { wrapper.classList.add('hidden'); return; }
    wrapper.classList.remove('hidden');
    const score = _pwScore(pw);
    const cfg = [
      { w: '25%',  color: '#EF4444', text: 'อ่อนมาก'  },
      { w: '50%',  color: '#F97316', text: 'อ่อน'      },
      { w: '75%',  color: '#F59E0B', text: 'ปานกลาง'  },
      { w: '100%', color: '#0D9488', text: 'แข็งแรง'   },
    ][score - 1];
    bar.style.width      = cfg.w;
    bar.style.background = cfg.color;
    label.textContent    = cfg.text;
    label.style.color    = cfg.color;
  });

  // ── Change password ─────────────────────────────────────────────────────────
  container.querySelector('#change-pw-btn')?.addEventListener('click', async () => {
    const newPw  = container.querySelector('#new-pw').value;
    const confPw = container.querySelector('#confirm-pw').value;
    const btn    = container.querySelector('#change-pw-btn');

    if (!newPw || newPw.length < 8) {
      showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'error'); return;
    }
    if (newPw !== confPw) {
      showToast('รหัสผ่านไม่ตรงกัน', 'error'); return;
    }
    btn.disabled = true; btn.textContent = 'กำลังเปลี่ยน...';

    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPw }),
    });
    btn.disabled = false; btn.textContent = 'เปลี่ยนรหัสผ่าน';

    if (res?.success) {
      showToast('เปลี่ยนรหัสผ่านสำเร็จ ✓');
      container.querySelector('#new-pw').value     = '';
      container.querySelector('#confirm-pw').value = '';
      container.querySelector('#pw-strength').classList.add('hidden');
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  if (canManage) {
    _loadBizHours(container, storeId, store);
    _loadRates(container, storeId, store);
    _loadRoles(container, storeId);
  }
}

// ─── Business hours ───────────────────────────────────────────────────────────

async function _loadBizHours(container, storeId, store) {
  const loadingEl = container.querySelector('#biz-hours-loading');
  const rowsEl    = container.querySelector('#biz-hours-rows');
  const saveBtn   = container.querySelector('#save-biz-hours');
  if (!loadingEl || !rowsEl) return;

  const hours = store?.business_hours || {};

  loadingEl.classList.add('hidden');
  rowsEl.classList.remove('hidden');
  saveBtn?.classList.remove('hidden');

  rowsEl.innerHTML = Object.entries(DAYS_TH).map(([day, label]) => {
    const h       = hours[day] || { open: '08:00', close: '17:00', closed: false };
    return `
      <div class="flex items-center gap-3 py-1.5 border-b border-slate-50" data-day="${day}">
        <span class="w-20 text-sm font-body text-slate-600">${label}</span>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" class="bh-closed accent-red-500" ${h.closed ? 'checked' : ''}>
          <span class="text-xs text-slate-400 font-body">ปิดทั้งวัน</span>
        </label>
        <input type="time" class="bh-open input-field py-1 text-xs w-24 ${h.closed ? 'opacity-40' : ''}"
               value="${h.open || '08:00'}" ${h.closed ? 'disabled' : ''}>
        <span class="text-slate-300 text-xs">–</span>
        <input type="time" class="bh-close input-field py-1 text-xs w-24 ${h.closed ? 'opacity-40' : ''}"
               value="${h.close || '17:00'}" ${h.closed ? 'disabled' : ''}>
      </div>`;
  }).join('');

  // Toggle closed
  rowsEl.querySelectorAll('.bh-closed').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('[data-day]');
      row.querySelectorAll('.bh-open,.bh-close').forEach(inp => {
        inp.disabled = cb.checked;
        inp.classList.toggle('opacity-40', cb.checked);
      });
    });
  });

  saveBtn?.addEventListener('click', async () => {
    const bizHours = {};
    rowsEl.querySelectorAll('[data-day]').forEach(row => {
      const day    = row.dataset.day;
      const closed = row.querySelector('.bh-closed').checked;
      bizHours[day] = {
        open:   row.querySelector('.bh-open').value  || null,
        close:  row.querySelector('.bh-close').value || null,
        closed,
      };
    });
    const res = await apiFetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ business_hours: bizHours }),
    });
    if (res?.success) showToast('บันทึกเวลาทำการแล้ว ✓');
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

// ─── Service rates ────────────────────────────────────────────────────────────

const RATE_LABELS = {
  general_exam: 'ตรวจทั่วไป',
  vaccine:      'วัคซีน',
  surgery:      'ผ่าตัด',
  dental:       'ทำฟัน',
  blood_test:   'ตรวจเลือด',
};

async function _loadRates(container, storeId, store) {
  const loadingEl = container.querySelector('#rates-loading');
  const rowsEl    = container.querySelector('#rates-rows');
  const saveBtn   = container.querySelector('#save-rates');
  if (!loadingEl || !rowsEl) return;

  const rates = store?.default_service_rates || {};

  loadingEl.classList.add('hidden');
  rowsEl.classList.remove('hidden');
  saveBtn?.classList.remove('hidden');

  rowsEl.innerHTML = Object.entries(RATE_LABELS).map(([key, label]) => `
    <div class="flex items-center gap-3 py-1.5 border-b border-slate-50">
      <span class="flex-1 text-sm font-body text-slate-600">${label}</span>
      <div class="flex items-center gap-1">
        <span class="text-xs text-slate-400">฿</span>
        <input type="number" class="rate-input input-field py-1 text-sm w-24 text-right"
               data-key="${key}" value="${rates[key] || 0}" min="0" step="50">
      </div>
    </div>`).join('');

  saveBtn?.addEventListener('click', async () => {
    const newRates = {};
    rowsEl.querySelectorAll('.rate-input').forEach(inp => {
      newRates[inp.dataset.key] = parseFloat(inp.value) || 0;
    });
    const res = await apiFetch(`/api/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ default_service_rates: newRates }),
    });
    if (res?.success) showToast('บันทึกค่ารักษาแล้ว ✓');
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

// ─── Role management (FEAT-04) ────────────────────────────────────────────────

async function _loadRoles(container, storeId) {
  const loadingEl = container.querySelector('#roles-loading');
  const listEl    = container.querySelector('#roles-list');
  if (!loadingEl || !listEl) return;

  const res   = await apiFetch(`/api/roles?store_id=${storeId}`);
  const roles = res?.data || [];

  loadingEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  _renderRoleList(listEl, roles, storeId, container);

  container.querySelector('#add-role-btn')?.addEventListener('click', () => {
    _openRoleModal(null, storeId, () => _loadRoles(container, storeId));
  });
}

function _renderRoleList(el, roles, storeId, container) {
  if (!roles.length) {
    el.innerHTML = `<p class="text-sm text-slate-400 font-body">ยังไม่มี Role — กด "+ เพิ่ม Role"</p>`;
    return;
  }

  el.innerHTML = roles.map(r => {
    const perms = r.permissions || {};
    const permSummary = PERM_MODULES.filter(m => (perms[m] || []).includes('view')).join(', ') || '—';
    return `
      <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${r.color || '#6B7280'}"></div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-navy text-sm">${r.name}</div>
          <div class="text-xs text-slate-400 font-body truncate">เข้าถึง: ${permSummary}</div>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button data-edit-role="${r.id}" data-role='${JSON.stringify(r)}'
            class="text-xs border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg
                   hover:border-primary hover:text-primary transition-colors">แก้ไข</button>
          <button data-delete-role="${r.id}"
            class="text-xs border border-red-200 text-red-400 px-2.5 py-1.5 rounded-lg
                   hover:bg-red-50 transition-colors">ลบ</button>
        </div>
      </div>`;
  }).join('');

  el.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-role]');
    const delBtn  = e.target.closest('[data-delete-role]');

    if (editBtn) {
      const role = JSON.parse(editBtn.dataset.role);
      _openRoleModal(role, storeId, () => _loadRoles(container, storeId));
    }
    if (delBtn) {
      if (!confirm('ลบ Role นี้?')) return;
      const res = await apiFetch(`/api/roles/${delBtn.dataset.deleteRole}`, { method: 'DELETE' });
      if (res?.success) { showToast('ลบ Role แล้ว', 'info'); _loadRoles(container, storeId); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function _openRoleModal(role, storeId, onSave) {
  const isEdit  = !!role;
  const perms   = role?.permissions || {};
  const modal   = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">${isEdit ? 'แก้ไข Role' : '+ สร้าง Role ใหม่'}</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อ Role *</label>
          <input id="rl-name" class="input-field" value="${role?.name || ''}" placeholder="สัตวแพทย์">
        </div>
        <div>
          <label class="input-label">สี</label>
          <input id="rl-color" class="input-field h-10" type="color" value="${role?.color || '#6B7280'}">
        </div>
      </div>
      <div>
        <label class="input-label mb-2">สิทธิ์การเข้าถึง</label>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-100">
                <th class="text-left py-2 text-slate-500 font-semibold">Module</th>
                ${PERM_ACTIONS.map(a => `<th class="text-center py-2 text-slate-500 font-semibold capitalize">${a}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${PERM_MODULES.map(mod => `
                <tr class="border-b border-slate-50">
                  <td class="py-2 font-semibold text-navy">${mod}</td>
                  ${PERM_ACTIONS.map(act => `
                    <td class="text-center py-2">
                      <input type="checkbox" class="perm-cb accent-primary"
                             data-mod="${mod}" data-act="${act}"
                             ${(perms[mod] || []).includes(act) ? 'checked' : ''}>
                    </td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button id="rl-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="rl-save" class="btn-primary flex-1">${isEdit ? 'บันทึก' : 'สร้าง Role'}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#rl-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#rl-save').addEventListener('click', async () => {
    const name  = modal.querySelector('#rl-name').value.trim();
    const color = modal.querySelector('#rl-color').value;
    if (!name) { showToast('กรุณากรอกชื่อ Role', 'error'); return; }

    const permissions = {};
    PERM_MODULES.forEach(mod => { permissions[mod] = []; });
    modal.querySelectorAll('.perm-cb:checked').forEach(cb => {
      const { mod, act } = cb.dataset;
      if (!permissions[mod]) permissions[mod] = [];
      if (!permissions[mod].includes(act)) permissions[mod].push(act);
    });

    const btn = modal.querySelector('#rl-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = isEdit
      ? await apiFetch(`/api/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ name, color, permissions }) })
      : await apiFetch('/api/roles', { method: 'POST', body: JSON.stringify({ store_id: storeId, name, color, permissions }) });

    if (res?.success) {
      showToast(isEdit ? 'บันทึก Role แล้ว ✓' : `สร้าง Role "${name}" แล้ว ✓`);
      modal.remove();
      onSave();
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = isEdit ? 'บันทึก' : 'สร้าง Role';
    }
  });
}

function _pwScore(pw) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return Math.max(1, s);
}
