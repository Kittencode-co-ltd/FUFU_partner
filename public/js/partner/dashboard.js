import { getCurrentRole, getCurrentUser, getCurrentStore, logout } from '../auth.js';
import { showToast } from '../utils/toast.js';
import { apiFetch }       from '../utils/api-client.js';
import { storage }        from '../utils/storage.js';
import { STORAGE_KEYS, CATEGORY_MAP, FEATURE_FLAGS } from '../utils/config.js';
import { startSyncEngine } from '../utils/sync-engine.js';
import { escapeHtml } from '../utils/formatters.js';
import { icon } from '../utils/icons.js';

// ─── Staff Mode config ────────────────────────────────────────────────────────

const MODES = {
  all: {
    label: 'ทั่วไป', icon: 'th-large',
    description: 'เข้าถึงทุกส่วน',
  },
  counter: {
    label: 'เคาน์เตอร์', icon: 'clipboard-list',
    description: 'รับคนไข้ นัดหมาย เก็บเงิน',
    defaultPage: 'queue',
    pages: ['home', 'queue', 'pets', 'pos', 'income'],
  },
  doctor: {
    label: 'แพทย์', icon: 'stethoscope',
    description: 'ตรวจ บันทึก OPD',
    defaultPage: 'opd',
    pages: ['home', 'queue', 'opd', 'medical', 'pets', 'inventory'],
  },
  pharmacy: {
    label: 'สต็อก/เภสัช', icon: 'box',
    description: 'จัดยา รับสินค้า สต็อก',
    defaultPage: 'inventory',
    pages: ['home', 'inventory'],
  },
  finance: {
    label: 'การเงิน', icon: 'coins',
    description: 'รายได้ ใบเสร็จ',
    defaultPage: 'income',
    pages: ['home', 'income'],
  },
};

const MODE_KEY = 'fufu_mode';
let _currentMode = 'all';

export function getMode() { return _currentMode; }

function _setMode(mode, role) {
  _currentMode = mode;
  storage.set(MODE_KEY, mode);
  _buildNav(role);
  _renderModeSwitcher(role);
  const cfg = MODES[mode];
  if (FEATURE_FLAGS.MVP_MODE) navigate('home');
  else if (cfg?.defaultPage) navigate(cfg.defaultPage);
  else navigate('home');
  showToast(`โหมด: ${cfg?.label || mode}`);
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = {
  vet: [
    { id: 'home',      icon: 'chart-bar',      label: 'ภาพรวม' },
    { id: 'queue',     icon: 'clipboard-list', label: 'คิวตรวจ' },
    { id: 'pets',      icon: 'paw',            label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'opd',       icon: 'stethoscope',    label: 'ห้องตรวจ' },
    { id: 'ipd',       icon: 'hospital',       label: 'IPD Ward' },
    { id: 'medical',   icon: 'folder-open',    label: 'ประวัติการรักษา' },
    { id: 'inventory', icon: 'box',            label: 'สต็อก / ยา' },
    { id: 'income',    icon: 'coins',          label: 'รายได้' },
    { id: 'documents', icon: 'file-alt',       label: 'เอกสาร' },
    { id: 'kanban',    icon: 'tasks',          label: 'Task Board' },
    { id: 'staff',     icon: 'users',          label: 'จัดการพนักงาน' },
    { id: 'settings',  icon: 'cog',            label: 'ตั้งค่า' },
  ],
  shop: [
    { id: 'home',      icon: 'chart-bar',      label: 'ภาพรวม' },
    { id: 'queue',     icon: 'clipboard-list', label: 'คิว' },
    { id: 'inventory', icon: 'box',            label: 'สต็อก' },
    { id: 'income',    icon: 'coins',          label: 'รายได้' },
    { id: 'settings',  icon: 'cog',            label: 'ตั้งค่า' },
  ],
  hotel: [
    { id: 'home',     icon: 'chart-bar',      label: 'ภาพรวม' },
    { id: 'queue',    icon: 'clipboard-list', label: 'คิว' },
    { id: 'pets',     icon: 'paw',            label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'hotel',    icon: 'bed',            label: 'ห้องพัก' },
    { id: 'income',   icon: 'coins',          label: 'รายได้' },
    { id: 'settings', icon: 'cog',            label: 'ตั้งค่า' },
  ],
  grooming: [
    { id: 'home',     icon: 'chart-bar',      label: 'ภาพรวม' },
    { id: 'grooming', icon: 'cut',            label: 'คิว Grooming' },
    { id: 'pets',     icon: 'paw',            label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'income',   icon: 'coins',          label: 'รายได้' },
    { id: 'settings', icon: 'cog',            label: 'ตั้งค่า' },
  ],
  admin: [
    { id: 'home',     icon: 'chart-bar', label: 'ภาพรวม' },
    { id: 'settings', icon: 'cog',       label: 'ตั้งค่า' },
  ],
};

const MVP_NAV = [
  { id: 'home',         icon: 'chart-bar',      label: 'ภาพรวม' },
  { id: 'appointments', icon: 'clipboard-list', label: 'นัดหมาย' },
  { id: 'calendar',     icon: 'calendar-alt',   label: 'ปฏิทิน' },
  { id: 'patients',     icon: 'paw',            label: 'สัตว์ที่เข้ารับบริการ' },
  { id: 'summaries',    icon: 'folder-open',    label: 'สรุปการเข้ารับบริการ' },
  { id: 'clinic',       icon: 'hospital-alt',   label: 'ข้อมูลคลินิก' },
  { id: 'users',        icon: 'users',          label: 'ผู้ใช้งาน' },
];

// Checked before rendering so an out-of-scope module is never lazy-loaded.
const MVP_NAV_PAGES = new Set([...MVP_NAV.map(item => item.id), 'pet-profile']);
const MVP_ROLE_PAGES = {
  owner: new Set(MVP_NAV.map(item => item.id)),
  reception: new Set(['home', 'appointments', 'calendar', 'patients', 'summaries', 'clinic']),
  vet: new Set(['home', 'appointments', 'calendar', 'patients', 'summaries', 'clinic']),
};

const PAGE_TITLES = {
  home:         'ภาพรวม',
  appointments: 'นัดหมาย',
  calendar:     'ปฏิทิน',
  patients:     'สัตว์ที่เข้ารับบริการ',
  summaries:    'สรุปการเข้ารับบริการ',
  clinic:       'ข้อมูลคลินิก',
  users:        'ผู้ใช้งาน',
  queue:        'คิวตรวจ',
  pets:         'สัตว์เลี้ยง & นัดหมาย',
  'pet-profile':'โปรไฟล์สัตว์เลี้ยง',
  opd:          'ห้องตรวจ',
  ipd:          'IPD Ward',
  medical:      'ประวัติการรักษา',
  inventory:    'สต็อก / ยา',
  staff:        'จัดการพนักงาน',
  pos:          'ชำระเงิน (POS)',
  income:       'รายได้',
  hotel:        'ห้องพัก',
  grooming:     'บริการ Grooming',
  documents:    'ศูนย์เอกสาร',
  kanban:       'Task Board',
  settings:     'ตั้งค่า',
};

// ─── Navigate ─────────────────────────────────────────────────────────────────

// Pages that are safe to restore on refresh (no mandatory detail context needed)
const _RESTORABLE_PAGES = new Set([
  'home','queue','medical','pets','hotel','grooming',
  'inventory','finance','ipd','documents','kanban','settings','users','staff','opd',
  'appointments','calendar','patients','summaries','clinic',
]);
const _PAGE_KEY = 'fufu_current_page';

export function navigate(pageId, detail = null) {
  if (FEATURE_FLAGS.MVP_MODE && !MVP_NAV_PAGES.has(pageId)) pageId = 'home';
  document.dispatchEvent(new CustomEvent('fufu:navigate', { detail: pageId }));
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.remove('hidden');

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || pageId;

  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === pageId;
    el.classList.toggle('bg-white/10',      active);
    el.classList.toggle('text-white',       active);
    el.classList.toggle('text-slate-400',   !active);
    el.classList.toggle('border-l-2',       active);
    el.classList.toggle('border-primary',   active);
    el.classList.toggle('border-l-0',       !active);
  });

  if (_RESTORABLE_PAGES.has(pageId)) sessionStorage.setItem(_PAGE_KEY, pageId);

  _renderPage(pageId, detail);
}

// ─── Store switcher (multi-branch) ──────────────────────────────────────────────

async function _initStoreSwitcher() {
  const btn  = document.getElementById('sb-store-switcher');
  const dd   = document.getElementById('sb-store-dropdown');
  const chev = document.getElementById('sb-store-chevron');
  if (!btn || !dd) return;

  // Prefer the cached stores list saved at login time — it includes ALL accessible
  // stores (owned + staff). Falling back to /api/stores only returns owned stores,
  // which makes staff accounts always see length≤1 and hides the chevron even when
  // they can access multiple branches.
  const cachedRaw = storage.get(STORAGE_KEYS.STORES_LIST);
  let stores = cachedRaw ? JSON.parse(cachedRaw) : null;

  if (!stores) {
    const res = await apiFetch('/api/stores');
    stores = res?.data || [];
    if (stores.length) storage.set(STORAGE_KEYS.STORES_LIST, JSON.stringify(stores));
  }

  const currentId = storage.get(STORAGE_KEYS.STORE_ID);

  // Only one store (or none) → nothing to switch; keep it static.
  if (stores.length <= 1) {
    chev?.classList.add('hidden');
    btn.style.cursor = 'default';
    return;
  }

  const check = `<svg class="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

  dd.innerHTML = stores.map(s => {
    const cat    = CATEGORY_MAP[s.category] || { label: s.category || '', icon: 'store' };
    const active = s.id === currentId;
    const branch = s.branch_name ? ` · ${s.branch_name}` : '';
    return `
      <button data-store-id="${s.id}" data-store-name="${escapeHtml(s.name)}" data-store-category="${escapeHtml(s.category)}"
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${active ? 'bg-primary-subtle' : 'hover:bg-slate-50'}">
        <span class="w-4 flex items-center justify-center flex-shrink-0 text-slate-400">${icon(cat.icon, 'w-3.5 h-3.5')}</span>
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-semibold text-navy truncate">${escapeHtml(s.name)}${escapeHtml(branch)}</span>
          <span class="block text-xs text-slate-400 truncate">${cat.label}</span>
        </span>
        ${active ? check : ''}
      </button>`;
  }).join('');

  const setOpen = (open) => {
    dd.classList.toggle('hidden', !open);
    if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
  };

  btn.addEventListener('click', () => {
    setOpen(dd.classList.contains('hidden'));
  });
  // Close on any click outside the switcher/dropdown. Using closest() rather than
  // stopPropagation guarantees the same click that opens it won't also close it.
  document.addEventListener('click', (e) => {
    if (e.target.closest('#sb-store-switcher') || e.target.closest('#sb-store-dropdown')) return;
    setOpen(false);
  });
  dd.addEventListener('click', (e) => {
    const item = e.target.closest('[data-store-id]');
    if (!item) return;
    const { storeId, storeName, storeCategory } = item.dataset;
    if (storeId === currentId) { setOpen(false); return; }
    _switchStore(storeId, storeName, storeCategory);
  });
}

function _switchStore(id, name, category) {
  const cat = CATEGORY_MAP[category] || {};
  storage.set(STORAGE_KEYS.STORE_ID,       id);
  storage.set(STORAGE_KEYS.STORE_NAME,     name);
  storage.set(STORAGE_KEYS.STORE_CATEGORY, category);
  storage.set(STORAGE_KEYS.ROLE,           cat.role || 'vet');

  // Per-store context must be re-resolved for the new store.
  storage.remove(STORAGE_KEYS.STAFF_ROLE);
  storage.remove(STORAGE_KEYS.STORE_INFO);
  localStorage.removeItem('fufu_staff_roles');
  localStorage.removeItem('fufu_mode');
  localStorage.removeItem('fufu_staff_permissions');

  showToast(`สลับไปยัง ${name}`, 'info');
  setTimeout(() => window.location.reload(), 300);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDashboard() {
  const role    = getCurrentRole();
  const user    = getCurrentUser();
  const store   = getCurrentStore();
  const catInfo = CATEGORY_MAP[store.category] || { label: store.category || '', icon: 'store' };

  const q = (id) => document.getElementById(id);
  if (q('sb-store-name')) q('sb-store-name').textContent = store.name || 'ร้านของคุณ';
  if (q('sb-store-type')) q('sb-store-type').innerHTML = `<span class="inline-flex items-center gap-1">${icon(catInfo.icon, 'w-3 h-3')} ${catInfo.label}</span>`;
  if (q('sb-user-email')) q('sb-user-email').textContent = user.email || '';
  if (q('sb-user-role'))  q('sb-user-role').textContent  = role;

  _initStoreSwitcher();

  const dateEl = q('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Check if logged-in user is staff (not owner) → restrict modes
  const storeId  = storage.get(STORAGE_KEYS.STORE_ID);
  const staffRes = await apiFetch(`/api/staff/me?store_id=${storeId}`);
  const myStaff  = staffRes?.data;

  if (myStaff) {
    // Staff member — set primary role as the authoritative staff role
    const allowedModes = myStaff.roles || ['counter'];
    const primaryRole  = allowedModes[0];
    const savedMode    = storage.get(MODE_KEY);
    // Clamp: only restore saved mode if it is one the staff is actually allowed to use.
    _currentMode = (savedMode && allowedModes.includes(savedMode)) ? savedMode : primaryRole;
    storage.set(MODE_KEY, _currentMode);
    storage.set(STORAGE_KEYS.STAFF_ROLE, primaryRole);
    storage.set('fufu_staff_roles',      JSON.stringify(allowedModes));
    storage.set('fufu_staff_name',       myStaff.name);
    if (myStaff.permissions) storage.set('fufu_staff_permissions', JSON.stringify(myStaff.permissions));
    else storage.remove('fufu_staff_permissions');
    if (q('sb-user-role')) q('sb-user-role').textContent = allowedModes.join(', ');
  } else {
    // Owner — full access
    _currentMode = storage.get(MODE_KEY) || 'all';
    storage.set(STORAGE_KEYS.STAFF_ROLE, 'owner');
    storage.remove('fufu_staff_roles');
    storage.remove('fufu_staff_permissions');
    if (q('sb-user-role')) q('sb-user-role').textContent = 'owner';
  }

  _buildNav(role);
  _renderModeSwitcher(role);

  q('logout-btn')?.addEventListener('click', logout);

  _initSidebarToggle();

  // OPD bridge
  document.addEventListener('fufu:openOPD',     (e) => navigate('opd', e.detail));
  // POS bridge
  document.addEventListener('fufu:openPOS',     (e) => navigate('pos', e.detail));

  // Pet profile bridge — from pets list
  document.addEventListener('fufu:openPetProfile', (e) => navigate('pet-profile', e.detail));

  const lastPage = sessionStorage.getItem(_PAGE_KEY);
  const staffRolesInit = storage.getJSON('fufu_staff_roles');
  const canHomeInit    = !staffRolesInit || staffRolesInit.includes('home') || staffRolesInit.includes('all');
  const defaultPage = FEATURE_FLAGS.MVP_MODE
    ? 'home'
    : canHomeInit ? 'home' : (MODES[_currentMode]?.defaultPage || 'queue');
  const canRestore = lastPage && _RESTORABLE_PAGES.has(lastPage) &&
    (!FEATURE_FLAGS.MVP_MODE || MVP_NAV_PAGES.has(lastPage)) &&
    (lastPage !== 'home' || canHomeInit);
  navigate(canRestore ? lastPage : defaultPage);

  _initOfflineBadge();
  startSyncEngine();
}

// ─── Offline badge ────────────────────────────────────────────────────────────

function _initOfflineBadge() {
  const badge = document.getElementById('offline-badge');
  const count = document.getElementById('sync-count');
  if (!badge) return;

  function _showBadge(visible) {
    badge.classList.toggle('hidden', !visible);
    badge.classList.toggle('flex',    visible);
  }

  function _updateCount(n) {
    if (!count) return;
    count.classList.toggle('hidden', n === 0);
    count.classList.toggle('flex',   n > 0);
    count.textContent = n > 9 ? '9+' : String(n);
  }

  // Set initial state
  _showBadge(!navigator.onLine);

  document.addEventListener('fufu:offline', () => _showBadge(true));
  document.addEventListener('fufu:online',  () => _showBadge(false));
  document.addEventListener('fufu:sync-status', e => _updateCount(e.detail?.pending ?? 0));
}

// ─── Sidebar toggle ───────────────────────────────────────────────────────────

function _initSidebarToggle() {
  const btn     = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sb-overlay');
  if (!btn) return;

  const isMobile = () => window.innerWidth < 768;

  // Restore desktop collapsed state
  if (!isMobile() && localStorage.getItem('fufu_sidebar') === 'collapsed') {
    document.body.classList.add('sb-collapsed');
  }

  btn.addEventListener('click', () => {
    if (isMobile()) {
      document.body.classList.toggle('sb-open');
    } else {
      document.body.classList.toggle('sb-collapsed');
      localStorage.setItem(
        'fufu_sidebar',
        document.body.classList.contains('sb-collapsed') ? 'collapsed' : 'open'
      );
    }
  });

  // Close sidebar when clicking overlay (mobile)
  overlay?.addEventListener('click', () => {
    document.body.classList.remove('sb-open');
  });

  // Auto-close sidebar on navigate (mobile)
  document.addEventListener('fufu:navigate', () => {
    if (isMobile()) document.body.classList.remove('sb-open');
  });

  // Collapse sidebar on resize to desktop if it was open as overlay
  window.addEventListener('resize', () => {
    if (!isMobile()) document.body.classList.remove('sb-open');
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function _buildNav(role) {
  const allItems = FEATURE_FLAGS.MVP_MODE ? MVP_NAV : (NAV[role] || NAV.vet);
  const modeCfg = FEATURE_FLAGS.MVP_MODE ? null : MODES[_currentMode];
  const staffRoles  = storage.getJSON('fufu_staff_roles'); // null = owner
  const canHome     = !staffRoles || staffRoles.includes('home') || staffRoles.includes('all');

  let items = modeCfg?.pages
    ? allItems.filter(i => modeCfg.pages.includes(i.id))
    : allItems;

  if (FEATURE_FLAGS.MVP_MODE) {
    const mvpRole = storage.get(STORAGE_KEYS.STAFF_ROLE) || 'owner';
    const allowedPages = MVP_ROLE_PAGES[mvpRole] || new Set();
    items = items.filter(item => allowedPages.has(item.id));
  }

  // Gate home/overview: only owner or staff explicitly granted 'home' view permission
  if (!FEATURE_FLAGS.MVP_MODE && !canHome) items = items.filter(i => i.id !== 'home');

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = items.map(item => `
    <button data-nav="${item.id}"
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
             transition-all duration-150 text-slate-400 hover:bg-white/10 hover:text-slate-200">
      <span class="w-4 flex items-center justify-center flex-shrink-0 opacity-70">
        ${icon(item.icon, 'w-4 h-4')}
      </span>
      <span class="flex-1 text-left">${item.label}</span>
      ${item.id === 'appointments' ? '<span id="appt-nav-badge" style="display:none;background:#F97316;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 5px;"></span>' : ''}
    </button>
  `).join('');

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (btn) navigate(btn.dataset.nav);
  });

  _loadApptBadge();
}

async function _loadApptBadge() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) return;
  try {
    const res = await apiFetch(`/api/appointments/count?store_id=${storeId}`);
    const badge = document.getElementById('appt-nav-badge');
    if (!badge) return;
    const count = res?.count || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch { /* silent */ }
}

function _renderModeSwitcher(role) {
  const sbEl    = document.getElementById('sidebar-mode-switcher');
  const section = document.getElementById('sb-mode-section');
  if (!sbEl) return;

  if (FEATURE_FLAGS.MVP_MODE) {
    if (section) section.classList.add('hidden');
    sbEl.replaceChildren();
    return;
  }

  const staffRoles = storage.getJSON('fufu_staff_roles');
  const availableModes = staffRoles
    ? staffRoles
    : (role === 'vet'
        ? ['all','counter','doctor','pharmacy','finance']
        : ['all','counter','finance']);

  if (section) section.classList.toggle('hidden', availableModes.length <= 1);

  sbEl.innerHTML = availableModes.map(m => {
    const cfg    = MODES[m];
    const active = m === _currentMode;
    return `
      <button data-sb-mode="${m}" title="${cfg.description}"
        class="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all
               ${active
                 ? 'bg-primary text-white'
                 : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'}">
        <span class="flex-shrink-0 opacity-90">${icon(cfg.icon, 'w-3 h-3')}</span>
        <span class="truncate">${cfg.label}</span>
      </button>`;
  }).join('');

  sbEl.onclick = (e) => {
    const btn = e.target.closest('[data-sb-mode]');
    if (btn && btn.dataset.sbMode !== _currentMode) _setMode(btn.dataset.sbMode, role);
  };
}

// ─── Lazy page renderer ───────────────────────────────────────────────────────

async function _renderPage(pageId, detail = null) {
  if (pageId === 'home') {
    const { renderHome } = await import('./home.js');
    await renderHome(document.getElementById('page-home'));
    return;
  }
  if (pageId === 'appointments' || pageId === 'calendar') {
    const { renderAppointments } = await import('./appointments-mvp.js');
    await renderAppointments(document.getElementById(`page-${pageId}`), pageId === 'calendar' ? 'calendar' : 'inbox');
    _loadApptBadge();
    return;
  }
  if (pageId === 'patients') {
    const { renderPets } = await import('./pets.js');
    await renderPets(document.getElementById('page-patients'), 'pets');
    return;
  }
  if (pageId === 'summaries') {
    const { renderVisitSummaries } = await import('./visit-summaries.js');
    await renderVisitSummaries(document.getElementById('page-summaries'));
    return;
  }
  if (pageId === 'clinic') {
    const { renderClinicProfile } = await import('./clinic-profile.js');
    await renderClinicProfile(document.getElementById('page-clinic'));
    return;
  }
  if (pageId === 'users') {
    const { renderStaff } = await import('./staff.js');
    await renderStaff(document.getElementById('page-users'));
    return;
  }
  if (pageId === 'queue') {
    const { renderQueue } = await import('./queue.js');
    await renderQueue(document.getElementById('page-queue'));
    _loadApptBadge();
    return;
  }
  if (pageId === 'opd') {
    const { renderDoctorWorkroom } = await import('./doctor-workroom.js');
    renderDoctorWorkroom(document.getElementById('doctor-workroom-root'), detail);
    return;
  }
  if (pageId === 'pets') {
    const { renderPets } = await import('./pets.js');
    await renderPets(document.getElementById('page-pets'));
    return;
  }
  if (pageId === 'pet-profile') {
    const { renderPetProfile } = await import('./pets.js');
    renderPetProfile(document.getElementById('page-pet-profile'), detail);
    return;
  }
  if (pageId === 'medical') {
    const { renderMedicalRecords } = await import('./medical.js');
    await renderMedicalRecords(document.getElementById('page-medical'));
    return;
  }
  if (pageId === 'pos') {
    const { renderPOS } = await import('./pos.js');
    renderPOS(document.getElementById('page-pos'), detail || {});
    return;
  }
  if (pageId === 'hotel') {
    const { renderHotel } = await import('./hotel.js');
    await renderHotel(document.getElementById('page-hotel'));
    return;
  }
  if (pageId === 'grooming') {
    const { renderGrooming } = await import('./grooming.js');
    await renderGrooming(document.getElementById('page-grooming'));
    return;
  }
  if (pageId === 'inventory') {
    const { renderInventory } = await import('./inventory.js');
    await renderInventory(document.getElementById('page-inventory'));
    return;
  }
  if (pageId === 'staff') {
    const { renderStaff } = await import('./staff.js');
    await renderStaff(document.getElementById('page-staff'));
    return;
  }
  if (pageId === 'income') {
    const { renderFinancePage } = await import('./finance.js');
    await renderFinancePage(document.getElementById('page-income'));
    return;
  }
  if (pageId === 'ipd') {
    const { renderIPDWard } = await import('./ipd.js');
    renderIPDWard(document.getElementById('page-ipd'));
    return;
  }
  if (pageId === 'documents') {
    const { renderDocumentCenter } = await import('./documents.js');
    await renderDocumentCenter(document.getElementById('page-documents'));
    return;
  }
  if (pageId === 'kanban') {
    const { renderKanban } = await import('./kanban.js');
    renderKanban(document.getElementById('page-kanban'));
    return;
  }
  if (pageId === 'settings') {
    const { renderSettings } = await import('./settings.js');
    await renderSettings(document.getElementById('page-settings'));
    return;
  }
}
