import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { logAudit }  from './audit.js';
import { formatThaiDateTimeShort } from '../utils/formatters.js';
import { printDischargeSummary } from '../utils/print-docs.js';

let _storeId = '';
let _settingsMode = false;

const STATUS_CFG = {
  available:   { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  icon: 'fa-door-open', label: 'ว่าง'    },
  occupied:    { color: '#F97316', bg: 'rgba(249,115,22,0.10)',  icon: 'fa-paw',       label: 'มีผู้ป่วย' },
  maintenance: { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: 'fa-wrench',    label: 'ซ่อม'    },
  reserved:    { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  icon: 'fa-clock',     label: 'จอง'     },
};
const TYPE_ICON    = { standard: '🏠', large: '🏡', icu: '🏥', isolation: '⚠️' };
const VITALS_NORMAL = {
  temperature:      { min: 37.5, max: 39.2, unit: '°C',   icon: '🌡' },
  heart_rate:       { min: 60,   max: 140,  unit: 'bpm',  icon: '❤' },
  respiratory_rate: { min: 10,   max: 30,   unit: '/min', icon: '🫁' },
  weight_kg:        { min: null, max: null,  unit: 'kg',   icon: '⚖' },
};
const SPECIES_OPTS = [
  { v: 'dog',    l: '🐕 สุนัข' }, { v: 'cat',    l: '🐈 แมว' },
  { v: 'rabbit', l: '🐰 กระต่าย' }, { v: 'bird', l: '🐦 นก' },
  { v: 'other',  l: '🐾 อื่นๆ' },
];

export async function renderIPDWard(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
}

// ─── Main render ──────────────────────────────────────────────────────────────

async function _render(container) {
  const staffRole = storage.get(STORAGE_KEYS.STAFF_ROLE);
  const canSettings = staffRole === 'owner' || staffRole === 'vet';

  const [cagesRes, admRes] = await Promise.all([
    apiFetch(`/api/ipd/cages?store_id=${_storeId}`),
    apiFetch(`/api/ipd/admissions?store_id=${_storeId}&status=admitted`),
  ]);

  let cages      = cagesRes?.data || [];
  const admitted = admRes?.data   || [];

  const admMap = {};
  admitted.forEach(a => { if (a.cage_id) admMap[a.cage_id] = a; });
  cages = cages.map(c => ({
    ...c,
    current_admission: admMap[c.id] || null,
    status: admMap[c.id] ? 'occupied' : c.status,
  }));

  const stats = {
    total:    cages.length,
    occupied: cages.filter(c => c.status === 'occupied').length,
    available:cages.filter(c => c.status === 'available').length,
    icu:      cages.filter(c => c.cage_type === 'icu' && c.status === 'occupied').length,
  };

  container.innerHTML = `
    <div class="space-y-4">
      ${_settingsMode ? `
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-body"
           style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D">
        ⚙️ โหมดตั้งค่ากรง — กดปุ่มอีกครั้งเพื่อออก
      </div>` : ''}

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        ${[
          { val: stats.total,     label: 'กรงทั้งหมด', color: '#1E293B' },
          { val: stats.occupied,  label: 'มีผู้ป่วย',  color: '#F97316' },
          { val: stats.available, label: 'ว่าง',        color: '#0D9488' },
          { val: stats.icu,       label: 'ICU',          color: '#EF4444' },
        ].map(s => `
          <div class="card p-4 text-center">
            <div class="text-2xl font-bold" style="color:${s.color}">${s.val}</div>
            <div class="text-xs text-slate-400 font-body mt-1">${s.label}</div>
          </div>`).join('')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Cage map -->
        <div class="md:col-span-1 lg:col-span-3 card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-navy">🏥 แผนผัง Ward</h3>
            <div class="flex items-center gap-3">
              <div class="hidden sm:flex flex-wrap gap-2">
                ${Object.entries(STATUS_CFG).map(([, v]) => `
                  <span class="text-xs flex items-center gap-1 font-body" style="color:${v.color}">
                    <i class="fas ${v.icon} text-xs"></i>${v.label}
                  </span>`).join('')}
              </div>
              ${canSettings ? `
              <button id="settings-mode-btn"
                class="text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors
                       ${_settingsMode
                         ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                         : 'border border-slate-300 text-slate-500 hover:border-primary hover:text-primary'}">
                ${_settingsMode ? '✓ ออกจากตั้งค่า' : '⚙️ ตั้งค่ากรง'}
              </button>` : ''}
              <button id="add-cage-btn"
                class="text-xs border border-primary text-primary px-3 py-1.5 rounded-lg
                       hover:bg-primary-subtle transition-colors font-semibold whitespace-nowrap
                       ${_settingsMode ? '' : 'hidden'}">
                + เพิ่มกรง
              </button>
            </div>
          </div>
          ${cages.length === 0
            ? `<div class="py-16 text-center text-slate-400 font-body text-sm">
                ยังไม่มีกรง — กด "+ เพิ่มกรง" เพื่อเริ่มต้น
               </div>`
            : `<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" id="cage-grid">
                ${cages.map(_cageCard).join('')}
               </div>`}
        </div>

        <!-- Detail panel -->
        <div class="md:col-span-1 lg:col-span-2 card p-4 min-h-48 md:min-h-64" id="ipd-detail">
          <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400">
            <i class="fas fa-hand-pointer text-4xl mb-3 opacity-40"></i>
            <div class="font-body text-sm">คลิกที่กรงเพื่อดูข้อมูล<br>และ Treatment Sheet</div>
          </div>
        </div>
      </div>
    </div>`;

  container.querySelector('#settings-mode-btn')?.addEventListener('click', () => {
    _settingsMode = !_settingsMode;
    _render(container);
  });

  container.querySelector('#add-cage-btn')?.addEventListener('click', () => _openAddCageModal(container));

  const grid = container.querySelector('#cage-grid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    // Edit/delete buttons
    const editBtn   = e.target.closest('[data-edit-cage]');
    const deleteBtn = e.target.closest('[data-delete-cage]');
    if (editBtn)   { e.stopPropagation(); const c = cages.find(x => x.id === editBtn.dataset.editCage);   if (c) _openEditCageModal(c, container); return; }
    if (deleteBtn) { e.stopPropagation(); const c = cages.find(x => x.id === deleteBtn.dataset.deleteCage); if (c) _deleteCage(c, container); return; }

    // Cage card click
    const card = e.target.closest('.cage-card');
    if (!card) return;
    grid.querySelectorAll('.cage-card').forEach(c => c.style.outline = '');
    card.style.outline = '2px solid #0D9488';
    const cage = cages.find(c => c.id === card.dataset.cageId);
    if (cage) _renderDetail(cage, container);
  });
}

// ─── Cage card ────────────────────────────────────────────────────────────────

function _cageCard(cage) {
  const cfg   = STATUS_CFG[cage.status] || STATUS_CFG.available;
  const adm   = cage.current_admission;
  const isOcc = cage.status === 'occupied';

  return `
    <div class="cage-card rounded-xl p-3 cursor-pointer transition-all hover:shadow-md border-2 border-transparent"
         data-cage-id="${cage.id}" style="background:${cfg.bg}">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-bold text-navy truncate mr-1">${TYPE_ICON[cage.cage_type] || '🏠'} ${cage.cage_number}</span>
        <div class="flex items-center gap-0.5 flex-shrink-0">
          <button data-edit-cage="${cage.id}"
            class="w-6 h-6 flex items-center justify-center rounded-md bg-white/80 text-slate-400
                   hover:text-primary hover:bg-white transition-colors shadow-sm
                   ${_settingsMode ? '' : 'hidden'}"
            title="แก้ไขกรง">
            <i class="fas fa-pen text-[10px]"></i>
          </button>
          ${!isOcc ? `<button data-delete-cage="${cage.id}"
            class="w-6 h-6 flex items-center justify-center rounded-md bg-white/80 text-slate-400
                   hover:text-red-500 hover:bg-white transition-colors shadow-sm
                   ${_settingsMode ? '' : 'hidden'}"
            title="ลบกรง">
            <i class="fas fa-trash text-[10px]"></i>
          </button>` : ''}
          <span class="w-2.5 h-2.5 rounded-full ml-1 flex-shrink-0" style="background:${cfg.color}"></span>
        </div>
      </div>
      ${adm ? `
        <div class="text-xs font-semibold text-navy truncate">${adm.pet_name}</div>
        <div class="text-xs text-slate-500 font-body truncate">${adm.owner_name || ''}</div>
        <div class="text-xs text-slate-400 font-body mt-1">${_timeSince(adm.admitted_at)}</div>
      ` : `
        <div class="text-xs text-slate-400 font-body flex items-center gap-1 mt-1">
          <i class="fas ${cfg.icon} text-xs"></i>${cfg.label}
        </div>
      `}
      <div class="text-xs font-semibold text-primary mt-1.5">฿${(cage.daily_rate||0).toLocaleString()}/วัน</div>
    </div>`;
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

async function _renderDetail(cage, container) {
  const panel = container.querySelector('#ipd-detail');
  if (!panel) return;
  logAudit('view_sensitive', 'ipd_cage', cage.id, null, null, `เปิดดูกรง ${cage.cage_number}`);

  // ── Empty cage ──
  if (cage.status !== 'occupied' || !cage.current_admission) {
    panel.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-2">
          <div class="text-3xl">${TYPE_ICON[cage.cage_type] || '🏠'}</div>
          <div class="font-semibold text-navy">กรง ${cage.cage_number}</div>
          <div class="text-xs text-slate-400 font-body">
            ${STATUS_CFG[cage.status]?.label || ''} · ฿${(cage.daily_rate||0).toLocaleString()}/วัน
            · ชั้น ${cage.floor || 1}
          </div>
          ${cage.status === 'available' ? `
            <button id="admit-btn" class="btn-primary text-sm px-4 py-2 mt-2">+ รับสัตว์เข้ากรง</button>` : `
            <div class="text-xs text-slate-400 font-body mt-2">${STATUS_CFG[cage.status]?.label}</div>`}
        </div>
        <div class="border-t border-slate-100 pt-3 flex gap-2 justify-center">
          <button id="detail-edit-cage-btn"
            class="text-xs border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg
                   hover:border-primary hover:text-primary transition-colors font-semibold">
            <i class="fas fa-pen mr-1"></i>แก้ไขข้อมูลกรง
          </button>
          <button id="detail-delete-cage-btn"
            class="text-xs border border-red-200 text-red-400 px-3 py-1.5 rounded-lg
                   hover:bg-red-50 hover:text-red-500 transition-colors font-semibold">
            <i class="fas fa-trash mr-1"></i>ลบกรง
          </button>
        </div>
      </div>`;
    panel.querySelector('#admit-btn')?.addEventListener('click', () => _openAdmitModal(cage, container));
    panel.querySelector('#detail-edit-cage-btn')?.addEventListener('click', () => _openEditCageModal(cage, container));
    panel.querySelector('#detail-delete-cage-btn')?.addEventListener('click', () => _deleteCage(cage, container));
    return;
  }

  // ── Occupied cage ──
  const adm        = cage.current_admission;
  const treatRes   = await apiFetch(`/api/ipd/treatments/${adm.id}`);
  const treatments = treatRes?.data || [];
  const done       = treatments.filter(t => t.status === 'done').length;
  const belongings = Array.isArray(adm.belongings_log) ? adm.belongings_log : [];

  // Calculate cost so far
  const hrs   = Math.max(1, Math.ceil((Date.now() - new Date(adm.admitted_at)) / 3600000));
  const days  = Math.ceil(hrs / 24);
  const cost  = days * (parseFloat(adm.daily_rate) || 500);

  panel.innerHTML = `
    <div class="space-y-3 max-h-screen overflow-y-auto pr-1">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div class="font-bold text-navy text-sm">${TYPE_ICON[cage.cage_type]} กรง ${cage.cage_number} — ${adm.pet_name}</div>
          <div class="text-xs text-slate-400 font-body">${_timeSince(adm.admitted_at)} · ฿${cost.toLocaleString()}</div>
        </div>
        <div class="flex gap-1.5 flex-wrap">
          <button id="edit-adm-btn"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors font-semibold">
            <i class="fas fa-pen mr-1"></i>แก้ไขผู้ป่วย
          </button>
          <button id="edit-cage-occ-btn"
            class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors font-semibold">
            <i class="fas fa-cog mr-1"></i>แก้ไขกรง
          </button>
          <button id="discharge-btn"
            class="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors"
            style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D">
            <i class="fas fa-right-from-bracket mr-1"></i>Discharge
          </button>
        </div>
      </div>

      <!-- Patient info -->
      <div class="bg-slate-50 rounded-xl p-3 text-xs space-y-1 font-body">
        <div class="flex gap-4 flex-wrap">
          <span><strong>ชนิด:</strong> ${SPECIES_OPTS.find(s=>s.v===adm.species)?.l || adm.species || '—'}</span>
          ${adm.owner_name ? `<span><strong>เจ้าของ:</strong> ${adm.owner_name}</span>` : ''}
        </div>
        ${adm.admission_reason ? `<div><strong>เหตุผล:</strong> ${adm.admission_reason}</div>` : ''}
      </div>

      <!-- Belongings -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="font-semibold text-sm text-navy">🎒 ของที่ฝากมา</span>
          <button id="add-belonging-btn" class="text-xs text-primary hover:underline font-semibold">+ เพิ่ม</button>
        </div>
        <div id="belongings-list" class="flex flex-wrap gap-1.5 min-h-6">
          ${belongings.length === 0
            ? `<span class="text-xs text-slate-400 font-body">ยังไม่มีรายการ</span>`
            : belongings.map((b, i) => `
                <span class="flex items-center gap-1 text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-body">
                  ${b.item}${b.qty > 1 ? ` ×${b.qty}` : ''}${b.note ? ` (${b.note})` : ''}
                  <button data-remove-belonging="${i}" class="text-slate-400 hover:text-red-500 ml-1 transition-colors">×</button>
                </span>`).join('')}
        </div>
      </div>

      <!-- Daily notes -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-sm text-navy">📝 บันทึกประจำวัน</span>
          <span id="notes-save-status" class="text-xs text-slate-400 font-body"></span>
        </div>
        <textarea id="daily-notes" rows="3"
          class="w-full text-xs font-body text-navy bg-slate-50 rounded-xl p-2.5 border border-slate-100
                 focus:border-primary focus:bg-white outline-none resize-none transition-colors"
          placeholder="อาการ, การกิน, พฤติกรรม...">${adm.daily_notes || ''}</textarea>
      </div>

      <!-- Vital Signs -->
      <div id="vitals-section"></div>

      <!-- Treatments -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="font-semibold text-sm text-navy">💊 Treatment <span class="text-xs text-slate-400 font-body">(${done}/${treatments.length})</span></span>
          <button id="add-treatment-btn" class="text-xs text-primary hover:underline font-semibold">+ เพิ่ม</button>
        </div>
        ${treatments.length > 0 ? `
          <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div class="h-1.5 rounded-full bg-primary transition-all" style="width:${Math.round(done/treatments.length*100)}%"></div>
          </div>` : ''}
        <div class="space-y-1.5 max-h-64 overflow-y-auto" id="treatment-list">
          ${treatments.length === 0
            ? `<div class="text-center py-4 text-xs text-slate-400 font-body">ยังไม่มีรายการ — กด "+ เพิ่ม" เพื่อเริ่ม</div>`
            : treatments.map(t => _treatmentRow(t)).join('')}
        </div>
      </div>
    </div>`;

  // ── Events ──
  panel.querySelector('#edit-adm-btn')?.addEventListener('click',
    () => _openEditAdmissionModal(adm, container, cage));

  panel.querySelector('#edit-cage-occ-btn')?.addEventListener('click',
    () => _openEditCageModal(cage, container));

  panel.querySelector('#discharge-btn')?.addEventListener('click',
    () => _discharge(adm.id, container));

  panel.querySelector('#add-belonging-btn')?.addEventListener('click',
    () => _openAddBelongingModal(adm, belongings, container, cage));

  panel.querySelector('#add-treatment-btn')?.addEventListener('click',
    () => _openAddTreatmentModal(adm, container, cage));

  // Load and render vitals
  _renderVitals(adm, panel);

  // Remove belonging
  panel.querySelector('#belongings-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-remove-belonging]');
    if (!btn) return;
    const idx      = parseInt(btn.dataset.removeBelonging);
    const updated  = belongings.filter((_, i) => i !== idx);
    const res      = await apiFetch(`/api/ipd/admissions/${adm.id}`, {
      method: 'PATCH', body: JSON.stringify({ belongings_log: updated }),
    });
    if (res?.success) { adm.belongings_log = updated; _renderDetail(cage, container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });

  // Daily notes autosave
  let notesTimer;
  panel.querySelector('#daily-notes')?.addEventListener('input', e => {
    clearTimeout(notesTimer);
    const statusEl = panel.querySelector('#notes-save-status');
    if (statusEl) statusEl.textContent = '● กำลังบันทึก...';
    notesTimer = setTimeout(async () => {
      const res = await apiFetch(`/api/ipd/admissions/${adm.id}`, {
        method: 'PATCH', body: JSON.stringify({ daily_notes: e.target.value }),
      });
      if (statusEl) statusEl.textContent = res?.success ? '✓ บันทึกแล้ว' : '⚠ ไม่สำเร็จ';
    }, 1500);
  });

  // Treatment done → open status modal
  panel.querySelector('#treatment-list')?.addEventListener('click', e => {
    const doneBtn   = e.target.closest('[data-done-id]');
    const deleteBtn = e.target.closest('[data-delete-treat]');
    if (doneBtn)   _openDoneModal(treatments.find(t => t.id === doneBtn.dataset.doneId), cage, container);
    if (deleteBtn) _deleteTreatment(deleteBtn.dataset.deleteTreat, cage, container);
  });
}

// ─── Treatment row ────────────────────────────────────────────────────────────

function _treatmentRow(t) {
  const TYPE_ICON_MAP = { medication: '💊', feeding: '🍽️', vitals: '🩺', observation: '👁️', procedure: '🔧' };
  const isDone = t.status === 'done';

  const statusIcons = isDone ? [
    t.eat_status  ? `<span title="กิน: ${t.eat_status}">${t.eat_status === 'good' ? '🍽️✅' : t.eat_status === 'little' ? '🍽️⚡' : '🍽️❌'}</span>` : '',
    t.poop_status ? `<span title="ถ่าย: ${t.poop_status}">${t.poop_status === 'normal' ? '💩✅' : t.poop_status === 'abnormal' ? '💩⚠️' : ''}</span>` : '',
    t.pee_status  ? `<span title="ฉี่: ${t.pee_status}">${t.pee_status === 'normal' ? '💧✅' : t.pee_status === 'abnormal' ? '💧⚠️' : ''}</span>` : '',
  ].filter(Boolean).join('') : '';

  return `
    <div class="flex items-start gap-2 p-2 rounded-lg text-xs group
                ${isDone ? 'bg-green-50' : 'bg-white border border-slate-100'}">
      <span class="text-slate-400 font-mono w-10 flex-shrink-0 pt-0.5">${t.treatment_time}</span>
      <span class="text-base flex-shrink-0">${TYPE_ICON_MAP[t.treatment_type] || '📝'}</span>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-navy truncate">${t.description || '—'}</div>
        ${t.dosage ? `<div class="text-slate-400">${t.dosage}</div>` : ''}
        ${t.notes  ? `<div class="text-slate-500 italic">${t.notes}</div>` : ''}
        ${statusIcons ? `<div class="flex gap-1 mt-0.5">${statusIcons}</div>` : ''}
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        ${isDone
          ? `<span class="text-green-600 font-bold">✓</span>`
          : `<button data-done-id="${t.id}"
               class="text-xs px-2 py-1 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors">
               ทำแล้ว
             </button>`}
        <button data-delete-treat="${t.id}"
          class="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-0.5">
          <i class="fas fa-times text-xs"></i>
        </button>
      </div>
    </div>`;
}

// ─── Cage modals ──────────────────────────────────────────────────────────────

function _openAddCageModal(container) {
  const m = _modal('เพิ่มกรง', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">หมายเลขกรง *</label>
          <input id="c-num" class="input-field" placeholder="A-01"></div>
        <div><label class="input-label">ประเภท</label>
          <select id="c-type" class="input-field">
            <option value="standard">🏠 Standard</option>
            <option value="large">🏡 Large</option>
            <option value="icu">🏥 ICU</option>
            <option value="isolation">⚠️ Isolation</option>
          </select></div>
        <div><label class="input-label">ชั้น</label>
          <input id="c-floor" class="input-field" type="number" value="1" min="1"></div>
        <div><label class="input-label">ค่าบริการ/วัน (฿)</label>
          <input id="c-rate" class="input-field" type="number" value="500"></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const cage_number = m.querySelector('#c-num').value.trim();
    if (!cage_number) { showToast('กรุณากรอกหมายเลขกรง', 'error'); return; }

    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/ipd/cages', { method: 'POST', body: JSON.stringify({
      store_id:   _storeId,
      cage_number,
      cage_type:  m.querySelector('#c-type').value,
      floor:      parseInt(m.querySelector('#c-floor').value) || 1,
      daily_rate: parseInt(m.querySelector('#c-rate').value)  || 500,
    })});
    if (res?.success) { m.remove(); showToast(`เพิ่มกรง ${cage_number} แล้ว`); await _render(container); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

function _openEditCageModal(cage, container) {
  const m = _modal(`แก้ไขกรง ${cage.cage_number}`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">หมายเลขกรง *</label>
          <input id="c-num" class="input-field" value="${cage.cage_number}"></div>
        <div><label class="input-label">ประเภท</label>
          <select id="c-type" class="input-field">
            ${['standard','large','icu','isolation'].map(t =>
              `<option value="${t}" ${t===cage.cage_type?'selected':''}>${TYPE_ICON[t]||''} ${t}</option>`
            ).join('')}
          </select></div>
        <div><label class="input-label">ชั้น</label>
          <input id="c-floor" class="input-field" type="number" value="${cage.floor||1}" min="1"></div>
        <div><label class="input-label">ค่าบริการ/วัน (฿)</label>
          <input id="c-rate" class="input-field" type="number" value="${cage.daily_rate||500}"></div>
      </div>
      <div><label class="input-label">สถานะ</label>
        <select id="c-status" class="input-field">
          ${Object.entries(STATUS_CFG).filter(([k])=>k!=='occupied').map(([k,v])=>
            `<option value="${k}" ${k===cage.status?'selected':''}>${v.label}</option>`
          ).join('')}
        </select></div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const cage_number = m.querySelector('#c-num').value.trim();
    if (!cage_number) { showToast('กรุณากรอกหมายเลขกรง', 'error'); return; }

    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch(`/api/ipd/cages/${cage.id}`, { method: 'PATCH', body: JSON.stringify({
      cage_number,
      cage_type:  m.querySelector('#c-type').value,
      floor:      parseInt(m.querySelector('#c-floor').value)  || 1,
      daily_rate: parseInt(m.querySelector('#c-rate').value)   || 500,
      status:     m.querySelector('#c-status').value,
    })});
    if (res?.success) { m.remove(); showToast('อัปเดตกรงแล้ว'); await _render(container); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

function _deleteCage(cage, container) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
      <div class="text-center">
        <div class="text-4xl mb-3">🗑</div>
        <h3 class="font-bold text-navy text-lg">ลบกรง ${cage.cage_number}?</h3>
        <p class="text-sm text-slate-500 font-body mt-1">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
      </div>
      <div class="flex gap-3">
        <button id="del-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="del-confirm"
          class="flex-1 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          style="background:#EF4444;color:#fff;border:1px solid #DC2626"
          onmouseover="this.style.background='#DC2626'" onmouseout="this.style.background='#EF4444'">
          ลบกรง
        </button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#del-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  m.querySelector('#del-confirm').addEventListener('click', async () => {
    m.querySelector('#del-confirm').disabled = true;
    m.querySelector('#del-confirm').textContent = 'กำลังลบ...';
    const res = await apiFetch(`/api/ipd/cages/${cage.id}`, { method: 'DELETE' });
    m.remove();
    if (res?.success) { showToast(`ลบกรง ${cage.cage_number} แล้ว`); await _render(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

// ─── Admission modals ─────────────────────────────────────────────────────────

function _openAdmitModal(cage, container) {
  let _sel = null; // selected pet { pet_id, pet_name, species, breed, hn, allergies, owner_name, recent_count }
  const EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };

  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">รับสัตว์เข้ากรง ${cage.cage_number}</h3>

      <!-- Step 1: search -->
      <div id="s1">
        <label class="input-label">ค้นหาสัตว์เลี้ยงในระบบ (ชื่อ / เจ้าของ / เบอร์โทร)</label>
        <div class="relative">
          <input id="admit-q" class="input-field pr-8" placeholder="บัดดี้ หรือ 0812345678..." autocomplete="off">
          <div id="admit-dd"
               class="hidden absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl
                      shadow-card-hover border border-slate-100 max-h-60 overflow-y-auto text-sm"></div>
        </div>
        <div class="mt-2 text-xs text-slate-400 font-body flex items-center justify-between">
          <span>ต้องมีข้อมูลในระบบก่อนจึงจะรับเข้ากรงได้</span>
          <button id="s1-register" class="text-primary hover:underline font-semibold">
            + ลงทะเบียนสัตว์ใหม่
          </button>
        </div>
      </div>

      <!-- Step 2: selected pet + details (hidden initially) -->
      <div id="s2" class="hidden space-y-3">
        <div id="pet-card" class="rounded-xl p-3 border-2 border-primary bg-primary-subtle"></div>
        <div>
          <label class="input-label">เหตุผลในการ Admit *</label>
          <input id="a-reason" class="input-field" placeholder="ผ่าตัด, ให้น้ำเกลือ, สังเกตอาการ...">
        </div>
        <div>
          <label class="input-label">ค่าบริการ/วัน (฿)</label>
          <input id="a-rate" class="input-field" type="number" value="${cage.daily_rate||500}">
        </div>
        <button id="s2-change" class="text-xs text-primary hover:underline font-body">← เปลี่ยนสัตว์เลี้ยง</button>
      </div>

      <div class="flex gap-3 pt-1">
        <button id="m-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="m-confirm" class="btn-primary flex-1" disabled>รับเข้ากรง</button>
      </div>
    </div>`;

  document.body.appendChild(m);

  const input      = m.querySelector('#admit-q');
  const dropdown   = m.querySelector('#admit-dd');
  const s1         = m.querySelector('#s1');
  const s2         = m.querySelector('#s2');
  const confirmBtn = m.querySelector('#m-confirm');
  const petCard    = m.querySelector('#pet-card');

  // ── showStep2: display selected pet card ──
  function showStep2(pet) {
    _sel = pet;
    s1.classList.add('hidden');
    s2.classList.remove('hidden');
    confirmBtn.disabled = false;

    const hnBadge      = pet.hn ? `<span class="badge badge-navy text-xs">HN-${String(pet.hn).padStart(5,'0')}</span>` : '';
    const recentBadge  = pet.recent_count > 0
      ? `<span class="text-xs text-slate-400 font-body">ประวัติ OPD ${pet.recent_count} ครั้ง</span>` : '';
    const allergyWarn  = pet.allergies
      ? `<div class="mt-2 text-xs text-red-600 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠️ แพ้: ${pet.allergies}</div>` : '';

    petCard.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-3xl">${EMOJI[pet.species] || '🐾'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-primary-dark">${pet.pet_name}</span>
            ${hnBadge}
          </div>
          <div class="text-xs text-slate-500 font-body mt-0.5">
            ${SPECIES_OPTS.find(s=>s.v===pet.species)?.l || pet.species}${pet.breed ? ' · '+pet.breed : ''}
          </div>
          <div class="text-xs text-slate-500 font-body">
            เจ้าของ: ${pet.owner_name || '—'}${pet.owner_phone ? ' · '+pet.owner_phone : ''}
          </div>
          ${recentBadge}
        </div>
      </div>
      ${allergyWarn}`;
  }

  // ── showStep1: back to search ──
  function showStep1() {
    _sel = null;
    s2.classList.add('hidden');
    s1.classList.remove('hidden');
    confirmBtn.disabled = true;
    input.value = '';
    input.focus();
  }

  m.querySelector('#s2-change').addEventListener('click', showStep1);

  // ── Pet search autocomplete ──
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.add('hidden'); return; }

    timer = setTimeout(async () => {
      const res    = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
      const owners = res?.data || [];

      if (!owners.length) {
        dropdown.innerHTML = `
          <div class="px-4 py-3 font-body text-sm text-slate-500">
            ไม่พบ "${q}"
            <button id="dd-reg" class="ml-2 text-primary underline text-xs">ลงทะเบียนใหม่</button>
          </div>`;
        dropdown.classList.remove('hidden');
        dropdown.querySelector('#dd-reg')?.addEventListener('click', () => {
          dropdown.classList.add('hidden');
          _registerThenAdmit(m, showStep2);
        });
        return;
      }

      const rows = [];
      for (const owner of owners) {
        for (const pet of (owner.pets || [])) {
          rows.push({ pet_id: pet.id, pet_name: pet.name, species: pet.species, breed: pet.breed || null, hn: pet.hn || null, allergies: pet.allergies || null, owner_name: owner.name, owner_phone: owner.phone || '' });
        }
        if (!(owner.pets || []).length) {
          rows.push({ _no_pet: true, owner_name: owner.name, owner_phone: owner.phone || '' });
        }
      }

      dropdown.innerHTML = rows.map((r, i) => r._no_pet
        ? `<div class="px-4 py-2 text-xs text-slate-400 font-body">${r.owner_name} — ยังไม่มีสัตว์เลี้ยงในระบบ</div>`
        : `<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors" data-ridx="${i}">
             <span class="text-xl">${EMOJI[r.species]||'🐾'}</span>
             <div class="flex-1 min-w-0">
               <div class="font-semibold text-navy">${r.pet_name}${r.allergies?' ⚠️':''}</div>
               <div class="text-xs text-slate-400 font-body">
                 ${SPECIES_OPTS.find(s=>s.v===r.species)?.l||r.species}${r.breed?' · '+r.breed:''} ·
                 เจ้าของ: ${r.owner_name}${r.owner_phone?' · '+r.owner_phone:''}
               </div>
             </div>
           </div>`
      ).join('') + `
        <div class="border-t border-slate-100 px-4 py-2">
          <button id="dd-reg2" class="text-xs text-primary hover:underline font-body">
            + ลงทะเบียนสัตว์เลี้ยงใหม่
          </button>
        </div>`;

      dropdown.classList.remove('hidden');

      dropdown.querySelectorAll('[data-ridx]').forEach(el => {
        el.addEventListener('click', async () => {
          dropdown.classList.add('hidden');
          const r = rows[parseInt(el.dataset.ridx)];
          if (!r.pet_id) return;

          // Fetch full pet profile for recent record count + allergies
          const petRes = await apiFetch(`/api/pets/${r.pet_id}`);
          const full   = petRes?.data;
          showStep2({ ...r, recent_count: full?.medical_records?.length || 0, allergies: full?.allergies || r.allergies });
        });
      });

      dropdown.querySelector('#dd-reg2')?.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        _registerThenAdmit(m, showStep2);
      });
    }, 300);
  });

  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));

  m.querySelector('#s1-register').addEventListener('click', () => _registerThenAdmit(m, showStep2));
  m.querySelector('#m-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  // ── Confirm admit ──
  confirmBtn.addEventListener('click', async () => {
    if (!_sel) return;
    confirmBtn.disabled = true; confirmBtn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/ipd/admissions', { method: 'POST', body: JSON.stringify({
      store_id:         _storeId,
      cage_id:          cage.id,
      pet_id:           _sel.pet_id,
      pet_name:         _sel.pet_name,
      species:          _sel.species   || 'dog',
      owner_name:       _sel.owner_name || null,
      admission_reason: m.querySelector('#a-reason')?.value.trim() || null,
      daily_rate:       parseInt(m.querySelector('#a-rate')?.value) || cage.daily_rate || 500,
    })});

    if (res?.success) {
      m.remove();
      showToast(`รับ ${_sel.pet_name} เข้ากรง ${cage.cage_number} แล้ว`);
      logAudit('create', 'ipd_admissions', res.data.id, null, res.data, 'admit patient');
      await _render(container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      confirmBtn.disabled = false; confirmBtn.textContent = 'รับเข้ากรง';
    }
  });

  setTimeout(() => input.focus(), 100);
}

// ─── Inline register owner + pet → callback with selected pet ────────────────

function _registerThenAdmit(parentModal, onDone) {
  parentModal.style.visibility = 'hidden';

  const EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };

  // Step 1: Create owner
  const m1 = document.createElement('div');
  m1.className = 'fixed inset-0 flex items-center justify-center bg-black/40 p-4';
  m1.style.zIndex = '60';
  m1.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">ลงทะเบียนใหม่ — 1/2 เจ้าของ</h3>
      <div>
        <label class="input-label">ชื่อ-นามสกุล *</label>
        <input id="r-name" class="input-field" placeholder="คุณสมชาย ใจดี" autofocus>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">เบอร์โทร *</label>
          <input id="r-phone" class="input-field" type="tel" placeholder="0812345678">
        </div>
        <div>
          <label class="input-label">อีเมล (ถ้ามี)</label>
          <input id="r-email" class="input-field" type="email" placeholder="email@example.com">
        </div>
      </div>
      <div class="flex gap-3">
        <button id="r-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="r-next" class="btn-primary flex-1">ถัดไป →</button>
      </div>
    </div>`;

  document.body.appendChild(m1);

  function cancel() { m1.remove(); parentModal.style.visibility = ''; }
  m1.querySelector('#r-cancel').addEventListener('click', cancel);

  m1.querySelector('#r-next').addEventListener('click', async () => {
    const name  = m1.querySelector('#r-name').value.trim();
    const phone = m1.querySelector('#r-phone').value.trim();
    if (!name || !phone) { showToast('กรุณากรอกชื่อและเบอร์โทร', 'error'); return; }

    const btn = m1.querySelector('#r-next');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/pets/owners', {
      method: 'POST',
      body: JSON.stringify({ name, phone, email: m1.querySelector('#r-email').value.trim() || null }),
    });

    if (!res?.success) {
      showToast(res?.error || 'สร้างเจ้าของไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = 'ถัดไป →';
      return;
    }

    const owner = res.data;
    m1.remove();

    // Step 2: Create pet
    const m2 = document.createElement('div');
    m2.className = 'fixed inset-0 flex items-center justify-center bg-black/40 p-4';
    m2.style.zIndex = '60';
    m2.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 class="font-bold text-navy text-lg">ลงทะเบียนใหม่ — 2/2 สัตว์เลี้ยง</h3>
        <div class="bg-primary-subtle rounded-xl px-4 py-2 text-sm text-primary-dark font-semibold">
          👤 ${owner.name} · ${owner.phone || ''}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="input-label">ชื่อสัตว์เลี้ยง *</label>
            <input id="p-name" class="input-field" placeholder="บัดดี้" autofocus>
          </div>
          <div>
            <label class="input-label">ชนิด</label>
            <select id="p-species" class="input-field">
              ${SPECIES_OPTS.map(s => `<option value="${s.v}">${s.l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="input-label">สายพันธุ์</label>
            <input id="p-breed" class="input-field" placeholder="โกลเด้น รีทรีฟเวอร์">
          </div>
          <div>
            <label class="input-label">เพศ</label>
            <select id="p-gender" class="input-field">
              <option value="unknown">ไม่ระบุ</option>
              <option value="male">เพศผู้ ♂</option>
              <option value="female">เพศเมีย ♀</option>
            </select>
          </div>
          <div>
            <label class="input-label">น้ำหนัก (kg)</label>
            <input id="p-weight" class="input-field" type="number" step="0.1" placeholder="5.2">
          </div>
          <div class="col-span-2">
            <label class="input-label">แพ้ยา / อาหาร</label>
            <input id="p-allergy" class="input-field" placeholder="ถ้าไม่มีให้เว้นว่าง">
          </div>
        </div>
        <div class="flex gap-3">
          <button id="p-cancel" class="btn-outline flex-1">ยกเลิก</button>
          <button id="p-save" class="btn-primary flex-1">บันทึก + เลือก</button>
        </div>
      </div>`;

    document.body.appendChild(m2);
    m2.querySelector('#p-cancel').addEventListener('click', () => { m2.remove(); parentModal.style.visibility = ''; });

    m2.querySelector('#p-save').addEventListener('click', async () => {
      const petName = m2.querySelector('#p-name').value.trim();
      const species = m2.querySelector('#p-species').value;
      if (!petName) { showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error'); return; }

      const btn2 = m2.querySelector('#p-save');
      btn2.disabled = true; btn2.textContent = 'กำลังบันทึก...';

      const petRes = await apiFetch('/api/pets', {
        method: 'POST',
        body: JSON.stringify({
          owner_id:  owner.id,
          store_id:  _storeId,
          name:      petName,
          species,
          breed:     m2.querySelector('#p-breed').value.trim()          || null,
          gender:    m2.querySelector('#p-gender').value,
          weight_kg: parseFloat(m2.querySelector('#p-weight').value)    || null,
          allergies: m2.querySelector('#p-allergy').value.trim()        || null,
        }),
      });

      if (!petRes?.success) {
        showToast(petRes?.error || 'สร้างสัตว์เลี้ยงไม่สำเร็จ', 'error');
        btn2.disabled = false; btn2.textContent = 'บันทึก + เลือก';
        return;
      }

      const pet = petRes.data;
      m2.remove();
      parentModal.style.visibility = '';
      showToast(`ลงทะเบียน ${petName} สำเร็จ`);

      onDone({
        pet_id:       pet.id,
        pet_name:     pet.name,
        species:      pet.species,
        breed:        pet.breed  || null,
        hn:           pet.hn     || null,
        allergies:    pet.allergies || null,
        owner_name:   owner.name,
        owner_phone:  owner.phone || '',
        recent_count: 0,
      });
    });
  });
}

function _openEditAdmissionModal(adm, container, cage) {
  const m = _modal(`แก้ไขข้อมูล — ${adm.pet_name}`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="e-pet" class="input-field" value="${adm.pet_name || ''}"></div>
        <div><label class="input-label">ชนิด</label>
          <select id="e-species" class="input-field">
            ${SPECIES_OPTS.map(s => `<option value="${s.v}" ${s.v===adm.species?'selected':''}>${s.l}</option>`).join('')}
          </select></div>
        <div><label class="input-label">ชื่อเจ้าของ</label>
          <input id="e-owner" class="input-field" value="${adm.owner_name || ''}"></div>
        <div class="col-span-2"><label class="input-label">เหตุผลในการ Admit</label>
          <input id="e-reason" class="input-field" value="${adm.admission_reason || ''}"></div>
        <div><label class="input-label">ค่าบริการ/วัน (฿)</label>
          <input id="e-rate" class="input-field" type="number" value="${adm.daily_rate||500}"></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const pet_name = m.querySelector('#e-pet').value.trim();
    if (!pet_name) { showToast('กรุณาระบุชื่อสัตว์เลี้ยง', 'error'); return; }

    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch(`/api/ipd/admissions/${adm.id}`, { method: 'PATCH', body: JSON.stringify({
      pet_name,
      species:          m.querySelector('#e-species').value,
      owner_name:       m.querySelector('#e-owner').value.trim()  || null,
      admission_reason: m.querySelector('#e-reason').value.trim() || null,
      daily_rate:       parseInt(m.querySelector('#e-rate').value) || 500,
    })});

    if (res?.success) {
      m.remove(); showToast('อัปเดตข้อมูลแล้ว');
      Object.assign(adm, res.data);
      cage.current_admission = adm;
      _renderDetail(cage, container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ─── Belongings ───────────────────────────────────────────────────────────────

function _openAddBelongingModal(adm, currentList, container, cage) {
  const m = _modal('เพิ่มของที่ฝากมาด้วย', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="input-label">รายการ *</label>
          <input id="b-item" class="input-field" placeholder="ชามอาหาร, ผ้าห่ม, ยา..." autofocus></div>
        <div><label class="input-label">จำนวน</label>
          <input id="b-qty" class="input-field" type="number" value="1" min="1"></div>
        <div><label class="input-label">หมายเหตุ</label>
          <input id="b-note" class="input-field" placeholder="สีน้ำเงิน, 14 เม็ด..."></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const item = m.querySelector('#b-item').value.trim();
    if (!item) { showToast('กรุณากรอกรายการ', 'error'); return; }

    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const updated = [...currentList, {
      item,
      qty:  parseInt(m.querySelector('#b-qty').value)  || 1,
      note: m.querySelector('#b-note').value.trim() || '',
    }];

    const res = await apiFetch(`/api/ipd/admissions/${adm.id}`, {
      method: 'PATCH', body: JSON.stringify({ belongings_log: updated }),
    });
    if (res?.success) {
      m.remove(); showToast(`เพิ่ม ${item} แล้ว`);
      adm.belongings_log = updated;
      cage.current_admission = adm;
      _renderDetail(cage, container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ─── Treatment modals ─────────────────────────────────────────────────────────

function _openAddTreatmentModal(adm, container, cage) {
  const m = _modal('เพิ่มรายการ Treatment', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">เวลา *</label>
          <input id="t-time" class="input-field" type="time" value="${new Date().toTimeString().slice(0,5)}"></div>
        <div><label class="input-label">ประเภท</label>
          <select id="t-type" class="input-field">
            <option value="medication">💊 ยา</option>
            <option value="feeding">🍽️ อาหาร</option>
            <option value="vitals">🩺 Vitals</option>
            <option value="observation">👁️ สังเกต</option>
            <option value="procedure">🔧 หัตถการ</option>
          </select></div>
        <div class="col-span-2" id="t-product-row">
          <label class="input-label">เลือกจากคลัง (ไม่บังคับ)</label>
          <select id="t-product" class="input-field">
            <option value="">— กำลังโหลด... —</option>
          </select>
          <div id="t-stock-warn" class="hidden mt-1 text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
            ⚠️ สินค้าคงเหลือน้อย — กรุณาเติมสต็อก
          </div>
        </div>
        <div class="col-span-2"><label class="input-label">รายละเอียด *</label>
          <input id="t-desc" class="input-field" placeholder="Amoxicillin 250mg, ข้าวต้มไก่ 100g..."></div>
        <div><label class="input-label">ขนาด / ปริมาณ</label>
          <input id="t-dose" class="input-field" placeholder="1 เม็ด, 100ml"></div>
        <div><label class="input-label">หมายเหตุ</label>
          <input id="t-notes" class="input-field" placeholder="กินหลังอาหาร"></div>
      </div>
    </div>`);

  // ── Load inventory and wire product selector ──
  apiFetch(`/api/inventory?store_id=${_storeId}`).then(res => {
    const products = res?.data || [];
    const sel = m.querySelector('#t-product');
    if (!sel) return;
    sel.innerHTML = '<option value="">— ไม่เลือกจากคลัง —</option>' +
      products.map(p =>
        `<option value="${p.id}" data-stock="${p.stock}" data-name="${p.name}${p.unit ? ' (' + p.unit + ')' : ''}">` +
        `${p.name}${p.unit ? ' (' + p.unit + ')' : ''} — คงเหลือ ${p.stock}` +
        `</option>`
      ).join('');
  }).catch(() => {
    const sel = m.querySelector('#t-product');
    if (sel) sel.innerHTML = '<option value="">— ไม่สามารถโหลดคลังได้ —</option>';
  });

  // Show product row only for medication type
  const typeEl     = m.querySelector('#t-type');
  const productRow = m.querySelector('#t-product-row');
  function _syncProductRow() {
    if (typeEl.value === 'medication') {
      productRow.classList.remove('hidden');
    } else {
      productRow.classList.add('hidden');
      m.querySelector('#t-stock-warn').classList.add('hidden');
    }
  }
  typeEl.addEventListener('change', _syncProductRow);

  // Warn when selected product stock <= 5; auto-fill description
  m.querySelector('#t-product').addEventListener('change', e => {
    const opt    = e.target.selectedOptions[0];
    const stock  = parseInt(opt?.dataset?.stock ?? '', 10);
    const name   = opt?.dataset?.name || '';
    const warnEl = m.querySelector('#t-stock-warn');
    const descEl = m.querySelector('#t-desc');

    if (e.target.value && !isNaN(stock) && stock <= 5) {
      warnEl.textContent = `⚠️ สินค้าคงเหลือน้อย (${stock} หน่วย) — กรุณาเติมสต็อก`;
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }

    // Auto-fill description if user hasn't typed anything yet
    if (name && descEl && !descEl.value.trim()) {
      descEl.value = name;
    }
  });

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const description    = m.querySelector('#t-desc').value.trim();
    const treatment_time = m.querySelector('#t-time').value;
    if (!description || !treatment_time) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }

    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/ipd/treatments', { method: 'POST', body: JSON.stringify({
      admission_id:   adm.id,
      store_id:       _storeId,
      treatment_time,
      treatment_type: m.querySelector('#t-type').value,
      description,
      dosage:         m.querySelector('#t-dose').value.trim()  || null,
      notes:          m.querySelector('#t-notes').value.trim() || null,
    })});

    if (res?.success) { m.remove(); showToast('เพิ่มรายการแล้ว'); _renderDetail(cage, container); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

function _openDoneModal(treatment, cage, container) {
  if (!treatment) return;
  const m = _modal(`✓ บันทึกเสร็จ — ${treatment.description}`, `
    <div class="space-y-4">
      <p class="text-xs text-slate-400 font-body">บันทึกสถานะเพิ่มเติม (ไม่บังคับ)</p>
      <div>
        <label class="input-label mb-1.5">🍽️ การกิน</label>
        <div class="flex gap-2">
          ${[['good','กินดี'],['little','กินน้อย'],['none','ไม่กิน']].map(([v,l]) =>
            `<label class="flex-1 text-center">
               <input type="radio" name="eat" value="${v}" class="sr-only peer">
               <span class="block text-xs py-1.5 rounded-lg border border-slate-200 cursor-pointer
                            peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:text-primary
                            hover:border-primary transition-colors font-body">${l}</span>
             </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="input-label mb-1.5">💩 ถ่าย</label>
        <div class="flex gap-2">
          ${[['normal','ปกติ'],['abnormal','ผิดปกติ'],['none','ยังไม่ถ่าย']].map(([v,l]) =>
            `<label class="flex-1 text-center">
               <input type="radio" name="poop" value="${v}" class="sr-only peer">
               <span class="block text-xs py-1.5 rounded-lg border border-slate-200 cursor-pointer
                            peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:text-primary
                            hover:border-primary transition-colors font-body">${l}</span>
             </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="input-label mb-1.5">💧 ฉี่</label>
        <div class="flex gap-2">
          ${[['normal','ปกติ'],['abnormal','ผิดปกติ'],['none','ยังไม่ฉี่']].map(([v,l]) =>
            `<label class="flex-1 text-center">
               <input type="radio" name="pee" value="${v}" class="sr-only peer">
               <span class="block text-xs py-1.5 rounded-lg border border-slate-200 cursor-pointer
                            peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:text-primary
                            hover:border-primary transition-colors font-body">${l}</span>
             </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="input-label">หมายเหตุเพิ่มเติม</label>
        <input id="done-notes" class="input-field" placeholder="ข้อสังเกต, อาการพิเศษ...">
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const btn = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const eat  = m.querySelector('input[name="eat"]:checked')?.value  || null;
    const poop = m.querySelector('input[name="poop"]:checked')?.value || null;
    const pee  = m.querySelector('input[name="pee"]:checked')?.value  || null;

    const res = await apiFetch(`/api/ipd/treatments/${treatment.id}/done`, {
      method: 'PATCH', body: JSON.stringify({
        eat_status:  eat,
        poop_status: poop,
        pee_status:  pee,
        notes:       m.querySelector('#done-notes').value.trim() || null,
        completed_by: storage.getJSON(STORAGE_KEYS.USER)?.email || 'staff',
      }),
    });
    if (res?.success) { m.remove(); showToast('บันทึกเรียบร้อย'); _renderDetail(cage, container); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

async function _deleteTreatment(id, cage, container) {
  if (!confirm('ลบรายการนี้?')) return;
  const res = await apiFetch(`/api/ipd/treatments/${id}`, { method: 'DELETE' });
  if (res?.success) { showToast('ลบรายการแล้ว'); _renderDetail(cage, container); }
  else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

// ─── Discharge ────────────────────────────────────────────────────────────────

async function _discharge(admId, container) {
  if (!confirm('ยืนยัน Discharge สัตว์ออกจากกรง?')) return;

  const res = await apiFetch(`/api/ipd/admissions/${admId}/discharge`, { method: 'PATCH', body: '{}' });
  if (!res?.success) { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); return; }

  // Fetch summary data after confirmed discharge
  const [treatRes, vitalRes] = await Promise.all([
    apiFetch(`/api/ipd/treatments/${admId}`),
    apiFetch(`/api/ipd/vitals/${admId}`),
  ]);

  const cost    = res.data?.total_cost || 0;
  const adm     = res.data;
  const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || 'คลินิก';
  showToast(`Discharge สำเร็จ${cost ? ` · ฿${cost.toLocaleString()}` : ''}`);
  logAudit('update', 'ipd_admissions', admId, null, { status: 'discharged' }, 'discharge patient');
  await _render(container);

  const panel = container.querySelector('#ipd-detail');
  if (panel) panel.innerHTML = `
    <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400 space-y-3 p-4">
      <i class="fas fa-check-circle text-4xl" style="color:#10B981"></i>
      <div class="font-body text-sm">Discharge สำเร็จ${cost ? `<br>ค่าบริการรวม <span class="font-bold text-navy">฿${cost.toLocaleString()}</span>` : ''}</div>
      <button id="print-discharge-btn"
        class="text-sm border border-slate-200 text-slate-500 px-4 py-2 rounded-xl
               hover:border-primary hover:text-primary transition-colors font-semibold">
        🖨 พิมพ์ Discharge Summary
      </button>
    </div>`;

  panel?.querySelector('#print-discharge-btn')?.addEventListener('click', () => {
    const tab = printDischargeSummary({
      storeName,
      adm,
      treatments: treatRes?.data || [],
      vitals:     vitalRes?.data || [],
      date: adm.discharged_at || new Date().toISOString(),
    });
    if (!tab) showToast('กรุณาอนุญาต Pop-up เพื่อพิมพ์', 'error');
  });
}

// ─── Vital Signs ─────────────────────────────────────────────────────────────

async function _renderVitals(adm, panel) {
  const section = panel.querySelector('#vitals-section');
  if (!section) return;

  const res    = await apiFetch(`/api/ipd/vitals/${adm.id}`);
  const vitals = res?.data || [];
  const latest = vitals[vitals.length - 1] || null;

  const _color = (key, val) => {
    const n = VITALS_NORMAL[key];
    if (!n || val == null) return 'text-navy';
    if (n.min != null && val < n.min) return 'text-blue-500';
    if (n.max != null && val > n.max) return 'text-red-500';
    return 'text-primary';
  };

  // Mini chart: last 8 temperature readings
  const tempReadings = vitals.filter(v => v.temperature != null).slice(-8);
  const chartHTML = tempReadings.length >= 2 ? (() => {
    const vals   = tempReadings.map(v => v.temperature);
    const minVal = Math.min(...vals) - 0.5;
    const maxVal = Math.max(...vals) + 0.5;
    const range  = maxVal - minVal || 1;
    const coords = vals.map((v, i) => ({
      x: Math.round((i / (vals.length - 1)) * 100),
      y: Math.round((1 - (v - minVal) / range) * 40),
      v,
    }));
    const pts = coords.map(c => `${c.x},${c.y}`).join(' ');
    return `
      <div class="mt-2">
        <div class="text-xs text-slate-400 font-body mb-1">กราฟอุณหภูมิ (${tempReadings.length} ครั้ง)</div>
        <svg viewBox="0 0 100 44" class="w-full h-10" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="#0D9488" stroke-width="2" stroke-linejoin="round"/>
          ${coords.map(({ x, y, v }) => {
            const col = v < 37.5 ? '#3B82F6' : v > 39.2 ? '#EF4444' : '#0D9488';
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="${col}"/>`;
          }).join('')}
        </svg>
      </div>`;
  })() : '';

  const latestRow = latest ? Object.entries(VITALS_NORMAL).map(([key, cfg]) => {
    const val = latest[key];
    if (val == null) return '';
    return `<span class="font-body text-xs"><span class="mr-0.5">${cfg.icon}</span><span class="${_color(key, val)} font-semibold">${val}</span><span class="text-slate-400 ml-0.5">${cfg.unit}</span></span>`;
  }).filter(Boolean).join('<span class="text-slate-200 mx-1">·</span>') : '';

  const vitalsTableRows = [...vitals].reverse().map(v => `
    <tr class="border-t border-slate-50">
      <td class="py-1 text-slate-400">${formatThaiDateTimeShort(v.recorded_at)}</td>
      <td class="text-center ${_color('temperature', v.temperature)}">${v.temperature ?? '—'}</td>
      <td class="text-center ${_color('heart_rate', v.heart_rate)}">${v.heart_rate ?? '—'}</td>
      <td class="text-center">${v.weight_kg ?? '—'}</td>
      <td class="text-center ${_color('respiratory_rate', v.respiratory_rate)}">${v.respiratory_rate ?? '—'}</td>
      <td class="text-right">
        <button data-del-vital="${v.id}" class="text-slate-300 hover:text-red-500 transition-colors">×</button>
      </td>
    </tr>`).join('');

  section.innerHTML = `
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-semibold text-sm text-navy">🩺 Vital Signs
          <span class="text-xs text-slate-400 font-body">(${vitals.length} ครั้ง)</span>
        </span>
        <button id="add-vitals-btn" class="text-xs text-primary hover:underline font-semibold">+ บันทึก</button>
      </div>

      ${latest ? `
        <div class="bg-slate-50 rounded-xl px-3 py-2 text-xs flex flex-wrap gap-x-2 gap-y-1 mb-1">
          ${latestRow}
          <span class="text-slate-400 font-body w-full mt-0.5">ล่าสุด: ${formatThaiDateTimeShort(latest.recorded_at)}</span>
        </div>
        ${chartHTML}` : `
        <div class="text-center py-3 text-xs text-slate-400 font-body">
          ยังไม่มีการบันทึก — กด "+ บันทึก" เพื่อเริ่ม
        </div>`}

      ${vitals.length >= 1 ? `
        <div id="vitals-table-toggle" class="mt-1">
          <button class="text-xs text-slate-400 hover:text-primary font-body hover:underline" id="vitals-expand-btn">
            ${vitals.length === 1 ? 'ประวัติ 1 รายการ ▾' : `ดูทั้งหมด ${vitals.length} รายการ ▾`}
          </button>
          <div id="vitals-table" class="hidden mt-2 max-h-40 overflow-y-auto">
            <table class="w-full text-xs font-body">
              <thead class="text-slate-400">
                <tr>
                  <th class="text-left py-1">เวลา</th>
                  <th class="text-center">🌡°C</th>
                  <th class="text-center">❤bpm</th>
                  <th class="text-center">⚖kg</th>
                  <th class="text-center">🫁/min</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${vitalsTableRows}</tbody>
            </table>
          </div>
        </div>` : ''}
    </div>`;

  section.querySelector('#add-vitals-btn')?.addEventListener('click',
    () => _openAddVitalsModal(adm, panel));

  section.querySelector('#vitals-expand-btn')?.addEventListener('click', () => {
    const table   = section.querySelector('#vitals-table');
    const expandBtn = section.querySelector('#vitals-expand-btn');
    table?.classList.toggle('hidden');
    expandBtn.textContent = table?.classList.contains('hidden')
      ? (vitals.length === 1 ? 'ประวัติ 1 รายการ ▾' : `ดูทั้งหมด ${vitals.length} รายการ ▾`)
      : 'ย่อ ▴';
  });

  section.querySelector('#vitals-table')?.addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-del-vital]');
    if (!delBtn) return;
    const delRes = await apiFetch(`/api/ipd/vitals/${delBtn.dataset.delVital}`, { method: 'DELETE' });
    if (delRes?.success) _renderVitals(adm, panel);
    else showToast(delRes?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openAddVitalsModal(adm, panel) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const m = _modal('บันทึก Vital Signs', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">เวลา</label>
          <input id="vt-time" class="input-field" type="time" value="${timeStr}"></div>
        <div></div>
        <div><label class="input-label">🌡 อุณหภูมิ (°C)</label>
          <input id="vt-temp" class="input-field" type="number" step="0.1" placeholder="38.5"></div>
        <div><label class="input-label">❤ ชีพจร (bpm)</label>
          <input id="vt-hr" class="input-field" type="number" placeholder="80"></div>
        <div><label class="input-label">⚖ น้ำหนัก (kg)</label>
          <input id="vt-wt" class="input-field" type="number" step="0.1" placeholder="5.2"></div>
        <div><label class="input-label">🫁 หายใจ (/min)</label>
          <input id="vt-rr" class="input-field" type="number" placeholder="20"></div>
        <div class="col-span-2">
          <label class="input-label">ความเจ็บปวด 0–10</label>
          <div class="flex gap-1 mt-1">
            ${Array.from({length:11}, (_,i) => `
              <label class="flex-1 text-center cursor-pointer">
                <input type="radio" name="pain" value="${i}" class="sr-only peer">
                <span class="block text-xs py-1 rounded border border-slate-200 peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:text-primary font-body hover:border-slate-300 transition-colors">${i}</span>
              </label>`).join('')}
          </div>
        </div>
        <div class="col-span-2"><label class="input-label">หมายเหตุ</label>
          <input id="vt-notes" class="input-field" placeholder="อาการ, สิ่งที่สังเกตได้..."></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const today   = new Date().toISOString().split('T')[0];
    const timeVal = m.querySelector('#vt-time').value || timeStr;
    const btn     = m.querySelector('#modal-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const payload = {
      admission_id:     adm.id,
      store_id:         _storeId,
      recorded_at:      `${today}T${timeVal}:00`,
    };
    const temp = parseFloat(m.querySelector('#vt-temp').value);
    const hr   = parseInt(m.querySelector('#vt-hr').value);
    const wt   = parseFloat(m.querySelector('#vt-wt').value);
    const rr   = parseInt(m.querySelector('#vt-rr').value);
    const pain = m.querySelector('input[name="pain"]:checked')?.value;
    const notes = m.querySelector('#vt-notes').value.trim();

    const hasMeasurement = !isNaN(temp) || !isNaN(hr) || !isNaN(wt) || !isNaN(rr) || pain != null || Boolean(notes);
    if (!hasMeasurement) {
      showToast('กรุณากรอกค่าอย่างน้อย 1 รายการ', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
      return;
    }

    if (!isNaN(temp)) payload.temperature      = temp;
    if (!isNaN(hr))   payload.heart_rate        = hr;
    if (!isNaN(wt))   payload.weight_kg         = wt;
    if (!isNaN(rr))   payload.respiratory_rate  = rr;
    if (pain != null) payload.pain_score        = parseInt(pain);
    if (notes)        payload.notes             = notes;

    const res = await apiFetch('/api/ipd/vitals', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.success) { m.remove(); showToast('บันทึก Vital Signs แล้ว'); _renderVitals(adm, panel); }
    else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _modal(title, body) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">${title}</h3>
      <div>${body}</div>
      <div class="flex gap-3">
        <button id="modal-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="modal-confirm" class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#modal-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  return m;
}

function _timeSince(dateStr) {
  if (!dateStr) return '—';
  const hrs = Math.floor((Date.now() - new Date(dateStr)) / 3600000);
  if (hrs < 1)  return 'เพิ่งเข้ามา';
  if (hrs < 24) return `${hrs} ชม.`;
  return `${Math.floor(hrs / 24)} วัน ${hrs % 24} ชม.`;
}
