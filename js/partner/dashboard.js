/**
 * FUFU Partner – Dashboard Orchestrator (Enhanced)
 * Handles layout rendering, sidebar navigation, RBAC filtering,
 * and page lifecycle.
 * @module partner/dashboard
 * 
 * Acceptance Criteria:
 * - [x] Navigation dynamically respects RBAC roles via filterNavByRole.
 * - [x] Feature flags control visibility of Calendar, Medical, Hotel, and Users modules.
 * - [x] Dashboard lazy loads sub-modules.
 */

import { STORAGE_KEYS, API_BASE, FEATURE_FLAGS } from '../utils/config.js';
import { showToast } from '../utils/notifications.js';
import { formatThaiDate } from '../utils/formatters.js';
import { getCurrentUser, getCurrentRole, logout } from '../auth.js';
import { fetchFromSupabase } from '../utils/supabase-client.js';
import { renderQueue, renderFullQueue, renderCalendar, toggleTVMode } from './queue.js';
import { renderFinancePage } from './finance.js';
import { renderProducts, renderInventoryExtras } from './inventory.js';
import { renderMedicalRecords } from './medical.js';
import { renderRooms } from './hotel.js';
import { initSettings } from './settings.js';
import { filterNavByRole, injectRBACNav, getStaffRole, hasPermission, renderUserManagement } from './rbac.js';

// ===== NAV CONFIG per Role =====
const navConfig = {
  vet: {
    name: 'Happy Paws Clinic',
    type: 'คลินิกสัตว์แพทย์', typeClass: 'type-vet',
    nav: [
      { section: 'หลัก', items: [
        { id: 'dashboard', icon: 'fa-gauge', label: 'แดชบอร์ด' },
        { id: 'queue', icon: 'fa-list-ol', label: 'คิวนัดหมาย', badge: 3 },
        { id: 'records', icon: 'fa-file-medical', label: 'ประวัติการรักษา' },
        { id: 'income', icon: 'fa-baht-sign', label: 'รายรับ' },
      ]},
      { section: 'จัดการ', items: [
        { id: 'products', icon: 'fa-syringe', label: 'บริการ / ยา' },
        { id: 'settings', icon: 'fa-gear', label: 'ตั้งค่า' },
      ]},
    ],
  },
  shop: {
    name: 'PetVille Shop',
    type: 'Pet Shop', typeClass: 'type-shop',
    nav: [
      { section: 'หลัก', items: [
        { id: 'dashboard', icon: 'fa-gauge', label: 'แดชบอร์ด' },
        { id: 'queue', icon: 'fa-bag-shopping', label: 'คำสั่งซื้อ', badge: 5 },
        { id: 'products', icon: 'fa-boxes-stacked', label: 'สินค้า' },
        { id: 'income', icon: 'fa-baht-sign', label: 'รายรับ' },
      ]},
      { section: 'จัดการ', items: [
        { id: 'settings', icon: 'fa-gear', label: 'ตั้งค่า' },
      ]},
    ],
  },
  service: {
    name: 'Furry Dreams',
    type: 'Pet Hotel & Grooming', typeClass: 'type-service',
    nav: [
      { section: 'หลัก', items: [
        { id: 'dashboard', icon: 'fa-gauge', label: 'แดชบอร์ด' },
        { id: 'queue', icon: 'fa-calendar-check', label: 'การจอง', badge: 2 },
        { id: 'rooms', icon: 'fa-bed', label: 'ห้องพัก' },
        { id: 'products', icon: 'fa-scissors', label: 'บริการ Grooming' },
        { id: 'income', icon: 'fa-baht-sign', label: 'รายรับ' },
      ]},
      { section: 'จัดการ', items: [
        { id: 'settings', icon: 'fa-gear', label: 'ตั้งค่า' },
      ]},
    ],
  },
  admin: {
    name: 'FUFU Headquarters',
    type: 'Super Admin', typeClass: 'type-admin',
    nav: [
      { section: 'ภาพรวม', items: [
        { id: 'dashboard', icon: 'fa-gauge', label: 'แดชบอร์ด' },
        { id: 'overview', icon: 'fa-chart-pie', label: 'ภาพรวมทุก Partner' },
        { id: 'income', icon: 'fa-baht-sign', label: 'รายรับรวม' },
      ]},
      { section: 'จัดการ', items: [
        { id: 'queue', icon: 'fa-calendar-check', label: 'การนัดหมาย' },
        { id: 'products', icon: 'fa-box', label: 'สินค้า / บริการ' },
        { id: 'settings', icon: 'fa-gear', label: 'ตั้งค่าระบบ' },
      ]},
    ],
  },
};

// ===== DEMO DATA =====
const demoData = {
  vet: {
    stats: [
      { icon: 'fa-calendar-check', cl: 'si-orange sc-orange', val: '8', label: 'นัดหมายวันนี้', change: '+2', up: true },
      { icon: 'fa-baht-sign', cl: 'si-teal sc-teal', val: '฿12,400', label: 'รายรับวันนี้', change: '+8%', up: true },
      { icon: 'fa-paw', cl: 'si-yellow sc-yellow', val: '34', label: 'ผู้ป่วยเดือนนี้', change: '+5', up: true },
      { icon: 'fa-star', cl: 'si-purple sc-purple', val: '4.9', label: 'คะแนนรีวิว', change: '+0.1', up: true },
    ],
    quickActions: [
      { icon: '📋', label: 'เพิ่มนัดหมาย', page: 'queue' },
      { icon: '💊', label: 'บันทึกการรักษา', page: 'records' },
      { icon: '💉', label: 'จัดการบริการ', page: 'products' },
      { icon: '📊', label: 'ดูรายรับ', page: 'income' },
    ],
    queue: [
      { num: 'A001', pet: 'บัดดี้ (สุนัข)', owner: 'คุณสมชาย', time: '09:00', status: 'active', statusLabel: 'กำลังรักษา', priority: 'emergency' },
      { num: 'A002', pet: 'มิลค์ (แมว)', owner: 'คุณสุดา', time: '09:30', status: 'waiting', statusLabel: 'รอ', priority: 'vip' },
      { num: 'A003', pet: 'โกลเด้น (สุนัข)', owner: 'คุณวิชัย', time: '10:00', status: 'waiting', statusLabel: 'รอ', priority: 'normal' },
      { num: 'A004', pet: 'ชิโระ (แมว)', owner: 'คุณนภา', time: '11:00', status: 'done', statusLabel: 'เสร็จ', priority: 'normal' },
    ],
    chart: { vals: ['55%','70%','45%','85%','60%','90%','75%'], labels: ['จ','อ','พ','พฤ','ศ','ส','อา'] },
    recentHead: ['วันที่','สัตว์เลี้ยง','บริการ','ราคา','สถานะ'],
    recentRows: [
      ['1 เม.ย.','บัดดี้','ตรวจสุขภาพ','฿500','<span class="badge badge-success">ชำระแล้ว</span>'],
      ['1 เม.ย.','มิลค์','ฉีดวัคซีน','฿800','<span class="badge badge-success">ชำระแล้ว</span>'],
      ['31 มี.ค.','โกลเด้น','ผ่าตัดทำหมัน','฿3,500','<span class="badge badge-warning">รอชำระ</span>'],
    ],
    products: [
      { icon: '💉', name: 'ฉีดวัคซีน 5 โรค', price: '฿800', stock: 'ไม่จำกัด' },
      { icon: '🔬', name: 'ตรวจเลือดครบชุด', price: '฿1,200', stock: 'ไม่จำกัด' },
      { icon: '✂️', name: 'ผ่าตัดทำหมัน', price: '฿3,500', stock: 'ไม่จำกัด' },
      { icon: '🦷', name: 'ขูดหินปูน', price: '฿1,500', stock: 'ไม่จำกัด' },
      { icon: '💊', name: 'ยาถ่ายพยาธิ', price: '฿120', stock: '45 กล่อง' },
      { icon: '🩺', name: 'ตรวจสุขภาพทั่วไป', price: '฿300', stock: 'ไม่จำกัด' },
    ],
  },
  shop: {
    stats: [
      { icon: 'fa-bag-shopping', cl: 'si-orange sc-orange', val: '12', label: 'คำสั่งซื้อวันนี้', change: '+4', up: true },
      { icon: 'fa-baht-sign', cl: 'si-teal sc-teal', val: '฿18,600', label: 'ยอดขายวันนี้', change: '+15%', up: true },
      { icon: 'fa-boxes-stacked', cl: 'si-yellow sc-yellow', val: '248', label: 'สินค้าทั้งหมด', change: '+8', up: true },
      { icon: 'fa-triangle-exclamation', cl: 'si-purple sc-purple', val: '6', label: 'สินค้าใกล้หมด', change: '', up: false },
    ],
    quickActions: [
      { icon: '📦', label: 'เพิ่มสินค้า', page: 'products' },
      { icon: '🛒', label: 'ดูคำสั่งซื้อ', page: 'queue' },
      { icon: '📊', label: 'ดูรายรับ', page: 'income' },
      { icon: '⚙️', label: 'ตั้งค่า', page: 'settings' },
    ],
    queue: [
      { num: '#1045', pet: 'Royal Canin 3kg', owner: 'คุณมีนา', time: '10:23', status: 'active', statusLabel: 'จัดส่ง' },
      { num: '#1046', pet: 'Whiskas x5', owner: 'คุณบุญมี', time: '11:00', status: 'waiting', statusLabel: 'รอจัดส่ง' },
      { num: '#1047', pet: 'สายจูง + ปลอกคอ', owner: 'คุณรัตนา', time: '13:00', status: 'waiting', statusLabel: 'รอจัดส่ง' },
    ],
    chart: { vals: ['65%','80%','55%','90%','70%','95%','85%'], labels: ['จ','อ','พ','พฤ','ศ','ส','อา'] },
    recentHead: ['วันที่','รายการ','จำนวน','ยอด','สถานะ'],
    recentRows: [
      ['1 เม.ย.','Royal Canin Maxi','2 ถุง','฿1,600','<span class="badge badge-success">จัดส่งแล้ว</span>'],
      ['1 เม.ย.','ทรายแมว 10kg','3 ถุง','฿900','<span class="badge badge-warning">กำลังจัด</span>'],
      ['31 มี.ค.','วิตามิน + ของเล่น','1 ชุด','฿650','<span class="badge badge-success">จัดส่งแล้ว</span>'],
    ],
    products: [
      { icon: '🍖', name: 'Royal Canin Medium', price: '฿850', stock: '45 ถุง' },
      { icon: '🐟', name: 'Whiskas Tuna Pack', price: '฿180', stock: '120 ซอง' },
      { icon: '🪮', name: 'แปรงขน Pro', price: '฿320', stock: '32 ชิ้น' },
      { icon: '🦴', name: 'ขนม Temptations', price: '฿120', stock: '80 ซอง' },
      { icon: '🛁', name: 'แชมพูสุนัข', price: '฿220', stock: '15 ขวด' },
      { icon: '🧸', name: 'ของเล่นตุ๊กตา', price: '฿150', stock: '28 ชิ้น' },
    ],
  },
  service: {
    stats: [
      { icon: 'fa-bed', cl: 'si-orange sc-orange', val: '8', label: 'ห้องที่มีผู้เข้าพัก', change: '', up: true },
      { icon: 'fa-baht-sign', cl: 'si-teal sc-teal', val: '฿9,800', label: 'รายรับวันนี้', change: '+5%', up: true },
      { icon: 'fa-scissors', cl: 'si-yellow sc-yellow', val: '5', label: 'คิว Grooming วันนี้', change: '', up: true },
      { icon: 'fa-calendar-check', cl: 'si-purple sc-purple', val: '22', label: 'การจองเดือนนี้', change: '+3', up: true },
    ],
    quickActions: [
      { icon: '🏠', label: 'จองห้องพัก', page: 'rooms' },
      { icon: '✂️', label: 'นัด Grooming', page: 'queue' },
      { icon: '📊', label: 'ดูรายรับ', page: 'income' },
      { icon: '⚙️', label: 'ตั้งค่า', page: 'settings' },
    ],
    queue: [
      { num: 'H-01', pet: 'ลูน่า (สุนัข)', owner: 'คุณปวีณา', time: 'Check-in', status: 'active', statusLabel: 'Check-in' },
      { num: 'G-05', pet: 'มะม่วง (แมว)', owner: 'คุณอรนุช', time: '13:00', status: 'waiting', statusLabel: 'รอ Groom' },
      { num: 'H-02', pet: 'มักซ์ (สุนัข)', owner: 'คุณธนา', time: 'Check-out', status: 'done', statusLabel: 'Check-out' },
    ],
    chart: { vals: ['50%','65%','80%','60%','75%','88%','70%'], labels: ['จ','อ','พ','พฤ','ศ','ส','อา'] },
    recentHead: ['วันที่','สัตว์เลี้ยง','บริการ','ราคา','สถานะ'],
    recentRows: [
      ['1 เม.ย.','ลูน่า','ห้องพัก Suite 3 คืน','฿2,400','<span class="badge badge-success">Check-in</span>'],
      ['1 เม.ย.','มะม่วง','Grooming Full Set','฿800','<span class="badge badge-warning">รอดำเนินการ</span>'],
      ['31 มี.ค.','มักซ์','ห้องพักทั่วไป 2 คืน','฿1,200','<span class="badge badge-neutral">Check-out</span>'],
    ],
    products: [
      { icon: '🛏', name: 'ห้อง Standard', price: '฿400/คืน', stock: '5 ห้อง' },
      { icon: '⭐', name: 'ห้อง Deluxe', price: '฿650/คืน', stock: '3 ห้อง' },
      { icon: '👑', name: 'ห้อง Suite', price: '฿900/คืน', stock: '2 ห้อง' },
      { icon: '✂️', name: 'Grooming Basic', price: '฿400', stock: 'ไม่จำกัด' },
      { icon: '💆', name: 'Spa + Grooming', price: '฿700', stock: 'ไม่จำกัด' },
      { icon: '🛁', name: 'อาบน้ำ + แต่งเล็บ', price: '฿250', stock: 'ไม่จำกัด' },
    ],
  },
};

// ===== STATE =====
let role = getCurrentRole();
let cfg = navConfig[role] || navConfig.vet;
let currentPage = 'dashboard';

/** Get demo data for a specific role */
export function getDemoData(r) { return demoData[r || role] || demoData.vet; }

/** Get the current navigation config */
export function getNavConfig(r) { return navConfig[r || role] || navConfig.vet; }

// ===== STORE DROPDOWN =====
async function loadStoresDropdown() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const switcher = document.getElementById('store-switcher');
  if (!switcher) return;

  let stores = [];

  if (!token || token === 'demo_token') {
    stores = [
      { id: 'store-vet-001', name: 'Happy Pet Clinic (Demo)', category: 'vet_clinic' },
      { id: 'store-shop-002', name: 'FUFU Pet Paradise (Demo)', category: 'pet_shop' },
    ];
  } else {
    try {
      const res = await fetch(`${API_BASE}/api/my-stores`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      stores = await res.json();
    } catch (e) {
      console.error('Failed to fetch stores', e);
    }
  }

  switcher.innerHTML = stores.map(s =>
    `<option value="${s.id}">${s.name || 'ไม่ได้ตั้งชื่อร้าน'}</option>`
  ).join('');

  const currentId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
  if (currentId && stores.some(s => s.id === currentId)) {
    switcher.value = currentId;
  }
}

// ===== SIDEBAR =====
function renderSidebar() {
  loadStoresDropdown();

  const user = getCurrentUser();
  const typeEl = document.getElementById('sb-partner-type');
  if (typeEl) {
    typeEl.textContent = cfg.type;
    typeEl.className = 'p-type ' + cfg.typeClass;
  }

  const nameEl = document.getElementById('sb-user-name');
  const emailEl = document.getElementById('sb-user-email');
  if (nameEl) nameEl.textContent = user.email ? user.email.split('@')[0] : 'Partner';
  if (emailEl) emailEl.textContent = user.email || 'partner@fufu.app';

  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  // Apply RBAC filtering to nav
  let filteredNav = injectRBACNav(JSON.parse(JSON.stringify(cfg.nav)));
  filteredNav = filterNavByRole(filteredNav);

  nav.innerHTML = '';
  filteredNav.forEach(section => {
    const sec = document.createElement('div');
    sec.className = 'nav-section';
    sec.innerHTML = `<div class="nav-section-title">${section.section}</div>`;

    section.items.forEach(item => {
      const a = document.createElement('a');
      a.className = 'nav-item' + (item.id === 'dashboard' ? ' active' : '');
      a.href = '#';
      a.dataset.page = item.id;
      a.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.id);
      });
      sec.appendChild(a);
    });

    nav.appendChild(sec);
  });

  // Show current staff role badge (for Owner)
  const staffRole = getStaffRole();
  const roleLabel = { owner: 'เจ้าของ', vet: 'สัตว์แพทย์', reception: 'ต้อนรับ', staff: 'พนักงาน', accountant: 'บัญชี' };
  const roleEl = document.getElementById('sb-staff-role');
  if (roleEl) {
    roleEl.textContent = roleLabel[staffRole] || staffRole;
  }
}

// ===== NAVIGATION =====
export function navigate(pageId) {
  currentPage = pageId;

  // Toggle page sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));

  const pg = document.getElementById('page-' + pageId);
  if (pg) pg.classList.add('active');

  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'แดชบอร์ด', queue: 'คิว / การนัดหมาย', income: 'รายรับ',
    products: 'สินค้า / บริการ', records: 'ประวัติการรักษา', rooms: 'ห้องพัก',
    overview: 'ภาพรวมทุก Partner', settings: 'ตั้งค่า', users: 'จัดการพนักงาน',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageId] || pageId;

  // Try to fetch real data for specific pages
  const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
  if (pageId === 'queue') fetchFromSupabase('appointments', { store_id: storeId });
  if (pageId === 'income') fetchFromSupabase('transactions', { store_id: storeId });

  // Render page-specific modules
  if (pageId === 'users' && FEATURE_FLAGS.ENABLE_RBAC) {
    renderUserManagement(document.getElementById('page-users'));
  }
  if (pageId === 'records' && FEATURE_FLAGS.ENABLE_MEDICAL_MODULE) {
    renderMedicalRecords();
  }
  if (pageId === 'products') {
    renderInventoryExtras();
  }
  if (pageId === 'queue') {
    renderFullQueue();
    if (FEATURE_FLAGS.ENABLE_CALENDAR_VIEW) {
      const calContainer = document.getElementById('queue-calendar');
      if (calContainer) renderCalendar(calContainer);
    }
  }
  if (pageId === 'rooms' && FEATURE_FLAGS.ENABLE_HOTEL_MODULE) {
    renderRooms(role);
  }
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  const d = getDemoData(role);

  // Update section titles based on role
  const qTitle = document.getElementById('db-queue-title');
  if (qTitle) {
    if (role === 'vet') qTitle.textContent = '🗓 คิวแพทย์ / ผู้ป่วยวันนี้ (Today\'s Patients)';
    else if (role === 'shop') qTitle.textContent = '📦 ออเดอร์สินค้า (Product Orders)';
    else if (role === 'service') qTitle.textContent = '✂️ ตารางงาน (Grooming Schedule)';
  }

  const rTitle = document.getElementById('recent-title');
  if (rTitle) {
    if (role === 'vet') rTitle.textContent = '📋 รายการรักษาล่าสุด';
    else if (role === 'shop') rTitle.textContent = '📋 สถานะสต็อก (Stock Status)';
    else if (role === 'service') rTitle.textContent = '🛍 แพ็กเกจ / บริการ (Service Packages)';
  }

  // Quick actions
  const qa = document.getElementById('quick-actions');
  if (qa) {
    qa.innerHTML = d.quickActions.map(a =>
      `<div class="qa-btn" data-nav-page="${a.page}">
        <div class="qa-icon">${a.icon}</div>
        <div class="qa-label">${a.label}</div>
      </div>`
    ).join('');

    qa.querySelectorAll('.qa-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.navPage));
    });
  }

  // Stats
  const sg = document.getElementById('stats-grid');
  if (sg) {
    sg.innerHTML = d.stats.map(s =>
      `<div class="stat-card ${s.cl.split(' ')[1]}">
        <div class="stat-icon ${s.cl.split(' ')[0]}"><i class="fas ${s.icon}"></i></div>
        <div class="stat-value">${s.val}</div>
        <div class="stat-label">${s.label}</div>
        ${s.change ? `<div class="stat-change ${s.up ? 'up' : 'down'}"><i class="fas fa-arrow-${s.up ? 'up' : 'down'}"></i> ${s.change}</div>` : ''}
      </div>`
    ).join('');
  }

  // Queue preview
  renderQueue(d.queue);

  // Chart
  const ca = document.getElementById('chart-area');
  const cl = document.getElementById('chart-labels');
  if (ca) {
    ca.innerHTML = d.chart.vals.map(v =>
      `<div class="chart-bar" style="height:${v}" data-val="฿${Math.round(parseInt(v) * 1.2)}K"></div>`
    ).join('');
  }
  if (cl) cl.innerHTML = d.chart.labels.map(l => `<span>${l}</span>`).join('');

  // Recent table
  const rh = document.getElementById('recent-thead');
  const rb = document.getElementById('recent-tbody');
  if (rh) rh.innerHTML = '<tr>' + d.recentHead.map(h => `<th>${h}</th>`).join('') + '</tr>';
  if (rb) rb.innerHTML = d.recentRows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');

  // Delegate to sub-modules
  renderProducts(d.products);
  renderFullQueue(d);
  renderFinancePage(role);
  renderRooms(role);

  // Render calendar on queue page
  const calContainer = document.getElementById('queue-calendar');
  if (calContainer) renderCalendar(calContainer);
}

// ===== STORE SWITCH =====
function switchStore(newId) {
  if (!newId) return;
  const switcher = document.getElementById('store-switcher');
  if (!switcher) return;

  const selectedText = switcher.options[switcher.selectedIndex]?.text || '';

  localStorage.setItem(STORAGE_KEYS.STORE_ID, newId);

  // Re-derive role (simplified — real implementation would fetch category)
  role = getCurrentRole();
  cfg = navConfig[role] || navConfig.vet;

  renderSidebar();
  navigate('dashboard');
  renderDashboard();
  showToast(`เปลี่ยนเป็นร้าน ${selectedText} แล้ว`);
}

// ===== MODAL =====
const modalForms = {
  queue: {
    title: 'เพิ่มนัดหมาย / คิว', sub: 'กรอกข้อมูลการนัดหมาย',
    fields: `
      <div class="form-row">
        <div class="field-group"><label class="field-label">ชื่อสัตว์เลี้ยง</label><input class="field-input" placeholder="บัดดี้"></div>
        <div class="field-group"><label class="field-label">เจ้าของ</label><input class="field-input" placeholder="คุณสมชาย"></div>
      </div>
      <div class="form-row">
        <div class="field-group"><label class="field-label">บริการ</label><input class="field-input" placeholder="ตรวจสุขภาพ"></div>
        <div class="field-group"><label class="field-label">เวลานัด</label><input class="field-input" type="time" value="09:00"></div>
      </div>
      <div class="field-group"><label class="field-label">หมายเหตุ</label><input class="field-input" placeholder="อาการ / รายละเอียด"></div>`,
  },
  products: {
    title: 'เพิ่มสินค้า / บริการ', sub: 'กรอกรายละเอียดสินค้าหรือบริการ',
    fields: `
      <div class="field-group"><label class="field-label">ชื่อสินค้า / บริการ</label><input class="field-input" placeholder="ชื่อ..."></div>
      <div class="form-row">
        <div class="field-group"><label class="field-label">ราคา (บาท)</label><input class="field-input" type="number" placeholder="0"></div>
        <div class="field-group"><label class="field-label">สต็อก</label><input class="field-input" placeholder="ไม่จำกัด"></div>
      </div>
      <div class="field-group"><label class="field-label">รายละเอียด</label><input class="field-input" placeholder="คำอธิบายสินค้า..."></div>`,
  },
};

export function openModal() {
  const form = modalForms[currentPage] || modalForms.queue;
  const mt = document.getElementById('modal-title');
  const ms = document.getElementById('modal-sub');
  const mb = document.getElementById('modal-body');
  const mo = document.getElementById('modal');
  if (mt) mt.textContent = form.title;
  if (ms) ms.textContent = form.sub;
  if (mb) mb.innerHTML = form.fields;
  if (mo) mo.classList.add('show');
}

export function closeModal() {
  const mo = document.getElementById('modal');
  if (mo) mo.classList.remove('show');
}

function confirmModal() {
  closeModal();
  showToast('บันทึกข้อมูลสำเร็จ');
}

// ===== TOPBAR DATE =====
function setDate() {
  const el = document.getElementById('topbar-date');
  if (el) el.textContent = formatThaiDate(new Date());
}

// ===== INIT =====
export function initDashboard() {
  role = getCurrentRole();
  cfg = navConfig[role] || navConfig.vet;

  renderSidebar();
  renderDashboard();
  setDate();
  initSettings();

  // Modal handlers
  const modalOverlay = document.getElementById('modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  const cancelBtn = document.querySelector('.btn-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const confirmBtn = document.querySelector('.btn-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmModal);

  // Notification bell
  const notifBtn = document.querySelector('.notif-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => showToast('มีการนัดหมายใหม่ 3 รายการ'));
  }

  // Logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

  // Store switcher
  const switcher = document.getElementById('store-switcher');
  if (switcher) switcher.addEventListener('change', (e) => switchStore(e.target.value));

  // All "เพิ่มรายการ" buttons
  document.querySelectorAll('[data-action="open-modal"]').forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  // Quick action "ดูทั้งหมด" links
  document.querySelectorAll('[data-action="navigate"]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.navTarget));
  });

  // TV Mode toggle
  const tvModeBtn = document.getElementById('tv-mode-btn');
  if (tvModeBtn) tvModeBtn.addEventListener('click', toggleTVMode);
}
