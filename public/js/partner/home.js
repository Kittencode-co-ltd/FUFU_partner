import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { STORAGE_KEYS, FEATURE_FLAGS } from '../utils/config.js';
import { icon } from '../utils/icons.js';

// ─── Date range presets ───────────────────────────────────────────────────────

const RANGES = [
  { id: 'today',  label: 'วันนี้',    days: 0  },
  { id: '7d',     label: '7 วัน',     days: 6  },
  { id: '30d',    label: '30 วัน',    days: 29 },
  { id: 'month',  label: 'เดือนนี้',  days: -1 }, // special: 1st of month
  { id: 'custom', label: 'กำหนดเอง', days: -2 }, // special: show inputs
];

function _dateRange(preset) {
  const today = new Date();
  const toStr = today.toISOString().split('T')[0];
  if (preset.days === 0) return { from: toStr, to: toStr };
  if (preset.days === -1) {
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    return { from, to: toStr };
  }
  const from = new Date(Date.now() - preset.days * 86400000).toISOString().split('T')[0];
  return { from, to: toStr };
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderHome(container) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) {
    container.innerHTML = `
      <div class="card p-10 text-center space-y-3">
        <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto">
          <span class="text-slate-400">${icon('store', 'w-6 h-6')}</span>
        </div>
        <div class="font-semibold text-navy">ยังไม่ได้เลือกร้านค้า</div>
        <p class="text-slate-400 font-body text-sm">กรุณา logout แล้ว login ใหม่</p>
      </div>`;
    return;
  }

  const role = storage.get(STORAGE_KEYS.ROLE) || 'vet';
  if (FEATURE_FLAGS.MVP_MODE && role !== 'vet') {
    await _renderBusinessHome(container, storeId, role);
    return;
  }

  if (FEATURE_FLAGS.MVP_MODE) {
    await _renderMvpHome(container, storeId);
    return;
  }

  // Default range: 7 วัน
  let activeRange = '7d';
  let customFrom  = '';
  let customTo    = '';

  const doRender = () => _renderDashboard(container, storeId, activeRange, customFrom, customTo);
  await doRender();

  // Delegate range tab clicks + custom inputs
  container.addEventListener('click', async e => {
    const tab = e.target.closest('[data-range]');
    if (!tab) return;
    activeRange = tab.dataset.range;
    _updateTabs(container, activeRange);
    container.querySelector('#custom-range')?.classList.toggle('hidden', activeRange !== 'custom');
    if (activeRange !== 'custom') await doRender();
  });

  container.addEventListener('click', async e => {
    if (e.target.id === 'apply-range') {
      customFrom = container.querySelector('#range-from')?.value;
      customTo   = container.querySelector('#range-to')?.value;
      if (customFrom && customTo) await doRender();
    }
  });
}

const BUSINESS_HOME = {
  shop: {
    eyebrow: 'SHOP WORKSPACE', title: 'ภาพรวมร้านค้า',
    description: 'จัดการสินค้า เช็กสต็อก และเริ่มขายจากหน้าเดียว',
    actions: [
      { id: 'inventory', label: 'เปิดคลังสินค้า', icon: 'box' },
      { id: 'pos', label: 'เริ่มขาย · POS', icon: 'credit-card', primary: true },
      { id: 'orders', label: 'คำสั่งซื้อออนไลน์', icon: 'receipt' },
    ],
  },
  hotel: {
    eyebrow: 'PET HOTEL WORKSPACE', title: 'ภาพรวมโรงแรมสัตว์เลี้ยง',
    description: 'ดูห้องพัก การจอง และงานเช็กอินที่ต้องทำวันนี้',
    actions: [
      { id: 'hotel', label: 'ดูห้องพัก', icon: 'bed', primary: true },
      { id: 'appointments', label: 'เปิดรายการจอง', icon: 'calendar-alt' },
      { id: 'queue', label: 'ไปที่คิว', icon: 'clipboard-list' },
    ],
  },
  grooming: {
    eyebrow: 'GROOMING WORKSPACE', title: 'ภาพรวมร้านอาบน้ำตัดขน',
    description: 'ติดตามนัดหมาย คิวบริการ และสัตว์เลี้ยงที่รอรับบริการ',
    actions: [
      { id: 'appointments', label: 'ดูนัดหมาย', icon: 'calendar-alt', primary: true },
      { id: 'queue', label: 'เปิดคิวบริการ', icon: 'clipboard-list' },
      { id: 'grooming', label: 'จัดการบริการ', icon: 'cut' },
    ],
  },
};

async function _renderBusinessHome(container, storeId, role) {
  const config = BUSINESS_HOME[role] || BUSINESS_HOME.shop;
  const today = _localDateKey(new Date());
  const appointmentUrl = `/api/appointments?store_id=${encodeURIComponent(storeId)}`;
  const requests = role === 'shop'
    ? [
        apiFetch(`/api/inventory?store_id=${encodeURIComponent(storeId)}`),
        apiFetch(`/api/pos/invoices?store_id=${encodeURIComponent(storeId)}&limit=100`),
      ]
    : role === 'hotel'
      ? [
          apiFetch(`/api/hotel/rooms?store_id=${encodeURIComponent(storeId)}`),
          apiFetch(`${appointmentUrl}&bucket=requested&limit=100`),
          apiFetch(`${appointmentUrl}&bucket=upcoming&limit=100`),
        ]
      : [
          apiFetch(`${appointmentUrl}&bucket=requested&limit=100`),
          apiFetch(`${appointmentUrl}&bucket=upcoming&limit=100`),
          apiFetch(`/api/queue?store_id=${encodeURIComponent(storeId)}&date=${today}`),
        ];

  container.innerHTML = `
    <div class="space-y-5">
      <div class="rounded-2xl bg-navy text-white p-6 sm:p-8 shadow-card">
        <div class="text-[11px] font-bold tracking-[0.16em] text-white/65">${config.eyebrow}</div>
        <div class="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 class="text-2xl sm:text-3xl font-bold">${config.title}</h1>
            <p class="mt-2 text-sm text-white/75">${config.description}</p></div>
          <button type="button" data-home-refresh class="min-h-11 rounded-xl border border-white/25 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">รีเฟรชข้อมูล</button>
        </div>
        <div class="mt-6 flex flex-wrap gap-2">
          ${config.actions.map(action => `<button type="button" data-home-nav="${action.id}" class="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${action.primary ? 'bg-accent text-white hover:bg-accent-dark' : 'bg-white/10 text-white hover:bg-white/20'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">${icon(action.icon, 'w-4 h-4')}<span>${action.label}</span></button>`).join('')}
        </div>
      </div>
      <div id="business-home-data" class="space-y-5">
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
          ${[1, 2, 3, 4].map(() => '<div class="card h-28 animate-pulse bg-slate-50" aria-hidden="true"></div>').join('')}
        </div>
      </div>
    </div>`;

  const responses = await Promise.allSettled(requests);
  const data = responses.map(item => item.status === 'fulfilled' && item.value?.success ? item.value : null);
  const hasErrors = data.some(item => !item);
  const rows = value => Array.isArray(value?.data) ? value.data : [];
  let metrics = [];
  let recentTitle = '';
  let recentRows = [];
  let emptyMessage = '';

  if (role === 'shop') {
    const products = rows(data[0]);
    const invoices = rows(data[1]);
    const lowStock = products.filter(product => Number(product.stock || 0) <= Number(product.reorder_point || 0));
    const todaysInvoices = invoices.filter(invoice => String(invoice.created_at || '').slice(0, 10) === today);
    const sales = todaysInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    metrics = [
      ['สินค้าในคลัง', data[0] ? products.length : '—', 'รายการที่เปิดขาย', 'box', 'text-primary'],
      ['สินค้าใกล้หมด', data[0] ? lowStock.length : '—', 'ควรตรวจและเติมสต็อก', 'exclamation-triangle', lowStock.length ? 'text-orange-600' : 'text-primary'],
      ['ยอดขายวันนี้', data[1] ? `฿${_formatBaht(sales)}` : '—', `${todaysInvoices.length} ใบเสร็จ`, 'coins', 'text-primary'],
      ['ออเดอร์ออนไลน์', '—', 'รอเชื่อมคำสั่งซื้อจาก FUFU App', 'receipt', 'text-slate-500'],
    ];
    recentTitle = 'ขายหน้าร้านล่าสุด';
    recentRows = todaysInvoices.slice(0, 5).map(invoice => ({
      primary: invoice.invoice_number || 'ใบเสร็จ',
      secondary: new Date(invoice.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      trailing: `฿${_formatBaht(invoice.total)}`,
    }));
    emptyMessage = 'วันนี้ยังไม่มีรายการขาย';
  } else if (role === 'hotel') {
    const rooms = rows(data[0]);
    const requested = rows(data[1]);
    const upcoming = rows(data[2]);
    const todayBookings = [...requested, ...upcoming].filter(item => (item.appt_date || item.starts_at?.slice(0, 10)) === today);
    const occupied = rooms.filter(room => room.status === 'occupied').length;
    metrics = [
      ['ห้องทั้งหมด', data[0] ? rooms.length : '—', 'ห้องในระบบ', 'bed', 'text-primary'],
      ['กำลังเข้าพัก', data[0] ? occupied : '—', 'ห้องที่มีสัตว์พักอยู่', 'paw', 'text-blue-600'],
      ['การจองวันนี้', data[1] && data[2] ? todayBookings.length : '—', 'เช็กอินและเช็กเอาต์', 'calendar-alt', 'text-primary'],
      ['รอยืนยัน', data[1] ? requested.length : '—', 'คำขอจองใหม่', 'clipboard-list', requested.length ? 'text-orange-600' : 'text-primary'],
    ];
    recentTitle = 'งานที่ต้องดูวันนี้';
    recentRows = todayBookings.slice(0, 5).map(item => ({
      primary: item.pet_name || item.notes || 'สัตว์เลี้ยง',
      secondary: `${item.appt_time_slot || item.starts_at?.slice(11, 16) || 'ไม่ระบุเวลา'} · ${item.owner_name || item.customer_name || 'เจ้าของสัตว์'}`,
      trailing: _appointmentStatus(item.status),
    }));
    emptyMessage = 'วันนี้ยังไม่มีการจองหรือเช็กอิน';
  } else {
    const requested = rows(data[0]);
    const upcoming = rows(data[1]);
    const queue = rows(data[2]);
    const appointments = [...requested, ...upcoming];
    const todayAppointments = appointments.filter(item => (item.appt_date || item.starts_at?.slice(0, 10)) === today);
    metrics = [
      ['นัดหมายวันนี้', data[0] && data[1] ? todayAppointments.length : '—', 'บริการที่กำหนดไว้วันนี้', 'calendar-alt', 'text-primary'],
      ['รอยืนยัน', data[0] ? requested.length : '—', 'คำขอใหม่จากเจ้าของสัตว์', 'clipboard-list', requested.length ? 'text-orange-600' : 'text-primary'],
      ['คิววันนี้', data[2] ? queue.length : '—', 'สัตว์ที่รอรับบริการ', 'paw', 'text-blue-600'],
      ['บริการที่เปิด', '—', 'ดูแลรายการบริการในหน้า Grooming', 'cut', 'text-primary'],
    ];
    recentTitle = 'นัดหมายที่ต้องดำเนินการ';
    recentRows = [...requested, ...todayAppointments].slice(0, 5).map(item => ({
      primary: item.pet_name || item.notes || 'สัตว์เลี้ยง',
      secondary: `${item.appt_time_slot || item.starts_at?.slice(11, 16) || 'ไม่ระบุเวลา'} · ${item.owner_name || item.customer_name || 'เจ้าของสัตว์'}`,
      trailing: _appointmentStatus(item.status),
    }));
    emptyMessage = 'ยังไม่มีนัดหมายที่ต้องดำเนินการ';
  }

  const dataContainer = container.querySelector('#business-home-data');
  if (!dataContainer) return;
  dataContainer.innerHTML = `
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
      ${metrics.map(([label, value, detail, glyph, color]) => `<article class="card p-4 sm:p-5 min-h-32"><div class="flex items-start justify-between gap-2"><div class="text-sm text-slate-500">${label}</div><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-subtle ${color}">${icon(glyph, 'w-4 h-4')}</span></div><div class="mt-3 text-2xl sm:text-3xl font-bold text-navy tabular-nums">${value}</div><div class="mt-1 text-xs text-slate-400">${detail}</div></article>`).join('')}
    </div>
    <section class="card overflow-hidden">
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 class="font-semibold text-navy">${recentTitle}</h2><p class="mt-1 text-xs text-slate-400">ข้อมูลจริงจากระบบของร้าน</p></div><span class="text-xs font-medium text-slate-400">${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></div>
      ${recentRows.length ? `<div class="divide-y divide-slate-100">${recentRows.map(row => `<div class="flex items-center justify-between gap-3 px-5 py-3"><div class="min-w-0"><div class="truncate text-sm font-semibold text-navy">${escapeText(row.primary)}</div><div class="mt-0.5 truncate text-xs text-slate-500">${escapeText(row.secondary)}</div></div><span class="flex-shrink-0 text-sm font-semibold text-primary">${escapeText(row.trailing)}</span></div>`).join('')}</div>` : `<div class="px-5 py-9 text-center"><p class="text-sm font-semibold text-slate-600">${emptyMessage}</p><p class="mt-1 text-xs text-slate-400">เมื่อมีรายการใหม่ ระบบจะแสดงไว้ตรงนี้</p></div>`}
      ${hasErrors ? '<div class="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800" role="status">ข้อมูลบางส่วนโหลดไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วรีเฟรช</div>' : ''}
    </section>`;

  container.onclick = event => {
    if (event.target.closest('[data-home-refresh]')) return _renderBusinessHome(container, storeId, role);
    const button = event.target.closest('[data-home-nav]');
    if (button) import('./dashboard.js').then(({ navigate }) => navigate(button.dataset.homeNav));
  };
}

function _localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function _formatBaht(value) {
  return Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function _appointmentStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'confirmed' ? 'ยืนยันแล้ว' : normalized === 'checked_in' ? 'เช็กอินแล้ว' : 'รอยืนยัน';
}

async function _renderMvpHome(container, storeId) {
  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold text-navy">สิ่งที่ต้องทำวันนี้</h2>
        <p class="text-sm text-slate-400 font-body mt-1">ข้อมูลนัดหมายจริงจากระบบ ไม่มีข้อมูลตัวอย่าง</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${[1, 2, 3].map(() => '<div class="card p-5 h-28 animate-pulse bg-slate-50"></div>').join('')}
      </div>
    </div>`;

  const [appointmentsResponse, upcomingResponse, screeningResponse] = await Promise.allSettled([
    apiFetch(`/api/appointments?store_id=${encodeURIComponent(storeId)}&bucket=requested&limit=100`),
    apiFetch(`/api/appointments?store_id=${encodeURIComponent(storeId)}&bucket=upcoming&limit=100`),
    apiFetch(`/api/screenings?store_id=${encodeURIComponent(storeId)}&bucket=new`),
  ]);
  const result = appointmentsResponse.status === 'fulfilled' ? appointmentsResponse.value : null;
  const upcomingResult = upcomingResponse.status === 'fulfilled' ? upcomingResponse.value : null;
  const screeningResult = screeningResponse.status === 'fulfilled' ? screeningResponse.value : null;

  if (!result?.success) {
    container.innerHTML = `
      <div class="card p-8 text-center space-y-3">
        <div class="font-semibold text-navy">โหลดข้อมูลนัดหมายไม่สำเร็จ</div>
        <p class="text-sm text-slate-500 font-body">ตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</p>
        <button id="retry-mvp-home" class="btn-primary px-4 py-2 text-sm">ลองใหม่</button>
      </div>`;
    container.querySelector('#retry-mvp-home')?.addEventListener('click', () => _renderMvpHome(container, storeId));
    return;
  }

  const appointments = [...(Array.isArray(result.data) ? result.data : []), ...(Array.isArray(upcomingResult?.data) ? upcomingResult.data : [])];
  const today = new Date().toISOString().slice(0, 10);
  const statusOf = item => String(item.status || '').toLowerCase();
  const requested = appointments.filter(item => ['pending', 'requested'].includes(statusOf(item)));
  const todayAppointments = appointments.filter(item => {
    const date = item.appt_date || item.starts_at?.slice(0, 10);
    return date === today;
  });
  const confirmedToday = todayAppointments.filter(item => statusOf(item) === 'confirmed');
  const referrals = Array.isArray(screeningResult?.data) ? screeningResult.data : [];
  const urgentReferrals = referrals.filter(item => item.triage_level === 'emergency');

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-bold text-navy">สิ่งที่ต้องทำวันนี้</h2>
          <p class="text-sm text-slate-400 font-body mt-1">อัปเดตล่าสุด ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button id="refresh-mvp-home" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary">รีเฟรช</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${_mvpMetric('นัดรอยืนยัน', requested.length, 'ควรตอบกลับก่อน', 'text-orange-600', true)}
        ${_mvpMetric('นัดวันนี้', todayAppointments.length, 'รายการทั้งหมดวันนี้', 'text-blue-600')}
        ${_mvpMetric('ยืนยันแล้ววันนี้', confirmedToday.length, 'เตรียมรับบริการ', 'text-primary')}
        ${_mvpMetric('เคส AI รอพิจารณา', screeningResult?.count ?? referrals.length, urgentReferrals.length ? `${urgentReferrals.length} เคสเร่งด่วน` : 'จากเจ้าของสัตว์', urgentReferrals.length ? 'text-red-700' : 'text-brand', urgentReferrals.length > 0)}
      </div>
      <div class="card p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold text-navy">เคสคัดกรองที่ควรดู</h3><p class="mt-1 text-xs text-slate-400">พิจารณาความเร่งด่วนและติดต่อเจ้าของสัตว์</p></div><button id="open-screening-inbox" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10">เปิดกล่องรับเคส →</button></div>
        ${referrals.length === 0 ? '<div class="py-5 text-center text-sm text-slate-400 font-body">ยังไม่มีเคส AI ที่รอพิจารณา</div>' : referrals.slice(0, 4).map(item => `<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3"><div><p class="font-semibold text-slate-800">${escapeText(item.pet?.name || 'สัตว์เลี้ยง')} · ${escapeText(item.body_part || 'ผลคัดกรอง')}</p><p class="mt-0.5 text-xs text-slate-500">${escapeText(item.owner_contact?.name || 'เจ้าของสัตว์')} · ${escapeText(item.result_json?.summary || 'รอสัตวแพทย์พิจารณา')}</p></div><span class="rounded-full px-2.5 py-1 text-xs font-bold ${item.triage_level === 'emergency' ? 'bg-red-50 text-red-700' : item.triage_level === 'vet_24_48h' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}">${item.triage_level === 'emergency' ? 'เร่งด่วน' : item.triage_level === 'vet_24_48h' ? '24–48 ชม.' : 'คัดกรอง'}</span></div>`).join('')}
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="font-semibold text-navy">นัดที่ต้องดำเนินการ</h3>
          <button id="open-mvp-appointments" class="text-sm font-semibold text-primary hover:underline">ดูนัดหมายทั้งหมด →</button>
        </div>
        ${requested.length === 0
          ? '<div class="py-8 text-center text-sm text-slate-400 font-body">ไม่มีนัดรอยืนยัน</div>'
          : requested.slice(0, 5).map(_mvpAppointmentRow).join('')}
      </div>
    </div>`;

  container.querySelector('#refresh-mvp-home')?.addEventListener('click', () => _renderMvpHome(container, storeId));
  container.querySelector('#open-mvp-appointments')?.addEventListener('click', () => {
    import('./dashboard.js').then(({ navigate }) => navigate('appointments'));
  });
  container.querySelector('#open-screening-inbox')?.addEventListener('click', () => {
    import('./dashboard.js').then(({ navigate }) => navigate('screenings'));
  });
}

function _mvpMetric(label, value, detail, color, urgent = false) {
  return `
    <div class="card p-4 sm:p-5 ${urgent && value > 0 ? 'border border-orange-200 bg-orange-50/40' : ''}">
      <div class="text-xs sm:text-sm text-slate-500 font-body">${label}</div>
      <div class="text-2xl sm:text-3xl font-bold ${color} mt-1.5 sm:mt-2 tabular-nums">${value}</div>
      <div class="text-xs text-slate-400 font-body mt-1">${detail}</div>
    </div>`;
}

function _mvpAppointmentRow(item) {
  const date = item.appt_date || item.starts_at?.slice(0, 10) || '';
  const time = item.appt_time_slot || item.starts_at?.slice(11, 16) || 'ไม่ระบุเวลา';
  const customer = item.customer_name || item.owner_name || 'ลูกค้า';
  const pet = item.pet_name || item.notes || 'ไม่ระบุชื่อสัตว์';
  return `
    <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div class="w-16 flex-shrink-0 text-center">
        <div class="text-sm font-bold text-navy">${escapeText(time)}</div>
        <div class="text-xs text-slate-400">${escapeText(date)}</div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-navy truncate">${escapeText(pet)}</div>
        <div class="text-xs text-slate-400 font-body truncate">${escapeText(customer)}</div>
      </div>
      <span class="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">รอยืนยัน</span>
    </div>`;
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ─── Main render ──────────────────────────────────────────────────────────────

async function _renderDashboard(container, storeId, rangeId, customFrom, customTo) {
  const preset = RANGES.find(r => r.id === rangeId) || RANGES[1];
  const { from, to } = rangeId === 'custom' && customFrom && customTo
    ? { from: customFrom, to: customTo }
    : _dateRange(preset);

  const today = new Date().toISOString().split('T')[0];

  // Skeleton while loading
  const tabsHTML = _tabsHTML(rangeId);
  container.innerHTML = `
    <div class="space-y-4 sm:space-y-5 w-full">
      ${tabsHTML}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" id="kpi-row">
        ${[1,2,3,4].map(() => `<div class="card p-3 sm:p-5 animate-pulse"><div class="h-6 sm:h-7 bg-slate-100 rounded mb-2 w-3/4"></div><div class="h-4 bg-slate-50 rounded w-1/2"></div></div>`).join('')}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div class="card p-4 sm:p-5 h-44 sm:h-52 animate-pulse"></div>
        <div class="card p-4 sm:p-5 h-44 sm:h-52 animate-pulse"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div class="card p-4 sm:p-5 h-36 sm:h-40 animate-pulse"></div>
        <div class="card p-4 sm:p-5 h-36 sm:h-40 animate-pulse"></div>
      </div>
    </div>`;

  // Fetch all data in parallel
  const [finRes, qRes, qToday] = await Promise.all([
    apiFetch(`/api/finance/range?store_id=${storeId}&from=${from}&to=${to}`),
    apiFetch(`/api/queue/range?store_id=${storeId}&from=${from}&to=${to}`),
    apiFetch(`/api/queue?store_id=${storeId}&date=${today}`),
  ]);

  const fin   = finRes?.data   || {};
  const q     = qRes?.data     || {};
  const todayQ = qToday?.data  || [];

  const label = rangeId === 'custom' ? `${_thaiDate(from)} – ${_thaiDate(to)}`
    : rangeId === 'today' ? 'วันนี้'
    : preset.label;

  container.innerHTML = `
    <div class="space-y-4 sm:space-y-5 w-full">

      <!-- ── Date range tabs ── -->
      ${tabsHTML}

      <!-- ── KPI Cards ── -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        ${_kpi('coins',       'รายได้รวม',       `฿${_fmt(fin.total)}`,        `จาก ${fin.count||0} รายการ`,  'text-primary',   '#2A637422')}
        ${_kpi('paw',         'ผู้ป่วย/ลูกค้า',  `${q.total||0} ราย`,          `เสร็จ ${q.completed||0} ราย`, 'text-blue-500',  '#3B82F622')}
        ${_kpi('chart-line',  'รายได้เฉลี่ย/วัน',`฿${_fmt(fin.avg_per_day)}`, label,                           'text-amber-600', '#F59E0B22')}
        ${_kpi('percentage',  'ค่าคอม FUFU 5%', `฿${_fmt(fin.commission)}`,   'หักจากรายได้รวม',              'text-slate-500', '#94A3B822')}
      </div>

      <!-- ── Charts row ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
            <h3 class="font-semibold text-navy text-sm flex items-center gap-1.5"><span class="text-primary opacity-70">${icon('chart-bar','w-3.5 h-3.5')}</span> รายได้รายวัน</h3>
            <span class="text-xs text-slate-400 font-body">สูงสุด ฿${_fmt(Math.max(...(fin.by_day||[]).map(d=>d.total), 0))}</span>
          </div>
          ${_barChart(fin.by_day || [], d => d.total, d => `฿${_fmt(d.total)}`, d => _shortDate(d.date), '#2A6374')}
        </div>
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
            <h3 class="font-semibold text-navy text-sm flex items-center gap-1.5"><span class="text-blue-400">${icon('paw','w-3.5 h-3.5')}</span> จำนวนผู้ป่วย/ลูกค้ารายวัน</h3>
            <span class="text-xs text-slate-400 font-body">สูงสุด ${Math.max(...(q.by_day||[]).map(d=>d.count), 0)} ราย</span>
          </div>
          ${_barChart(q.by_day || [], d => d.count, d => `${d.count} ราย`, d => _shortDate(d.date), '#3B82F6')}
        </div>
      </div>

      <!-- ── Bottom row: payment breakdown + today's queue ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

        <!-- Payment method breakdown -->
        <div class="card p-4 sm:p-5">
          <h3 class="font-semibold text-navy text-sm mb-4 flex items-center gap-1.5"><span class="text-slate-400">${icon('credit-card','w-3.5 h-3.5')}</span> รายได้แบ่งตามช่องทางชำระ</h3>
          ${_paymentBars(fin.by_method || {}, fin.total || 0)}
          ${(q.by_service && Object.keys(q.by_service).length > 0) ? `
            <div class="mt-5 pt-4 border-t border-slate-100">
              <h4 class="font-semibold text-navy text-xs mb-3 uppercase tracking-wide">ประเภทบริการ</h4>
              ${_serviceBars(q.by_service, q.total || 0)}
            </div>` : ''}
        </div>

        <!-- Today's queue -->
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between mb-3 gap-2 flex-wrap">
            <h3 class="font-semibold text-navy text-sm flex-shrink-0 flex items-center gap-1.5"><span class="text-slate-400">${icon('list-ul','w-3.5 h-3.5')}</span> คิววันนี้</h3>
            <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs font-body text-slate-400">
              <span>รอ <strong class="text-amber-500">${todayQ.filter(q=>q.status==='waiting').length}</strong></span>
              <span>กำลังรักษา <strong class="text-blue-500">${todayQ.filter(q=>q.status==='in_progress').length}</strong></span>
              <span>เสร็จ <strong class="text-primary">${todayQ.filter(q=>q.status==='completed').length}</strong></span>
            </div>
          </div>
          ${todayQ.length === 0
            ? `<div class="py-8 text-center text-slate-400 font-body text-sm">ยังไม่มีคิววันนี้</div>`
            : todayQ.slice(0, 7).map(_queueRow).join('')
          }
          ${todayQ.length > 7
            ? `<div class="text-center pt-2"><button data-nav-goto="queue" class="text-xs text-primary hover:underline font-body">ดูทั้งหมด ${todayQ.length} รายการ →</button></div>`
            : ''}
        </div>
      </div>
    </div>`;

  // Navigate to queue
  container.querySelector('[data-nav-goto="queue"]')?.addEventListener('click', () => {
    import('./dashboard.js').then(({ navigate }) => navigate('queue'));
  });

  // Re-bind range events after re-render
  container.querySelectorAll('[data-range]').forEach(tab => {
    tab.addEventListener('click', async () => {
      const rangeNew = tab.dataset.range;
      container.querySelectorAll('[data-range]').forEach(t => {
        const on = t.dataset.range === rangeNew;
        t.style.cssText = on
          ? 'background:var(--color-brand,#2A6374);color:var(--color-fg-inverse,#fff);border-color:var(--color-brand,#2A6374);'
          : '';
      });
      container.querySelector('#custom-range')?.classList.toggle('hidden', rangeNew !== 'custom');
      if (rangeNew !== 'custom') {
        await _renderDashboard(container, storeId, rangeNew, customFrom, customTo);
      }
    });
  });

  container.querySelector('#apply-range')?.addEventListener('click', async () => {
    const f = container.querySelector('#range-from')?.value;
    const t = container.querySelector('#range-to')?.value;
    if (f && t) await _renderDashboard(container, storeId, 'custom', f, t);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function _tabsHTML(activeId) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  return `
    <div class="flex flex-wrap items-center gap-2">
      ${RANGES.map(r => `
        <button data-range="${r.id}"
          class="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border font-semibold transition-colors font-body"
          style="${r.id === activeId ? 'background:var(--color-brand,#2A6374);color:var(--color-fg-inverse,#fff);border-color:var(--color-brand,#2A6374);' : 'background:var(--color-surface,#fff);color:var(--color-fg-muted,#64748B);border-color:var(--color-line,#E2E8F0);'}">
          ${r.label}
        </button>`).join('')}
    </div>
    <div id="custom-range" class="${activeId !== 'custom' ? 'hidden' : ''} flex items-center gap-2 flex-wrap mt-1">
      <input id="range-from" type="date" value="${weekAgo}" class="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary font-body">
      <span class="text-slate-400 font-body">—</span>
      <input id="range-to"   type="date" value="${today}"   class="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary font-body">
      <button id="apply-range" class="btn-primary text-sm px-4 py-2">ดูข้อมูล</button>
    </div>`;
}

function _updateTabs(container, activeId) {
  container.querySelectorAll('[data-range]').forEach(t => {
    const on = t.dataset.range === activeId;
    t.style.cssText = on ? 'background:var(--color-brand,#2A6374);color:var(--color-fg-inverse,#fff);border-color:var(--color-brand,#2A6374);' : '';
  });
}

function _kpi(iconKey, label, value, sub, valueClass, iconBg = '#f1f5f9') {
  const iconColor = iconBg.replace('22', 'bb');
  return `
    <div class="card p-3 sm:p-5">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center mb-3 flex-shrink-0"
           style="background:${iconBg};color:${iconColor}">
        ${icon(iconKey, 'w-4 h-4')}
      </div>
      <div class="text-xs text-slate-400 font-body leading-tight">${label}</div>
      <div class="text-lg sm:text-2xl font-bold ${valueClass} mt-1 leading-tight break-all">${value}</div>
      <div class="text-xs text-slate-400 font-body mt-0.5">${sub}</div>
    </div>`;
}

function _barChart(data, valFn, labelFn, dateFn, color) {
  if (!data.length) return `<div class="flex items-center justify-center h-24 text-slate-400 font-body text-sm">ยังไม่มีข้อมูล</div>`;
  const max = Math.max(...data.map(valFn), 1);
  const show = data.length > 14 ? data.filter((_, i) => i % 2 === 0) : data;
  return `
    <div class="flex items-end gap-1 h-28">
      ${show.map(d => {
        const pct = Math.max((valFn(d) / max) * 100, valFn(d) > 0 ? 3 : 0);
        const isToday = d.date === new Date().toISOString().split('T')[0];
        return `
          <div class="flex-1 flex flex-col items-center gap-1 min-w-0" title="${labelFn(d)}">
            <span class="text-xs font-body leading-none truncate w-full text-center"
              style="color:${valFn(d) > 0 ? color : '#CBD5E1'};font-size:0.6rem">
              ${valFn(d) > 0 ? labelFn(d) : ''}
            </span>
            <div class="w-full rounded-t transition-all"
              style="height:${pct}%;background:${isToday ? color : color + '55'};min-height:${valFn(d)>0?3:1}px"></div>
            <span class="text-xs font-body truncate w-full text-center"
              style="font-size:0.6rem;color:${isToday ? color : '#94A3B8'};font-weight:${isToday?700:400}">
              ${dateFn(d)}
            </span>
          </div>`;
      }).join('')}
    </div>`;
}

function _paymentBars(byMethod, total) {
  const PM = { cash: { label: 'เงินสด', icon: '' }, transfer: { label: 'โอนเงิน', icon: '' },
               card: { label: 'บัตรเครดิต', icon: '' }, promptpay: { label: 'พร้อมเพย์', icon: '' } };
  const entries = Object.entries(byMethod).sort(([,a],[,b]) => b - a);
  if (!entries.length) return `<div class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีข้อมูล</div>`;
  return entries.map(([method, amount]) => {
    const pm  = PM[method] || { label: method, icon: '' };
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    return `
      <div class="mb-2.5">
        <div class="flex justify-between text-xs mb-1 font-body">
          <span class="text-slate-600">${pm.icon} ${pm.label}</span>
          <span class="font-semibold text-navy">฿${_fmt(amount)} <span class="text-slate-400">(${pct}%)</span></span>
        </div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function _serviceBars(byService, total) {
  const entries = Object.entries(byService).sort(([,a],[,b]) => b - a).slice(0, 5);
  const colors  = ['#2A6374','#3B82F6','#F97316','#8B5CF6','#EAB308'];
  return entries.map(([svc, count], i) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="mb-2">
        <div class="flex justify-between text-xs mb-1 font-body">
          <span class="text-slate-600 truncate">${svc}</span>
          <span class="font-semibold text-navy ml-2">${count} ราย (${pct}%)</span>
        </div>
        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:${colors[i]||'#94A3B8'}"></div>
        </div>
      </div>`;
  }).join('');
}

function _queueRow(q) {
  const STATUS = {
    waiting:     { label: 'รอ',           cls: 'badge-gold' },
    called:      { label: 'เรียกแล้ว',   cls: 'badge-teal' },
    in_progress: { label: 'กำลังรักษา',  cls: 'bg-blue-50 text-blue-600' },
    completed:   { label: 'เสร็จ',        cls: 'badge-navy' },
    no_show:     { label: 'ไม่มา',        cls: 'bg-slate-100 text-slate-500' },
  };
  const s     = STATUS[q.status] || STATUS.waiting;
  const num   = String(q.queue_number).padStart(3, '0');
  const notes = q.notes || '';
  const [petName, ownerName] = notes.includes(' - ')
    ? notes.split(' - ').map(s => s.trim()) : [notes, ''];
  return `
    <div class="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <span class="font-mono font-bold text-primary text-sm w-12 flex-shrink-0">A${num}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-navy truncate">${petName || '—'}</div>
        <div class="text-xs text-slate-400 font-body truncate">${ownerName ? `${ownerName} · ` : ''}${q.service_type || ''}</div>
      </div>
      <span class="badge ${s.cls} flex-shrink-0 text-xs">${s.label}</span>
    </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _fmt(n) { return Number(n || 0).toLocaleString('th-TH'); }

function _shortDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

function _thaiDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return dateStr; }
}
