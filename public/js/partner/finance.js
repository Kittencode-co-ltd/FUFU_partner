import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { formatThaiDate } from '../utils/formatters.js';

const PM_ICON  = { cash: '💵', promptpay: '📱', card: '💳', transfer: '🏦', voucher: '🎟', other: '💰' };
const PM_LABEL = { cash: 'เงินสด', promptpay: 'PromptPay', card: 'บัตร', transfer: 'โอน', voucher: 'Voucher', other: 'อื่นๆ' };

const EXP_CAT = {
  salary:    { label: 'ค่าแรงงาน',       icon: '👷' },
  supplies:  { label: 'วัสดุสิ้นเปลือง',  icon: '🔧' },
  rent:      { label: 'ค่าเช่า',          icon: '🏠' },
  utilities: { label: 'ค่าไฟ/น้ำ',        icon: '💡' },
  goods:     { label: 'ค่าสินค้า/ยา',     icon: '📦' },
  marketing: { label: 'ค่าโฆษณา',         icon: '📣' },
  other:     { label: 'อื่นๆ',            icon: '💰' },
};

// ─── Date range presets ───────────────────────────────────────────────────────

function _getRange(preset, customFrom, customTo) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  switch (preset) {
    case 'today':  return { from: today, to: today };
    case '7d':     return { from: new Date(now - 6 * 86400000).toISOString().split('T')[0], to: today };
    case '30d':    return { from: new Date(now - 29 * 86400000).toISOString().split('T')[0], to: today };
    case 'month':  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: today };
    case 'custom': return { from: customFrom || today, to: customTo || today };
    default:       return { from: today, to: today };
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderFinancePage(container) {
  if (!container) return;

  const storeId    = storage.get(STORAGE_KEYS.STORE_ID);
  const staffRole  = storage.get(STORAGE_KEYS.STAFF_ROLE);
  const canManage  = staffRole === 'owner' || staffRole === 'accountant';
  let activePreset = '30d';
  let customFrom   = '';
  let customTo     = '';

  const TABS = [
    { id: 'today', label: 'วันนี้' },
    { id: '7d',    label: '7 วัน' },
    { id: '30d',   label: '30 วัน' },
    { id: 'month', label: 'เดือนนี้' },
    { id: 'custom',label: 'กำหนดเอง' },
  ];

  container.innerHTML = `
    <div class="space-y-5 max-w-5xl">

      <!-- Date range -->
      <div class="card p-4">
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
          ${TABS.map(t => `
            <button data-preset="${t.id}"
              class="tab-btn px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all
                     ${t.id === activePreset
                       ? 'bg-primary text-white border-primary'
                       : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'}">
              ${t.label}
            </button>`).join('')}
          <div id="custom-pickers" style="display:none" class="flex items-center gap-2 ml-2">
            <input type="date" id="range-from" class="input-field py-1.5 text-sm w-36">
            <span class="text-slate-400 text-sm">–</span>
            <input type="date" id="range-to"   class="input-field py-1.5 text-sm w-36">
            <button id="apply-range" class="btn-primary text-sm py-1.5 px-4">ดู</button>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div id="finance-stats" class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${_skeletonCards(4)}
      </div>

      <!-- P&L summary -->
      <div id="pnl-section" class="card p-5">
        <h3 class="font-semibold text-navy mb-3">📊 P&L — รายได้ vs รายจ่าย</h3>
        <div id="pnl-content" class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          ${_skeletonCards(3)}
        </div>
      </div>

      <!-- Daily chart -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy" id="chart-title">📈 รายได้รายวัน</h3>
          <span class="text-xs text-slate-400 font-body" id="chart-max-label"></span>
        </div>
        <div id="finance-chart" class="flex items-end gap-1 sm:gap-1.5 h-40 sm:h-56 md:h-64">
          ${_skeletonBars(7)}
        </div>
      </div>

      <!-- Payment breakdown -->
      <div class="card p-5" id="payment-breakdown-card">
        <h3 class="font-semibold text-navy mb-4">💳 ช่องทางชำระเงิน</h3>
        <div id="payment-breakdown" class="space-y-3"></div>
      </div>

      <!-- Transaction table -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy">ประวัติธุรกรรม <span id="tx-count" class="text-xs text-slate-400 font-body ml-1"></span></h3>
          <button id="export-csv" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-primary hover:text-primary transition-colors font-semibold">
            <i class="fas fa-download mr-1"></i>Export CSV
          </button>
        </div>
        <div id="finance-table" class="space-y-0">
          <div class="text-center py-8 text-slate-400 font-body text-sm animate-pulse">กำลังโหลด...</div>
        </div>
      </div>

      <!-- Expense section -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy">💸 รายจ่าย <span id="exp-count" class="text-xs text-slate-400 font-body ml-1"></span></h3>
          <div class="flex items-center gap-2">
            <button id="export-exp-csv" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-primary hover:text-primary transition-colors font-semibold">
              <i class="fas fa-download mr-1"></i>Export CSV
            </button>
            ${canManage ? `
            <button id="add-expense-btn"
              class="text-sm text-primary border border-primary px-3 py-1.5 rounded-lg
                     hover:bg-primary-subtle transition-colors font-semibold">
              + บันทึกรายจ่าย
            </button>` : ''}
          </div>
        </div>
        <div id="expense-list">
          <div class="text-center py-6 text-slate-400 font-body text-sm animate-pulse">กำลังโหลด...</div>
        </div>
      </div>

    </div>`;

  let _txData  = [];
  let _expData = [];

  // ── Load all data ──
  async function _load() {
    const { from, to } = _getRange(activePreset, customFrom, customTo);
    _setLoading(container);

    const [rangeRes, txRes, expRes] = await Promise.all([
      apiFetch(`/api/finance/range?store_id=${storeId}&from=${from}&to=${to}`),
      apiFetch(`/api/finance/transactions?store_id=${storeId}&from=${from}&to=${to}&limit=200`),
      apiFetch(`/api/expenses?store_id=${storeId}&from=${from}&to=${to}`),
    ]);

    const rd  = rangeRes?.data || {};
    _txData   = txRes?.data  || [];
    _expData  = expRes?.data || [];
    const expTotal = expRes?.total || 0;

    _renderStats(container, rd, from, to);
    _renderPnL(container, rd.total || 0, expTotal);
    _renderChart(container, rd.by_day || [], from, to);
    _renderPaymentBreakdown(container, rd.by_method || {}, rd.total || 0);
    _renderTable(container, _txData);
    _renderExpenses(container, _expData, expTotal);

    container.querySelector('#tx-count').textContent  = `(${_txData.length} รายการ)`;
    container.querySelector('#exp-count').textContent = `(${_expData.length} รายการ · ฿${expTotal.toLocaleString('th-TH')})`;
  }

  function _updateTabs() {
    container.querySelectorAll('.tab-btn').forEach(b => {
      const active = b.dataset.preset === activePreset;
      b.style.background  = active ? '#0D9488' : '';
      b.style.color       = active ? '#fff'    : '';
      b.style.borderColor = active ? '#0D9488' : '';
    });
    const pickers = container.querySelector('#custom-pickers');
    if (pickers) pickers.style.display = activePreset === 'custom' ? 'flex' : 'none';
  }

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      _updateTabs();
      if (activePreset !== 'custom') _load();
    });
  });

  _updateTabs();

  container.querySelector('#apply-range')?.addEventListener('click', () => {
    customFrom = container.querySelector('#range-from').value;
    customTo   = container.querySelector('#range-to').value;
    if (customFrom && customTo) _load();
  });

  container.querySelector('#export-csv')?.addEventListener('click', () => _exportCSV(_txData));
  container.querySelector('#export-exp-csv')?.addEventListener('click', () => _exportExpenseCSV(_expData));

  container.querySelector('#add-expense-btn')?.addEventListener('click', () => {
    const { from, to } = _getRange(activePreset, customFrom, customTo);
    _openAddExpenseModal(storeId, from, () => _load());
  });

  await _load();
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function _skeletonCards(n) {
  return Array(n).fill(`<div class="card p-5 animate-pulse"><div class="h-8 bg-slate-100 rounded mb-2"></div><div class="h-4 bg-slate-50 rounded w-2/3"></div></div>`).join('');
}
function _skeletonBars(n) {
  return Array(n).fill(`<div class="flex-1 bg-slate-100 rounded-t animate-pulse h-16"></div>`).join('');
}

// ─── Loading state ────────────────────────────────────────────────────────────

function _setLoading(container) {
  const stats = container.querySelector('#finance-stats');
  if (stats) stats.innerHTML = _skeletonCards(4);
  const chart = container.querySelector('#finance-chart');
  if (chart) chart.innerHTML = _skeletonBars(7);
}

// ─── Stats KPIs ───────────────────────────────────────────────────────────────

function _renderStats(container, d, from, to) {
  const el = container.querySelector('#finance-stats');
  if (!el) return;
  const fmt = n => Number(n || 0).toLocaleString('th-TH');
  el.innerHTML = [
    { icon: '💰', label: 'รายได้รวม',    value: fmt(d.total),       unit: '฿',    cls: 'text-navy'      },
    { icon: '🧾', label: 'จำนวนธุรกรรม', value: fmt(d.count),       unit: 'ครั้ง', cls: 'text-navy'      },
    { icon: '📊', label: 'เฉลี่ย/วัน',   value: fmt(d.avg_per_day), unit: '฿',    cls: 'text-primary'   },
    { icon: '💸', label: 'ค่าคอม 5%',    value: fmt(d.commission),  unit: '฿',    cls: 'text-slate-500' },
  ].map(s => `
    <div class="card p-5">
      <div class="text-2xl mb-2">${s.icon}</div>
      <div class="text-xs text-slate-400 font-body">${s.label}</div>
      <div class="mt-1 flex items-baseline gap-1">
        <span class="text-2xl font-bold ${s.cls}">${s.value}</span>
        <span class="text-xs text-slate-400 font-body">${s.unit}</span>
      </div>
    </div>`).join('');
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

function _renderPnL(container, revenue, expTotal) {
  const el = container.querySelector('#pnl-content');
  if (!el) return;
  const profit   = revenue - expTotal;
  const margin   = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const profitCls = profit >= 0 ? 'text-primary' : 'text-red-500';
  const profitIcon = profit >= 0 ? '📈' : '📉';
  const fmt = n => Math.abs(n).toLocaleString('th-TH');

  el.innerHTML = `
    <div class="card p-4 text-center">
      <div class="text-lg mb-1">💰</div>
      <div class="text-xs text-slate-400 font-body">รายได้รวม</div>
      <div class="text-xl font-bold text-navy mt-1">฿${fmt(revenue)}</div>
    </div>
    <div class="card p-4 text-center">
      <div class="text-lg mb-1">💸</div>
      <div class="text-xs text-slate-400 font-body">รายจ่ายรวม</div>
      <div class="text-xl font-bold text-red-500 mt-1">฿${fmt(expTotal)}</div>
    </div>
    <div class="card p-4 text-center border-2 ${profit >= 0 ? 'border-primary' : 'border-red-300'}">
      <div class="text-lg mb-1">${profitIcon}</div>
      <div class="text-xs text-slate-400 font-body">กำไรสุทธิ (ประมาณ)</div>
      <div class="text-xl font-bold ${profitCls} mt-1">${profit < 0 ? '-' : ''}฿${fmt(profit)}</div>
      <div class="text-xs text-slate-400 font-body mt-0.5">Margin ${margin}%</div>
    </div>`;
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function _renderChart(container, days, from, to) {
  const el    = container.querySelector('#finance-chart');
  const title = container.querySelector('#chart-title');
  if (!el) return;

  if (!days.length) {
    el.innerHTML = '<p class="text-xs text-slate-400 font-body w-full text-center">ยังไม่มีข้อมูล</p>';
    return;
  }

  const dayCount  = days.length;
  const showEvery = dayCount <= 14 ? 1 : dayCount <= 30 ? 3 : 7;
  if (title) title.textContent = `📈 รายได้รายวัน (${dayCount} วัน)`;

  const max   = Math.max(...days.map(d => d.total), 1);
  const label = container.querySelector('#chart-max-label');
  if (label) label.textContent = `สูงสุด ฿${max.toLocaleString('th-TH')}`;
  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = days.map((d, i) => {
    const pct     = Math.max((d.total / max) * 100, 2);
    const isToday = d.date === today;
    const showLbl = i % showEvery === 0 || i === days.length - 1;
    const dt      = new Date(d.date + 'T00:00');
    const day     = showLbl
      ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`
      : '';
    const valLabel = d.total > 0
      ? (d.total >= 1000 ? '฿' + Math.round(d.total / 1000) + 'k' : '฿' + d.total.toLocaleString('th-TH'))
      : '';
    return `
      <div class="flex-1 flex flex-col items-center gap-0.5 min-w-0 group relative"
           title="${d.date}: ฿${d.total.toLocaleString('th-TH')}">
        <span class="text-xs font-semibold font-body truncate w-full text-center leading-tight"
              style="color:${isToday ? '#0D9488' : '#94A3B8'}">${valLabel}</span>
        <div class="w-full rounded-t transition-all relative"
             style="height:${pct}%;background:${isToday ? '#0D9488' : '#CCFBF1'};min-height:4px">
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex
                      bg-navy text-white text-xs font-body px-2 py-0.5 rounded-md whitespace-nowrap z-10 shadow">
            ฿${d.total.toLocaleString('th-TH')}
          </div>
        </div>
        <span class="text-xs font-body text-center leading-tight truncate w-full"
              style="color:#94A3B8;font-size:9px">${day}</span>
      </div>`;
  }).join('');
}

// ─── Payment breakdown ────────────────────────────────────────────────────────

function _renderPaymentBreakdown(container, byMethod, total) {
  const el = container.querySelector('#payment-breakdown');
  if (!el) return;
  const entries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = '<p class="text-slate-400 font-body text-sm">ยังไม่มีข้อมูล</p>';
    return;
  }
  const max = total || 1;
  el.innerHTML = entries.map(([method, amount]) => {
    const pct = Math.round((amount / max) * 100);
    return `
      <div class="flex items-center gap-3">
        <span class="w-20 text-sm font-body text-slate-500 flex-shrink-0">
          ${PM_ICON[method] || '💰'} ${PM_LABEL[method] || method}
        </span>
        <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="h-full rounded-full bg-primary transition-all" style="width:${pct}%"></div>
        </div>
        <span class="w-28 text-right text-sm font-semibold text-navy font-body">
          ฿${Number(amount).toLocaleString('th-TH')}
          <span class="text-slate-400 font-normal text-xs">(${pct}%)</span>
        </span>
      </div>`;
  }).join('');
}

// ─── Transaction table ────────────────────────────────────────────────────────

function _renderTable(container, rows) {
  const el = container.querySelector('#finance-table');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<p class="text-center py-10 text-slate-400 font-body text-sm">ยังไม่มีธุรกรรมในช่วงนี้</p>';
    return;
  }
  el.innerHTML = `
    <div class="-mx-1 overflow-x-auto">
      <table class="w-full text-sm min-w-[480px]">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left py-3 text-xs font-semibold text-slate-400 pr-4">วันที่</th>
            <th class="text-left py-3 text-xs font-semibold text-slate-400 pr-4">ช่องทาง/รายละเอียด</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400 pr-4">ยอด</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400 pr-4">ค่าคอม</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400">สุทธิ</th>
          </tr>
        </thead>
        <tbody>${rows.map(_txRow).join('')}</tbody>
      </table>
    </div>`;
}

function _txRow(tx) {
  const ts      = tx.paid_at || tx.created_at;
  const d       = new Date(ts);
  const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const fmt     = n => Number(n || 0).toLocaleString('th-TH');
  const pm      = tx.payment_method || 'cash';
  const net     = (tx.total || 0) - (tx.commission_amount || 0);
  return `
    <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td class="py-3 pr-4">
        <div class="font-semibold text-navy text-xs">${dateStr}</div>
        <div class="text-xs text-slate-400 font-body">${timeStr}</div>
      </td>
      <td class="py-3 pr-4 text-slate-600 font-body text-sm">
        ${PM_ICON[pm] || '💰'} ${PM_LABEL[pm] || pm}
        ${tx.description ? `<div class="text-xs text-slate-400">${tx.description}</div>` : ''}
      </td>
      <td class="py-3 pr-4 text-right font-semibold text-navy">฿${fmt(tx.total)}</td>
      <td class="py-3 pr-4 text-right text-slate-400 font-body text-xs">฿${fmt(tx.commission_amount)}</td>
      <td class="py-3 text-right font-semibold text-primary">฿${fmt(net)}</td>
    </tr>`;
}

// ─── Expense list ─────────────────────────────────────────────────────────────

function _renderExpenses(container, rows, total) {
  const el = container.querySelector('#expense-list');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<p class="text-center py-6 text-slate-400 font-body text-sm">ยังไม่มีรายจ่ายในช่วงนี้</p>';
    return;
  }

  // Group by category for summary
  const byCategory = {};
  rows.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount || 0);
  });

  const catSummary = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const cfg = EXP_CAT[cat] || EXP_CAT.other;
      const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
      return `
        <div class="flex items-center gap-2 text-sm">
          <span class="w-28 text-slate-500 font-body flex-shrink-0">${cfg.icon} ${cfg.label}</span>
          <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="h-full rounded-full bg-red-400" style="width:${pct}%"></div>
          </div>
          <span class="text-right text-xs font-semibold text-navy w-24 font-body">
            ฿${Math.round(amt).toLocaleString('th-TH')} <span class="text-slate-400 font-normal">(${pct}%)</span>
          </span>
        </div>`;
    }).join('');

  el.innerHTML = `
    <div class="space-y-2 mb-4">${catSummary}</div>
    <div class="-mx-1 overflow-x-auto">
      <table class="w-full text-sm min-w-[520px]">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left py-2 text-xs font-semibold text-slate-400 pr-3">วันที่</th>
            <th class="text-left py-2 text-xs font-semibold text-slate-400 pr-3">หมวดหมู่</th>
            <th class="text-left py-2 text-xs font-semibold text-slate-400 pr-3">รายละเอียด</th>
            <th class="text-right py-2 text-xs font-semibold text-slate-400 pr-3">จำนวน</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(e => {
            const cfg    = EXP_CAT[e.category] || EXP_CAT.other;
            const whtAmt = parseFloat(e.withholding_tax_amount || 0);
            const whtRate = parseFloat(e.withholding_tax_rate || 0);
            return `
              <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                <td class="py-2.5 pr-3 text-xs text-slate-500 font-body whitespace-nowrap">
                  ${formatThaiDate(e.expense_date)}
                </td>
                <td class="py-2.5 pr-3 text-sm font-body whitespace-nowrap">
                  ${cfg.icon} ${cfg.label}
                </td>
                <td class="py-2.5 pr-3 text-slate-600 font-body text-sm">
                  ${e.description || '—'}
                  ${e.payee_name ? `<div class="text-xs text-slate-400">ผู้รับ: ${e.payee_name}</div>` : ''}
                  ${e.receipt_note ? `<div class="text-xs text-slate-400">${e.receipt_note}</div>` : ''}
                </td>
                <td class="py-2.5 pr-3 text-right font-semibold text-red-500">
                  ฿${Number(e.amount).toLocaleString('th-TH')}
                  ${whtRate > 0 ? `<div class="text-xs text-amber-600 font-normal">WHT ${whtRate}% = ฿${whtAmt.toLocaleString('th-TH')}</div>` : ''}
                </td>
                <td class="py-2.5 text-right">
                  <button data-del-expense="${e.id}"
                    class="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <i class="fas fa-times text-xs"></i>
                  </button>
                </td>
              </tr>`;
          }).join('')}
          <tr class="border-t-2 border-slate-200">
            <td colspan="3" class="py-2.5 font-semibold text-navy text-sm">รวมรายจ่าย</td>
            <td class="py-2.5 text-right font-bold text-red-500">฿${Math.round(total).toLocaleString('th-TH')}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>`;

  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-del-expense]');
    if (!btn) return;
    if (!confirm('ลบรายจ่ายนี้?')) return;
    const res = await apiFetch(`/api/expenses/${btn.dataset.delExpense}`, { method: 'DELETE' });
    if (res?.success) { showToast('ลบรายจ่ายแล้ว'); btn.closest('tr').remove(); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

// ─── Add expense modal ────────────────────────────────────────────────────────

function _openAddExpenseModal(storeId, defaultDate, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
      <h3 class="font-bold text-navy text-lg">💸 บันทึกรายจ่าย</h3>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">วันที่ *</label>
          <input id="exp-date" class="input-field" type="date" value="${defaultDate || new Date().toISOString().split('T')[0]}">
        </div>
        <div>
          <label class="input-label">จำนวนเงิน (฿) *</label>
          <input id="exp-amount" class="input-field" type="number" min="0" step="1" placeholder="0">
        </div>
      </div>

      <div>
        <label class="input-label">หมวดหมู่</label>
        <select id="exp-cat" class="input-field">
          ${Object.entries(EXP_CAT).map(([k, v]) =>
            `<option value="${k}">${v.icon} ${v.label}</option>`
          ).join('')}
        </select>
      </div>

      <div>
        <label class="input-label">รายละเอียด</label>
        <input id="exp-desc" class="input-field" placeholder="เช่น ค่าแรงประจำเดือน, ค่าน้ำประปา...">
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อผู้รับเงิน</label>
          <input id="exp-payee" class="input-field" placeholder="บริษัท / บุคคล">
        </div>
        <div>
          <label class="input-label">ภาษีหัก ณ ที่จ่าย (%)</label>
          <select id="exp-wht" class="input-field">
            <option value="0">ไม่มี</option>
            <option value="1">1%</option>
            <option value="3">3%</option>
            <option value="5">5%</option>
          </select>
        </div>
      </div>

      <div>
        <label class="input-label">เลขที่ใบเสร็จ / หมายเหตุ</label>
        <input id="exp-note" class="input-field" placeholder="REC-001 หรือเว้นว่าง">
      </div>

      <div class="flex gap-3">
        <button id="exp-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="exp-save"   class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#exp-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#exp-save').addEventListener('click', async () => {
    const amount = parseFloat(modal.querySelector('#exp-amount').value);
    if (!amount || amount <= 0) { showToast('กรุณากรอกจำนวนเงิน', 'error'); return; }

    const btn = modal.querySelector('#exp-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const whtRate = parseFloat(modal.querySelector('#exp-wht').value) || 0;
    const res = await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        store_id:             storeId,
        expense_date:         modal.querySelector('#exp-date').value,
        category:             modal.querySelector('#exp-cat').value,
        amount,
        description:          modal.querySelector('#exp-desc').value.trim() || null,
        receipt_note:         modal.querySelector('#exp-note').value.trim() || null,
        payee_name:           modal.querySelector('#exp-payee').value.trim() || null,
        withholding_tax_rate: whtRate,
      }),
    });

    if (res?.success) {
      modal.remove();
      showToast('บันทึกรายจ่ายแล้ว');
      onSaved?.();
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  setTimeout(() => modal.querySelector('#exp-amount')?.focus(), 100);
}

// ─── CSV Export (Transactions) ────────────────────────────────────────────────

function _exportCSV(rows) {
  if (!rows.length) return;
  const headers = ['วันที่', 'ช่องทาง', 'รายละเอียด', 'ยอด (฿)', 'ค่าคอม (฿)', 'สุทธิ (฿)'];
  const lines = rows.map(tx => {
    const d   = new Date(tx.paid_at || tx.created_at).toLocaleString('th-TH');
    const net = (tx.total || 0) - (tx.commission_amount || 0);
    return [d, tx.payment_method || 'cash', tx.description || tx.invoice_number || '', tx.total || 0, tx.commission_amount || 0, net].join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fufu_transactions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Export (Expenses) ────────────────────────────────────────────────────

function _exportExpenseCSV(rows) {
  if (!rows.length) { return; }
  const headers = ['วันที่', 'หมวดหมู่', 'รายละเอียด', 'ผู้รับเงิน', 'จำนวน (฿)', 'WHT %', 'WHT (฿)', 'สุทธิจ่าย (฿)', 'เลขที่ใบเสร็จ'];
  const lines = rows.map(e => {
    const cfg     = EXP_CAT[e.category] || EXP_CAT.other;
    const whtAmt  = parseFloat(e.withholding_tax_amount || 0);
    const whtRate = parseFloat(e.withholding_tax_rate   || 0);
    const net     = parseFloat(e.amount || 0) - whtAmt;
    return [
      e.expense_date,
      cfg.label,
      (e.description || '').replace(/,/g, '，'),
      (e.payee_name  || '').replace(/,/g, '，'),
      e.amount || 0,
      whtRate,
      whtAmt,
      net.toFixed(2),
      (e.receipt_note || '').replace(/,/g, '，'),
    ].join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fufu_expenses_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
