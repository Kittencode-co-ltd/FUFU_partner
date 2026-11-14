import { getCurrentRole, getCurrentUser, getCurrentStore, logout } from '../auth.js';
import { initProfileMenu, setProfileMenuItems, setProfileRole } from './profile-menu.js';
import { pageLabel, groupLabel, t as tr, locale, applyLangAttr } from './portal-i18n.js';
import { showToast } from '../utils/toast.js';
import { apiFetch }       from '../utils/api-client.js';
import { storage }        from '../utils/storage.js';
import { STORAGE_KEYS, CATEGORY_MAP, FEATURE_FLAGS } from '../utils/config.js';
import { startSyncEngine } from '../utils/sync-engine.js';
import { escapeHtml } from '../utils/formatters.js';
import { icon } from '../utils/icons.js';
import { initResponsiveEnhancements } from '../utils/responsive.js';

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
    { id: 'pos',       icon: 'credit-card',    label: 'ขายหน้าร้าน · POS' },
    { id: 'orders',    icon: 'receipt',        label: 'คำสั่งซื้อออนไลน์' },
    { id: 'delivery',  icon: 'exchange-alt',   label: 'จัดส่ง' },
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
  { id: 'screenings',   icon: 'stethoscope',    label: 'เคส AI ส่งต่อ' },
  { id: 'home',         icon: 'chart-bar',      label: 'ภาพรวม' },
  { id: 'appointments', icon: 'clipboard-list', label: 'นัดหมาย' },
  { id: 'calendar',     icon: 'calendar-alt',   label: 'ปฏิทิน' },
  { id: 'patients',     icon: 'paw',            label: 'สัตว์ที่เข้ารับบริการ' },
  { id: 'summaries',    icon: 'folder-open',    label: 'สรุปการเข้ารับบริการ' },
  { id: 'clinic',       icon: 'hospital-alt',   label: 'ข้อมูลคลินิก' },
  { id: 'users',        icon: 'users',          label: 'ผู้ใช้งาน' },
];

// MVP workspaces stay focused on each store's real day-to-day tasks. The
// category comes from the selected store, not from an account-wide default.
// Items are listed in the order the work happens and grouped by step, so staff move
// down the menu instead of jumping around. `group` is a key in portal-i18n (NAV_GROUPS).
// clinic / users / settings live in the profile menu (ACCOUNT_PAGES).
const BUSINESS_NAV = {
  vet: [
    { id: 'home', icon: 'chart-bar', label: 'ภาพรวม', group: 'today' },
    { id: 'appointments', icon: 'calendar-alt', label: 'นัดหมาย', group: 'intake' },
    { id: 'screenings', icon: 'stethoscope', label: 'เคส AI ส่งต่อ', group: 'intake' },
    { id: 'calendar', icon: 'calendar-alt', label: 'ปฏิทิน', group: 'intake' },
    { id: 'queue', icon: 'clipboard-list', label: 'คิวตรวจ', group: 'care' },
    { id: 'opd', icon: 'stethoscope', label: 'OPD · ห้องตรวจ', group: 'care' },
    { id: 'ipd', icon: 'hospital', label: 'IPD · ผู้ป่วยใน', group: 'care' },
    { id: 'cashier', icon: 'coins', label: 'แคชเชียร์', group: 'payment' },
    { id: 'patients', icon: 'paw', label: 'สัตว์ที่เข้ารับบริการ', group: 'records' },
    { id: 'medical', icon: 'folder-open', label: 'ประวัติการรักษา', group: 'records' },
    { id: 'summaries', icon: 'file-alt', label: 'สรุปการเข้ารับบริการ', group: 'records' },
    { id: 'inventory', icon: 'box', label: 'คลังยาและเวชภัณฑ์', group: 'stock' },
    { id: 'clinic', icon: 'hospital-alt', label: 'ข้อมูลคลินิก' },
    { id: 'users', icon: 'users', label: 'ผู้ใช้งาน' },
  ],
  shop: [
    { id: 'home', icon: 'chart-bar', label: 'ภาพรวมร้านค้า', group: 'today' },
    { id: 'pos', icon: 'credit-card', label: 'ขายหน้าร้าน · POS', group: 'sales' },
    { id: 'orders', icon: 'receipt', label: 'คำสั่งซื้อออนไลน์', group: 'sales' },
    { id: 'delivery', icon: 'exchange-alt', label: 'จัดส่ง', group: 'sales' },
    { id: 'inventory', icon: 'box', label: 'คลังสินค้า', group: 'stock' },
    { id: 'income', icon: 'coins', label: 'ยอดขายและรายได้', group: 'money' },
    { id: 'users', icon: 'users', label: 'ผู้ใช้งาน' },
    { id: 'settings', icon: 'cog', label: 'ตั้งค่าร้าน' },
  ],
  hotel: [
    { id: 'home', icon: 'chart-bar', label: 'ภาพรวมโรงแรม', group: 'today' },
    { id: 'appointments', icon: 'calendar-alt', label: 'การจอง', group: 'booking' },
    { id: 'calendar', icon: 'calendar-alt', label: 'ปฏิทิน', group: 'booking' },
    { id: 'queue', icon: 'clipboard-list', label: 'คิวเช็กอิน / เช็กเอาต์', group: 'stay' },
    { id: 'hotel', icon: 'bed', label: 'ห้องพักและการดูแล', group: 'stay' },
    { id: 'cashier', icon: 'coins', label: 'แคชเชียร์', group: 'payment' },
    { id: 'pets', icon: 'paw', label: 'สัตว์เลี้ยงและเจ้าของ', group: 'records' },
    { id: 'income', icon: 'coins', label: 'รายได้', group: 'records' },
    { id: 'users', icon: 'users', label: 'ผู้ใช้งาน' },
    { id: 'settings', icon: 'cog', label: 'ตั้งค่าโรงแรม' },
  ],
  grooming: [
    { id: 'home', icon: 'chart-bar', label: 'ภาพรวมร้าน', group: 'today' },
    { id: 'appointments', icon: 'calendar-alt', label: 'นัดหมาย', group: 'booking' },
    { id: 'calendar', icon: 'calendar-alt', label: 'ปฏิทิน', group: 'booking' },
    { id: 'queue', icon: 'clipboard-list', label: 'คิวบริการ', group: 'service' },
    { id: 'grooming', icon: 'cut', label: 'งานอาบน้ำตัดขน', group: 'service' },
    { id: 'cashier', icon: 'coins', label: 'แคชเชียร์', group: 'payment' },
    { id: 'pets', icon: 'paw', label: 'สัตว์เลี้ยงและเจ้าของ', group: 'records' },
    { id: 'income', icon: 'coins', label: 'รายได้', group: 'records' },
    { id: 'users', icon: 'users', label: 'ผู้ใช้งาน' },
    { id: 'settings', icon: 'cog', label: 'ตั้งค่าร้าน' },
  ],
};

// Mobile bottom bar: the 4 pages each workspace uses most, in work order
const BOTTOM_TABS = {
  vet: ['home', 'queue', 'opd', 'cashier'],
  shop: ['home', 'pos', 'orders', 'inventory'],
  hotel: ['home', 'appointments', 'queue', 'cashier'],
  grooming: ['home', 'appointments', 'queue', 'cashier'],
};

// The patient journey, shown as a step bar on these pages (นัด/เคส → คิว → ตรวจ → ชำระเงิน)
const FLOW_STEPS = {
  vet: ['appointments', 'queue', 'opd', 'cashier'],
  hotel: ['appointments', 'queue', 'hotel', 'cashier'],
  grooming: ['appointments', 'queue', 'grooming', 'cashier'],
};

// Checked before rendering so a store cannot restore another category's page.
const MVP_NAV_PAGES = new Set([
  ...MVP_NAV.map(item => item.id),
  ...Object.values(BUSINESS_NAV).flat().map(item => item.id),
  'pet-profile',
]);
const MVP_ROLE_PAGES = {
  owner: new Set([...MVP_NAV_PAGES]),
  reception: new Set(['screenings', 'home', 'queue', 'cashier', 'appointments', 'calendar', 'patients', 'summaries', 'clinic']),
  vet: new Set(['screenings', 'home', 'queue', 'cashier', 'opd', 'appointments', 'calendar', 'patients', 'summaries', 'clinic']),
};
const BUSINESS_ROLE_PAGES = {
  shop: {
    reception: new Set(['home', 'inventory', 'pos', 'orders', 'delivery']),
    vet: new Set(['home', 'inventory', 'pos', 'orders', 'delivery']),
  },
  hotel: {
    reception: new Set(['home', 'hotel', 'queue', 'cashier', 'appointments', 'calendar', 'pets']),
    vet: new Set(['home', 'hotel', 'queue', 'cashier', 'appointments', 'calendar', 'pets']),
  },
  grooming: {
    reception: new Set(['home', 'queue', 'cashier', 'appointments', 'calendar', 'grooming', 'pets']),
    vet: new Set(['home', 'queue', 'cashier', 'appointments', 'calendar', 'grooming', 'pets']),
  },
};

function _navItemsForRole(role) {
  const items = FEATURE_FLAGS.MVP_MODE
    ? (BUSINESS_NAV[role] || BUSINESS_NAV.vet)
    : (NAV[role] || NAV.vet);
  if (!FEATURE_FLAGS.MVP_MODE) return items;

  const staffRole = storage.get(STORAGE_KEYS.STAFF_ROLE) || 'owner';
  if (staffRole === 'owner') return items;
  const allowed = role === 'vet'
    ? MVP_ROLE_PAGES[staffRole]
    : BUSINESS_ROLE_PAGES[role]?.[staffRole];
  return allowed ? items.filter(item => allowed.has(item.id)) : [];
}

const PAGE_TITLES = {
  home:         'ภาพรวม',
  screenings:   'เคส AI ส่งต่อ',
  appointments: 'นัดหมาย',
  calendar:     'ปฏิทิน',
  patients:     'สัตว์ที่เข้ารับบริการ',
  summaries:    'สรุปการเข้ารับบริการ',
  clinic:       'ข้อมูลคลินิก',
  users:        'ผู้ใช้งาน',
  orders:       'คำสั่งซื้อออนไลน์',
  delivery:     'จัดส่ง',
  queue:        'คิวตรวจ',
  cashier:      'แคชเชียร์',
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
  'appointments','calendar','patients','summaries','clinic','orders','delivery','cashier','pos','income',
]);
const _PAGE_KEY = 'fufu_current_page';
let _pageEnterTimer = null;

export function navigate(pageId, detail = null) {
  const visiblePage = _navItemsForRole(getCurrentRole()).some(item => item.id === pageId);
  const canOpenPetProfile = pageId === 'pet-profile' && _navItemsForRole(getCurrentRole()).some(item => ['pets', 'patients'].includes(item.id));
  if ((FEATURE_FLAGS.MVP_MODE && !MVP_NAV_PAGES.has(pageId)) || (!visiblePage && !canOpenPetProfile)) pageId = 'home';
  document.dispatchEvent(new CustomEvent('fufu:navigate', { detail: pageId }));
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.remove('hidden', 'page-enter');
    void target.offsetWidth; // restart the entrance animation
    target.classList.add('page-enter');
    // Cards that arrive with the first data load animate in; later re-renders (polling) don't.
    clearTimeout(_pageEnterTimer);
    _pageEnterTimer = setTimeout(() => target.classList.remove('page-enter'), 2000);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });

  const titleEl = document.getElementById('topbar-title');
  // Same wording as the menu item, so the title always matches what was tapped
  const navItem = _navItems.find(item => item.id === pageId);
  if (titleEl) titleEl.textContent = pageLabel(pageId, navItem?.label || PAGE_TITLES[pageId] || pageId);

  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === pageId;
    el.classList.toggle('is-active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  // Pages that are not one of the bottom tabs live under "menu", so light that tab up instead
  const menuTab = document.querySelector('#bottom-nav [data-open-drawer]');
  menuTab?.classList.toggle('is-active', !document.querySelector(`#bottom-nav [data-nav="${pageId}"]`));

  _renderFlowSteps(pageId);

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

  const check = `<svg class="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

  const storeOptions = stores.map(s => {
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
  dd.innerHTML = `${storeOptions || '<div class="px-3 py-2 text-xs text-slate-400">ไม่พบร้านค้า</div>'}
    <div class="mt-1 border-t border-slate-100 pt-1">
      <a href="/login" class="block rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-subtle">เลือกร้านค้า</a>
    </div>`;
  btn.style.cursor = 'pointer';

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
  applyLangAttr();
  const role    = getCurrentRole();
  const user    = getCurrentUser();
  const store   = getCurrentStore();
  const catInfo = CATEGORY_MAP[store.category] || { label: store.category || '', icon: 'store' };
  const isStoreActive = storage.get(STORAGE_KEYS.STORE_ACTIVE) !== 'false';

  const q = (id) => document.getElementById(id);
  if (q('sb-store-name')) q('sb-store-name').textContent = store.name || 'ร้านของคุณ';
  if (q('sb-store-type')) q('sb-store-type').innerHTML = `<span class="inline-flex items-center gap-1">${icon(catInfo.icon, 'w-3 h-3')} ${catInfo.label}</span>`;
  initProfileMenu({
    email: user.email || '',
    role: 'owner',
    storeName: store.name || '',
    onNavigate: navigate,
    onLogout: logout,
  });

  _initStoreSwitcher();

  const dateEl = q('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(locale(), {
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
    setProfileRole(allowedModes.join(','));
  } else {
    // Owner — full access
    _currentMode = storage.get(MODE_KEY) || 'all';
    storage.set(STORAGE_KEYS.STAFF_ROLE, 'owner');
    storage.remove('fufu_staff_roles');
    storage.remove('fufu_staff_permissions');
    setProfileRole('owner');
  }

  _buildNav(role);
  _renderModeSwitcher(role);

  if (!isStoreActive) {
    const main = q('app-main');
    if (main) {
      const banner = document.createElement('section');
      banner.className = 'mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<div class="flex items-start gap-3"><span class="text-xl" aria-hidden="true"><svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg></span><div><strong class="block">ร้านถูกปิดใช้งานชั่วคราว</strong><p class="mt-1 text-sm">ขณะนี้คุณดูข้อมูลใน Partner ได้ แต่ยังทำรายการหรือแก้ไขข้อมูลไม่ได้ กรุณาติดต่อผู้ดูแลระบบ FUFU เพื่อเปิดใช้งาน</p></div></div>';
      main.prepend(banner);
      main.classList.add('partner-store-readonly');
      main.addEventListener('click', event => {
        if (event.target.closest('button, input, select, textarea, form, [role="button"]')) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      main.addEventListener('submit', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      main.querySelectorAll('button, input, select, textarea').forEach(control => {
        control.setAttribute('aria-disabled', 'true');
      });
    }
  }

  _initSidebarToggle();
  initResponsiveEnhancements();

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
    (!FEATURE_FLAGS.MVP_MODE || (MVP_NAV_PAGES.has(lastPage) && (_navItemsForRole(role).some(item => item.id === lastPage) || (lastPage === 'pet-profile' && _navItemsForRole(role).some(item => ['pets', 'patients'].includes(item.id)))))) &&
    (lastPage !== 'home' || canHomeInit);
  navigate(canRestore ? lastPage : defaultPage);

  _initOfflineBadge();
  if (isStoreActive) startSyncEngine();
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

// Below this width the sidebar is an off-canvas drawer (tablet + mobile).
const DRAWER_QUERY = window.matchMedia('(max-width: 1023px)');

function _setDrawer(open) {
  document.body.classList.toggle('sb-open', open);
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#sidebar-nav [data-nav]')?.focus({ preventScroll: true });
}

function _initSidebarToggle() {
  const btn     = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sb-overlay');
  if (!btn) return;

  const isDrawer = () => DRAWER_QUERY.matches;

  // Restore desktop collapsed state
  if (!isDrawer() && localStorage.getItem('fufu_sidebar') === 'collapsed') {
    document.body.classList.add('sb-collapsed');
  }

  btn.addEventListener('click', () => {
    if (isDrawer()) {
      _setDrawer(!document.body.classList.contains('sb-open'));
    } else {
      document.body.classList.toggle('sb-collapsed');
      const collapsed = document.body.classList.contains('sb-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      localStorage.setItem('fufu_sidebar', collapsed ? 'collapsed' : 'open');
    }
  });

  overlay?.addEventListener('click', () => _setDrawer(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('sb-open')) {
      _setDrawer(false);
      btn.focus();
    }
  });

  // Auto-close the drawer after navigating
  document.addEventListener('fufu:navigate', () => {
    if (isDrawer()) _setDrawer(false);
  });

  // Leaving drawer mode (rotate / resize to desktop) closes the overlay
  DRAWER_QUERY.addEventListener('change', () => {
    if (!isDrawer()) _setDrawer(false);
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

let _navItems = [];
let _navRole = 'vet';

// Step bar (นัด → คิว → ตรวจ → ชำระเงิน) above pages that are part of the visit journey.
// Only steps this user can open are shown; it hides itself on every other page.
function _renderFlowSteps(pageId) {
  const bar = document.getElementById('flow-steps');
  if (!bar) return;
  const steps = (FEATURE_FLAGS.MVP_MODE ? FLOW_STEPS[_navRole] : null) || [];
  const visible = steps.map(id => _navItems.find(item => item.id === id)).filter(Boolean);
  if (visible.length < 2 || !visible.some(item => item.id === pageId)) { bar.hidden = true; bar.innerHTML = ''; return; }
  const current = visible.findIndex(item => item.id === pageId);
  bar.hidden = false;
  bar.innerHTML = visible.map((item, i) => `
    <button type="button" data-nav="${item.id}" class="flow-step ${i === current ? 'is-current' : i < current ? 'is-done' : ''}" ${i === current ? 'aria-current="step"' : ''}>
      <span class="flow-step__n">${i + 1}</span><span class="flow-step__label">${pageLabel(item.id, item.label).split(' · ')[0]}</span>
    </button>${i < visible.length - 1 ? '<span class="flow-step__line" aria-hidden="true"></span>' : ''}`).join('');
  bar.onclick = e => { const btn = e.target.closest('[data-nav]'); if (btn) navigate(btn.dataset.nav); };
}

// Pages reached from the profile menu (top-right avatar) instead of the sidebar
const ACCOUNT_PAGES = new Set(['clinic', 'users', 'settings', 'staff']);

function _buildNav(role) {
  const allItems = FEATURE_FLAGS.MVP_MODE ? (BUSINESS_NAV[role] || BUSINESS_NAV.vet) : (NAV[role] || NAV.vet);
  const modeCfg = FEATURE_FLAGS.MVP_MODE ? null : MODES[_currentMode];
  const staffRoles  = storage.getJSON('fufu_staff_roles'); // null = owner
  const canHome     = !staffRoles || staffRoles.includes('home') || staffRoles.includes('all');

  let items = modeCfg?.pages
    ? allItems.filter(i => modeCfg.pages.includes(i.id))
    : allItems;

  if (FEATURE_FLAGS.MVP_MODE) {
    const visibleIds = new Set(_navItemsForRole(role).map(item => item.id));
    items = items.filter(item => visibleIds.has(item.id));
  }

  // Gate home/overview: only owner or staff explicitly granted 'home' view permission
  if (!FEATURE_FLAGS.MVP_MODE && !canHome) items = items.filter(i => i.id !== 'home');

  // Store settings, team and account pages live in the profile menu, not the sidebar
  setProfileMenuItems(items.filter(item => ACCOUNT_PAGES.has(item.id)));
  items = items.filter(item => !ACCOUNT_PAGES.has(item.id));

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  // A heading each time the step (group) changes, so the menu reads top-to-bottom like the day's work
  let lastGroup = null;
  nav.innerHTML = items.map((item, i) => {
    const heading = item.group && item.group !== lastGroup && i > 0
      ? `<div class="nav-group" role="presentation">${groupLabel(item.group)}</div>` : '';
    lastGroup = item.group || lastGroup;
    return `${heading}
    <button type="button" data-nav="${item.id}" class="nav-item" style="--i:${i}">
      <span class="nav-item__icon">${icon(item.icon, 'w-4 h-4')}</span>
      <span class="flex-1 text-left truncate">${pageLabel(item.id, item.label)}</span>
      ${item.id === 'appointments' ? '<span id="appt-nav-badge" class="nav-badge" hidden></span>' : ''}
    </button>`;
  }).join('');

  // onclick (not addEventListener) so rebuilding the nav never stacks handlers
  nav.onclick = (e) => {
    const btn = e.target.closest('[data-nav]');
    if (btn) navigate(btn.dataset.nav);
  };

  _buildBottomNav(items, role);
  _navItems = items;
  _navRole = role;
  _loadApptBadge();
}

// Short names for the bottom bar (full names stay in the side menu)
const SHORT_LABELS = { home: 'ภาพรวม', queue: 'คิว', opd: 'ห้องตรวจ', cashier: 'แคชเชียร์', pos: 'ขาย', orders: 'ออเดอร์', inventory: 'คลัง', appointments: 'นัดหมาย', hotel: 'ห้องพัก', grooming: 'งานบริการ', income: 'รายได้' };
function shortLabel(item) {
  const full = pageLabel(item.id, item.label);
  return full !== item.label ? full.split(/[\s(/·]/)[0] : (SHORT_LABELS[item.id] || full.split(/[\s(/·]/)[0]);
}

// Mobile bottom tab bar: the workspace's 4 main steps (BOTTOM_TABS) + a "menu" tab that opens the drawer.
function _buildBottomNav(items, role) {
  const bar = document.getElementById('bottom-nav');
  if (!bar) return;
  const preferred = (FEATURE_FLAGS.MVP_MODE ? BOTTOM_TABS[role] : null) || [];
  let tabs = preferred.map(id => items.find(item => item.id === id)).filter(Boolean);
  if (tabs.length < 4) tabs = [...tabs, ...items.filter(item => !tabs.includes(item))].slice(0, 4);
  bar.innerHTML = `
    ${tabs.map(item => `
      <button type="button" data-nav="${item.id}" class="tab-item">
        ${icon(item.icon, 'w-5 h-5')}
        <span class="tab-item__label">${shortLabel(item)}</span>
      </button>`).join('')}
    <button type="button" class="tab-item" data-open-drawer aria-controls="sidebar">
      ${icon('th-large', 'w-5 h-5')}
      <span class="tab-item__label">${tr('menu')}</span>
    </button>`;
  bar.onclick = (e) => {
    if (e.target.closest('[data-open-drawer]')) return _setDrawer(true);
    const btn = e.target.closest('[data-nav]');
    if (btn) navigate(btn.dataset.nav);
  };
}

async function _loadApptBadge() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) return;
  try {
    const res = await apiFetch(`/api/appointments/count?store_id=${storeId}`);
    const badge = document.getElementById('appt-nav-badge');
    if (!badge) return;
    const count = res?.count || 0;
    badge.textContent = count > 99 ? '99+' : count;
    badge.hidden = count <= 0;
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
  if (pageId === 'screenings') {
    const { renderScreenings } = await import('./screenings-mvp.js');
    await renderScreenings(document.getElementById('page-screenings'));
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
  if (pageId === 'orders' || pageId === 'delivery') {
    const { renderShopOperations } = await import('./shop-operations.js');
    await renderShopOperations(document.getElementById(`page-${pageId}`), pageId);
    return;
  }
  if (pageId === 'cashier') {
    const { renderCashier } = await import('./cashier.js');
    await renderCashier(document.getElementById('page-cashier'));
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
    // Walk-up sales use the iPad POS; a bill handed over from a queue/OPD visit keeps the older checkout screen
    if (detail?.queueItem || detail?.medicalRecord) {
      const { renderPOS } = await import('./pos.js');
      renderPOS(document.getElementById('page-pos'), detail);
    } else {
      const { renderRetailPOS } = await import('./pos-retail.js');
      await renderRetailPOS(document.getElementById('page-pos'));
    }
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
