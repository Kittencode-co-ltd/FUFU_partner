import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';

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
        <div class="text-4xl">🏪</div>
        <div class="font-semibold text-navy">ยังไม่ได้เลือกร้านค้า</div>
        <p class="text-slate-400 font-body text-sm">กรุณา logout แล้ว login ใหม่</p>
      </div>`;
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
        ${_kpi('💰', 'รายได้รวม',       `฿${_fmt(fin.total)}`,        `จาก ${fin.count||0} รายการ`,  'text-primary')}
        ${_kpi('🐾', 'ผู้ป่วย/ลูกค้า',  `${q.total||0} ราย`,          `เสร็จ ${q.completed||0} ราย`, 'text-blue-500')}
        ${_kpi('📊', 'รายได้เฉลี่ย/วัน',`฿${_fmt(fin.avg_per_day)}`, label,                           'text-amber-600')}
        ${_kpi('💸', 'ค่าคอม FUFU 5%', `฿${_fmt(fin.commission)}`,   'หักจากรายได้รวม',              'text-slate-400')}
      </div>

      <!-- ── Charts row ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
            <h3 class="font-semibold text-navy text-sm">📈 รายได้รายวัน</h3>
            <span class="text-xs text-slate-400 font-body">สูงสุด ฿${_fmt(Math.max(...(fin.by_day||[]).map(d=>d.total), 0))}</span>
          </div>
          ${_barChart(fin.by_day || [], d => d.total, d => `฿${_fmt(d.total)}`, d => _shortDate(d.date), '#0D9488')}
        </div>
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
            <h3 class="font-semibold text-navy text-sm">🐾 จำนวนผู้ป่วย/ลูกค้ารายวัน</h3>
            <span class="text-xs text-slate-400 font-body">สูงสุด ${Math.max(...(q.by_day||[]).map(d=>d.count), 0)} ราย</span>
          </div>
          ${_barChart(q.by_day || [], d => d.count, d => `${d.count} ราย`, d => _shortDate(d.date), '#3B82F6')}
        </div>
      </div>

      <!-- ── Bottom row: payment breakdown + today's queue ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

        <!-- Payment method breakdown -->
        <div class="card p-4 sm:p-5">
          <h3 class="font-semibold text-navy text-sm mb-4">💳 รายได้แบ่งตามช่องทางชำระ</h3>
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
            <h3 class="font-semibold text-navy text-sm flex-shrink-0">📋 คิววันนี้</h3>
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
          ? 'background:#0D9488;color:#fff;border-color:#0D9488;'
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
          style="${r.id === activeId ? 'background:#0D9488;color:#fff;border-color:#0D9488;' : 'background:#fff;color:#64748B;border-color:#E2E8F0;'}">
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
    t.style.cssText = on ? 'background:#0D9488;color:#fff;border-color:#0D9488;' : '';
  });
}

function _kpi(icon, label, value, sub, valueClass) {
  return `
    <div class="card p-3 sm:p-5">
      <div class="text-xl sm:text-2xl mb-1.5">${icon}</div>
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
  const PM = { cash: { label: 'เงินสด', icon: '💵' }, transfer: { label: 'โอนเงิน', icon: '🏦' },
               card: { label: 'บัตรเครดิต', icon: '💳' }, promptpay: { label: 'พร้อมเพย์', icon: '📱' } };
  const entries = Object.entries(byMethod).sort(([,a],[,b]) => b - a);
  if (!entries.length) return `<div class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีข้อมูล</div>`;
  return entries.map(([method, amount]) => {
    const pm  = PM[method] || { label: method, icon: '💳' };
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
  const colors  = ['#0D9488','#3B82F6','#F97316','#8B5CF6','#EAB308'];
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
