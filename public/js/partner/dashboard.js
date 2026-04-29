import { getCurrentRole, getCurrentUser, getCurrentStore, logout } from '../auth.js';
import { showToast } from '../utils/toast.js';
import { apiFetch }       from '../utils/api-client.js';
import { storage }        from '../utils/storage.js';
import { STORAGE_KEYS, CATEGORY_MAP } from '../utils/config.js';

// ─── Staff Mode config ────────────────────────────────────────────────────────

const MODES = {
  all: {
    label: 'ทั่วไป', icon: '🏥',
    description: 'เข้าถึงทุกส่วน',
  },
  counter: {
    label: 'เคาน์เตอร์', icon: '📋',
    description: 'รับคนไข้ นัดหมาย เก็บเงิน',
    defaultPage: 'queue',
    pages: ['home', 'queue', 'pets', 'pos', 'income'],
  },
  doctor: {
    label: 'แพทย์', icon: '👨‍⚕️',
    description: 'ตรวจ บันทึก OPD',
    defaultPage: 'opd',
    pages: ['home', 'queue', 'opd', 'medical', 'pets', 'inventory'],
  },
  pharmacy: {
    label: 'สต็อก/เภสัช', icon: '📦',
    description: 'จัดยา รับสินค้า สต็อก',
    defaultPage: 'inventory',
    pages: ['home', 'inventory'],
  },
  finance: {
    label: 'การเงิน', icon: '💰',
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
  if (cfg?.defaultPage) navigate(cfg.defaultPage);
  else navigate('home');
  showToast(`โหมด: ${cfg?.label || mode}`);
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = {
  vet: [
    { id: 'home',      icon: '📊', label: 'ภาพรวม' },
    { id: 'queue',     icon: '📋', label: 'คิวตรวจ' },
    { id: 'pets',      icon: '🐾', label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'opd',       icon: '🩺', label: 'OPD Card' },
    { id: 'ipd',       icon: '🏥', label: 'IPD Ward' },
    { id: 'medical',   icon: '📂', label: 'ประวัติการรักษา' },
    { id: 'inventory', icon: '📦', label: 'สต็อก / ยา' },
    { id: 'income',    icon: '💰', label: 'รายได้' },
    { id: 'documents', icon: '📄', label: 'เอกสาร' },
    { id: 'kanban',    icon: '📌', label: 'Task Board' },
    { id: 'staff',     icon: '👥', label: 'จัดการพนักงาน' },
    { id: 'settings',  icon: '⚙️',  label: 'ตั้งค่า' },
  ],
  shop: [
    { id: 'home',      icon: '📊', label: 'ภาพรวม' },
    { id: 'queue',     icon: '📋', label: 'คิว' },
    { id: 'inventory', icon: '📦', label: 'สต็อก' },
    { id: 'income',    icon: '💰', label: 'รายได้' },
    { id: 'settings',  icon: '⚙️',  label: 'ตั้งค่า' },
  ],
  hotel: [
    { id: 'home',     icon: '📊', label: 'ภาพรวม' },
    { id: 'queue',    icon: '📋', label: 'คิว' },
    { id: 'pets',     icon: '🐾', label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'hotel',    icon: '🏨', label: 'ห้องพัก' },
    { id: 'income',   icon: '💰', label: 'รายได้' },
    { id: 'settings', icon: '⚙️',  label: 'ตั้งค่า' },
  ],
  grooming: [
    { id: 'home',     icon: '📊', label: 'ภาพรวม' },
    { id: 'grooming', icon: '✂️',  label: 'คิว Grooming' },
    { id: 'pets',     icon: '🐾', label: 'สัตว์เลี้ยง / นัดหมาย' },
    { id: 'income',   icon: '💰', label: 'รายได้' },
    { id: 'settings', icon: '⚙️',  label: 'ตั้งค่า' },
  ],
  admin: [
    { id: 'home',      icon: '📊', label: 'ภาพรวม' },
    { id: 'settings',  icon: '⚙️',  label: 'ตั้งค่า' },
  ],
};

const PAGE_TITLES = {
  home:         'ภาพรวม',
  queue:        'คิวตรวจ',
  pets:         'สัตว์เลี้ยง & นัดหมาย',
  'pet-profile':'โปรไฟล์สัตว์เลี้ยง',
  opd:          'OPD Card',
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

export function navigate(pageId, detail = null) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.remove('hidden');

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || pageId;

  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === pageId;
    el.classList.toggle('bg-white/10',    active);
    el.classList.toggle('text-white',     active);
    el.classList.toggle('text-slate-400', !active);
  });

  _renderPage(pageId, detail);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDashboard() {
  const role    = getCurrentRole();
  const user    = getCurrentUser();
  const store   = getCurrentStore();
  const catInfo = CATEGORY_MAP[store.category] || { label: store.category || '', icon: '🏪' };

  const q = (id) => document.getElementById(id);
  if (q('sb-store-name')) q('sb-store-name').textContent = store.name || 'ร้านของคุณ';
  if (q('sb-store-type')) q('sb-store-type').textContent = `${catInfo.icon} ${catInfo.label}`;
  if (q('sb-user-email')) q('sb-user-email').textContent = user.email || '';
  if (q('sb-user-role'))  q('sb-user-role').textContent  = role;

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
    // Staff member — auto-set mode from their primary role, hide staff management
    const primaryRole = (myStaff.roles || ['counter'])[0];
    _currentMode = storage.get(MODE_KEY) || primaryRole;
    // Restrict mode switcher to only assigned roles
    storage.set('fufu_staff_roles', JSON.stringify(myStaff.roles));
    storage.set('fufu_staff_name',  myStaff.name);
    if (q('sb-user-role')) q('sb-user-role').textContent = myStaff.roles.join(', ');
  } else {
    // Owner — full access
    _currentMode = storage.get(MODE_KEY) || 'all';
    storage.remove('fufu_staff_roles');
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

  navigate('home');
}

// ─── Sidebar toggle ───────────────────────────────────────────────────────────

function _initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;

  // Restore saved state
  if (localStorage.getItem('fufu_sidebar') === 'collapsed') {
    document.body.classList.add('sb-collapsed');
  }

  btn.addEventListener('click', () => {
    document.body.classList.toggle('sb-collapsed');
    localStorage.setItem(
      'fufu_sidebar',
      document.body.classList.contains('sb-collapsed') ? 'collapsed' : 'open'
    );
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function _buildNav(role) {
  const allItems  = NAV[role] || NAV.vet;
  const modeCfg   = MODES[_currentMode];
  const items     = modeCfg?.pages
    ? allItems.filter(i => modeCfg.pages.includes(i.id))
    : allItems;

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = items.map(item => `
    <button data-nav="${item.id}"
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
             transition-colors duration-150 text-slate-400 hover:bg-white/10 hover:text-white">
      <span class="w-5 text-center text-base">${item.icon}</span>
      <span class="flex-1 text-left">${item.label}</span>
      ${item.id === 'queue' ? '<span id="appt-nav-badge" style="display:none;background:#F97316;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 5px;"></span>' : ''}
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
  const el = document.getElementById('mode-switcher');
  if (!el) return;

  // Staff sees only their assigned roles; owner sees all
  const staffRoles = storage.getJSON('fufu_staff_roles');
  const availableModes = staffRoles
    ? staffRoles  // staff: only assigned roles
    : (role === 'vet'
        ? ['all','counter','doctor','pharmacy','finance']
        : ['all','counter','finance']);

  el.innerHTML = availableModes.map(m => {
    const cfg    = MODES[m];
    const active = m === _currentMode;
    return `
      <button data-mode="${m}" title="${cfg.description}"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
               ${active
                 ? 'bg-primary text-white shadow-glow'
                 : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}">
        <span>${cfg.icon}</span>
        <span class="hidden sm:inline">${cfg.label}</span>
      </button>`;
  }).join('');

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn && btn.dataset.mode !== _currentMode) _setMode(btn.dataset.mode, role);
  });
}

// ─── Lazy page renderer ───────────────────────────────────────────────────────

async function _renderPage(pageId, detail = null) {
  if (pageId === 'home') {
    const { renderHome } = await import('./home.js');
    await renderHome(document.getElementById('page-home'));
    return;
  }
  if (pageId === 'queue') {
    const { renderQueue } = await import('./queue.js');
    await renderQueue(document.getElementById('page-queue'));
    _loadApptBadge();
    return;
  }
  if (pageId === 'opd') {
    const { renderOPDCard } = await import('./opd-card.js');
    renderOPDCard(document.getElementById('page-opd'), detail);
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

// ─── Home page ────────────────────────────────────────────────────────────────

async function _renderHome() {
  const container = document.getElementById('page-home');
  if (!container) return;

  const storeId = storage.get(STORAGE_KEYS.STORE_ID);

  if (!storeId) {
    container.innerHTML = `
      <div class="card p-10 text-center space-y-3">
        <div class="text-4xl">🏪</div>
        <div class="font-semibold text-navy">ยังไม่ได้เลือกร้านค้า</div>
        <p class="text-slate-400 font-body text-sm">กรุณา logout แล้ว login ใหม่เพื่อเลือกร้านค้า</p>
        <button id="home-logout" class="btn-primary mt-2">ออกจากระบบ</button>
      </div>`;
    container.querySelector('#home-logout')?.addEventListener('click', logout);
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  let queue = [], summary = {};
  try {
    const [queueRes, summaryRes] = await Promise.all([
      apiFetch(`/api/queue?store_id=${storeId}&date=${today}`),
      apiFetch(`/api/finance/summary?store_id=${storeId}`),
    ]);
    queue   = queueRes?.data   || [];
    summary = summaryRes?.data || {};
  } catch (err) {
    console.error('[Home] fetch error:', err);
  }

  const waiting = queue.filter(q => q.status === 'waiting').length;
  const inProg  = queue.filter(q => q.status === 'in_progress').length;
  const done    = queue.filter(q => q.status === 'completed').length;
  const income  = summary.today || 0;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${_statCard('📋', 'รอตรวจ',      waiting,                      'รายการ', 'text-amber-500')}
        ${_statCard('🩺', 'กำลังรักษา',  inProg,                       'รายการ', 'text-blue-500')}
        ${_statCard('✅', 'เสร็จแล้ว',   done,                         'รายการ', 'text-primary')}
        ${_statCard('💰', 'รายได้วันนี้', income.toLocaleString('th-TH'), '฿',      'text-accent-dark')}
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy text-base">คิววันนี้</h3>
          <button id="home-see-queue" class="text-xs text-primary hover:underline font-body">ดูทั้งหมด →</button>
        </div>
        ${queue.length === 0
          ? `<p class="text-slate-400 font-body text-sm text-center py-8">ยังไม่มีคิวในวันนี้</p>`
          : queue.slice(0, 6).map(_queuePreviewRow).join('')
        }
      </div>
    </div>`;

  container.querySelector('#home-see-queue')?.addEventListener('click', () => navigate('queue'));
}

function _statCard(icon, label, value, unit, valueClass) {
  return `
    <div class="card p-5">
      <div class="text-2xl mb-2">${icon}</div>
      <div class="text-xs text-slate-400 font-body">${label}</div>
      <div class="mt-1 flex items-baseline gap-1">
        <span class="text-2xl font-bold ${valueClass}">${value}</span>
        <span class="text-xs text-slate-400 font-body">${unit}</span>
      </div>
    </div>`;
}

function _queuePreviewRow(q) {
  const STATUS_MAP = {
    waiting:     { label: 'รอ',          cls: 'badge-gold' },
    called:      { label: 'เรียกแล้ว',  cls: 'badge-teal' },
    in_progress: { label: 'กำลังรักษา', cls: 'bg-blue-50 text-blue-600' },
    completed:   { label: 'เสร็จ',       cls: 'badge-navy' },
    no_show:     { label: 'ไม่มา',       cls: 'bg-slate-100 text-slate-500' },
  };
  const s   = STATUS_MAP[q.status] || STATUS_MAP.waiting;
  const num = String(q.queue_number).padStart(3, '0');
  const notes = q.notes || '';
  const [petName, ownerName] = notes.includes(' - ')
    ? notes.split(' - ').map(s => s.trim())
    : [notes, ''];

  return `
    <div class="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span class="font-mono font-bold text-primary text-sm w-12 flex-shrink-0">A${num}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-navy truncate">${petName || '—'}</div>
        <div class="text-xs text-slate-400 font-body truncate">${ownerName ? `${ownerName} · ` : ''}${q.service_type || ''}</div>
      </div>
      <span class="badge ${s.cls} flex-shrink-0">${s.label}</span>
    </div>`;
}
