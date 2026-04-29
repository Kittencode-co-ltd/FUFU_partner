import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';

const PM_ICON  = { cash: '💵', promptpay: '📱', card: '💳', transfer: '🏦', voucher: '🎟', other: '💰' };
const PM_LABEL = { cash: 'เงินสด', promptpay: 'PromptPay', card: 'บัตร', transfer: 'โอน', voucher: 'Voucher', other: 'อื่นๆ' };

// ─── Date range presets ───────────────────────────────────────────────────────

function _getRange(preset, customFrom, customTo) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  switch (preset) {
    case 'today':  return { from: today, to: today };
    case '7d': {
      const f = new Date(now - 6 * 86400000).toISOString().split('T')[0];
      return { from: f, to: today };
    }
    case '30d': {
      const f = new Date(now - 29 * 86400000).toISOString().split('T')[0];
      return { from: f, to: today };
    }
    case 'month': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { from: f, to: today };
    }
    case 'custom': return { from: customFrom || today, to: customTo || today };
    default:       return { from: today, to: today };
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderFinancePage(container) {
  if (!container) return;

  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
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

      <!-- Date range selector -->
      <div class="card p-4">
        <div class="flex flex-wrap items-center gap-2">
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

      <!-- Summary KPIs -->
      <div id="finance-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${[1,2,3,4].map(() => `<div class="card p-5 animate-pulse"><div class="h-8 bg-slate-100 rounded mb-2"></div><div class="h-4 bg-slate-50 rounded w-2/3"></div></div>`).join('')}
      </div>

      <!-- Daily chart -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-navy" id="chart-title">📈 รายได้รายวัน</h3>
          <span class="text-xs text-slate-400 font-body" id="chart-max-label"></span>
        </div>
        <div id="finance-chart" class="flex items-end gap-1.5 h-32">
          ${[1,2,3,4,5,6,7].map(() => `<div class="flex-1 bg-slate-100 rounded-t animate-pulse h-16"></div>`).join('')}
        </div>
      </div>

      <!-- Payment method breakdown -->
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
    </div>`;

  let _txData = [];

  async function _load() {
    const { from, to } = _getRange(activePreset, customFrom, customTo);
    _setLoading(container);

    const [rangeRes, txRes] = await Promise.all([
      apiFetch(`/api/finance/range?store_id=${storeId}&from=${from}&to=${to}`),
      apiFetch(`/api/finance/transactions?store_id=${storeId}&from=${from}&to=${to}&limit=200`),
    ]);

    const rd = rangeRes?.data || {};
    _txData  = txRes?.data || [];

    _renderStats(container, rd, from, to);
    _renderChart(container, rd.by_day || [], from, to);
    _renderPaymentBreakdown(container, rd.by_method || {}, rd.total || 0);
    _renderTable(container, _txData);
    container.querySelector('#tx-count').textContent = `(${_txData.length} รายการ)`;
  }

  function _updateTabs() {
    container.querySelectorAll('.tab-btn').forEach(b => {
      const active = b.dataset.preset === activePreset;
      b.style.background   = active ? '#0D9488' : '';
      b.style.color        = active ? '#fff'     : '';
      b.style.borderColor  = active ? '#0D9488'  : '';
    });
    const pickers = container.querySelector('#custom-pickers');
    if (pickers) pickers.style.display = activePreset === 'custom' ? 'flex' : 'none';
  }

  // Tab clicks
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

  await _load();
}

// ─── Loading state ────────────────────────────────────────────────────────────

function _setLoading(container) {
  const stats = container.querySelector('#finance-stats');
  if (stats) stats.innerHTML = [1,2,3,4].map(() =>
    `<div class="card p-5 animate-pulse"><div class="h-8 bg-slate-100 rounded mb-2"></div><div class="h-4 bg-slate-50 rounded w-2/3"></div></div>`
  ).join('');
  const chart = container.querySelector('#finance-chart');
  if (chart) chart.innerHTML = [1,2,3,4,5,6,7].map(() =>
    `<div class="flex-1 bg-slate-100 rounded-t animate-pulse h-16"></div>`
  ).join('');
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function _renderStats(container, d, from, to) {
  const el = container.querySelector('#finance-stats');
  if (!el) return;
  const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
  el.innerHTML = [
    { icon: '💰', label: 'รายได้รวม',     value: fmt(d.total),       unit: '฿', cls: 'text-navy'     },
    { icon: '🧾', label: 'จำนวนธุรกรรม',  value: fmt(d.count),       unit: 'ครั้ง', cls: 'text-navy' },
    { icon: '📊', label: 'เฉลี่ย/วัน',    value: fmt(d.avg_per_day), unit: '฿', cls: 'text-primary'  },
    { icon: '💸', label: 'ค่าคอม 5%',     value: fmt(d.commission),  unit: '฿', cls: 'text-slate-500' },
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

// ─── Chart ────────────────────────────────────────────────────────────────────

function _renderChart(container, days, from, to) {
  const el    = container.querySelector('#finance-chart');
  const title = container.querySelector('#chart-title');
  if (!el) return;

  if (!days.length) {
    el.innerHTML = '<p class="text-xs text-slate-400 font-body w-full text-center">ยังไม่มีข้อมูล</p>';
    return;
  }

  const dayCount = days.length;
  // Only show day labels if 30 or fewer days; otherwise show month labels
  const showEvery = dayCount <= 14 ? 1 : dayCount <= 30 ? 3 : 7;
  if (title) title.textContent = `📈 รายได้รายวัน (${dayCount} วัน)`;

  const max   = Math.max(...days.map(d => d.total), 1);
  const label = container.querySelector('#chart-max-label');
  if (label) label.textContent = `สูงสุด ฿${max.toLocaleString('th-TH')}`;
  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = days.map((d, i) => {
    const pct     = Math.max((d.total / max) * 100, 2);
    const isToday = d.date === today;
    const showLbl = (i % showEvery === 0) || i === days.length - 1;
    const day     = showLbl
      ? new Date(d.date + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      : '';
    return `
      <div class="flex-1 flex flex-col items-center gap-1 min-w-0" title="${d.date}: ฿${d.total.toLocaleString('th-TH')}">
        <span class="text-xs font-semibold font-body truncate w-full text-center" style="color:${isToday ? '#0D9488' : '#94A3B8'}">
          ${d.total > 0 ? '฿' + Math.round(d.total / 1000) + 'k' : ''}
        </span>
        <div class="w-full rounded-t transition-all"
             style="height:${pct}%;background:${isToday ? '#0D9488' : '#CCFBF1'};min-height:4px"></div>
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
    const pct   = Math.round((amount / max) * 100);
    const label = PM_LABEL[method] || method;
    const icon  = PM_ICON[method]  || '💰';
    return `
      <div class="flex items-center gap-3">
        <span class="w-20 text-sm font-body text-slate-500 flex-shrink-0">${icon} ${label}</span>
        <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="h-full rounded-full bg-primary transition-all" style="width:${pct}%"></div>
        </div>
        <span class="w-28 text-right text-sm font-semibold text-navy font-body">
          ฿${Number(amount).toLocaleString('th-TH')} <span class="text-slate-400 font-normal text-xs">(${pct}%)</span>
        </span>
      </div>`;
  }).join('');
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

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

// ─── Table ────────────────────────────────────────────────────────────────────

function _renderTable(container, rows) {
  const el = container.querySelector('#finance-table');
  if (!el) return;

  if (rows.length === 0) {
    el.innerHTML = '<p class="text-center py-10 text-slate-400 font-body text-sm">ยังไม่มีธุรกรรมในช่วงนี้</p>';
    return;
  }

  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left py-3 text-xs font-semibold text-slate-400 pr-4">วันที่</th>
            <th class="text-left py-3 text-xs font-semibold text-slate-400 pr-4">ช่องทาง/รายละเอียด</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400 pr-4">ยอด</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400 pr-4">ค่าคอม</th>
            <th class="text-right py-3 text-xs font-semibold text-slate-400">สุทธิ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(tx => _txRow(tx)).join('')}
        </tbody>
      </table>
    </div>`;
}

function _txRow(tx) {
  const ts      = tx.paid_at || tx.created_at;
  const d       = new Date(ts);
  const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const fmt     = (n) => Number(n || 0).toLocaleString('th-TH');
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
