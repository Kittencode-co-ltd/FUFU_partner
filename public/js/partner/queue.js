import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { escapeHtml } from '../utils/formatters.js';
import { icon } from '../utils/icons.js';
import { can } from '../utils/permissions.js';

const SERVICE_TYPES = ['ตรวจทั่วไป', 'วัคซีน', 'ผ่าตัด', 'ทำฟัน', 'ตรวจเลือด', 'อาบน้ำ-ตัดขน', 'อื่นๆ'];

// SVG icon helpers (Heroicons-style, stroke-width 2)
const IC = {
  clock:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"/></svg>`,
  megaphone:  `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>`,
  pulse:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l3-3 3 6 3-6 3 3 3-3"/></svg>`,
  check:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  alert:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
  clipboard:  `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>`,
  card:       `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>`,
  receipt:    `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`,
  refresh:    `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>`,
  xmark:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
  star:       `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  phone:      `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>`,
  play:       `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
};

const STATUS_CFG = {
  waiting:     { label: 'รอ',          badge: 'badge-gold',                 border: 'border-l-amber-400' },
  called:      { label: 'เรียกแล้ว',  badge: 'badge-teal',                 border: 'border-l-primary'   },
  in_progress: { label: 'กำลังรักษา', badge: 'bg-blue-50 text-blue-600',   border: 'border-l-blue-500'  },
  completed:   { label: 'เสร็จ',       badge: 'badge-navy',                 border: 'border-l-slate-200' },
  no_show:     { label: 'ไม่มา',       badge: 'bg-slate-100 text-slate-400', border: 'border-l-slate-200' },
};

const KANBAN_COLS = [
  { key: 'waiting',     label: 'รอคิว',    icon: IC.clock,     statuses: ['waiting'],              hdrCls: 'text-amber-600', countCls: 'bg-amber-100 text-amber-700' },
  { key: 'called',      label: 'เรียกอยู่', icon: IC.megaphone, statuses: ['called'],               hdrCls: 'text-teal-600',  countCls: 'bg-teal-100 text-teal-700'   },
  { key: 'in_progress', label: 'ตรวจอยู่',  icon: IC.pulse,     statuses: ['in_progress'],          hdrCls: 'text-blue-600',  countCls: 'bg-blue-100 text-blue-700'   },
  { key: 'done',        label: 'เสร็จสิ้น', icon: IC.check,     statuses: ['completed', 'no_show'], hdrCls: 'text-slate-500', countCls: 'bg-slate-100 text-slate-600'  },
];

let _storeId = '';
let _container = null;
let _refreshTimer = null;
let _selectedPet = null; // { pet_id, pet_name, owner_name } | null

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function renderQueue(container) {
  _container = container;
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);

  container.innerHTML = `
    <!-- Appointment inbox (from app) -->
    <div id="appt-inbox" class="mb-3 sm:mb-4"></div>

    <!-- Walk-in quick-add bar -->
    <div class="card p-3 sm:p-4 mb-3 sm:mb-4" ${!can('queue','create') ? 'style="display:none"' : ''}>
      <div class="flex flex-wrap gap-2 sm:gap-3 items-end">
        <div class="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-52">
          <label class="input-label">ค้นหาสัตว์เลี้ยง / เจ้าของ / เบอร์โทร</label>
          <input id="wk-search" class="input-field" placeholder="บัดดี้ หรือ 0812345678..." autocomplete="off">
          <div id="wk-dropdown"
               class="hidden absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl
                      shadow-card-hover border border-slate-100 max-h-60 overflow-y-auto text-sm">
          </div>
        </div>
        <div class="flex-1 min-w-28">
          <label class="input-label">บริการ</label>
          <select id="wk-service" class="input-field">
            ${SERVICE_TYPES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer pb-3">
            <input type="checkbox" id="wk-emergency" class="w-4 h-4 accent-red-500">
            <span class="text-sm font-semibold text-red-500 flex items-center gap-1"><span class="inline-flex">${icon('exclamation-triangle','w-3.5 h-3.5')}</span> ด่วน</span>
          </label>
          <button id="wk-submit" class="btn-primary whitespace-nowrap">+ Walk-in</button>
        </div>
      </div>
      <div class="flex items-center justify-between mt-2 min-h-7">
        <div id="wk-selected" class="hidden items-center gap-2">
          <span id="wk-chip"
                class="text-xs bg-primary-subtle text-primary-dark rounded-lg px-3 py-1.5 font-semibold"></span>
          <button id="wk-deselect"
                  class="text-xs text-slate-400 hover:text-red-500 transition-colors">× เปลี่ยน</button>
        </div>
      </div>
    </div>

    <!-- Queue kanban board -->
    <div id="queue-cards"></div>
  `;

  _selectedPet = null;
  _bindWalkinSearch(container);
  container.querySelector('#wk-submit').addEventListener('click', _handleWalkin);
  container.querySelector('#tv-mode-btn')?.addEventListener('click', _openTVMode);
  container.querySelector('#wk-new-patient')?.addEventListener('click', () => _openQuickRegister(container));
  container.querySelector('#queue-cards').addEventListener('click', _handleCardAction);
  await _loadQueue();

  // Auto-refresh every 30s
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(_loadQueue, 30000);
}

// ─── Load & render ────────────────────────────────────────────────────────────

async function _loadQueue() {
  const today = new Date().toISOString().split('T')[0];
  const [queueRes, inboxRes] = await Promise.all([
    apiFetch(`/api/queue?store_id=${_storeId}&date=${today}`),
    apiFetch(`/api/appointments/inbox?store_id=${_storeId}&days_ahead=14`),
  ]);
  const queue = queueRes?.data || [];
  _renderStats(queue);
  _renderCards(queue);
  _renderInbox(inboxRes?.data || []);
}

// ─── Appointment Inbox ────────────────────────────────────────────────────────

function _renderInbox(appointments) {
  const el = _container?.querySelector('#appt-inbox');
  if (!el) return;

  if (!appointments.length) { el.innerHTML = ''; return; }

  const today = new Date().toISOString().split('T')[0];
  const todayApt = appointments.filter(a => a.appt_date === today);

  el.innerHTML = `
    <div class="card border border-amber-200 bg-amber-50/50 overflow-hidden">
      <!-- Banner (always visible) -->
      <div class="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
           id="inbox-toggle">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
          <span class="font-semibold text-navy text-sm">การจองจากแอป</span>
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
                style="background:#F97316">${appointments.length}</span>
          ${todayApt.length
            ? `<span class="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">วันนี้ ${todayApt.length} รายการ</span>`
            : ''}
        </div>
        <div class="flex items-center gap-3">
          <button data-appt-action="confirm-all"
            class="text-xs px-3 py-1 rounded-lg font-semibold transition-colors hidden"
            id="inbox-confirm-all"
            class="text-xs px-3 py-1 rounded-lg font-semibold transition-colors bg-primary text-white hover:bg-primary-dark">ยืนยันทั้งหมด</button>
          <span class="text-xs text-slate-400" id="inbox-hint">แตะเพื่อดู ▼</span>
          <span class="text-slate-400 transition-transform duration-200 inline-flex" id="inbox-chevron">${icon('chevron-right','w-3.5 h-3.5')}</span>
        </div>
      </div>

      <!-- Collapsible list (hidden by default) -->
      <div id="inbox-body" class="divide-y divide-amber-100 border-t border-amber-200" style="display:none">
        ${appointments.map(a => _apptRow(a, today)).join('')}
      </div>
    </div>`;

  // Toggle collapse — starts closed
  let open = false;
  const body   = el.querySelector('#inbox-body');
  const chev   = el.querySelector('#inbox-chevron');
  const hint   = el.querySelector('#inbox-hint');
  const btnAll = el.querySelector('#inbox-confirm-all');

  el.querySelector('#inbox-toggle').addEventListener('click', e => {
    if (e.target.closest('[data-appt-action="confirm-all"]')) return;
    open = !open;
    body.style.display = open ? '' : 'none';
    chev.style.transform = open ? 'rotate(90deg)' : '';
    hint.textContent = open ? 'แตะเพื่อซ่อน ▲' : 'แตะเพื่อดู ▼';
    btnAll.classList.toggle('hidden', !open);
  });

  // Confirm all
  btnAll.addEventListener('click', async () => {
    const ids = [...el.querySelectorAll('[data-appt-action="confirm"]')].map(b => b.dataset.apptId);
    if (!ids.length) return;
    btnAll.disabled = true; btnAll.textContent = 'กำลังยืนยัน...';
    for (const id of ids) {
      await apiFetch(`/api/appointments/${id}/confirm`, {
        method: 'PATCH', body: JSON.stringify({ store_id: _storeId }),
      });
    }
    showToast(`✅ ยืนยัน ${ids.length} รายการแล้ว`);
    await _loadQueue();
  });

  // Confirm / Reject individual
  body.addEventListener('click', async e => {
    const btn = e.target.closest('[data-appt-action]');
    if (!btn || btn.dataset.apptAction === 'confirm-all') return;
    const { apptAction, apptId } = btn.dataset;

    if (apptAction === 'confirm') {
      btn.disabled = true; btn.textContent = '...';
      const res = await apiFetch(`/api/appointments/${apptId}/confirm`, {
        method: 'PATCH', body: JSON.stringify({ store_id: _storeId }),
      });
      if (res?.success) {
        const q = res.data?.queue_entry;
        showToast(`✅ ยืนยันแล้ว — คิว A${String(q?.queue_number || '').padStart(3, '0')}`);
        await _loadQueue();
      } else {
        showToast(res?.error || 'ยืนยันไม่สำเร็จ', 'error');
        btn.disabled = false; btn.textContent = '✓';
      }
    }

    if (apptAction === 'reject') {
      btn.disabled = true; btn.textContent = '...';
      const res = await apiFetch(`/api/appointments/${apptId}/reject`, {
        method: 'PATCH', body: JSON.stringify({}),
      });
      if (res?.success) { showToast('ปฏิเสธการจองแล้ว', 'info'); await _loadQueue(); }
      else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = '✕'; }
    }
  });
}

function _apptRow(a, today) {
  const isToday = a.appt_date === today;
  const dateLabel = isToday ? 'วันนี้' : _thaiDate(a.appt_date);
  const time = a.appt_time_slot || a.appt_time || '—';
  const service = (a.services?.length ? a.services.join(', ') : null) || a.service_type || a.category || '—';
  const dropoff = a.drop_off_method ? ` · ${a.drop_off_method}` : '';

  return `
    <div class="flex items-center gap-3 px-4 py-2 ${isToday ? 'bg-orange-50/50' : 'hover:bg-amber-50/30'} transition-colors">
      <!-- Time -->
      <div class="flex-shrink-0 text-center w-14">
        <div class="text-xs ${isToday ? 'text-orange-500 font-semibold' : 'text-slate-400'}">${dateLabel}</div>
        <div class="text-sm font-bold text-navy leading-tight">${time}</div>
      </div>

      <!-- Pet + service -->
      <div class="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span class="text-sm font-semibold text-navy truncate flex items-center gap-1">
          <span class="text-primary opacity-60 inline-flex">${icon('paw','w-3 h-3')}</span>
          ${escapeHtml(a.pet_name) || '—'}
        </span>
        <span class="text-xs text-slate-500 truncate">${escapeHtml(service)}${escapeHtml(dropoff)}</span>
        ${isToday ? '<span class="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">วันนี้</span>' : ''}
      </div>

      <!-- Actions -->
      <div class="flex gap-1.5 flex-shrink-0">
        <button data-appt-action="confirm" data-appt-id="${a.id}"
          class="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors bg-primary text-white hover:bg-primary-dark flex items-center gap-1">
          ${IC.check} ยืนยัน</button>
        <button data-appt-action="reject" data-appt-id="${a.id}"
          class="text-xs px-2.5 py-1 rounded-lg font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1">
          ${IC.xmark}</button>
      </div>
    </div>`;
}

function _thaiDate(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); }
  catch { return dateStr; }
}

function _renderStats(queue) {
  const el = _container?.querySelector('#queue-stats');
  if (!el) return;
  const count = (s) => queue.filter(q => q.status === s).length;
  const stats = [
    { label: 'รอ', value: count('waiting'), cls: 'text-amber-500' },
    { label: 'กำลังรักษา', value: count('in_progress'), cls: 'text-blue-500' },
    { label: 'เสร็จแล้ว', value: count('completed'), cls: 'text-primary' },
    { label: 'ทั้งหมด', value: queue.length, cls: 'text-navy' },
  ];
  el.innerHTML = stats.map(s => `
    <div class="card p-2 sm:p-3 text-center">
      <div class="text-lg sm:text-2xl font-bold ${s.cls} leading-tight">${s.value}</div>
      <div class="text-xs text-slate-400 font-body mt-0.5 leading-tight truncate">${s.label}</div>
    </div>`).join('');
}

function _renderCards(queue) {
  const el = _container?.querySelector('#queue-cards');
  if (!el) return;

  const sorted = [...queue].sort((a, b) => {
    if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
    if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
    return a.queue_number - b.queue_number;
  });

  el.innerHTML = `
    <div style="display:flex;gap:12px;width:100%">
      ${KANBAN_COLS.map(col => {
        const items = sorted.filter(q => col.statuses.includes(q.status));
        return _kanbanColumn(col, items);
      }).join('')}
    </div>`;
}

function _kanbanColumn(col, items) {
  const cards = items.length === 0
    ? `<div class="rounded-lg border-2 border-dashed border-slate-200 py-8 text-center text-slate-300 text-xs font-body">ว่าง</div>`
    : items.map(_kanbanCard).join('');
  return `
    <div style="flex:1;min-width:0" class="flex flex-col rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
      <div class="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100">
        <span class="flex items-center gap-1.5 font-bold text-sm ${col.hdrCls}">${col.icon} ${col.label}</span>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${col.countCls}">${items.length}</span>
      </div>
      <div class="flex flex-col gap-2 p-2.5">${cards}</div>
    </div>`;
}

function _kanbanCard(q) {
  const cfg = STATUS_CFG[q.status] || STATUS_CFG.waiting;
  const num = String(q.queue_number).padStart(3, '0');
  const isEmergency = q.priority === 'emergency';
  const isDone = q.status === 'completed' || q.status === 'no_show';

  const [petName, ownerName] = (q.notes || '').includes(' - ')
    ? (q.notes || '').split(' - ').map(s => s.trim())
    : [q.notes || '', ''];

  const primaryBtn = _primaryAction(q);

  return `
    <div class="card border-l-4 ${cfg.border} p-3 ${isDone ? 'opacity-60' : ''}"
         data-queue-id="${q.id}" data-queue-status="${q.status}">
      <div class="flex items-center justify-between gap-1 mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="font-mono font-bold text-primary text-sm">A${num}</span>
          ${isEmergency ? `<span class="text-red-500 font-bold" title="ด่วน">${IC.alert}</span>` : ''}
        </div>
        ${q.status === 'called' ? _moreMenu(q) : ''}
      </div>
      <div class="font-semibold text-navy text-sm truncate">${escapeHtml(petName) || '—'}</div>
      ${ownerName ? `<div class="text-xs text-slate-400 font-body truncate">${escapeHtml(ownerName)}</div>` : ''}
      ${primaryBtn ? `<div class="mt-2.5">${primaryBtn}</div>` : ''}
    </div>`;
}

function _primaryAction(q) {
  const btn = (action, label, cls) =>
    `<button data-action="${action}" data-id="${q.id}" data-queue='${JSON.stringify(q)}'
             class="${cls} w-full text-xs py-1.5 rounded-lg transition-all font-semibold text-center">${label}</button>`;

  if (q.status === 'waiting')     return btn('call',     `<span class="flex items-center justify-center gap-1">${IC.megaphone} เรียก</span>`,     'bg-primary text-white hover:bg-primary-dark');
  if (q.status === 'called')      return btn('start',    `<span class="flex items-center justify-center gap-1">${IC.play} เริ่มรักษา</span>`,  'bg-blue-500 text-white hover:bg-blue-600');
  if (q.status === 'in_progress') return btn('complete', `<span class="flex items-center justify-center gap-1">${IC.check} เสร็จ</span>`,       'bg-primary text-white hover:bg-primary-dark');
  return '';
}

function _moreMenu(q) {
  const menuBtn = (action, label, cls) =>
    `<button data-action="${action}" data-id="${q.id}" data-queue='${JSON.stringify(q)}'
             class="${cls} w-full text-left text-xs px-3 py-1.5 rounded-lg font-body">${label}</button>`;
  return `
    <details class="relative">
      <summary class="list-none w-7 h-7 flex items-center justify-center rounded-lg
                      text-slate-400 hover:bg-slate-200 cursor-pointer select-none text-base leading-none">⋯</summary>
      <div class="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 space-y-0.5 min-w-32">
        ${menuBtn('recall', `<span class="flex items-center gap-1.5">${IC.refresh} เรียกซ้ำ</span>`, 'hover:bg-slate-50 text-slate-600')}
        ${menuBtn('noshow', `<span class="flex items-center gap-1.5">${IC.xmark} ไม่มา</span>`,    'hover:bg-red-50 text-red-500')}
      </div>
    </details>`;
}

function _queueCard(q) {
  const cfg = STATUS_CFG[q.status] || STATUS_CFG.waiting;
  const num = String(q.queue_number).padStart(3, '0');
  const isEmergency = q.priority === 'emergency';
  const isDone = q.status === 'completed' || q.status === 'no_show';

  const notes = q.notes || '';
  const [petName, ownerName] = notes.includes(' - ')
    ? notes.split(' - ').map(s => s.trim())
    : [notes, ''];

  const elapsed = q.called_at
    ? _elapsed(new Date(q.called_at))
    : _elapsed(new Date(q.created_at));

  const actions = _cardActions(q);

  return `
    <div class="card border-l-4 ${cfg.border} p-4 ${isDone ? 'opacity-50' : ''} transition-opacity"
         data-queue-id="${q.id}" data-queue-status="${q.status}">
      <div class="flex items-start gap-3">
        <!-- Queue number -->
        <div class="flex-shrink-0 text-center">
          <div class="font-mono font-bold text-primary text-lg leading-none">A${num}</div>
          ${isEmergency ? `<div class="flex items-center gap-0.5 text-xs text-red-500 font-semibold mt-0.5">${IC.alert} ด่วน</div>` : ''}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-navy">${escapeHtml(petName) || '—'}</span>
            <span class="badge ${cfg.badge}">${cfg.label}</span>
            ${q.priority === 'vip' ? `<span class="badge badge-gold flex items-center gap-1">${IC.star} VIP</span>` : ''}
          </div>
          <div class="text-sm text-slate-500 font-body mt-0.5">
            ${ownerName ? `เจ้าของ: ${escapeHtml(ownerName)} · ` : ''}${escapeHtml(q.service_type) || ''}
          </div>
          <div class="text-xs text-slate-400 font-body mt-1">${elapsed}</div>
        </div>

        <!-- Actions -->
        <div class="flex-shrink-0 flex gap-2 flex-wrap justify-end">
          ${actions}
        </div>
      </div>
    </div>`;
}

function _cardActions(q) {
  const btn = (action, label, cls = 'btn-outline text-xs px-3 py-1.5') =>
    `<button data-action="${action}" data-id="${q.id}" data-queue='${JSON.stringify(q)}'
             class="${cls} rounded-lg transition-all">${label}</button>`;

  const icoBtn = (icon, label) => `<span class="inline-flex items-center gap-1">${icon} ${label}</span>`;
  if (q.status === 'waiting') return `
    ${btn('call',  icoBtn(IC.megaphone, 'เรียก'), 'bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors')}
    ${btn('opd',   icoBtn(IC.clipboard, 'OPD'),   'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}`;

  if (q.status === 'called') return `
    ${btn('start',  icoBtn(IC.play,  'เริ่มรักษา'), 'bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors')}
    ${btn('noshow', icoBtn(IC.xmark, 'ไม่มา'),      'border border-slate-300 text-slate-500 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors')}
    ${btn('opd',    icoBtn(IC.clipboard, 'OPD'),    'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}`;

  if (q.status === 'in_progress') return `
    ${btn('complete', icoBtn(IC.check,     'เสร็จ'),  'bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors')}
    ${btn('opd',      icoBtn(IC.clipboard, 'OPD'),    'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}
    ${btn('pos',      icoBtn(IC.card,      'ชำระ'),   'border border-amber-400 text-amber-600 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors')}`;

  if (q.status === 'completed') return `
    ${btn('opd', icoBtn(IC.clipboard, 'ดู OPD'),   'border border-slate-200 text-slate-400 text-xs px-3 py-1.5 rounded-lg')}
    ${btn('pos', icoBtn(IC.receipt,   'ใบเสร็จ'),  'border border-slate-200 text-slate-400 text-xs px-3 py-1.5 rounded-lg')}`;

  return '';
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function _handleCardAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  // Close any open ⋯ menus
  _container?.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open'));

  const { action, id } = btn.dataset;

  // Gate write actions to users with queue edit permission
  const writeActions = ['call','recall','start','complete','noshow'];
  if (writeActions.includes(action) && !can('queue','edit')) {
    showToast('คุณไม่มีสิทธิ์แก้ไขคิว', 'error');
    return;
  }

  const STATUS_MAP = { call: 'called', recall: 'called', start: 'in_progress', complete: 'completed', noshow: 'no_show' };
  const newStatus = STATUS_MAP[action];
  if (!newStatus) return;

  btn.disabled = true;
  btn.textContent = '...';

  const res = await apiFetch(`/api/queue/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });

  if (res?.success) {
    await _loadQueue();
    showToast(action === 'recall' ? '🔁 เรียกซ้ำแล้ว' : _statusMsg(newStatus));
  } else {
    showToast('เกิดข้อผิดพลาด', 'error');
    btn.disabled = false;
    await _loadQueue();
  }
}

// ─── Walk-in search & submit ──────────────────────────────────────────────────

function _bindWalkinSearch(container) {
  const input = container.querySelector('#wk-search');
  const dropdown = container.querySelector('#wk-dropdown');
  if (!input || !dropdown) return;

  const SPECIES_ICON = { dog: 'dog', cat: 'cat', rabbit: 'paw', bird: 'dove', other: 'paw' };

  async function _loadDropdown(q) {
    const url = q.length >= 2
      ? `/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`
      : `/api/pets/owners/search?store_id=${_storeId}`;
    const res = await apiFetch(url);
    const owners = res?.data || [];

    if (!owners.length) {
      dropdown.innerHTML = `
        <div class="px-4 py-3 text-slate-500 font-body flex items-center gap-2">
          <span>${q ? `ไม่พบ "${q}"` : 'ยังไม่มีข้อมูลในระบบ'}</span>
          <button id="dd-new" class="text-primary underline text-xs hover:no-underline">+ ลูกค้าใหม่</button>
        </div>`;
      dropdown.classList.remove('hidden');
      dropdown.querySelector('#dd-new')?.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        _openQuickRegister(container);
      });
      return;
    }

    const rows = [];
    for (const owner of owners) {
      const pets = owner.pets || [];
      if (!pets.length) {
        rows.push({ pet_id: null, pet_name: null, owner_name: owner.name, owner_phone: owner.phone || '' });
      } else {
        for (const pet of pets) {
          rows.push({ pet_id: pet.id, pet_name: pet.name, species: pet.species, owner_name: owner.name, owner_phone: owner.phone || '' });
        }
      }
    }

    const header = q ? '' : `<div class="px-4 py-1.5 text-xs text-slate-400 font-body border-b border-slate-100">สัตว์เลี้ยงล่าสุดในระบบ</div>`;

    dropdown.innerHTML = header + rows.map((r, i) => {
      const iconKey = r.pet_id ? (SPECIES_ICON[r.species] || 'paw') : 'user';
      const main = r.pet_id
        ? `<span class="text-primary opacity-70 inline-flex">${icon(iconKey,'w-3 h-3')}</span> ${escapeHtml(r.pet_name)}`
        : `<span class="text-slate-400 inline-flex">${icon(iconKey,'w-3 h-3')}</span> ${escapeHtml(r.owner_name)} (ยังไม่มีสัตว์)`;
      const sub = r.pet_id ? `เจ้าของ: ${escapeHtml(r.owner_name)}${r.owner_phone ? ' · ' + escapeHtml(r.owner_phone) : ''}` : escapeHtml(r.owner_phone);
      return `
        <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors"
             data-ridx="${i}">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-navy">${main}</div>
            ${sub ? `<div class="text-xs text-slate-400 font-body">${sub}</div>` : ''}
          </div>
        </div>`;
    }).join('') + `
      <div class="border-t border-slate-100 px-4 py-2">
        <button id="dd-new2" class="text-xs text-primary hover:underline font-body">+ ลูกค้าใหม่</button>
      </div>`;

    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('[data-ridx]').forEach(el => {
      el.addEventListener('click', () => {
        const r = rows[parseInt(el.dataset.ridx)];
        _selectedPet = { pet_id: r.pet_id || null, pet_name: r.pet_name || input.value.trim(), owner_name: r.owner_name };
        input.value = r.pet_id ? r.pet_name : r.owner_name;
        _updateChip(container);
        dropdown.classList.add('hidden');
      });
    });

    dropdown.querySelector('#dd-new2')?.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      _openQuickRegister(container);
    });
  }

  let searchTimer;

  input.addEventListener('focus', () => {
    if (dropdown.classList.contains('hidden')) _loadDropdown('');
  });

  input.addEventListener('input', () => {
    _selectedPet = null;
    _updateChip(container);
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length === 1) return;
    searchTimer = setTimeout(() => _loadDropdown(q), 300);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });

  container.querySelector('#wk-deselect')?.addEventListener('click', () => {
    _selectedPet = null;
    input.value = '';
    _updateChip(container);
    input.focus();
  });
}

function _updateChip(container) {
  const selectedEl = container.querySelector('#wk-selected');
  const chipEl = container.querySelector('#wk-chip');
  if (!selectedEl || !chipEl) return;
  if (_selectedPet) {
    const label = _selectedPet.pet_id
      ? `${_selectedPet.pet_name} · ${_selectedPet.owner_name}`
      : _selectedPet.owner_name;
    chipEl.innerHTML = _selectedPet.pet_id
      ? `<span class="inline-flex mr-1 opacity-70">${icon('paw','w-3 h-3')}</span>${label}`
      : `<span class="inline-flex mr-1 opacity-70">${icon('user','w-3 h-3')}</span>${label}`;
    selectedEl.classList.remove('hidden');
    selectedEl.classList.add('flex');
  } else {
    selectedEl.classList.add('hidden');
    selectedEl.classList.remove('flex');
  }
}

async function _handleWalkin() {
  const search = _container?.querySelector('#wk-search');
  const service = _container?.querySelector('#wk-service')?.value || 'ตรวจทั่วไป';
  const isEmerg = _container?.querySelector('#wk-emergency')?.checked || false;
  const freeText = search?.value.trim() || '';

  const pet_id = _selectedPet?.pet_id || null;
  const pet_name = _selectedPet?.pet_name || freeText;
  const owner_name = _selectedPet?.owner_name || '';

  if (!pet_name) { showToast('กรุณาค้นหาหรือกรอกชื่อสัตว์เลี้ยง', 'error'); return; }

  const submitBtn = _container?.querySelector('#wk-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '...'; }

  const res = await apiFetch('/api/queue', {
    method: 'POST',
    body: JSON.stringify({
      store_id: _storeId,
      pet_id,
      pet_name,
      owner_name,
      service_type: service,
      priority: isEmerg ? 'emergency' : 'normal',
      notes: owner_name ? `${pet_name} - ${owner_name}` : pet_name,
    }),
  });

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '+ Walk-in'; }

  if (res?.success) {
    if (search) search.value = '';
    _selectedPet = null;
    _updateChip(_container);
    if (_container) _container.querySelector('#wk-emergency').checked = false;
    await _loadQueue();
    showToast(`เพิ่มคิว ${pet_name} เรียบร้อย`);
  } else {
    showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  }
}

// ─── Quick register (new patient inline) ─────────────────────────────────────

function _openQuickRegister(container) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">ลูกค้าใหม่ — 1/2 เจ้าของ</h3>
      <div>
        <label class="input-label">ชื่อ-นามสกุล *</label>
        <input id="qr-name" class="input-field" placeholder="คุณสมชาย ใจดี" autofocus>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">เบอร์โทร *</label>
          <input id="qr-phone" class="input-field" type="tel" placeholder="0812345678">
        </div>
        <div>
          <label class="input-label">อีเมล (ถ้ามี)</label>
          <input id="qr-email" class="input-field" type="email" placeholder="email@example.com">
        </div>
      </div>
      <div class="flex gap-3 pt-1">
        <button id="qr-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="qr-next" class="btn-primary flex-1">ถัดไป →</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#qr-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#qr-next').addEventListener('click', async () => {
    const name = modal.querySelector('#qr-name').value.trim();
    const phone = modal.querySelector('#qr-phone').value.trim();
    if (!name || !phone) { showToast('กรุณากรอกชื่อและเบอร์โทร', 'error'); return; }

    const btn = modal.querySelector('#qr-next');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/pets/owners', {
      method: 'POST',
      body: JSON.stringify({ name, phone, email: modal.querySelector('#qr-email').value.trim() || null, store_id: _storeId }),
    });

    if (!res?.success) {
      showToast(res?.error || 'สร้างเจ้าของไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = 'ถัดไป →';
      return;
    }
    modal.remove();
    _openQuickRegisterPet(container, res.data);
  });
}

function _openQuickRegisterPet(container, owner) {
  const SPECIES_OPTS = [
    { k: 'dog',    l: 'สุนัข' },
    { k: 'cat',    l: 'แมว' },
    { k: 'rabbit', l: 'กระต่าย' },
    { k: 'bird',   l: 'นก' },
    { k: 'other',  l: 'อื่นๆ' },
  ];
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">ลูกค้าใหม่ — 2/2 สัตว์เลี้ยง</h3>
      <div class="bg-primary-subtle rounded-xl px-4 py-2 text-sm text-primary-dark font-semibold flex items-center gap-2">
        <span class="inline-flex opacity-70">${icon('user','w-3.5 h-3.5')}</span> ${owner.name} · ${owner.phone || ''}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="qp-name" class="input-field" placeholder="บัดดี้" autofocus>
        </div>
        <div>
          <label class="input-label">ชนิด</label>
          <select id="qp-species" class="input-field">
            ${SPECIES_OPTS.map(s => `<option value="${s.k}">${s.l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="input-label">สายพันธุ์ (ถ้ามี)</label>
        <input id="qp-breed" class="input-field" placeholder="โกลเด้น รีทรีฟเวอร์">
      </div>
      <div class="flex gap-3 pt-1">
        <button id="qp-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="qp-save" class="btn-primary flex-1">บันทึก + เลือก</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#qp-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#qp-save').addEventListener('click', async () => {
    const petName = modal.querySelector('#qp-name').value.trim();
    const species = modal.querySelector('#qp-species').value;
    const breed = modal.querySelector('#qp-breed').value.trim() || null;
    if (!petName) { showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error'); return; }

    const btn = modal.querySelector('#qp-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/pets', {
      method: 'POST',
      body: JSON.stringify({ owner_id: owner.id, store_id: _storeId, name: petName, species, breed }),
    });

    if (!res?.success) {
      showToast(res?.error || 'สร้างสัตว์เลี้ยงไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก + เลือก';
      return;
    }

    const pet = res.data;
    _selectedPet = { pet_id: pet.id, pet_name: pet.name, owner_name: owner.name };
    const search = container.querySelector('#wk-search');
    if (search) search.value = pet.name;
    _updateChip(container);
    showToast(`ลงทะเบียน ${petName} แล้ว — กด Walk-in เพื่อเพิ่มคิว`);
    modal.remove();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _elapsed(since) {
  const mins = Math.floor((Date.now() - since) / 60000);
  if (mins < 1) return 'เพิ่งเข้ามา';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

function _statusMsg(status) {
  const MAP = {
    called: 'เรียกคิวแล้ว',
    in_progress: 'เริ่มรักษาแล้ว',
    completed: 'บันทึกเสร็จสิ้น',
    no_show: 'บันทึก: ไม่มา',
  };
  return MAP[status] || 'อัพเดทแล้ว';
}

// ─── TV Queue Display ─────────────────────────────────────────────────────────

function _openTVMode() {
  const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || 'คลินิก';

  const win = window.open('', '_blank');
  if (!win) { showToast('กรุณาอนุญาต Pop-up', 'error'); return; }

  const render = (queue) => {
    const active   = queue.filter(q => ['waiting','called','in_progress'].includes(q.status));
    const calling  = queue.filter(q => q.status === 'called');
    const waiting  = queue.filter(q => q.status === 'waiting');
    const inProg   = queue.filter(q => q.status === 'in_progress');

    const num = n => n?.queue_number ? `A${String(n.queue_number).padStart(3,'0')}` : '—';

    win.document.body.innerHTML = `
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Sarabun','Tahoma',sans-serif; background:#0a1628; color:#fff;
               display:flex; flex-direction:column; min-height:100vh; overflow:hidden; }
        .header { background:#0D9488; padding:16px 40px; display:flex; align-items:center; justify-content:space-between; }
        .store  { font-size:28px; font-weight:700; }
        .clock  { font-size:24px; font-weight:600; }
        .body   { display:grid; grid-template-columns:1fr 1fr; gap:20px; padding:24px 40px; flex:1; }
        .panel  { background:#111d33; border-radius:16px; padding:20px; }
        .panel-title { font-size:16px; color:#94a3b8; margin-bottom:12px; font-weight:600; letter-spacing:1px; text-transform:uppercase; }
        .calling-num  { font-size:96px; font-weight:900; color:#0D9488; line-height:1; text-align:center; margin:8px 0; }
        .calling-name { font-size:28px; text-align:center; color:#e2e8f0; margin-bottom:4px; }
        .calling-svc  { font-size:18px; text-align:center; color:#64748b; }
        .wait-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px;
                     background:#1e2d4a; margin-bottom:8px; }
        .wait-num  { font-size:24px; font-weight:700; color:#F59E0B; min-width:60px; }
        .wait-name { font-size:18px; color:#e2e8f0; flex:1; }
        .wait-svc  { font-size:14px; color:#64748b; }
        .footer    { background:#0a1628; padding:10px 40px; text-align:center; color:#334155; font-size:13px; border-top:1px solid #1e293b; }
        .prog-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px;
                     background:#1e2d4a; margin-bottom:8px; }
        .prog-num  { font-size:22px; font-weight:700; color:#3B82F6; min-width:60px; }
      </style>
      <div class="header">
        <div class="store">${storeName}</div>
        <div class="clock" id="tv-clock"></div>
      </div>
      <div class="body">
        <!-- Calling now -->
        <div class="panel">
          <div class="panel-title">กำลังเรียก</div>
          ${calling.length ? `
            <div class="calling-num">${num(calling[0])}</div>
            <div class="calling-name">${calling[0].notes?.split(' - ')[0] || '—'}</div>
            <div class="calling-svc">${calling[0].service_type || ''}</div>
          ` : `<div style="text-align:center;color:#334155;font-size:20px;margin-top:24px">—</div>`}
        </div>

        <!-- Right side: waiting + in progress -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="panel" style="flex:1">
            <div class="panel-title">รอเรียก (${waiting.length})</div>
            ${waiting.slice(0,8).map(q => `
              <div class="wait-item">
                <span class="wait-num">${num(q)}</span>
                <div>
                  <div class="wait-name">${(q.notes||'—').split(' - ')[0]}</div>
                  <div class="wait-svc">${q.service_type||''}</div>
                </div>
              </div>`).join('')}
            ${waiting.length === 0 ? '<div style="color:#334155;font-size:16px;padding:8px">ไม่มีคิวรอ</div>' : ''}
          </div>
          ${inProg.length ? `
          <div class="panel" style="flex:0 0 auto">
            <div class="panel-title">กำลังรักษา (${inProg.length})</div>
            ${inProg.slice(0,3).map(q => `
              <div class="prog-item">
                <span class="prog-num">${num(q)}</span>
                <div>
                  <div class="wait-name">${(q.notes||'—').split(' - ')[0]}</div>
                  <div class="wait-svc">${q.service_type||''}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
      <div class="footer">FUFU Partner · อัปเดตทุก 30 วินาที</div>`;

    // Clock
    const updateClock = () => {
      const el = win.document.getElementById('tv-clock');
      if (el) el.textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    updateClock();
    win._clockInterval = setInterval(updateClock, 1000);
  };

  // Initial render with current queue data
  const today = new Date().toISOString().split('T')[0];
  apiFetch(`/api/queue?store_id=${_storeId}&date=${today}`).then(res => {
    render(res?.data || []);

    // Auto-refresh every 30s
    win._refreshInterval = setInterval(async () => {
      const r = await apiFetch(`/api/queue?store_id=${_storeId}&date=${today}`);
      render(r?.data || []);
    }, 30000);
  });

  win.addEventListener('beforeunload', () => {
    clearInterval(win._refreshInterval);
    clearInterval(win._clockInterval);
  });
}
