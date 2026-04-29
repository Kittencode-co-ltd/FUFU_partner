import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const SPECIES = {
  dog:    { label: 'สุนัข',      emoji: '🐕' },
  cat:    { label: 'แมว',        emoji: '🐈' },
  rabbit: { label: 'กระต่าย',   emoji: '🐰' },
  bird:   { label: 'นก',         emoji: '🐦' },
  other:  { label: 'อื่นๆ',      emoji: '🐾' },
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
  return `
    <div class="space-y-4 max-w-5xl">
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        ${[
          { id: 'appointments', label: '📅 นัดหมาย' },
          { id: 'pets',         label: '🐾 สัตว์เลี้ยง' },
          { id: 'owners',       label: '👤 เจ้าของ' },
        ].map(t => `
          <button data-tab="${t.id}"
            class="tab-btn px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                   ${t.id === 'appointments' ? 'bg-white text-navy shadow-card' : 'text-slate-500 hover:text-navy'}">
            ${t.label}
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

// ─── Appointments Tab ─────────────────────────────────────────────────────────

async function _renderAppointments(el) {
  const today    = new Date().toISOString().split('T')[0];
  const in7days  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  el.innerHTML = `<div class="text-center py-10 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const res  = await apiFetch(`/api/pets/appointments/list?store_id=${_storeId}&from=${today}&to=${in7days}`);
  const appts = res?.data || [];

  el.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-navy">นัดหมาย 7 วันข้างหน้า</h3>
          <p class="text-xs text-slate-400 font-body mt-0.5">${today} — ${in7days}</p>
        </div>
        <button id="new-appt-btn" class="btn-primary text-sm px-4 py-2">+ นัดหมายใหม่</button>
      </div>

      <!-- Today section -->
      ${_apptSection('📅 วันนี้', appts.filter(a => a.appt_date === today), el)}

      <!-- Upcoming section -->
      ${_apptSection('📆 ที่กำลังจะมา', appts.filter(a => a.appt_date > today), el)}

      ${appts.length === 0 ? `<div class="card p-10 text-center text-slate-400 font-body">ไม่มีนัดหมายใน 7 วันข้างหน้า</div>` : ''}
    </div>`;

  el.querySelector('#new-appt-btn')?.addEventListener('click', () => _openApptModal(el));
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-appt-action]');
    if (!btn) return;
    const id = btn.dataset.apptId;
    if (btn.dataset.apptAction === 'checkin') _checkin(id, el);
    if (btn.dataset.apptAction === 'cancel')  _cancelAppt(id, el);
    if (btn.dataset.apptAction === 'view')    _viewPet(btn.dataset.petId);
  });
}

function _apptSection(title, appts, el) {
  if (!appts.length) return '';
  return `
    <div>
      <h4 class="text-sm font-semibold text-slate-500 mb-2">${title} (${appts.length})</h4>
      <div class="space-y-2">
        ${appts.map(a => _apptCard(a)).join('')}
      </div>
    </div>`;
}

function _apptCard(a) {
  const pet     = a.pets;
  const owner   = pet?.pet_owners;
  const sp      = SPECIES[pet?.species] || SPECIES.other;
  const cfg     = APPT_STATUS[a.status] || APPT_STATUS.scheduled;
  const time    = a.appt_time ? a.appt_time.substring(0, 5) : '—';
  const isToday = a.appt_date === new Date().toISOString().split('T')[0];
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
  const res = await apiFetch(`/api/pets/appointments/${apptId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
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
        <input id="pet-search" class="input-field flex-1" placeholder="🔍 ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์โทร">
        <button id="new-pet-btn" class="btn-primary text-sm px-4 py-2 whitespace-nowrap">+ สัตว์เลี้ยงใหม่</button>
      </div>
      <div id="pet-search-results" class="space-y-2">
        <p class="text-center text-slate-400 font-body text-sm py-8">พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา</p>
      </div>
    </div>`;

  let searchTimer;
  el.querySelector('#pet-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => _searchPets(e.target.value, el), 400);
  });

  el.querySelector('#new-pet-btn')?.addEventListener('click', () => _openNewPetFlow(el));
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pet-id]');
    if (btn) _viewPet(btn.dataset.petId);
  });
}

async function _searchPets(q, el) {
  const resultsEl = el.querySelector('#pet-search-results');
  if (!q || q.length < 2) {
    resultsEl.innerHTML = `<p class="text-center text-slate-400 font-body text-sm py-8">พิมพ์อย่างน้อย 2 ตัวอักษร</p>`;
    return;
  }

  resultsEl.innerHTML = `<div class="text-center py-4 text-slate-400 font-body animate-pulse">กำลังค้นหา...</div>`;
  const res = await apiFetch(`/api/pets/owners/search?q=${encodeURIComponent(q)}`);
  const owners = res?.data || [];

  if (!owners.length) {
    resultsEl.innerHTML = `
      <div class="card p-6 text-center space-y-3">
        <p class="text-slate-500 font-body">ไม่พบ "${q}"</p>
        <button id="create-new-btn" class="btn-primary text-sm px-4 py-2">+ สร้างเจ้าของใหม่</button>
      </div>`;
    resultsEl.querySelector('#create-new-btn')?.addEventListener('click', () => _openNewPetFlow(el, q));
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
             <div class="flex items-center gap-2">
               <span class="font-semibold text-navy">${pet.name}</span>
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
    <div class="space-y-4 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="card p-5 flex items-center gap-4">
        <div class="w-16 h-16 rounded-xl bg-primary-subtle flex items-center justify-center text-3xl flex-shrink-0">
          ${sp.emoji}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-bold text-navy text-xl">${pet.name}</h2>
            <span class="badge badge-teal text-xs">${sp.label}</span>
            ${pet.breed ? `<span class="badge badge-navy text-xs">${pet.breed}</span>` : ''}
            ${pet.is_neutered ? `<span class="badge bg-purple-50 text-purple-600 text-xs">ทำหมันแล้ว</span>` : ''}
          </div>
          <div class="text-sm text-slate-500 font-body mt-1">
            ${age ? `อายุ ${age} · ` : ''}${pet.gender === 'male' ? 'เพศผู้' : pet.gender === 'female' ? 'เพศเมีย' : ''}
            ${pet.color ? ` · สี${pet.color}` : ''}
            ${pet.weight_kg ? ` · น้ำหนัก ${pet.weight_kg} kg` : ''}
          </div>
          ${pet.allergies ? `<div class="text-xs text-red-500 font-body mt-1">⚠️ แพ้: ${pet.allergies}</div>` : ''}
        </div>
        <div class="flex-shrink-0 flex gap-2">
          <button id="profile-back" class="btn-outline text-sm px-3 py-2">← กลับ</button>
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

      <div id="profile-tab-content">
        ${_renderHistory(pet.medical_records || [])}
      </div>
    </div>`;

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
      if (btn.dataset.profileTab === 'history')      tc.innerHTML = _renderHistory(pet.medical_records || []);
      if (btn.dataset.profileTab === 'vaccines')     tc.innerHTML = _renderVaccines(pet.vaccinations || [], pet.id);
      if (btn.dataset.profileTab === 'appointments') tc.innerHTML = _renderPetAppts(pet.appointments || []);
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

function _renderHistory(records) {
  if (!records.length) return `<div class="card p-8 text-center text-slate-400 font-body">ยังไม่มีประวัติการรักษา</div>`;
  return `<div class="space-y-2">
    ${records.map(r => `
      <div class="card p-4 cursor-pointer hover:shadow-card-hover transition-shadow"
           onclick="document.dispatchEvent(new CustomEvent('fufu:openOPD',{detail:{_existingRecord:${JSON.stringify(r).replace(/"/g,'&quot;')}}}))" >
        <div class="flex items-center gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-navy text-sm">${r.visit_date || '—'}</span>
              <span class="badge ${r.status==='completed' ? 'badge-teal' : 'bg-blue-50 text-blue-600'} text-xs">
                ${r.status==='completed' ? 'เสร็จสิ้น' : 'กำลังรักษา'}
              </span>
            </div>
            <div class="text-sm text-slate-500 font-body mt-0.5">
              ${r.assessment || r.diagnosis || '—'}
            </div>
          </div>
          ${r.weight_kg ? `<span class="badge badge-navy text-xs">⚖ ${r.weight_kg}kg</span>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

function _renderVaccines(vaccines, petId) {
  return `
    <div class="space-y-3">
      <div class="flex justify-end">
        <button id="add-vaccine-btn" class="btn-primary text-sm px-4 py-2">+ บันทึกวัคซีน</button>
      </div>
      ${!vaccines.length
        ? `<div class="card p-8 text-center text-slate-400 font-body">ยังไม่มีประวัติวัคซีน</div>`
        : vaccines.map(v => `
            <div class="card p-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-semibold text-navy">💉 ${v.vaccine_name}</span>
                  ${v.batch_no ? `<span class="text-xs text-slate-400 ml-2 font-body">Lot: ${v.batch_no}</span>` : ''}
                </div>
                <div class="text-right text-xs font-body">
                  <div class="text-slate-500">ฉีดวันที่ ${v.given_date}</div>
                  ${v.next_due_date ? `<div class="text-primary font-semibold">นัดครั้งหน้า: ${v.next_due_date}</div>` : ''}
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
        <p class="text-center text-slate-400 font-body text-sm py-8">พิมพ์เพื่อค้นหา</p>
      </div>
    </div>`;

  let timer;
  el.querySelector('#owner-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = e.target.value.trim();
      if (q.length < 2) return;
      const res = await apiFetch(`/api/pets/owners/search?q=${encodeURIComponent(q)}`);
      const owners = res?.data || [];
      const resultsEl = el.querySelector('#owner-results');
      if (!owners.length) {
        resultsEl.innerHTML = `<div class="card p-6 text-center text-slate-400 font-body">ไม่พบ "${q}"</div>`;
        return;
      }
      resultsEl.innerHTML = owners.map(o => `
        <div class="card p-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">👤</div>
          <div class="flex-1">
            <div class="font-semibold text-navy">${o.name}</div>
            <div class="text-sm text-slate-500 font-body">
              ${o.phone || ''}${o.email ? ` · ${o.email}` : ''}
              · สัตว์เลี้ยง ${o.pets?.length || 0} ตัว
            </div>
          </div>
        </div>`).join('');
    }, 400);
  });

  el.querySelector('#new-owner-btn')?.addEventListener('click', () => _openOwnerModal(el));
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function _openApptModal(el, pet = null) {
  const modal = _modal('สร้างนัดหมาย', `
    <div class="space-y-3">
      ${pet ? `<div class="bg-primary-subtle rounded-lg px-4 py-2 text-sm text-primary-dark font-semibold">
        🐾 ${pet.name} · เจ้าของ: ${pet.pet_owners?.name || '—'}</div>` : ''}
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">วันที่นัด *</label>
          <input id="ap-date" class="input-field" type="date" value="${new Date().toISOString().split('T')[0]}">
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

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const date = modal.querySelector('#ap-date').value;
    if (!date) { showToast('กรุณาเลือกวันที่', 'error'); return; }

    const res = await apiFetch('/api/pets/appointments', {
      method: 'POST',
      body: JSON.stringify({
        store_id:     _storeId,
        pet_id:       pet?.id || null,
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

function _openNewPetFlow(el, prefillName = '') {
  const modal = _modal('เพิ่มสัตว์เลี้ยงใหม่', `
    <div class="space-y-4">
      <p class="text-sm text-slate-500 font-body">ขั้นตอนที่ 1: ข้อมูลเจ้าของ</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="input-label">ชื่อเจ้าของ *</label>
          <input id="nf-owner-name" class="input-field" value="${prefillName}" placeholder="คุณสมชาย">
        </div>
        <div>
          <label class="input-label">เบอร์โทร</label>
          <input id="nf-phone" class="input-field" placeholder="0812345678" type="tel">
        </div>
        <div>
          <label class="input-label">Line ID</label>
          <input id="nf-line" class="input-field" placeholder="@somchai">
        </div>
      </div>
      <hr class="border-slate-100">
      <p class="text-sm text-slate-500 font-body">ขั้นตอนที่ 2: ข้อมูลสัตว์เลี้ยง</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="nf-pet-name" class="input-field" placeholder="บัดดี้">
        </div>
        <div>
          <label class="input-label">ชนิด</label>
          <select id="nf-species" class="input-field">
            ${Object.entries(SPECIES).map(([k,v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">สายพันธุ์</label>
          <input id="nf-breed" class="input-field" placeholder="โกลเด้น รีทรีฟเวอร์">
        </div>
        <div>
          <label class="input-label">วันเกิด</label>
          <input id="nf-dob" class="input-field" type="date">
        </div>
        <div>
          <label class="input-label">เพศ</label>
          <select id="nf-gender" class="input-field">
            <option value="unknown">ไม่ระบุ</option>
            <option value="male">เพศผู้</option>
            <option value="female">เพศเมีย</option>
          </select>
        </div>
        <div>
          <label class="input-label">น้ำหนัก (kg)</label>
          <input id="nf-weight" class="input-field" type="number" step="0.1" placeholder="5.2">
        </div>
      </div>
      <div>
        <label class="input-label">แพ้ยา / อาหาร</label>
        <input id="nf-allergies" class="input-field" placeholder="ถ้าไม่มีให้เว้นว่าง">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const ownerName = modal.querySelector('#nf-owner-name').value.trim();
    const petName   = modal.querySelector('#nf-pet-name').value.trim();
    if (!ownerName || !petName) { showToast('กรุณากรอกชื่อเจ้าของและชื่อสัตว์เลี้ยง', 'error'); return; }

    const btn = modal.querySelector('#modal-confirm');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    // Create owner first
    const ownerRes = await apiFetch('/api/pets/owners', {
      method: 'POST',
      body: JSON.stringify({
        name:    ownerName,
        phone:   modal.querySelector('#nf-phone').value.trim() || null,
        line_id: modal.querySelector('#nf-line').value.trim()  || null,
      }),
    });

    if (!ownerRes?.success) { showToast(ownerRes?.error || 'สร้างเจ้าของไม่สำเร็จ', 'error'); btn.disabled = false; return; }

    // Create pet
    const petRes = await apiFetch('/api/pets', {
      method: 'POST',
      body: JSON.stringify({
        owner_id:   ownerRes.data.id,
        name:       petName,
        species:    modal.querySelector('#nf-species').value,
        breed:      modal.querySelector('#nf-breed').value.trim()  || null,
        dob:        modal.querySelector('#nf-dob').value           || null,
        gender:     modal.querySelector('#nf-gender').value,
        weight_kg:  parseFloat(modal.querySelector('#nf-weight').value) || null,
        allergies:  modal.querySelector('#nf-allergies').value.trim() || null,
      }),
    });

    if (!petRes?.success) { showToast(petRes?.error || 'สร้างข้อมูลสัตว์เลี้ยงไม่สำเร็จ', 'error'); btn.disabled = false; return; }

    showToast(`เพิ่ม ${petName} เรียบร้อย`);
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
        phone:   modal.querySelector('#ow-phone').value.trim()   || null,
        line_id: modal.querySelector('#ow-line').value.trim()    || null,
        email:   modal.querySelector('#ow-email').value.trim()   || null,
        address: modal.querySelector('#ow-address').value.trim() || null,
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
          <input id="vax-date" class="input-field" type="date" value="${new Date().toISOString().split('T')[0]}">
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
