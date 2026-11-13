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
    <div class="space-y-4 sm:space-y-5">
      <div class="ph-head">
        <div>
          <h1 class="ph-title">${config.title}</h1>
          <p class="ph-sub">${config.description}</p>
        </div>
        <button type="button" data-home-refresh class="ph-btn">${icon('exchange-alt', 'w-3.5 h-3.5')}รีเฟรช</button>
      </div>
      <div class="ph-actions">
        ${config.actions.map(action => `<button type="button" data-home-nav="${action.id}" class="ph-btn ${action.primary ? 'is-primary' : ''}">${icon(action.icon, 'w-4 h-4')}<span>${action.label}</span></button>`).join('')}
      </div>
      <div id="business-home-data" class="space-y-4 sm:space-y-5">
        <div class="skeleton ph-skel" aria-hidden="true"></div>
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
    const todaysInvoices = invoices.filter(invoice => invoice.created_at && _localDateKey(new Date(invoice.created_at)) === today);
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
    const todayBookings = _uniqueById([...requested, ...upcoming]).filter(item => _apptDate(item) === today);
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
      secondary: `${_apptTime(item)} · ${item.owner_name || item.customer_name || 'เจ้าของสัตว์'}`,
      trailing: _appointmentStatus(item.status),
    }));
    emptyMessage = 'วันนี้ยังไม่มีการจองหรือเช็กอิน';
  } else {
    const requested = rows(data[0]);
    const upcoming = rows(data[1]);
    const queue = rows(data[2]);
    const appointments = _uniqueById([...requested, ...upcoming]);
    const todayAppointments = appointments.filter(item => _apptDate(item) === today);
    metrics = [
      ['นัดหมายวันนี้', data[0] && data[1] ? todayAppointments.length : '—', 'บริการที่กำหนดไว้วันนี้', 'calendar-alt', 'text-primary'],
      ['รอยืนยัน', data[0] ? requested.length : '—', 'คำขอใหม่จากเจ้าของสัตว์', 'clipboard-list', requested.length ? 'text-orange-600' : 'text-primary'],
      ['คิววันนี้', data[2] ? queue.length : '—', 'สัตว์ที่รอรับบริการ', 'paw', 'text-blue-600'],
      ['บริการที่เปิด', '—', 'ดูแลรายการบริการในหน้า Grooming', 'cut', 'text-primary'],
    ];
    recentTitle = 'นัดหมายที่ต้องดำเนินการ';
    recentRows = _uniqueById([...requested, ...todayAppointments]).slice(0, 5).map(item => ({
      primary: item.pet_name || item.notes || 'สัตว์เลี้ยง',
      secondary: `${_apptTime(item)} · ${item.owner_name || item.customer_name || 'เจ้าของสัตว์'}`,
      trailing: _appointmentStatus(item.status),
    }));
    emptyMessage = 'ยังไม่มีนัดหมายที่ต้องดำเนินการ';
  }

  const dataContainer = container.querySelector('#business-home-data');
  if (!dataContainer) return;
  // metric color hint → a quiet state: orange text when something needs attention
  dataContainer.innerHTML = `
    <dl class="ph-stats">
      ${metrics.map(([label, value, detail, , color]) => `<div class="ph-stat ${color === 'text-orange-600' ? 'is-alert' : ''}"><dt>${color === 'text-orange-600' ? '<span class="ph-dot"></span>' : ''}${label}</dt><dd>${value}</dd><small>${detail}</small></div>`).join('')}
    </dl>
    <section class="ph-section">
      <div class="ph-section__head"><div><h2 class="ph-section__title">${recentTitle}</h2></div><span class="ph-section__hint">${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></div>
      ${recentRows.length ? recentRows.map(row => `<div class="ph-row"><div class="ph-row__main"><div class="ph-row__title">${escapeText(row.primary)}</div><div class="ph-row__meta">${escapeText(row.secondary)}</div></div>${/^฿/.test(row.trailing) ? `<b class="ph-row__title">${escapeText(row.trailing)}</b>` : `<span class="ph-tag ${row.trailing === 'รอยืนยัน' ? 'is-warn' : 'is-ok'}">${escapeText(row.trailing)}</span>`}</div>`).join('') : `<div class="ph-empty">${emptyMessage}</div>`}
      ${hasErrors ? '<div class="ph-empty" role="status">ข้อมูลบางส่วนโหลดไม่สำเร็จ ลองกดรีเฟรชอีกครั้ง</div>' : ''}
    </section>`;

  container.onclick = event => {
    if (event.target.closest('[data-home-refresh]')) return _renderBusinessHome(container, storeId, role);
    const button = event.target.closest('[data-home-nav]');
    if (button) import('./dashboard.js').then(({ navigate }) => navigate(button.dataset.homeNav));
  };
}

// Appointment date/time in the clinic's local time (starts_at is stored in UTC)
function _apptDate(item) {
  if (item.appt_date) return item.appt_date;
  return item.starts_at ? _localDateKey(new Date(item.starts_at)) : '';
}
function _apptTime(item) {
  if (item.appt_time_slot) return item.appt_time_slot;
  if (!item.starts_at) return 'ไม่ระบุเวลา';
  return new Date(item.starts_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function _uniqueById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (item?.id == null) return true;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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
    <div class="space-y-4 sm:space-y-5">
      <div class="ph-head"><div><h1 class="ph-title">สิ่งที่ต้องทำวันนี้</h1><p class="ph-sub">กำลังโหลดข้อมูล…</p></div></div>
      <div class="skeleton ph-skel" aria-hidden="true"></div>
      <div class="skeleton ph-skel" style="height:180px" aria-hidden="true"></div>
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
      <div class="ph-section text-center" style="padding:36px 18px">
        <div class="ph-section__title">โหลดข้อมูลนัดหมายไม่สำเร็จ</div>
        <p class="ph-sub">ตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</p>
        <button id="retry-mvp-home" class="ph-btn is-primary" style="margin-top:16px">ลองใหม่</button>
      </div>`;
    container.querySelector('#retry-mvp-home')?.addEventListener('click', () => _renderMvpHome(container, storeId));
    return;
  }

  // The two buckets can overlap; count each appointment once
  const appointments = _uniqueById([...(Array.isArray(result.data) ? result.data : []), ...(Array.isArray(upcomingResult?.data) ? upcomingResult.data : [])]);
  const today = _localDateKey(new Date());
  const statusOf = item => String(item.status || '').toLowerCase();
  const requested = appointments.filter(item => ['pending', 'requested'].includes(statusOf(item)));
  const todayAppointments = appointments.filter(item => _apptDate(item) === today);
  const confirmedToday = todayAppointments.filter(item => statusOf(item) === 'confirmed');
  const referrals = Array.isArray(screeningResult?.data) ? screeningResult.data : [];
  const urgentReferrals = referrals.filter(item => item.triage_level === 'emergency');
  const caseCount = screeningResult?.count ?? referrals.length;

  container.innerHTML = `
    <div class="space-y-4 sm:space-y-5">
      <div class="ph-head">
        <div>
          <h1 class="ph-title">สิ่งที่ต้องทำวันนี้</h1>
          <p class="ph-sub">อัปเดตล่าสุด ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
        </div>
        <button id="refresh-mvp-home" class="ph-btn">${icon('exchange-alt', 'w-3.5 h-3.5')}รีเฟรช</button>
      </div>
      <dl class="ph-stats">
        ${_mvpMetric('นัดรอยืนยัน', requested.length, 'ควรตอบกลับก่อน', requested.length ? 'is-alert' : '')}
        ${_mvpMetric('นัดวันนี้', todayAppointments.length, 'รายการทั้งหมดวันนี้')}
        ${_mvpMetric('ยืนยันแล้ววันนี้', confirmedToday.length, 'เตรียมรับบริการ')}
        ${_mvpMetric('เคส AI รอพิจารณา', caseCount, urgentReferrals.length ? `${urgentReferrals.length} เคสเร่งด่วน` : 'จากเจ้าของสัตว์', urgentReferrals.length ? 'is-urgent' : '')}
      </dl>
      <div class="ph-grid is-2">
        <section class="ph-section">
          <div class="ph-section__head">
            <div><h2 class="ph-section__title">เคสคัดกรองที่ควรดู</h2><p class="ph-section__hint">เรียงตามความเร่งด่วน</p></div>
            <button id="open-screening-inbox" class="ph-link">ดูทั้งหมด ${icon('chevron-right', 'w-3.5 h-3.5')}</button>
          </div>
          ${referrals.length === 0
            ? '<div class="ph-empty">ยังไม่มีเคส AI ที่รอพิจารณา</div>'
            : _sortByTriage(referrals).slice(0, 4).map(_mvpReferralRow).join('')}
        </section>
        <section class="ph-section">
          <div class="ph-section__head">
            <div><h2 class="ph-section__title">นัดรอยืนยัน</h2><p class="ph-section__hint">ตอบกลับเจ้าของสัตว์</p></div>
            <button id="open-mvp-appointments" class="ph-link">ดูนัดหมาย ${icon('chevron-right', 'w-3.5 h-3.5')}</button>
          </div>
          ${requested.length === 0
            ? '<div class="ph-empty">ไม่มีนัดรอยืนยัน</div>'
            : requested.slice(0, 5).map(_mvpAppointmentRow).join('')}
        </section>
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

function _mvpMetric(label, value, detail, state = '') {
  return `
    <div class="ph-stat ${state}">
      <dt>${state ? '<span class="ph-dot"></span>' : ''}${label}</dt>
      <dd>${value}</dd>
      <small>${detail}</small>
    </div>`;
}

const BODY_PART_TH = { skin: 'ผิวหนัง', eye: 'ตา', eyes: 'ตา', ear: 'หู', ears: 'หู', dental: 'ช่องปาก', mouth: 'ช่องปาก', teeth: 'ช่องปาก' };
const TRIAGE_RANK = { emergency: 0, vet_24_48h: 1 };

function _sortByTriage(items) {
  return [...items].sort((a, b) => (TRIAGE_RANK[a.triage_level] ?? 2) - (TRIAGE_RANK[b.triage_level] ?? 2));
}

function _mvpReferralRow(item) {
  const part = BODY_PART_TH[String(item.body_part || '').toLowerCase()] || item.body_part || 'ผลคัดกรอง';
  const level = item.triage_level;
  const tag = level === 'emergency' ? ['is-bad', 'เร่งด่วน'] : level === 'vet_24_48h' ? ['is-warn', '24–48 ชม.'] : ['', 'ดูที่บ้าน'];
  return `
    <div class="ph-row">
      <div class="ph-row__main">
        <div class="ph-row__title">${escapeText(item.pet?.name || 'สัตว์เลี้ยง')} · ${escapeText(part)}</div>
        <div class="ph-row__meta">${escapeText(item.owner_contact?.name || 'เจ้าของสัตว์')} · ${escapeText(item.result_json?.summary || 'รอสัตวแพทย์พิจารณา')}</div>
      </div>
      <span class="ph-tag ${tag[0]}">${tag[1]}</span>
    </div>`;
}

function _mvpAppointmentRow(item) {
  const time = _apptTime(item);
  const customer = item.customer_name || item.owner_name || 'ลูกค้า';
  const pet = item.pet_name || item.notes || 'ไม่ระบุชื่อสัตว์';
  const service = item.service || item.service_name || '';
  return `
    <div class="ph-row">
      <div class="ph-row__time"><b>${escapeText(time)}</b><span>${escapeText(_dayLabel(_apptDate(item)))}</span></div>
      <div class="ph-row__main">
        <div class="ph-row__title">${escapeText(pet)}</div>
        <div class="ph-row__meta">${escapeText(service ? `${customer} · ${service}` : customer)}</div>
      </div>
      <span class="ph-tag is-warn">รอยืนยัน</span>
    </div>`;
}

// "วันนี้" / "พรุ่งนี้" / "14 พ.ย." for a YYYY-MM-DD key
function _dayLabel(key) {
  if (!key) return '';
  const now = new Date();
  if (key === _localDateKey(now)) return 'วันนี้';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (key === _localDateKey(tomorrow)) return 'พรุ่งนี้';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
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
