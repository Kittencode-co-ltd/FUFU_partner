import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { formatHN, escapeHtml } from '../utils/formatters.js';

const SPECIES = {
  dog:    { label: 'สุนัข',      emoji: '🐕' },
  cat:    { label: 'แมว',        emoji: '🐈' },
  rabbit: { label: 'กระต่าย',   emoji: '🐰' },
  bird:   { label: 'นก',         emoji: '🐦' },
  other:  { label: 'อื่นๆ',      emoji: '🐾' },
};

const BREEDS = {
  dog: [
    'Golden Retriever', 'Labrador Retriever', 'German Shepherd', 'French Bulldog',
    'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Yorkshire Terrier', 'Dachshund',
    'Chihuahua', 'Shih Tzu', 'Siberian Husky', 'Pomeranian', 'Corgi', 'Border Collie',
    'Maltese', 'Samoyed', 'Doberman', 'Schnauzer', 'Cocker Spaniel', 'Boxer',
    'Great Dane', 'Dalmatian', 'Akita', 'Shiba Inu', 'Chow Chow', 'Bichon Frise',
    'Thai Bangkaew', 'Thai Ridgeback', 'Basenji', 'Weimaraner', 'Vizsla',
  ],
  cat: [
    'Persian', 'Siamese', 'Maine Coon', 'British Shorthair', 'Scottish Fold',
    'Ragdoll', 'Bengal', 'Abyssinian', 'Russian Blue', 'Burmese', 'Thai',
    'American Shorthair', 'Sphynx', 'Norwegian Forest Cat', 'Turkish Angora',
    'Birman', 'Tonkinese', 'Devon Rex', 'Cornish Rex', 'Exotic Shorthair',
    'Oriental', 'Himalayan', 'Manx',
  ],
  rabbit: [
    'Holland Lop', 'Mini Rex', 'Dutch', 'Lionhead', 'Rex', 'Angora',
    'Flemish Giant', 'New Zealand White', 'Mini Lop', 'Netherland Dwarf',
    'American', 'Californian', 'Checkered Giant', 'English Lop', 'Jersey Wooly',
  ],
  bird: [
    'Budgerigar', 'Cockatiel', 'Lovebird', 'Canary', 'Finch', 'Conure',
    'African Grey Parrot', 'Macaw', 'Cockatoo', 'Parakeet', 'Eclectus',
    'Sun Conure', 'Green Cheek Conure', 'Ringneck Parakeet', 'Lorikeet',
    'Caique', 'Pionus', 'Amazon Parrot',
  ],
  other: [],
};

const APPT_STATUS = {
  scheduled: { label: 'นัดหมาย',    cls: 'badge-gold' },
  confirmed: { label: 'ยืนยันแล้ว', cls: 'badge-teal' },
  arrived:   { label: 'มาถึงแล้ว',  cls: 'bg-blue-50 text-blue-600' },
  completed: { label: 'เสร็จสิ้น',  cls: 'badge-navy' },
  cancelled: { label: 'ยกเลิก',     cls: 'bg-slate-100 text-slate-400' },
  no_show:   { label: 'ไม่มา',      cls: 'bg-slate-100 text-slate-400' },
};

let _storeId = '';
let _tab = 'appointments';

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderPets(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  container.innerHTML = _shellHTML();
  _bindTabEvents(container);
  await _switchTab('appointments', container);
}

function _shellHTML() {
  const calendarIco = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`;
  const pawIco      = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8.5 3.5a2 2 0 100 4 2 2 0 000-4zm7 0a2 2 0 100 4 2 2 0 000-4zM4 7.5a2 2 0 100 4 2 2 0 000-4zm16 0a2 2 0 100 4 2 2 0 000-4zM12 10c-3.314 0-6 2.686-6 6 0 1.657.672 2.5 2 2.5h8c1.328 0 2-.843 2-2.5 0-3.314-2.686-6-6-6z"/></svg>`;
  const userIco     = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>`;
  return `
    <div class="space-y-4 w-full">
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        ${[
          { id: 'appointments', label: 'นัดหมาย',     ico: calendarIco },
          { id: 'pets',         label: 'สัตว์เลี้ยง', ico: pawIco      },
          { id: 'owners',       label: 'เจ้าของ',      ico: userIco     },
        ].map(t => `
          <button data-tab="${t.id}"
            class="tab-btn flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                   ${t.id === 'appointments' ? 'bg-white text-navy shadow-card' : 'text-slate-500 hover:text-navy'}">
            ${t.ico} ${t.label}
          </button>`).join('')}
      </div>
      <div id="pets-content"></div>
    </div>`;
}

function _bindTabEvents(container) {
  container.querySelector('.flex').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    container.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('bg-white',       b === btn);
      b.classList.toggle('text-navy',      b === btn);
      b.classList.toggle('shadow-card',    b === btn);
      b.classList.toggle('text-slate-500', b !== btn);
    });
    await _switchTab(btn.dataset.tab, container);
  });
}

async function _switchTab(tab, container) {
  _tab = tab;
  const content = container.querySelector('#pets-content');
  if (tab === 'appointments') await _renderAppointments(content);
  if (tab === 'pets')         await _renderPetsList(content);
  if (tab === 'owners')       await _renderOwnersList(content);
}

// ─── Appointments Tab — Calendar + List side-by-side ─────────────────────────

let _calOffset    = 0;          // months from current
let _listFilter   = 'today';    // 'today' | 'week' | 'month' | 'date'
let _selectedDate = null;       // YYYY-MM-DD when user clicks a calendar cell
let _monthAppts   = [];         // cached appointments for current calendar month

function _toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function _renderAppointments(el) {
  _calOffset    = 0;
  _listFilter   = 'today';
  _selectedDate = null;
  _monthAppts   = [];
  const today = _toDateStr(new Date());
  _selectedDate = today;

  el.innerHTML = `
    <div class="space-y-4">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-navy">📅 นัดหมาย</h3>
        <button id="new-appt-btn" class="btn-primary text-sm px-4 py-2">+ นัดหมายใหม่</button>
      </div>

      <!-- Split layout: Calendar left · List right -->
      <div class="grid grid-cols-1 md:grid-cols-[minmax(260px,300px)_1fr] gap-4 items-start">

        <!-- ── Left: Calendar ── -->
        <div id="appt-cal-panel" class="card overflow-hidden"></div>

        <!-- ── Right: List ── -->
        <div class="space-y-3">
          <!-- Filter tabs -->
          <div class="flex gap-1 bg-slate-100 p-1 rounded-xl">
            ${[
              { id:'today', label:'วันนี้'       },
              { id:'week',  label:'สัปดาห์นี้'    },
              { id:'month', label:'เดือนนี้'      },
            ].map(f => `
              <button data-filter="${f.id}"
                class="list-filter-btn flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors
                       ${_listFilter === f.id ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'}">
                ${f.label}
              </button>`).join('')}
          </div>
          <!-- List container -->
          <div id="appt-list-panel"></div>
        </div>

      </div>
    </div>`;

  // Filter buttons → update list
  el.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _listFilter   = btn.dataset.filter;
      _selectedDate = null;
      el.querySelectorAll('.list-filter-btn').forEach(b => {
        const active = b.dataset.filter === _listFilter;
        b.className = `list-filter-btn flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy'}`;
      });
      _refreshCalHighlight(el);
      _renderListPanel(el.querySelector('#appt-list-panel'));
    });
  });

  // Action delegation
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-appt-action]');
    if (!btn) return;
    const id = btn.dataset.apptId;
    if (btn.dataset.apptAction === 'checkin') _checkin(id, el);
    if (btn.dataset.apptAction === 'cancel')  _cancelAppt(id, el);
    if (btn.dataset.apptAction === 'view')    _viewPet(btn.dataset.petId);
  });

  el.querySelector('#new-appt-btn')?.addEventListener('click', () => _openApptModal(el));

  // Initial render (calendar + list in parallel)
  await _renderCalPanel(el);
}

// ── Calendar panel ──────────────────────────────────────────────────────────

async function _renderCalPanel(rootEl) {
  const panel = rootEl.querySelector('#appt-cal-panel');
  if (!panel) return;

  const now      = new Date();
  const baseMonth = now.getMonth() + _calOffset;
  const year     = now.getFullYear() + Math.floor(baseMonth / 12);
  const month    = ((baseMonth % 12) + 12) % 12;
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const from     = _toDateStr(firstDay);
  const to       = _toDateStr(lastDay);
  const today    = _toDateStr(now);
  const monthName = firstDay.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  panel.innerHTML = `<div class="text-center py-8 text-slate-400 animate-pulse text-sm">กำลังโหลด...</div>`;

  const res      = await apiFetch(`/api/pets/appointments/list?store_id=${_storeId}&from=${from}&to=${to}`);
  _monthAppts    = res?.data || [];

  const byDate   = {};
  _monthAppts.forEach(a => { (byDate[a.appt_date] = byDate[a.appt_date] || []).push(a); });

  const startDow = (firstDay.getDay() + 6) % 7;
  const cells    = Array(startDow).fill(null)
    .concat(Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)));

  panel.innerHTML = `
    <!-- Month navigation -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
      <button id="cp-prev" class="w-7 h-7 flex items-center justify-center rounded-lg
              hover:bg-slate-100 text-slate-500 transition-colors text-base font-bold">‹</button>
      <span class="text-sm font-bold text-navy">${monthName}</span>
      <button id="cp-next" class="w-7 h-7 flex items-center justify-center rounded-lg
              hover:bg-slate-100 text-slate-500 transition-colors text-base font-bold">›</button>
    </div>

    <!-- Day-of-week headers -->
    <div class="grid grid-cols-7 border-b border-slate-100">
      ${['จ','อ','พ','พฤ','ศ','ส','อา'].map((d, i) => `
        <div class="py-1.5 text-center text-xs font-semibold ${i >= 5 ? 'text-red-400' : 'text-slate-400'}">${d}</div>
      `).join('')}
    </div>

    <!-- Cells -->
    <div class="grid grid-cols-7" id="cal-cells">
      ${cells.map(d => {
        if (!d) return `<div class="h-10 border-r border-b border-slate-50/50"></div>`;
        const ds       = _toDateStr(d);
        const count    = byDate[ds]?.length || 0;
        const isToday  = ds === today;
        const isSel    = ds === _selectedDate;
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return `
          <div data-cal-date="${ds}"
               class="cal-cell h-10 flex flex-col items-center justify-center gap-0.5 cursor-pointer
                      border-r border-b border-slate-50/50 transition-colors hover:bg-primary-subtle
                      ${isSel ? 'bg-primary-subtle' : ''}">
            <span class="text-xs font-semibold leading-none
              ${isToday  ? 'w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center' :
                isWeekend ? 'text-red-400' : 'text-slate-600'}">
              ${d.getDate()}
            </span>
            ${count > 0 ? `
              <span class="text-xs font-bold leading-none ${isSel ? 'text-primary' : 'text-primary'}"
                    style="font-size:9px">●&nbsp;${count}</span>` : ''}
          </div>`;
      }).join('')}
    </div>`;

  panel.querySelector('#cp-prev')?.addEventListener('click', () => { _calOffset--; _renderCalPanel(rootEl); });
  panel.querySelector('#cp-next')?.addEventListener('click', () => { _calOffset++; _renderCalPanel(rootEl); });

  panel.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const ds = cell.dataset.calDate;
      _selectedDate = ds;
      _listFilter   = 'date';
      // Deactivate filter tabs
      rootEl.querySelectorAll('.list-filter-btn').forEach(b => {
        b.className = `list-filter-btn flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors text-slate-500 hover:text-navy`;
      });
      _refreshCalHighlight(rootEl);
      _renderListPanel(rootEl.querySelector('#appt-list-panel'));
    });
  });

  // Render list too (initial or after month change)
  await _renderListPanel(rootEl.querySelector('#appt-list-panel'));
}

function _refreshCalHighlight(rootEl) {
  rootEl.querySelectorAll('.cal-cell').forEach(cell => {
    const ds  = cell.dataset.calDate;
    const sel = _listFilter === 'date' ? ds === _selectedDate : _isInFilter(ds);
    cell.classList.toggle('bg-primary-subtle', sel);
    const dot = cell.querySelector('span:last-child');
    if (dot && dot !== cell.querySelector('span:first-child')) {
      dot.style.color = '#0D9488';
    }
  });
}

function _isInFilter(ds) {
  const now = new Date();
  const today = _toDateStr(now);
  if (_listFilter === 'today') return ds === today;
  if (_listFilter === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return ds >= _toDateStr(mon) && ds <= _toDateStr(sun);
  }
  if (_listFilter === 'month') return ds.startsWith(today.substring(0, 7));
  return false;
}

// ── List panel ──────────────────────────────────────────────────────────────

async function _renderListPanel(listEl) {
  if (!listEl) return;
  listEl.innerHTML = `<div class="text-center py-8 text-slate-400 animate-pulse text-sm">กำลังโหลด...</div>`;

  const today  = _toDateStr(new Date());
  let from, to, title;

  if (_listFilter === 'today' || (_listFilter === 'date' && _selectedDate === today)) {
    from = today; to = today;
    title = 'วันนี้ — ' + new Date().toLocaleDateString('th-TH', { weekday:'long', day:'numeric', month:'long' });
  } else if (_listFilter === 'date' && _selectedDate) {
    from = _selectedDate; to = _selectedDate;
    const dt = new Date(_selectedDate + 'T00:00');
    title = dt.toLocaleDateString('th-TH', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  } else if (_listFilter === 'week') {
    const now = new Date();
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    from  = _toDateStr(mon);
    to    = _toDateStr(sun);
    title = `สัปดาห์นี้ (${mon.toLocaleDateString('th-TH',{day:'numeric',month:'short'})} – ${sun.toLocaleDateString('th-TH',{day:'numeric',month:'short'})})`;
  } else {
    const now = new Date();
    from  = _toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    to    = _toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    title = new Date(from + 'T00:00').toLocaleDateString('th-TH', { month:'long', year:'numeric' });
  }

  const raw = (_listFilter === 'month' && _monthAppts.length)
    ? _monthAppts
    : (await apiFetch(`/api/pets/appointments/list?store_id=${_storeId}&from=${from}&to=${to}`))?.data || [];
  const appts = [...raw].sort((a, b) =>
    a.appt_date.localeCompare(b.appt_date) || (a.appt_time||'').localeCompare(b.appt_time||'')
  );

  if (!appts.length) {
    listEl.innerHTML = `
      <div class="card p-10 text-center space-y-2">
        <div class="text-3xl">📭</div>
        <div class="text-slate-400 font-body text-sm">ไม่มีนัดหมาย<br><span class="text-xs">${title}</span></div>
      </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  appts.forEach(a => { (byDate[a.appt_date] = byDate[a.appt_date] || []).push(a); });

  listEl.innerHTML = `
    <div class="space-y-3">
      <p class="text-xs text-slate-400 font-body font-semibold px-1">${title} · ${appts.length} รายการ</p>
      ${Object.entries(byDate).map(([ds, list]) => {
        const dt  = new Date(ds + 'T00:00');
        const isT = ds === today;
        const dayLabel = dt.toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' });
        return `
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full
                ${isT ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}">
                ${dayLabel}${isT ? ' · วันนี้' : ''}
              </span>
              <span class="text-xs text-slate-400 font-body">${list.length} นัด</span>
            </div>
            <div class="space-y-2">
              ${list.map(a => _apptCard(a)).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function _apptCard(a) {
  const pet     = a.pets;
  const owner   = pet?.pet_owners;
  const sp      = SPECIES[pet?.species] || SPECIES.other;
  const cfg     = APPT_STATUS[a.status] || APPT_STATUS.scheduled;
  const time    = a.appt_time ? a.appt_time.substring(0, 5) : '—';
  const isToday = a.appt_date === _toDateStr(new Date());
  const canCheckin = isToday && ['scheduled','confirmed'].includes(a.status);

  return `
    <div class="card p-4 flex items-center gap-4">
      <div class="flex-shrink-0 text-center w-12">
        <div class="font-bold text-primary text-lg leading-none">${time}</div>
        ${isToday ? '<div class="text-xs text-slate-400 font-body">วันนี้</div>' : `<div class="text-xs text-slate-400 font-body">${new Date(a.appt_date).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</div>`}
      </div>
      <div class="w-10 h-10 rounded-xl bg-primary-subtle flex items-center justify-center text-xl flex-shrink-0">
        ${sp.emoji}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-navy">${pet?.name || '(ไม่ระบุ)'}</span>
          <span class="badge ${cfg.cls} text-xs">${cfg.label}</span>
        </div>
        <div class="text-sm text-slate-500 font-body">
          ${owner?.name ? `เจ้าของ: ${owner.name}` : ''}${owner?.phone ? ` · ${owner.phone}` : ''} · ${a.service_type}
        </div>
        ${a.notes ? `<div class="text-xs text-slate-400 font-body mt-0.5">${a.notes}</div>` : ''}
      </div>
      <div class="flex gap-2 flex-shrink-0">
        ${pet ? `<button data-appt-action="view" data-pet-id="${pet.id}" class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">🐾 โปรไฟล์</button>` : ''}
        ${canCheckin ? `<button data-appt-action="checkin" data-appt-id="${a.id}" class="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">✓ Check-in</button>` : ''}
        ${a.status === 'scheduled' ? `<button data-appt-action="cancel" data-appt-id="${a.id}" class="text-xs border border-slate-200 text-slate-400 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">ยกเลิก</button>` : ''}
      </div>
    </div>`;
}

async function _checkin(apptId, el) {
  const res = await apiFetch(`/api/pets/appointments/${apptId}/checkin`, {
    method: 'POST',
    body: JSON.stringify({ store_id: _storeId }),
  });
  if (res?.success) {
    const num = String(res.data.queue_number).padStart(3, '0');
    showToast(`Check-in สำเร็จ! คิว A${num}`);
    await _renderAppointments(el);
    // Notify queue page to refresh if open
    document.dispatchEvent(new CustomEvent('fufu:queueRefresh'));
  } else {
    showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  }
}

async function _cancelAppt(apptId, el) {
  // Confirmation popup
  const confirmed = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px 28px 24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">📅</div>
        <div style="font-size:17px;font-weight:700;color:#1e293b;margin-bottom:8px;">ยืนยันการยกเลิกนัดหมาย</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.5;">คุณต้องการยกเลิกนัดหมายนี้ใช่ไหม?<br>การดำเนินการนี้ไม่สามารถย้อนกลับได้</div>
        <div style="display:flex;gap:10px;">
          <button id="cancel-no"  style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:14px;font-weight:600;color:#475569;cursor:pointer;">ไม่ยกเลิก</button>
          <button id="cancel-yes" style="flex:1;padding:10px;border:none;border-radius:10px;background:#ef4444;font-size:14px;font-weight:600;color:#fff;cursor:pointer;">ยืนยันยกเลิก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cancel-yes').addEventListener('click', () => { overlay.remove(); resolve(true);  });
    overlay.querySelector('#cancel-no') .addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });

  if (!confirmed) return;

  const res = await apiFetch(`/api/pets/appointments/${apptId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Cancelled' }),
  });
  if (res?.success) {
    showToast('ยกเลิกนัดหมายแล้ว', 'info');
    await _renderAppointments(el);
  }
}

// ─── Pets List Tab ────────────────────────────────────────────────────────────

async function _renderPetsList(el) {
  el.innerHTML = `
    <div class="space-y-4">
      <div class="card p-4 flex gap-3">
        <input id="pet-search" class="input-field flex-1" placeholder="🔍 ค้นหาชื่อสัตว์ / เลข HN / เจ้าของ / เบอร์โทร">
        <button id="new-pet-btn" class="btn-primary text-sm px-4 py-2 whitespace-nowrap">+ สัตว์เลี้ยงใหม่</button>
      </div>
      <div id="pet-search-results" class="space-y-2">
        <div class="text-center py-4 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>
      </div>
    </div>`;

  let searchTimer;
  el.querySelector('#pet-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length === 1) return;
    searchTimer = setTimeout(() => _searchPets(q, el), 400);
  });

  el.querySelector('#new-pet-btn')?.addEventListener('click', () => _openNewPetFlow(el));
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pet-id]');
    if (btn) _viewPet(btn.dataset.petId);
  });

  await _searchPets('', el);
}

async function _searchPets(q, el) {
  const resultsEl = el.querySelector('#pet-search-results');
  if (q.length === 1) {
    resultsEl.innerHTML = `<p class="text-center text-slate-400 font-body text-sm py-8">พิมพ์อย่างน้อย 2 ตัวอักษร</p>`;
    return;
  }

  resultsEl.innerHTML = `<div class="text-center py-4 text-slate-400 font-body animate-pulse">กำลังค้นหา...</div>`;
  const res = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
  const owners = res?.data || [];

  if (!owners.length) {
    resultsEl.innerHTML = `
      <div class="card p-6 text-center space-y-3">
        <p class="text-slate-500 font-body">ไม่พบ "${q}"</p>
        <button id="create-new-btn" class="btn-primary text-sm px-4 py-2">+ สร้างเจ้าของใหม่</button>
      </div>`;
    resultsEl.querySelector('#create-new-btn')?.addEventListener('click', () => _openNewPetFlow(el));
    return;
  }

  resultsEl.innerHTML = owners.flatMap(owner =>
    (owner.pets || [{ _ownerOnly: true }]).map(pet => pet._ownerOnly
      ? `<div class="card p-4 flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-shadow" data-pet-id="">
           <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">👤</div>
           <div class="flex-1">
             <div class="font-semibold text-navy">${owner.name}</div>
             <div class="text-sm text-slate-500 font-body">${owner.phone || ''} — ยังไม่มีสัตว์เลี้ยงในระบบ</div>
           </div>
         </div>`
      : `<div class="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-shadow" data-pet-id="${pet.id}">
           <div class="w-10 h-10 rounded-xl bg-primary-subtle flex items-center justify-center text-xl">
             ${SPECIES[pet.species]?.emoji || '🐾'}
           </div>
           <div class="flex-1">
             <div class="flex items-center gap-2 flex-wrap">
               <span class="font-semibold text-navy">${pet.name}</span>
               ${_hn(pet) ? `<span class="badge badge-navy text-xs">${_hn(pet)}</span>` : ''}
               <span class="text-xs text-slate-400 font-body">${SPECIES[pet.species]?.label || ''} ${pet.breed || ''}</span>
             </div>
             <div class="text-sm text-slate-500 font-body">เจ้าของ: ${owner.name} · ${owner.phone || ''}</div>
           </div>
           <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
           </svg>
         </div>`)
  ).join('');
}

// ─── Pet Profile View ─────────────────────────────────────────────────────────

async function _viewPet(petId) {
  if (!petId) return;
  const res = await apiFetch(`/api/pets/${petId}`);
  const pet = res?.data;
  if (!pet) { showToast('ไม่พบข้อมูลสัตว์เลี้ยง', 'error'); return; }
  document.dispatchEvent(new CustomEvent('fufu:openPetProfile', { detail: pet }));
}

export function renderPetProfile(container, pet) {
  if (!pet) return;
  const sp    = SPECIES[pet.species] || SPECIES.other;
  const owner = pet.pet_owners || {};
  const age   = pet.dob ? _calcAge(pet.dob) : null;

  container.innerHTML = `
    <div class="space-y-4 w-full">
      <!-- Back nav -->
      <div>
        <button id="profile-back"
          class="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="min-width:16px">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          กลับ
        </button>
      </div>

      <!-- Header -->
      <div class="card p-5 flex items-center gap-4">
        <div class="w-16 h-16 rounded-xl bg-primary-subtle flex items-center justify-center text-3xl flex-shrink-0">
          ${sp.emoji}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-bold text-navy text-xl">${pet.name}</h2>
            ${_hn(pet) ? `<span class="badge bg-navy text-white text-xs font-mono">${_hn(pet)}</span>` : ''}
            <span class="badge badge-teal text-xs">${sp.label}</span>
            ${pet.breed ? `<span class="badge badge-navy text-xs">${pet.breed}</span>` : ''}
            ${pet.is_neutered ? `<span class="badge bg-purple-50 text-purple-600 text-xs">ทำหมันแล้ว</span>` : ''}
          </div>
          <div class="text-sm text-slate-500 font-body mt-1">
            ${age ? `อายุ ${age} · ` : ''}${pet.gender === 'male' ? 'เพศผู้ ♂' : pet.gender === 'female' ? 'เพศเมีย ♀' : ''}
            ${pet.color ? ` · ${pet.color}` : ''}
            ${pet.weight_kg ? ` · ${pet.weight_kg} kg` : ''}
            ${pet.microchip_no ? ` · ชิป: ${pet.microchip_no}` : ''}
          </div>
          ${pet.allergies ? `<div class="text-xs text-red-500 font-body mt-1">⚠️ แพ้: ${pet.allergies}</div>` : ''}
        </div>
        <div class="flex-shrink-0">
          <button id="new-appt-from-profile" class="btn-primary text-sm px-3 py-2">📅 นัดหมาย</button>
        </div>
      </div>

      <!-- Owner info -->
      <div class="card p-4 flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">👤</div>
        <div class="flex-1">
          <div class="font-semibold text-navy">${owner.name || '—'}</div>
          <div class="text-sm text-slate-500 font-body">
            ${owner.phone || ''}${owner.email ? ` · ${owner.email}` : ''}${owner.line_id ? ` · Line: ${owner.line_id}` : ''}
          </div>
        </div>
      </div>

      <!-- Tabs: ประวัติ / วัคซีน / นัดหมาย -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        ${['history','vaccines','appointments'].map((t, i) => `
          <button data-profile-tab="${t}"
            class="profile-tab px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                   ${i===0 ? 'bg-white text-navy shadow-card' : 'text-slate-500 hover:text-navy'}">
            ${t==='history' ? '📋 ประวัติรักษา' : t==='vaccines' ? '💉 วัคซีน' : '📅 นัดหมาย'}
          </button>`).join('')}
      </div>

      <div id="profile-tab-content"></div>
    </div>`;

  // Inject initial history tab (DOM node, not HTML string)
  container.querySelector('#profile-tab-content').appendChild(_renderHistory(pet.medical_records || []));

  // Tab switching
  container.querySelectorAll('[data-profile-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.profile-tab').forEach(b => {
        b.classList.toggle('bg-white',       b === btn);
        b.classList.toggle('text-navy',      b === btn);
        b.classList.toggle('shadow-card',    b === btn);
        b.classList.toggle('text-slate-500', b !== btn);
      });
      const tc = container.querySelector('#profile-tab-content');
      if (btn.dataset.profileTab === 'history') {
        tc.replaceChildren(_renderHistory(pet.medical_records || []));
      } else if (btn.dataset.profileTab === 'vaccines') {
        tc.innerHTML = _renderVaccines(pet.vaccinations || [], pet.id, pet.medical_records || []);
      } else if (btn.dataset.profileTab === 'appointments') {
        tc.innerHTML = _renderPetAppts(pet.appointments || []);
      }
    });
  });

  container.querySelector('#profile-back')?.addEventListener('click', () => {
    import('../partner/dashboard.js').then(({ navigate }) => navigate('pets'));
  });

  container.querySelector('#new-appt-from-profile')?.addEventListener('click', () => {
    _openApptModal(container, pet);
  });

  // Vaccine add button (event delegation)
  container.addEventListener('click', (e) => {
    if (e.target.closest('#add-vaccine-btn')) _openVaccineModal(pet, container);
  });
}

function _fmtAuditTs(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch { return null; }
}

function _fmtVisitDate(s) {
  if (!s) return '—';
  try {
    const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00');
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function _renderHistory(records) {
  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'card p-8 text-center text-slate-400 font-body';
    empty.textContent = 'ยังไม่มีประวัติการรักษา';
    return empty;
  }
  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';

  records.forEach(r => {
    const auditTs = _fmtAuditTs(r.created_at);
    const card = document.createElement('div');
    card.className = 'card p-4 hover:shadow-card-hover transition-shadow';
    card.dataset.recordId = r.id;
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex-1 cursor-pointer" data-opd-open>
          <div class="flex items-center gap-2">
            <span class="font-semibold text-navy text-sm">${_fmtVisitDate(r.visit_date)}</span>
            <span class="badge ${r.status === 'completed' ? 'badge-teal' : 'bg-blue-50 text-blue-600'} text-xs">
              ${r.status === 'completed' ? 'เสร็จสิ้น' : 'กำลังรักษา'}
            </span>
          </div>
          <div class="text-sm text-slate-500 font-body mt-0.5">
            ${r.assessment || r.diagnosis || '—'}
          </div>
          ${auditTs ? `<div class="text-xs text-slate-400 font-body mt-1">บันทึก: ${auditTs}${r.created_by ? ' · ' + r.created_by : ''}</div>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${r.weight_kg ? `<span class="badge badge-navy text-xs">⚖ ${r.weight_kg}kg</span>` : ''}
          <button class="text-red-500 hover:text-red-700 text-xs font-body px-1" data-delete-record title="ลบบันทึกนี้">ลบ</button>
        </div>
      </div>`;

    // Open OPD on clicking the content area
    card.querySelector('[data-opd-open]').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: { _existingRecord: r } }));
    });

    // Delete button
    card.querySelector('[data-delete-record]').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('ยืนยันการลบ? การกระทำนี้จะถูกบันทึก log')) return;
      try {
        await apiFetch(`/api/medical-records/${r.id}`, { method: 'DELETE' });
        card.remove();
        showToast('ลบบันทึกการรักษาแล้ว', 'success');
      } catch (err) {
        showToast('ลบไม่สำเร็จ: ' + (err?.message || 'เกิดข้อผิดพลาด'), 'error');
      }
    });

    wrap.appendChild(card);
  });

  return wrap;
}

function _renderVaccines(vaccines, petId, medicalRecords = []) {
  const today    = _toDateStr(new Date());
  const soon30   = _toDateStr(new Date(Date.now() + 30 * 86400000));

  function _vaccineBadge(v) {
    if (!v.next_due_date) return '';
    if (v.next_due_date < today) {
      return `<span class="text-xs font-semibold bg-red-100 text-red-600 rounded-lg px-2 py-0.5">⚠️ เกินกำหนด</span>`;
    }
    if (v.next_due_date <= soon30) {
      return `<span class="text-xs font-semibold bg-amber-100 text-amber-600 rounded-lg px-2 py-0.5">🔔 ใกล้ถึงกำหนด</span>`;
    }
    return `<span class="text-xs font-semibold bg-primary-subtle text-primary rounded-lg px-2 py-0.5">✓ ปกติ</span>`;
  }

  // Weight chart from medical records
  const weightPoints = (medicalRecords || [])
    .filter(r => r.weight_kg && (r.visit_date || r.created_at))
    .map(r => ({ date: (r.visit_date || r.created_at).split('T')[0], w: parseFloat(r.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);

  const weightChart = weightPoints.length >= 2 ? (() => {
    const minW = Math.min(...weightPoints.map(p => p.w));
    const maxW = Math.max(...weightPoints.map(p => p.w));
    const range = maxW - minW || 1;
    const W = 480, H = 100, PAD = 10;
    const xStep = (W - PAD * 2) / (weightPoints.length - 1);

    const pts = weightPoints.map((p, i) => ({
      x: PAD + i * xStep,
      y: H - PAD - ((p.w - minW) / range) * (H - PAD * 2),
      ...p,
    }));

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return `
      <div class="card p-4 mb-3">
        <h4 class="font-semibold text-navy text-sm mb-3">⚖ น้ำหนักตามเวลา</h4>
        <svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:100px">
          <!-- Grid lines -->
          <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H-PAD}" stroke="#e2e8f0" stroke-width="1"/>
          <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#e2e8f0" stroke-width="1"/>
          <!-- Weight line -->
          <path d="${pathD}" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Data points -->
          ${pts.map(p => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#0D9488"/>
            <text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle"
                  font-size="9" fill="#0D9488" font-family="Sarabun,sans-serif">${p.w}kg</text>
          `).join('')}
          <!-- Min/Max labels -->
          <text x="${(PAD-2).toFixed(1)}" y="${PAD}" text-anchor="end" font-size="8" fill="#94a3b8" font-family="Sarabun,sans-serif">${maxW}kg</text>
          <text x="${(PAD-2).toFixed(1)}" y="${H-PAD}" text-anchor="end" font-size="8" fill="#94a3b8" font-family="Sarabun,sans-serif">${minW}kg</text>
        </svg>
        <div class="flex justify-between text-xs text-slate-400 font-body mt-1 px-2">
          <span>${weightPoints[0].date}</span>
          <span>${weightPoints[weightPoints.length-1].date}</span>
        </div>
      </div>`;
  })() : '';

  return `
    <div class="space-y-3">
      ${weightChart}
      <div class="flex justify-end">
        <button id="add-vaccine-btn" class="btn-primary text-sm px-4 py-2">+ บันทึกวัคซีน</button>
      </div>
      ${!vaccines.length
        ? `<div class="card p-8 text-center text-slate-400 font-body">ยังไม่มีประวัติวัคซีน</div>`
        : vaccines.map(v => `
            <div class="card p-4 border-l-4 ${
              !v.next_due_date               ? 'border-l-slate-200' :
              v.next_due_date < today        ? 'border-l-red-400'   :
              v.next_due_date <= soon30      ? 'border-l-amber-400' : 'border-l-primary'}">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-navy">💉 ${v.vaccine_name}</span>
                    ${_vaccineBadge(v)}
                    ${v.batch_no ? `<span class="text-xs text-slate-400 font-body">Lot: ${v.batch_no}</span>` : ''}
                  </div>
                  ${v.vet_name ? `<div class="text-xs text-slate-400 font-body mt-0.5">สัตวแพทย์: ${v.vet_name}</div>` : ''}
                </div>
                <div class="text-right text-xs font-body flex-shrink-0">
                  <div class="text-slate-500">ฉีดวันที่ ${v.given_date}</div>
                  ${v.next_due_date ? `<div class="${v.next_due_date < today ? 'text-red-500 font-bold' : 'text-primary font-semibold'}">
                    ครั้งหน้า: ${v.next_due_date}
                  </div>` : ''}
                </div>
              </div>
            </div>`).join('')}
    </div>`;
}

function _renderPetAppts(appointments) {
  if (!appointments.length) return `<div class="card p-8 text-center text-slate-400 font-body">ไม่มีนัดหมายที่กำลังจะมา</div>`;
  return `<div class="space-y-2">
    ${appointments.map(a => {
      const cfg = APPT_STATUS[a.status] || APPT_STATUS.scheduled;
      return `<div class="card p-4 flex items-center justify-between">
        <div>
          <div class="font-semibold text-navy text-sm">${a.appt_date} ${a.appt_time ? a.appt_time.substring(0,5) : ''}</div>
          <div class="text-sm text-slate-500 font-body">${a.service_type}</div>
        </div>
        <span class="badge ${cfg.cls} text-xs">${cfg.label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── Owners Tab ───────────────────────────────────────────────────────────────

async function _renderOwnersList(el) {
  el.innerHTML = `
    <div class="space-y-4">
      <div class="card p-4 flex gap-3">
        <input id="owner-search" class="input-field flex-1" placeholder="🔍 ค้นหาชื่อ / เบอร์โทร / อีเมล">
        <button id="new-owner-btn" class="btn-primary text-sm px-4 py-2 whitespace-nowrap">+ เพิ่มเจ้าของ</button>
      </div>
      <div id="owner-results" class="space-y-2">
        <div class="text-center py-4 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>
      </div>
    </div>`;

  async function _loadOwners(q) {
    const resultsEl = el.querySelector('#owner-results');
    if (q.length === 1) return;
    const url = q.length >= 2
      ? `/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`
      : `/api/pets/owners/search?store_id=${_storeId}`;
    const res = await apiFetch(url);
    const owners = res?.data || [];
    if (!owners.length) {
      resultsEl.innerHTML = `<div class="card p-6 text-center text-slate-400 font-body">${q ? `ไม่พบ "${q}"` : 'ยังไม่มีข้อมูลเจ้าของในระบบ'}</div>`;
      return;
    }
    resultsEl.innerHTML = owners.map(o => {
      const pets = o.pets || [];
      const hasPets = pets.length > 0;
      return `
      <div class="card overflow-hidden">
        <div class="owner-row p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
             data-owner-id="${o.id}">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">👤</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-navy">${o.name}</div>
            <div class="text-sm text-slate-500 font-body truncate">
              ${o.phone || ''}${o.email ? ` · ${o.email}` : ''}
              · สัตว์เลี้ยง ${pets.length} ตัว
            </div>
          </div>
          ${hasPets ? `<svg class="owner-chevron flex-shrink-0 transition-transform duration-200"
               width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:#94a3b8;min-width:16px">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>` : ''}
        </div>
        ${hasPets ? `
        <div class="owner-pets hidden border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2">
          ${pets.map(p => {
            const sp = SPECIES[p.species] || SPECIES.other;
            return `
            <div class="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer transition-colors pet-row"
                 data-pet-id="${p.id}">
              <div class="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-base flex-shrink-0">
                ${p.photo_url
                  ? `<img src="${p.photo_url}" class="w-full h-full object-cover rounded-lg">`
                  : sp.emoji}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm text-navy">${p.name}</div>
                <div class="text-xs text-slate-400 font-body">${sp.label}${p.breed ? ` · ${p.breed}` : ''}</div>
              </div>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:#cbd5e1;flex-shrink:0;min-width:14px">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
    }).join('');

    // Toggle pet dropdown
    resultsEl.querySelectorAll('.owner-row').forEach(row => {
      row.addEventListener('click', () => {
        const petsEl  = row.nextElementSibling;
        const chevron = row.querySelector('.owner-chevron');
        if (!petsEl) return;
        const open = !petsEl.classList.contains('hidden');
        petsEl.classList.toggle('hidden', open);
        chevron?.classList.toggle('rotate-180', !open);
      });
    });

    // Open pet profile on pet row click
    resultsEl.querySelectorAll('.pet-row').forEach(row => {
      row.addEventListener('click', e => {
        e.stopPropagation();
        const petId = row.dataset.petId;
        if (petId) _viewPet(petId);
      });
    });
  }

  let timer;
  el.querySelector('#owner-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => _loadOwners(e.target.value.trim()), 400);
  });

  el.querySelector('#new-owner-btn')?.addEventListener('click', () => _openOwnerModal(el));
  await _loadOwners('');
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function _openApptModal(el, pet = null) {
  // When called without a pet, show owner/pet search fields
  const ownerPetSection = pet ? `
    <div class="bg-primary-subtle rounded-lg px-4 py-2 text-sm text-primary-dark font-semibold">
      🐾 ${pet.name} · เจ้าของ: ${pet.pet_owners?.name || '—'}
    </div>` : `
    <div class="space-y-2">
      <div class="relative">
        <label class="input-label">เลือกเจ้าของ *</label>
        <input id="ap-owner-search" class="input-field" placeholder="พิมพ์ชื่อ / เบอร์โทร..." autocomplete="off">
        <div id="ap-owner-dropdown"
          class="hidden absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-hover
                 border border-slate-100 max-h-48 overflow-y-auto z-50 text-sm"></div>
      </div>
      <div id="ap-owner-badge" class="hidden bg-primary-subtle rounded-lg px-3 py-2 flex items-center justify-between">
        <span id="ap-owner-label" class="text-sm font-semibold text-primary-dark"></span>
        <button id="ap-owner-clear" class="text-xs text-slate-400 hover:text-red-500">× เปลี่ยน</button>
      </div>
      <div>
        <label class="input-label">เลือกสัตว์เลี้ยง</label>
        <select id="ap-pet-select" class="input-field" disabled>
          <option value="">— เลือกเจ้าของก่อน —</option>
        </select>
      </div>
    </div>`;

  const modal = _modal('สร้างนัดหมาย', `
    <div class="space-y-3">
      ${ownerPetSection}
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">วันที่นัด *</label>
          <input id="ap-date" class="input-field" type="date" value="${_toDateStr(new Date())}">
        </div>
        <div>
          <label class="input-label">เวลา</label>
          <input id="ap-time" class="input-field" type="time" value="09:00">
        </div>
      </div>
      <div>
        <label class="input-label">บริการ</label>
        <select id="ap-service" class="input-field">
          ${['ตรวจทั่วไป','วัคซีน','ผ่าตัด','ทำฟัน','ตรวจเลือด','ติดตามผล','อื่นๆ'].map(s =>
            `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="input-label">หมายเหตุ</label>
        <input id="ap-notes" class="input-field" placeholder="อาการเบื้องต้น...">
      </div>
    </div>`);

  // Wire up owner search if no pet pre-selected
  let _selectedOwnerId = null;
  let _selectedPetId   = pet?.id || null;

  if (!pet) {
    const ownerInput    = modal.querySelector('#ap-owner-search');
    const ownerDd       = modal.querySelector('#ap-owner-dropdown');
    const ownerBadge    = modal.querySelector('#ap-owner-badge');
    const ownerLabel    = modal.querySelector('#ap-owner-label');
    const ownerClear    = modal.querySelector('#ap-owner-clear');
    const petSelect     = modal.querySelector('#ap-pet-select');

    function _selectOwner(owner) {
      _selectedOwnerId = owner.id;
      ownerLabel.textContent = `👤 ${owner.name}${owner.phone ? ' · ' + owner.phone : ''}`;
      ownerBadge.classList.remove('hidden');
      ownerInput.parentElement.classList.add('hidden');
      ownerDd.classList.add('hidden');

      // Populate pet dropdown
      const pets = owner.pets || [];
      petSelect.innerHTML = `<option value="">— ไม่ระบุสัตว์เลี้ยง —</option>` +
        pets.map(p => `<option value="${p.id}">${SPECIES[p.species]?.emoji || '🐾'} ${p.name}</option>`).join('');
      petSelect.disabled = false;
      petSelect.addEventListener('change', () => { _selectedPetId = petSelect.value || null; });
    }

    ownerClear?.addEventListener('click', () => {
      _selectedOwnerId = null;
      _selectedPetId   = null;
      ownerBadge.classList.add('hidden');
      ownerInput.parentElement.classList.remove('hidden');
      ownerInput.value = '';
      petSelect.innerHTML = `<option value="">— เลือกเจ้าของก่อน —</option>`;
      petSelect.disabled = true;
      ownerInput.focus();
    });

    let ownerTimer;
    ownerInput?.addEventListener('input', () => {
      clearTimeout(ownerTimer);
      const q = ownerInput.value.trim();
      if (q.length < 2) { ownerDd.classList.add('hidden'); return; }
      ownerTimer = setTimeout(async () => {
        const res = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
        const owners = res?.data || [];
        if (!owners.length) {
          ownerDd.innerHTML = `<div class="px-4 py-3 text-slate-400 font-body text-sm">ไม่พบ "${q}"</div>`;
        } else {
          ownerDd.innerHTML = owners.map(o => `
            <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors"
                 data-owner-idx="${owners.indexOf(o)}">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-navy text-sm">${o.name}</div>
                <div class="text-xs text-slate-400 font-body">${o.phone || ''}${o.email ? ' · ' + o.email : ''} · สัตว์ ${(o.pets||[]).length} ตัว</div>
              </div>
            </div>`).join('');
          ownerDd.querySelectorAll('[data-owner-idx]').forEach(row => {
            row.addEventListener('click', () => _selectOwner(owners[parseInt(row.dataset.ownerIdx)]));
          });
        }
        ownerDd.classList.remove('hidden');
      }, 300);
    });
    ownerInput?.addEventListener('blur', () => setTimeout(() => ownerDd.classList.add('hidden'), 200));
  }

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const date = modal.querySelector('#ap-date').value;
    if (!date) { showToast('กรุณาเลือกวันที่', 'error'); return; }
    if (!pet && !_selectedOwnerId) { showToast('กรุณาเลือกเจ้าของ', 'error'); return; }

    const res = await apiFetch('/api/pets/appointments', {
      method: 'POST',
      body: JSON.stringify({
        store_id:     _storeId,
        pet_id:       _selectedPetId || null,
        owner_id:     _selectedOwnerId || null,
        appt_date:    date,
        appt_time:    modal.querySelector('#ap-time').value || null,
        service_type: modal.querySelector('#ap-service').value,
        notes:        modal.querySelector('#ap-notes').value.trim() || null,
      }),
    });

    if (res?.success) {
      showToast('สร้างนัดหมายแล้ว');
      modal.remove();
      const content = document.querySelector('#pets-content');
      if (content && _tab === 'appointments') await _renderAppointments(content);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

// Step 1 — ค้นหา / เลือกเจ้าของก่อน
function _openNewPetFlow(el) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-lg space-y-4">
      <h3 class="font-bold text-navy text-lg">เพิ่มสัตว์เลี้ยง — เลือกเจ้าของ</h3>
      <div>
        <label class="input-label">ค้นหาเจ้าของ (ชื่อ / เบอร์โทร / อีเมล)</label>
        <input id="os-input" class="input-field" placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร..." autofocus>
      </div>
      <div id="os-results" class="space-y-2 max-h-64 overflow-y-auto">
        <p class="text-sm text-slate-400 font-body text-center py-6">พิมพ์เพื่อค้นหาเจ้าของ</p>
      </div>
      <div class="border-t border-slate-100 pt-3 flex gap-3">
        <button id="os-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="os-create-owner" class="btn-primary flex-1">+ สร้างเจ้าของใหม่</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#os-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#os-create-owner').addEventListener('click', () => {
    modal.remove();
    _openCreateOwnerThenPet(el);
  });

  let timer;
  modal.querySelector('#os-input').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = e.target.value.trim();
      const resultsEl = modal.querySelector('#os-results');
      if (q.length < 2) {
        resultsEl.innerHTML = `<p class="text-sm text-slate-400 font-body text-center py-6">พิมพ์อย่างน้อย 2 ตัวอักษร</p>`;
        return;
      }
      resultsEl.innerHTML = `<div class="text-center py-4 text-slate-400 font-body text-sm animate-pulse">กำลังค้นหา...</div>`;
      const res    = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
      const owners = res?.data || [];
      if (!owners.length) {
        resultsEl.innerHTML = `<p class="text-sm text-slate-400 font-body text-center py-6">ไม่พบ "${q}" — กด "สร้างเจ้าของใหม่"</p>`;
        return;
      }
      resultsEl.innerHTML = owners.map(o => `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-subtle transition-colors cursor-pointer border border-slate-100"
             data-oid="${o.id}" data-oname="${o.name}" data-ophone="${o.phone || ''}" data-oemail="${o.email || ''}">
          <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">👤</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-navy text-sm">${o.name}</div>
            <div class="text-xs text-slate-500 font-body">
              ${o.phone || ''}${o.email ? ` · ${o.email}` : ''} · สัตว์ ${o.pets?.length || 0} ตัว
            </div>
          </div>
          <span class="text-xs bg-primary text-white px-3 py-1.5 rounded-lg flex-shrink-0">เลือก →</span>
        </div>`).join('');

      resultsEl.querySelectorAll('[data-oid]').forEach(row => {
        row.addEventListener('click', () => {
          modal.remove();
          _openAddPetModal(el, {
            id:    row.dataset.oid,
            name:  row.dataset.oname,
            phone: row.dataset.ophone,
            email: row.dataset.oemail,
          });
        });
      });
    }, 350);
  });
}

// Step 1b — สร้างเจ้าของใหม่ก่อน แล้วต่อที่ฟอร์มสัตว์เลี้ยง
function _openCreateOwnerThenPet(el, prefillName = '') {
  const modal = _modal('สร้างเจ้าของใหม่', `
    <div class="space-y-3">
      <div>
        <label class="input-label">ชื่อ-นามสกุล *</label>
        <input id="co-name" class="input-field" value="${prefillName}" placeholder="คุณสมชาย ใจดี">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">เบอร์โทร</label>
          <input id="co-phone" class="input-field" placeholder="0812345678" type="tel">
        </div>
        <div>
          <label class="input-label">อีเมล</label>
          <input id="co-email" class="input-field" type="email" placeholder="somchai@email.com">
        </div>
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#co-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/pets/owners', {
      method: 'POST',
      body: JSON.stringify({
        name,
        phone: modal.querySelector('#co-phone').value.trim() || null,
        email: modal.querySelector('#co-email').value.trim() || null,
        store_id: _storeId,
      }),
    });
    if (!res?.success) {
      showToast(res?.error || 'สร้างเจ้าของไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
      return;
    }
    modal.remove();
    showToast(`เพิ่มเจ้าของ ${name} แล้ว`);
    _openAddPetModal(el, res.data);
  });
}

function _attachBreedAutocomplete(modal) {
  const input   = modal.querySelector('#ap-breed');
  const species = modal.querySelector('#ap-species');
  if (!input || !species) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'absolute left-0 right-0 top-full z-[60] bg-white border border-slate-200 rounded-xl shadow-card-hover max-h-44 overflow-y-auto hidden mt-1';
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);

  function render(q) {
    const list    = BREEDS[species.value] || [];
    const matches = list
      .filter(b => !q || b.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
    if (!matches.length) { dropdown.classList.add('hidden'); return; }
    dropdown.innerHTML = matches.map(b =>
      `<div class="px-3 py-2 text-sm cursor-pointer hover:bg-primary-subtle font-body text-navy transition-colors" data-breed="${b}">${b}</div>`
    ).join('');
    dropdown.classList.remove('hidden');
  }

  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('blur',  () => setTimeout(() => dropdown.classList.add('hidden'), 150));

  dropdown.addEventListener('mousedown', (e) => {
    const item = e.target.closest('[data-breed]');
    if (!item) return;
    input.value = item.dataset.breed;
    dropdown.classList.add('hidden');
  });

  species.addEventListener('change', () => {
    input.value = '';
    dropdown.classList.add('hidden');
  });
}

// Step 2 — ฟอร์มสัตว์เลี้ยง โดยมีเจ้าของที่เลือกไว้แสดงด้านบน
function _openAddPetModal(el, owner) {
  const modal = _modal('เพิ่มสัตว์เลี้ยง', `
    <div class="space-y-4">
      <!-- Owner badge (read-only) -->
      <div class="bg-primary-subtle rounded-xl px-4 py-3 flex items-center gap-3">
        <span class="text-xl">👤</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-primary-dark text-sm">${owner.name}</div>
          ${(owner.phone || owner.email) ? `<div class="text-xs text-slate-500 font-body">${owner.phone || ''}${owner.email ? (owner.phone ? ' · ' : '') + owner.email : ''}</div>` : ''}
        </div>
        <span class="text-xs text-slate-400 font-body">เจ้าของ</span>
      </div>
      <!-- Pet fields -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="ap-name" class="input-field" placeholder="บัดดี้">
        </div>
        <div>
          <label class="input-label">ชนิด</label>
          <select id="ap-species" class="input-field">
            ${Object.entries(SPECIES).map(([k,v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">สายพันธุ์</label>
          <input id="ap-breed" class="input-field" placeholder="โกลเด้น รีทรีฟเวอร์">
        </div>
        <div>
          <label class="input-label">เพศ</label>
          <select id="ap-gender" class="input-field">
            <option value="unknown">ไม่ระบุ</option>
            <option value="male">เพศผู้ ♂</option>
            <option value="female">เพศเมีย ♀</option>
          </select>
        </div>
        <div>
          <label class="input-label">วันเกิด</label>
          <input id="ap-dob" class="input-field" type="date">
        </div>
        <div>
          <label class="input-label">น้ำหนัก (kg)</label>
          <input id="ap-weight" class="input-field" type="number" step="0.1" placeholder="5.2">
        </div>
        <div>
          <label class="input-label">สีและตำหนิ</label>
          <input id="ap-color" class="input-field" placeholder="สีน้ำตาล ดาวที่หน้าผาก">
        </div>
        <div>
          <label class="input-label">เลขไมโครชิป</label>
          <input id="ap-microchip" class="input-field" placeholder="900123456789012">
        </div>
      </div>
      <div class="flex items-center gap-3">
        <input id="ap-neutered" type="checkbox" class="w-4 h-4 accent-primary">
        <label for="ap-neutered" class="text-sm font-body text-navy cursor-pointer">ทำหมันแล้ว</label>
      </div>
      <div>
        <label class="input-label">แพ้ยา / อาหาร</label>
        <input id="ap-allergies" class="input-field" placeholder="ถ้าไม่มีให้เว้นว่าง">
      </div>
    </div>`);

  _attachBreedAutocomplete(modal);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const petName = modal.querySelector('#ap-name').value.trim();
    if (!petName) { showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error'); return; }
    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const petRes = await apiFetch('/api/pets', {
      method: 'POST',
      body: JSON.stringify({
        owner_id:     owner.id,
        store_id:     _storeId,
        name:         petName,
        species:      modal.querySelector('#ap-species').value,
        breed:        modal.querySelector('#ap-breed').value.trim()       || null,
        dob:          modal.querySelector('#ap-dob').value                || null,
        gender:       modal.querySelector('#ap-gender').value,
        weight_kg:    parseFloat(modal.querySelector('#ap-weight').value) || null,
        color:        modal.querySelector('#ap-color').value.trim()       || null,
        microchip_no: modal.querySelector('#ap-microchip').value.trim()  || null,
        is_neutered:  modal.querySelector('#ap-neutered').checked,
        allergies:    modal.querySelector('#ap-allergies').value.trim()   || null,
      }),
    });

    if (!petRes?.success) {
      showToast(petRes?.error || 'สร้างข้อมูลสัตว์เลี้ยงไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
      return;
    }
    const hn = _hn(petRes.data);
    showToast(`เพิ่ม ${petName} แล้ว${hn ? ` · ${hn}` : ''}`);
    modal.remove();
    await _renderPetsList(el);
  });
}

function _openOwnerModal(el) {
  const modal = _modal('เพิ่มเจ้าของสัตว์เลี้ยง', `
    <div class="space-y-3">
      <div>
        <label class="input-label">ชื่อ-นามสกุล *</label>
        <input id="ow-name" class="input-field" placeholder="คุณสมชาย ใจดี">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">เบอร์โทร</label>
          <input id="ow-phone" class="input-field" placeholder="0812345678" type="tel">
        </div>
        <div>
          <label class="input-label">Line ID</label>
          <input id="ow-line" class="input-field" placeholder="@somchai">
        </div>
      </div>
      <div>
        <label class="input-label">อีเมล</label>
        <input id="ow-email" class="input-field" type="email" placeholder="somchai@email.com">
      </div>
      <div>
        <label class="input-label">ที่อยู่</label>
        <input id="ow-address" class="input-field" placeholder="บ้านเลขที่...">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#ow-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }

    const res = await apiFetch('/api/pets/owners', {
      method: 'POST',
      body: JSON.stringify({
        name,
        phone:    modal.querySelector('#ow-phone').value.trim()   || null,
        line_id:  modal.querySelector('#ow-line').value.trim()    || null,
        email:    modal.querySelector('#ow-email').value.trim()   || null,
        address:  modal.querySelector('#ow-address').value.trim() || null,
        store_id: _storeId,
      }),
    });

    if (res?.success) {
      showToast(`เพิ่ม ${name} แล้ว`);
      modal.remove();
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function _openVaccineModal(pet, container) {
  const modal = _modal(`บันทึกวัคซีน — ${pet.name}`, `
    <div class="space-y-3">
      <div>
        <label class="input-label">ชื่อวัคซีน *</label>
        <select id="vax-name" class="input-field">
          ${['DHPPL 5 โรค','พิษสุนัขบ้า','Bordetella','Lepto','FVRCP (แมว 3 โรค)','FeLV (มะเร็งแมว)','อื่นๆ'].map(v =>
            `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">วันที่ฉีด *</label>
          <input id="vax-date" class="input-field" type="date" value="${_toDateStr(new Date())}">
        </div>
        <div>
          <label class="input-label">นัดฉีดครั้งหน้า</label>
          <input id="vax-next" class="input-field" type="date">
        </div>
      </div>
      <div>
        <label class="input-label">Batch / Lot Number</label>
        <input id="vax-lot" class="input-field" placeholder="LOT-2026-001">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#vax-name').value;
    const date = modal.querySelector('#vax-date').value;
    if (!date) { showToast('กรุณาเลือกวันที่', 'error'); return; }

    const res = await apiFetch('/api/pets/vaccinations', {
      method: 'POST',
      body: JSON.stringify({
        pet_id:        pet.id,
        store_id:      _storeId,
        vaccine_name:  name,
        given_date:    date,
        next_due_date: modal.querySelector('#vax-next').value || null,
        batch_no:      modal.querySelector('#vax-lot').value.trim() || null,
        vet_name:      storage.getJSON(STORAGE_KEYS.USER)?.email || null,
      }),
    });

    if (res?.success) {
      showToast(`บันทึกวัคซีน ${name} แล้ว`);
      modal.remove();
      // Refresh profile
      const updated = await apiFetch(`/api/pets/${pet.id}`);
      if (updated?.success) renderPetProfile(container, updated.data);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _hn(pet) {
  return pet?.hn ? formatHN(pet.hn, pet.created_at) : '';
}

function _calcAge(dob) {
  const diff  = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (365.25 * 86400000));
  if (years >= 1) return `${years} ปี`;
  const months = Math.floor(diff / (30.44 * 86400000));
  return `${months} เดือน`;
}

function _modal(title, bodyHTML) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">${title}</h3>
      <div>${bodyHTML}</div>
      <div class="flex gap-3 pt-2">
        <button id="modal-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="modal-confirm" class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  return modal;
}
