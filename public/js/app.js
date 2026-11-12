/**
 * FUFU Partner — Application Entry Point
 * Detects current page and boots the correct module.
 */

const path = window.location.pathname.toLowerCase();

// Translated UI string (public/js/i18n.js), falling back to the Thai original
const tr = (key, fallback) => window.FUFU_I18N?.t(key) || fallback;

if (path.includes('login')) {
  bootLogin();
} else if (path.includes('register')) {
  bootRegister();
} else if (path.includes('onboarding')) {
  bootOnboarding();
} else if (path.includes('dashboard')) {
  bootDashboard();
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
      showToast(tr('errEmpty', 'กรุณากรอกอีเมลและรหัสผ่าน'), 'error');
      return;
    }

    // Loading state
    submitBtn.disabled  = true;
    spinner.classList.remove('hidden');
    btnText.textContent = tr('signingIn', 'กำลังเข้าสู่ระบบ...');

    const result = await doLogin(email, password);

    submitBtn.disabled  = false;
    spinner.classList.add('hidden');
    btnText.textContent = tr('submitLogin', 'เข้าสู่ระบบ');

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
      if (heading) heading.textContent = tr('firstStore', 'สร้างร้านค้าแรก');
      if (sub)     sub.textContent     = tr('firstStoreSub', 'บัญชีของคุณยังไม่มีร้านค้า — สร้างได้เลยตอนนี้');
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
      showToast(tr('errFill', 'กรุณากรอกข้อมูลให้ครบ'), 'error');
      return;
    }

    // Loading state
    submitBtn.disabled  = true;
    spinner.classList.remove('hidden');
    btnText.textContent = tr('creating', 'กำลังสร้างบัญชี...');
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
      showToast(error?.message || tr('errRegister', 'เชื่อมต่อระบบสมัครสมาชิกไม่ได้ กรุณาลองใหม่'), 'error');
      return;
    } finally {
      submitBtn.disabled  = false;
      spinner.classList.add('hidden');
      btnText.textContent = tr('submitRegister', 'สร้างบัญชีและร้านค้า');
    }

    // Handle "email already exists"
    if (result?.already_exists) {
      existsBanner?.classList.remove('hidden');
      existsBanner?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!result?.success) {
      showToast(result?.error || (result === null
        ? tr('errNetwork', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
        : tr('errGeneric', 'เกิดข้อผิดพลาด')), 'error');
      return;
    }

    if (result.needs_email_verification) {
      showToast(tr('okVerify', 'สร้างบัญชีสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'));
      form.reset();
      setTimeout(() => { window.location.href = '/login.html'; }, 1800);
      return;
    }

    if (result.pending_approval) {
      form.reset();
      showToast(result.message || tr('pendingApproval', 'สมัครสำเร็จ บัญชีกำลังรอ FUFU อนุมัติก่อนเข้าใช้งาน'));
      setTimeout(() => { window.location.href = '/login.html'; }, 2200);
      return;
    }

    //Success — save token + select store immediately (no login redirect)
    storage.set(STORAGE_KEYS.TOKEN,         result.token);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, result.refresh_token || '');
    storage.set(STORAGE_KEYS.USER,          JSON.stringify(result.user));

    if (result.warning) showToast(result.warning, 'error');

    if (result.stores?.length) {
      showToast(`สร้างบัญชีและร้าน "${result.stores[0].name}" สำเร็จ!`);
      setTimeout(() => selectStore(result.stores[0]), 800);
    } else {
      // needs_onboarding — redirect to login which will show create-store form
      showToast(tr('okCreateStore', 'สร้างบัญชีสำเร็จ! กรุณาสร้างร้านค้าของคุณ'));
      setTimeout(() => { window.location.href = '/login.html'; }, 1200);
    }
  });
}

function renderCreateStore(container, token, showToast, selectStore) {
  const { CATEGORY_MAP } = window.__fufu_config__ || {
    CATEGORY_MAP: {
      vet_clinic:   { label: 'คลินิกสัตว์แพทย์', icon: '' },
      pet_shop:     { label: 'ร้านค้าสัตว์เลี้ยง', icon: '' },
      pet_hotel:    { label: 'โรงแรมสัตว์เลี้ยง', icon: '' },
      pet_grooming: { label: 'บริการอาบน้ำตัดขน', icon: '' },
    },
  };

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <label class="input-label">${tr('storeName', 'ชื่อร้าน / คลินิก')}</label>
        <input id="cs-name" class="input-field" placeholder="Happy Paws Clinic">
      </div>
      <div>
        <label class="input-label">${tr('category', 'ประเภทธุรกิจ')}</label>
        <select id="cs-category" class="input-field">
          <option value="vet_clinic">${tr('catVet', 'คลินิกสัตวแพทย์')}</option>
          <option value="pet_shop">${tr('catShop', 'ร้านค้าสัตว์เลี้ยง')}</option>
          <option value="pet_hotel">${tr('catHotel', 'โรงแรมสัตว์เลี้ยง')}</option>
          <option value="pet_grooming">${tr('catGroom', 'อาบน้ำตัดขน')}</option>
        </select>
      </div>
      <button id="cs-submit" class="btn-primary w-full">${tr('createStore', 'สร้างร้านค้า →')}</button>
    </div>`;

  container.querySelector('#cs-submit').addEventListener('click', async () => {
    const name     = container.querySelector('#cs-name').value.trim();
    const category = container.querySelector('#cs-category').value;
    if (!name) { showToast(tr('errStoreName', 'กรุณากรอกชื่อร้าน'), 'error'); return; }

    const btn = container.querySelector('#cs-submit');
    btn.disabled = true;
    btn.textContent = tr('creatingStore', 'กำลังสร้าง...');

    const { apiFetch } = await import('./utils/api-client.js');
    const res = await apiFetch('/api/stores', {
      method: 'POST',
      body: JSON.stringify({ name, category }),
    });

    if (res?.success) {
      const { storage } = await import('./utils/storage.js');
      storage.clearSession();
      container.innerHTML = `
        <div class="rounded-2xl bg-white p-6 text-center space-y-3">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-2xl"><svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <h3 class="font-semibold text-slate-800">${tr('pendingTitle', 'รอการอนุมัติ')}</h3>
          <p class="text-sm leading-6 text-slate-500">${tr('pendingApproval', 'สร้างร้านแล้ว บัญชีกำลังรอ FUFU อนุมัติก่อนเข้าใช้งาน')}</p>
          <a class="btn-primary inline-flex justify-center px-5" href="/">${tr('back', 'กลับหน้าหลัก')}</a>
        </div>`;
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false;
      btn.textContent = tr('createStore', 'สร้างร้านค้า →');
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
  const { apiFetch } = await import('./utils/api-client.js');
  const access = await apiFetch('/api/auth/partner-access');
  if (!access?.success) return;
  if (Array.isArray(access.stores)) {
    const [{ storage }, { STORAGE_KEYS }] = await Promise.all([
      import('./utils/storage.js'),
      import('./utils/config.js'),
    ]);
    const selectedId = storage.get(STORAGE_KEYS.STORE_ID);
    const selected = access.stores.find(store => store.id === selectedId);
    if (selected) storage.set(STORAGE_KEYS.STORE_ACTIVE, selected.is_active === false ? 'false' : 'true');
  }
  if (access.status !== 'approved') {
    const { storage } = await import('./utils/storage.js');
    if (access.status === 'onboarding') {
      storage.clearSession();
      window.location.replace('/login.html');
      return;
    }
    document.body.innerHTML = `
      <main class="min-h-screen grid place-items-center bg-[#faf7f2] p-5">
        <section class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${access.status === 'rejected' ? 'bg-red-50' : 'bg-amber-50'} text-2xl">${access.status === 'rejected' ? '✕' : ''}</div>
          <h1 class="text-xl font-bold text-slate-800">${access.status === 'rejected' ? 'ไม่อนุมัติคำขอพาร์ทเนอร์' : tr('pendingTitle', 'รอการอนุมัติ')}</h1>
          <p class="mt-3 text-sm leading-6 text-slate-500">${access.status === 'rejected' ? 'คำขอสมัครร้านของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ' : tr('pendingApproval', 'บัญชีพาร์ทเนอร์ของคุณยังรอ FUFU อนุมัติ เมื่ออนุมัติแล้วจึงจะเข้าใช้งานได้')}</p>
          <button id="pending-logout" class="btn-primary mt-6 w-full">${tr('logout', 'ออกจากระบบ')}</button>
        </section>
      </main>`;
    document.getElementById('pending-logout')?.addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      logout();
    });
    return;
  }
  const { initDashboard } = await import('./partner/dashboard.js');
  await initDashboard();
}
