import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const SERVICE_TYPES = ['ตรวจทั่วไป', 'วัคซีน', 'ผ่าตัด', 'ทำฟัน', 'ตรวจเลือด', 'อาบน้ำ-ตัดขน', 'อื่นๆ'];

const STATUS_CFG = {
  waiting:     { label: 'รอ',          badge: 'badge-gold',                    border: 'border-l-amber-400' },
  called:      { label: 'เรียกแล้ว',  badge: 'badge-teal',                    border: 'border-l-primary' },
  in_progress: { label: 'กำลังรักษา', badge: 'bg-blue-50 text-blue-600',      border: 'border-l-blue-500' },
  completed:   { label: 'เสร็จ',       badge: 'badge-navy',                    border: 'border-l-slate-200' },
  no_show:     { label: 'ไม่มา',       badge: 'bg-slate-100 text-slate-400',   border: 'border-l-slate-200' },
};

let _storeId = '';
let _container = null;
let _refreshTimer = null;

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function renderQueue(container) {
  _container = container;
  _storeId   = storage.get(STORAGE_KEYS.STORE_ID);

  container.innerHTML = `
    <!-- Appointment inbox (from app) -->
    <div id="appt-inbox" class="mb-5"></div>

    <!-- Walk-in quick-add bar -->
    <div class="card p-4 mb-5">
      <form id="walkin-form" class="flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-32">
          <label class="input-label">ชื่อสัตว์เลี้ยง</label>
          <input id="wk-pet"   class="input-field" placeholder="บัดดี้" required>
        </div>
        <div class="flex-1 min-w-32">
          <label class="input-label">ชื่อเจ้าของ</label>
          <input id="wk-owner" class="input-field" placeholder="คุณสมชาย">
        </div>
        <div class="flex-1 min-w-36">
          <label class="input-label">บริการ</label>
          <select id="wk-service" class="input-field">
            ${SERVICE_TYPES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer pb-3">
            <input type="checkbox" id="wk-emergency" class="w-4 h-4 accent-red-500">
            <span class="text-sm font-semibold text-red-500">🚨 ด่วน</span>
          </label>
          <button type="submit" class="btn-primary whitespace-nowrap">+ Walk-in</button>
        </div>
      </form>
    </div>

    <!-- Stats row -->
    <div id="queue-stats" class="grid grid-cols-4 gap-3 mb-5"></div>

    <!-- Queue cards -->
    <div id="queue-cards" class="space-y-3"></div>
  `;

  container.querySelector('#walkin-form').addEventListener('submit', _handleWalkin);
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

  const today    = new Date().toISOString().split('T')[0];
  const todayApt = appointments.filter(a => a.appt_date === today);
  const futureApt= appointments.filter(a => a.appt_date > today);

  el.innerHTML = `
    <div class="card border border-amber-200 bg-amber-50/50 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-amber-200 cursor-pointer select-none"
           id="inbox-toggle">
        <div class="flex items-center gap-2">
          <span class="text-base">📱</span>
          <span class="font-semibold text-navy text-sm">การจองจากแอป</span>
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
            style="background:#F97316">${appointments.length}</span>
        </div>
        <div class="flex items-center gap-3">
          ${todayApt.length ? `<span class="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">วันนี้ ${todayApt.length} รายการ</span>` : ''}
          <i class="fas fa-chevron-down text-slate-400 text-xs transition-transform" id="inbox-chevron"></i>
        </div>
      </div>
      <div id="inbox-body" class="divide-y divide-amber-100">
        ${appointments.map(a => _apptCard(a, today)).join('')}
      </div>
    </div>`;

  // Toggle collapse
  let open = true;
  el.querySelector('#inbox-toggle')?.addEventListener('click', () => {
    open = !open;
    el.querySelector('#inbox-body').style.display = open ? '' : 'none';
    const chev = el.querySelector('#inbox-chevron');
    if (chev) chev.style.transform = open ? '' : 'rotate(-90deg)';
  });

  // Confirm / Reject
  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-appt-action]');
    if (!btn) return;
    const { apptAction, apptId } = btn.dataset;

    if (apptAction === 'confirm') {
      btn.disabled = true; btn.textContent = 'กำลังยืนยัน...';
      const res = await apiFetch(`/api/appointments/${apptId}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ store_id: _storeId }),
      });
      if (res?.success) {
        const q = res.data?.queue_entry;
        showToast(`✅ ยืนยันแล้ว — เพิ่มคิว A${String(q?.queue_number||'').padStart(3,'0')} วันที่ ${_thaiDate(q?.queue_date||'')}`);
        await _loadQueue();
      } else {
        showToast(res?.error || 'ยืนยันไม่สำเร็จ', 'error');
        btn.disabled = false; btn.textContent = '✓ ยืนยัน';
      }
    }

    if (apptAction === 'reject') {
      btn.disabled = true; btn.textContent = '...';
      const res = await apiFetch(`/api/appointments/${apptId}/reject`, {
        method: 'PATCH', body: JSON.stringify({}),
      });
      if (res?.success) { showToast('ปฏิเสธการจองแล้ว', 'info'); await _loadQueue(); }
      else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = '✕ ปฏิเสธ'; }
    }
  });
}

function _apptCard(a, today) {
  const isToday = a.appt_date === today;
  const dateLabel = isToday
    ? `<span class="font-semibold text-orange-600">วันนี้</span>`
    : `<span>${_thaiDate(a.appt_date)}</span>`;
  const services = (a.services || []).join(', ') || a.category || '—';
  const dropoff  = a.drop_off_method ? `· ${a.drop_off_method}` : '';

  return `
    <div class="flex items-start gap-4 px-5 py-3 ${isToday ? 'bg-orange-50/60' : 'hover:bg-amber-50/40'} transition-colors">
      <!-- Date badge -->
      <div class="flex-shrink-0 text-center min-w-12">
        <div class="text-xs font-body text-slate-500">${dateLabel}</div>
        <div class="text-sm font-bold text-navy">${a.appt_time_slot || '—'}</div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-navy text-sm">🐾 ${a.pet_name}</span>
          <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-body">📱 App</span>
          ${isToday ? '<span class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">วันนี้</span>' : ''}
        </div>
        <div class="text-xs text-slate-500 font-body mt-0.5">
          ${services} ${dropoff}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 flex-shrink-0">
        <button data-appt-action="confirm" data-appt-id="${a.id}"
          class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
          style="background:#0D9488;color:#fff;">✓ ยืนยัน</button>
        <button data-appt-action="reject" data-appt-id="${a.id}"
          class="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
          ✕ ปฏิเสธ</button>
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
    { label: 'รอ',          value: count('waiting'),     cls: 'text-amber-500' },
    { label: 'กำลังรักษา', value: count('in_progress'), cls: 'text-blue-500'  },
    { label: 'เสร็จแล้ว',  value: count('completed'),   cls: 'text-primary'   },
    { label: 'ทั้งหมด',    value: queue.length,           cls: 'text-navy'      },
  ];
  el.innerHTML = stats.map(s => `
    <div class="card p-3 text-center">
      <div class="text-2xl font-bold ${s.cls}">${s.value}</div>
      <div class="text-xs text-slate-400 font-body mt-0.5">${s.label}</div>
    </div>`).join('');
}

function _renderCards(queue) {
  const el = _container?.querySelector('#queue-cards');
  if (!el) return;

  if (queue.length === 0) {
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีคิวในวันนี้</div>`;
    return;
  }

  // Emergency first, then by queue_number
  const sorted = [...queue].sort((a, b) => {
    if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
    if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
    return a.queue_number - b.queue_number;
  });

  el.innerHTML = sorted.map(_queueCard).join('');

  // Wire action buttons
  el.addEventListener('click', _handleCardAction);
}

function _queueCard(q) {
  const cfg  = STATUS_CFG[q.status] || STATUS_CFG.waiting;
  const num  = String(q.queue_number).padStart(3, '0');
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
          ${isEmergency ? '<div class="text-xs text-red-500 font-semibold mt-0.5">🚨 ด่วน</div>' : ''}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-navy">${petName || '—'}</span>
            <span class="badge ${cfg.badge}">${cfg.label}</span>
            ${q.priority === 'vip' ? '<span class="badge badge-gold">⭐ VIP</span>' : ''}
          </div>
          <div class="text-sm text-slate-500 font-body mt-0.5">
            ${ownerName ? `เจ้าของ: ${ownerName} · ` : ''}${q.service_type || ''}
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

  if (q.status === 'waiting') return `
    ${btn('call',  '📢 เรียก',  'bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors')}
    ${btn('opd',   '📋 OPD',    'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}`;

  if (q.status === 'called') return `
    ${btn('start',  '▶ เริ่มรักษา', 'bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors')}
    ${btn('noshow', '❌ ไม่มา',     'border border-slate-300 text-slate-500 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors')}
    ${btn('opd',    '📋 OPD',       'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}`;

  if (q.status === 'in_progress') return `
    ${btn('complete', '✓ เสร็จ', 'bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors')}
    ${btn('opd',      '📋 OPD',   'border border-primary text-primary text-xs px-3 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors')}
    ${btn('pos',      '💳 ชำระ',  'border border-amber-400 text-amber-600 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors')}`;

  if (q.status === 'completed') return `
    ${btn('opd', '📋 ดู OPD', 'border border-slate-200 text-slate-400 text-xs px-3 py-1.5 rounded-lg')}
    ${btn('pos', '🧾 ใบเสร็จ', 'border border-slate-200 text-slate-400 text-xs px-3 py-1.5 rounded-lg')}`;

  return '';
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function _handleCardAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, id } = btn.dataset;
  const queueItem = btn.dataset.queue ? JSON.parse(btn.dataset.queue) : null;

  if (action === 'opd') {
    document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: queueItem }));
    return;
  }
  if (action === 'pos') {
    document.dispatchEvent(new CustomEvent('fufu:openPOS', { detail: { queueItem } }));
    return;
  }

  const STATUS_MAP = { call: 'called', start: 'in_progress', complete: 'completed', noshow: 'no_show' };
  const newStatus = STATUS_MAP[action];
  if (!newStatus) return;

  btn.disabled   = true;
  btn.textContent = '...';

  const res = await apiFetch(`/api/queue/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });

  if (res?.success) {
    await _loadQueue();
    showToast(_statusMsg(newStatus));
  } else {
    showToast('เกิดข้อผิดพลาด', 'error');
    btn.disabled = false;
    await _loadQueue();
  }
}

async function _handleWalkin(e) {
  e.preventDefault();
  const form     = e.target;
  const petName  = form.querySelector('#wk-pet').value.trim();
  const owner    = form.querySelector('#wk-owner').value.trim();
  const service  = form.querySelector('#wk-service').value;
  const isEmerg  = form.querySelector('#wk-emergency').checked;

  if (!petName) { showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error'); return; }

  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;

  const res = await apiFetch('/api/queue', {
    method: 'POST',
    body: JSON.stringify({
      store_id:     _storeId,
      pet_name:     petName,
      owner_name:   owner,
      service_type: service,
      priority:     isEmerg ? 'emergency' : 'normal',
      notes:        owner ? `${petName} - ${owner}` : petName,
    }),
  });

  submitBtn.disabled = false;

  if (res?.success) {
    form.reset();
    await _loadQueue();
    showToast(`เพิ่มคิว ${petName} เรียบร้อย`);
  } else {
    showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _elapsed(since) {
  const mins = Math.floor((Date.now() - since) / 60000);
  if (mins < 1)  return 'เพิ่งเข้ามา';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

function _statusMsg(status) {
  const MAP = {
    called:      'เรียกคิวแล้ว',
    in_progress: 'เริ่มรักษาแล้ว',
    completed:   'บันทึกเสร็จสิ้น',
    no_show:     'บันทึก: ไม่มา',
  };
  return MAP[status] || 'อัพเดทแล้ว';
}
