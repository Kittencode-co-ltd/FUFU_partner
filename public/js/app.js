/**
 * FUFU Partner — Application Entry Point
 * Detects current page and boots the correct module.
 */

const path = window.location.pathname.toLowerCase();

if (path.includes('login')) {
  bootLogin();
} else if (path.includes('register')) {
  bootRegister();
} else if (path.includes('dashboard')) {
  bootDashboard();
} else if (path === '/' || path.includes('index')) {
  bootLanding();
}

// ─── Page booters ─────────────────────────────────────────────────────────────

async function bootLogin() {
  const { isAuthenticated, doLogin, renderStoreList, selectStore } = await import('./auth.js');
  const { showToast } = await import('./utils/toast.js');

  if (isAuthenticated()) {
    // Already logged in — show a resume banner instead of hard redirect
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-primary rounded-xl px-5 py-3 shadow-card flex items-center gap-4 text-sm';
    banner.innerHTML = `
      <span class="text-navy font-semibold">คุณ login อยู่แล้ว</span>
      <a href="/dashboard.html" class="btn-primary py-1.5 px-4 text-xs">ไป Dashboard</a>
      <button id="banner-logout" class="text-slate-400 hover:text-red-500 transition-colors text-xs">ออกจากระบบ</button>`;
    document.body.appendChild(banner);
    banner.querySelector('#banner-logout').addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      logout();
    });
  }

  const form        = document.getElementById('login-form');
  const emailEl     = document.getElementById('email');
  const passwordEl  = document.getElementById('password');
  const submitBtn   = document.getElementById('submit-btn');
  const btnText     = document.getElementById('btn-text');
  const spinner     = document.getElementById('btn-spinner');
  const storePanel  = document.getElementById('store-panel');
  const storeList   = document.getElementById('store-list');
  const backBtn     = document.getElementById('back-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = emailEl.value.trim();
    const password = passwordEl.value;

    if (!email || !password) {
      showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
      return;
    }

    // Loading state
    submitBtn.disabled  = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'กำลังเข้าสู่ระบบ...';

    const result = await doLogin(email, password);

    submitBtn.disabled  = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'เข้าสู่ระบบ';

    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }

    if (result.stores.length === 0) {
      // No stores yet — show create-store form
      form.closest('section')?.classList.add('hidden');
      storePanel?.classList.remove('hidden');
      renderCreateStore(storeList, result.token, showToast, selectStore);
    } else if (result.stores.length === 1) {
      selectStore(result.stores[0]);
    } else {
      form.closest('section')?.classList.add('hidden');
      storePanel?.classList.remove('hidden');
      renderStoreList(storeList, result.stores);
    }
  });

  backBtn?.addEventListener('click', () => {
    storePanel?.classList.add('hidden');
    form.closest('section')?.classList.remove('hidden');
  });
}

async function bootRegister() {
  const { showToast } = await import('./utils/toast.js');
  const { apiFetch }  = await import('./utils/api-client.js');

  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const result = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name:        fd.get('name'),
        email:       fd.get('email'),
        phone:       fd.get('phone'),
        password:    fd.get('password'),
        partnerType: fd.get('partnerType'),
      }),
    });

    if (result?.success) {
      showToast('ลงทะเบียนสำเร็จ! กรุณาตรวจสอบอีเมลยืนยัน');
      setTimeout(() => { window.location.href = '/login.html'; }, 2000);
    } else {
      showToast(result?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

async function bootLanding() {
  const { initHero }             = await import('./landing/hero.js');
  const { initBooking }          = await import('./landing/booking.js');
  const { initTestimonials }     = await import('./landing/testimonials.js');
  const { initBusinessFeatures } = await import('./landing/business-features.js');
  initHero();
  initBusinessFeatures();
  initBooking();
  initTestimonials();
}

function renderCreateStore(container, token, showToast, selectStore) {
  const { CATEGORY_MAP } = window.__fufu_config__ || {
    CATEGORY_MAP: {
      vet_clinic:   { label: 'คลินิกสัตว์แพทย์', icon: '🏥' },
      pet_shop:     { label: 'ร้านค้าสัตว์เลี้ยง', icon: '🛍' },
      pet_hotel:    { label: 'โรงแรมสัตว์เลี้ยง', icon: '🏨' },
      pet_grooming: { label: 'บริการอาบน้ำตัดขน', icon: '✂️' },
    },
  };

  container.innerHTML = `
    <div class="space-y-4">
      <p class="text-slate-500 text-sm font-body">ยังไม่มีร้านค้า — สร้างร้านแรกของคุณได้เลย</p>
      <div>
        <label class="input-label">ชื่อร้าน / คลินิก</label>
        <input id="cs-name" class="input-field" placeholder="Happy Paws Clinic">
      </div>
      <div>
        <label class="input-label">ประเภทธุรกิจ</label>
        <select id="cs-category" class="input-field">
          <option value="vet_clinic">🏥 คลินิกสัตว์แพทย์</option>
          <option value="pet_shop">🛍 ร้านค้าสัตว์เลี้ยง</option>
          <option value="pet_hotel">🏨 โรงแรมสัตว์เลี้ยง</option>
          <option value="pet_grooming">✂️ บริการอาบน้ำตัดขน</option>
        </select>
      </div>
      <button id="cs-submit" class="btn-primary w-full">สร้างร้านค้า →</button>
    </div>`;

  container.querySelector('#cs-submit').addEventListener('click', async () => {
    const name     = container.querySelector('#cs-name').value.trim();
    const category = container.querySelector('#cs-category').value;
    if (!name) { showToast('กรุณากรอกชื่อร้าน', 'error'); return; }

    const btn = container.querySelector('#cs-submit');
    btn.disabled = true;
    btn.textContent = 'กำลังสร้าง...';

    const { apiFetch } = await import('./utils/api-client.js');
    const res = await apiFetch('/api/stores', {
      method: 'POST',
      body: JSON.stringify({ name, category }),
    });

    if (res?.success) {
      showToast(`สร้าง "${name}" เรียบร้อย`);
      setTimeout(() => selectStore(res.data), 800);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false;
      btn.textContent = 'สร้างร้านค้า →';
    }
  });
}

async function bootDashboard() {
  const { requireAuth } = await import('./auth.js');
  if (!requireAuth()) return;
  const { initDashboard } = await import('./partner/dashboard.js');
  await initDashboard();
}
