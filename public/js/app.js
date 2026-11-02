/**
 * FUFU Partner — Application Entry Point
 * Detects current page and boots the correct module.
 */

const path = window.location.pathname.toLowerCase();

if (path.includes('login')) {
  bootLogin();
} else if (path.includes('register')) {
  bootRegister();
} else if (path.includes('onboarding')) {
  bootOnboarding();
} else if (path.includes('dashboard')) {
  bootDashboard();
} else if (path === '/' || path.includes('index')) {
  bootLanding();
}

// ─── Page booters ─────────────────────────────────────────────────────────────

async function bootLogin() {
  const { isAuthenticated, doLogin, renderStoreList, selectStore } = await import('./auth.js');
  const { showToast } = await import('./utils/toast.js');
  const { storage }   = await import('./utils/storage.js');
  const { STORAGE_KEYS, REMEMBER_EMAIL_KEY } = await import('./utils/config.js');

  // ── "Remember me" auto-login ──────────────────────────────────────────────
  // If the user opted to stay signed in and a session + store are still present,
  // skip the form entirely. If the token has expired, the dashboard's auth guard
  // / apiFetch refresh handles it — and on refresh failure it clears the session
  // and bounces back here, so there's no redirect loop (no token = no auto-login).
  if (storage.get(STORAGE_KEYS.REMEMBER) === '1'
      && isAuthenticated()
      && storage.get(STORAGE_KEYS.STORE_ID)) {
    window.location.replace('/dashboard.html');
    return;
  }

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
  const rememberEl  = document.getElementById('remember-me');

  if (!form) return;

  // Pre-fill the remembered email and restore the checkbox state.
  const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
  if (rememberedEmail && emailEl) emailEl.value = rememberedEmail;
  if (rememberEl) rememberEl.checked = storage.get(STORAGE_KEYS.REMEMBER) === '1'
                                       || !!rememberedEmail;

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
      showToast(result.error, 'error', 6000);
      return;
    }

    // Persist "remember me" intent + email so the next visit can auto-login.
    if (rememberEl?.checked) {
      storage.set(STORAGE_KEYS.REMEMBER, '1');
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      storage.remove(STORAGE_KEYS.REMEMBER);
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    if (result.needs_onboarding || result.stores.length === 0) {
      // No stores yet — show create-store form inline
      form.closest('section')?.classList.add('hidden');
      storePanel?.classList.remove('hidden');
      const heading = storePanel.querySelector('h2');
      const sub     = storePanel.querySelector('p');
      if (heading) heading.textContent = 'สร้างร้านค้าแรก';
      if (sub)     sub.textContent     = 'บัญชีของคุณยังไม่มีร้านค้า — สร้างได้เลยตอนนี้';
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
  const { showToast }  = await import('./utils/toast.js');
  const { apiFetch }   = await import('./utils/api-client.js');
  const { storage }    = await import('./utils/storage.js');
  const { STORAGE_KEYS, CATEGORY_MAP } = await import('./utils/config.js');
  const { selectStore } = await import('./auth.js');

  const form      = document.getElementById('register-form');
  const submitBtn = document.getElementById('reg-submit');
  const spinner   = document.getElementById('reg-spinner');
  const btnText   = document.getElementById('reg-btn-text');
  const existsBanner = document.getElementById('exists-banner');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const email      = fd.get('email')?.trim();
    const password   = fd.get('password');
    const name       = fd.get('name')?.trim();
    const store_name = fd.get('store_name')?.trim();

    if (!name || !email || !password || !store_name) {
      showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
      return;
    }

    // Loading state
    submitBtn.disabled  = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'กำลังสร้างบัญชี...';
    existsBanner?.classList.add('hidden');

    let result;
    try {
      result = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone:          fd.get('phone') || '',
          password,
          store_name,
          store_category: fd.get('store_category') || 'vet_clinic',
        }),
      });
    } catch (error) {
      showToast(error?.message || 'เชื่อมต่อระบบสมัครสมาชิกไม่ได้ กรุณาลองใหม่', 'error');
      return;
    } finally {
      submitBtn.disabled  = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'สร้างบัญชีและร้านค้า →';
    }

    // Handle "email already exists"
    if (result?.already_exists) {
      existsBanner?.classList.remove('hidden');
      existsBanner?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!result?.success) {
      showToast(result?.error || (result === null
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
        : 'เกิดข้อผิดพลาด'), 'error');
      return;
    }

    if (result.needs_email_verification) {
      showToast('สร้างบัญชีสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
      form.reset();
      setTimeout(() => { window.location.href = '/login.html'; }, 1800);
      return;
    }

    // ✅ Success — save token + select store immediately (no login redirect)
    storage.set(STORAGE_KEYS.TOKEN,         result.token);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, result.refresh_token || '');
    storage.set(STORAGE_KEYS.USER,          JSON.stringify(result.user));

    if (result.warning) showToast(result.warning, 'error');

    if (result.stores?.length) {
      showToast(`สร้างบัญชีและร้าน "${result.stores[0].name}" สำเร็จ! 🎉`);
      setTimeout(() => selectStore(result.stores[0]), 800);
    } else {
      // needs_onboarding — redirect to login which will show create-store form
      showToast('สร้างบัญชีสำเร็จ! กรุณาสร้างร้านค้าของคุณ');
      setTimeout(() => { window.location.href = '/login.html'; }, 1200);
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

async function bootOnboarding() {
  const { requireAuth, selectStore } = await import('./auth.js');
  if (!requireAuth()) return;

  const { showToast } = await import('./utils/toast.js');
  const { apiFetch }  = await import('./utils/api-client.js');
  const container     = document.getElementById('onboarding-store');
  if (!container) return;

  renderCreateStore(container, null, showToast, selectStore);
}

async function bootDashboard() {
  const { requireAuth } = await import('./auth.js');
  if (!requireAuth()) return;
  const { initDashboard } = await import('./partner/dashboard.js');
  await initDashboard();
}
