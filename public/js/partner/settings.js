import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

export async function renderSettings(container) {
  const user    = storage.getJSON(STORAGE_KEYS.USER) || {};
  const store   = {
    id:       storage.get(STORAGE_KEYS.STORE_ID),
    name:     storage.get(STORAGE_KEYS.STORE_NAME),
    category: storage.get(STORAGE_KEYS.STORE_CATEGORY),
  };
  const isStaff     = !!storage.getJSON('fufu_staff_roles');
  const ppId        = localStorage.getItem(STORAGE_KEYS.PROMPTPAY_ID) || '';
  const maskLevel   = localStorage.getItem(STORAGE_KEYS.MASKING_LEVEL) || '1';

  container.innerHTML = `
    <div class="space-y-5 max-w-xl">

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
}

function _pwScore(pw) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return Math.max(1, s);
}
