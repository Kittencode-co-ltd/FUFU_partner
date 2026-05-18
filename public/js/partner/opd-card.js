import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { printDrugLabels, printReferralLetter } from '../utils/print-docs.js';

const VITALS_NORMAL = {
  temp: { min: 37.5, max: 39.2, unit: '°C' },
  weight: { min: null, max: null, unit: 'kg' },
  hr: { min: 60, max: 140, unit: 'bpm' },
  rr: { min: 10, max: 30, unit: '/min' },
};

const FREQ_LABELS = { SID: 'วันละ 1×', BID: 'วันละ 2×', TID: 'วันละ 3×', QID: 'วันละ 4×', PRN: 'เมื่อจำเป็น' };
const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };
const COMMISSION_RATE = 0.05;

let _currentQueue = null;
let _currentRecord = null;
let _prescriptions = [];
let _autosaveTimer = null;
let _isDirty = false;
let _container = null;
let _petProfile = null;
let _bindAbort = null;       // AbortController for per-render listeners
let _invCache = null;        // cached inventory for RX modal
let _invCacheAt = 0;
let _soapTemplates = [];

const _DRAFT_KEY = 'fufu_opd_draft';
const _INV_CACHE_TTL = 60_000;

function _saveDraft() {
  const c = _container;
  if (!c) return;
  const g = id => c.querySelector(`#${id}`)?.value ?? '';
  sessionStorage.setItem(_DRAFT_KEY, JSON.stringify({
    record:        _currentRecord ? { ..._currentRecord } : null,
    queue:         _currentQueue  ? { ..._currentQueue  } : null,
    pet_name:      g('opd-pet-name'),
    owner_name:    g('opd-owner'),
    species:       c.querySelector('#opd-species')?.value || 'dog',
    temp:          g('v-temp'),
    weight:        g('v-weight'),
    hr:            g('v-hr'),
    rr:            g('v-rr'),
    hx:            g('hx'),
    pe:            g('pe'),
    dx:            g('dx'),
    tx:            g('tx'),
    prescriptions: _prescriptions,
    savedAt:       Date.now(),
  }));
}

function _clearDraft() {
  sessionStorage.removeItem(_DRAFT_KEY);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderOPDCard(container, detail = null) {
  if (_bindAbort) _bindAbort.abort();
  _bindAbort = new AbortController();
  _container = container;
  _prescriptions = [];
  _isDirty = false;
  _petProfile = null;
  clearTimeout(_autosaveTimer);

  const existing = detail?._existingRecord;

  if (existing) {
    _currentQueue = null;
    _currentRecord = { ...existing };
    _prescriptions = Array.isArray(existing.prescriptions)
      ? existing.prescriptions
      : (Array.isArray(existing.prescribed_meds) ? existing.prescribed_meds : []);
  } else if (detail && !existing) {
    _currentQueue = detail;
    const notes = detail.notes || '';
    const [petName, ownerName] = notes.includes(' - ')
      ? notes.split(' - ').map(s => s.trim())
      : [notes, ''];
    _currentRecord = { id: null, pet_name: petName, owner_name: ownerName, species: 'dog', pet_id: detail.pet_id || null };
  } else {
    // No detail — try to restore draft (refresh recovery)
    const raw = sessionStorage.getItem(_DRAFT_KEY);
    const draft = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
    if (draft && Date.now() - (draft.savedAt || 0) < 7_200_000) {
      _currentQueue  = draft.queue  || null;
      _currentRecord = {
        ...(draft.record || {}),
        pet_name:         draft.pet_name  || '',
        owner_name:       draft.owner_name || '',
        species:          draft.species   || 'dog',
        subjective:       draft.hx        || '',
        objective:        draft.pe        || '',
        assessment:       draft.dx        || '',
        plan:             draft.tx        || '',
        temperature_c:    draft.temp      || '',
        weight_kg:        draft.weight    || '',
        heart_rate:       draft.hr        || '',
        respiratory_rate: draft.rr        || '',
        vitals: { temp: draft.temp || '', weight: draft.weight || '', hr: draft.hr || '', rr: draft.rr || '' },
      };
      _prescriptions = Array.isArray(draft.prescriptions) ? draft.prescriptions : [];
    } else {
      _clearDraft();
      _currentQueue  = null;
      _currentRecord = { id: null, pet_name: '', owner_name: '', species: 'dog' };
    }
  }

  container.innerHTML = _buildHTML();
  _bindEvents();
  if (_prescriptions.length) _renderRxList();

  // Load full pet profile if we have a pet_id (from queue or existing record)
  const petId = detail?.pet_id || existing?.pet_id || null;
  if (petId) _loadPetProfile(petId);
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function _buildHTML() {
  const r = _currentRecord;
  const q = _currentQueue;
  const num = q?.queue_number ? `A${String(q.queue_number).padStart(3, '0')}` : '';
  const sp = r.species || 'dog';
  const v = r.vitals || {};

  return `
  <div class="space-y-5 w-full">

    <!-- Allergies warning banner (shown by _loadPetProfile if pet has allergies) -->
    <div id="opd-allergy-banner" class="hidden card border-2 border-red-300 bg-red-50 p-3 flex items-center gap-3">
      <span class="text-2xl flex-shrink-0">⚠️</span>
      <div>
        <div class="font-bold text-red-700 text-sm">แพ้ยา / อาหาร — ระวัง!</div>
        <div id="opd-allergy-text" class="text-red-600 font-body text-sm mt-0.5"></div>
      </div>
    </div>

    <!-- Patient bar -->
    <div class="card p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
      <div class="w-12 h-12 rounded-xl bg-primary-subtle flex items-center justify-center text-2xl flex-shrink-0">
        ${SPECIES_EMOJI[sp] || '🐾'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="relative flex items-center gap-2 flex-wrap">
          <input id="opd-pet-name" value="${r.pet_name || ''}"
            class="font-bold text-navy text-lg bg-transparent border-b border-transparent
                   hover:border-slate-200 focus:border-primary outline-none transition-colors min-w-32"
            placeholder="ชื่อสัตว์เลี้ยง (ค้นหา...)" autocomplete="off">
          <div id="opd-pet-dropdown" class="hidden absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-white rounded-xl shadow-card-hover border border-slate-100 z-50"></div>
          <select id="opd-species"
            class="text-sm text-slate-500 bg-transparent border border-slate-200 rounded-lg px-2 py-1
                   focus:border-primary outline-none pointer-events-none" disabled>
            ${Object.entries(SPECIES_EMOJI).map(([k, v]) =>
    `<option value="${k}" ${k === sp ? 'selected' : ''}>${v} ${k}</option>`
  ).join('')}
          </select>
          ${num ? `<span class="badge badge-teal">${num}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs text-slate-400 font-body">เจ้าของ:</span>
          <input id="opd-owner" value="${r.owner_name || ''}"
            class="text-sm text-slate-600 font-body bg-transparent border-b border-transparent
                   hover:border-slate-200 focus:border-primary outline-none transition-colors flex-1 min-w-24 pointer-events-none"
            placeholder="ชื่อเจ้าของ" readonly>
        </div>
        <!-- Extra pet info: breed, HN, age — filled by _loadPetProfile -->
        <div id="opd-pet-extra" class="hidden mt-1.5 flex flex-wrap gap-1.5"></div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end w-full sm:w-auto">
        <span id="save-status" class="text-xs text-slate-400 font-body"></span>
        <button id="opd-back-btn"     class="btn-outline text-sm px-3 py-2">← กลับ</button>
        <button id="opd-referral-btn" class="btn-outline text-sm px-4 py-2">📋 ส่งตัว</button>
        <button id="opd-save-btn"     class="btn-outline text-sm px-4 py-2">💾 บันทึก</button>
        <button id="opd-complete-btn" class="btn-primary text-sm px-4 py-2">✓ เสร็จสิ้น</button>
        <button id="opd-goto-pos"     class="hidden btn-primary text-sm px-4 py-2">💳 ไปชำระเงิน</button>
      </div>
    </div>

    <!-- Vitals -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      ${_vitalInput('v-temp', '🌡', 'อุณหภูมิ', r.temperature_c || v.temp || '', 'temp')}
      ${_vitalInput('v-weight', '⚖', 'น้ำหนัก', r.weight_kg || v.weight || '', 'weight')}
      ${_vitalInput('v-hr', '❤', 'ชีพจร', r.heart_rate || v.hr || '', 'hr')}
      ${_vitalInput('v-rr', '🫁', 'หายใจ', r.respiratory_rate || v.rr || '', 'rr')}
    </div>

    <!-- SOAP Template Picker -->
    <div class="card p-3 flex items-center gap-3 flex-wrap">
      <span class="text-sm font-semibold text-slate-500 flex-shrink-0">📋 โหลดแม่แบบ:</span>
      <select id="soap-tmpl-select" class="input-field flex-1 min-w-44 py-1.5 text-sm">
        <option value="">— เลือกแม่แบบ (โหลดจาก template) —</option>
      </select>
      <button id="soap-tmpl-load" class="btn-outline text-sm py-1.5 px-3 flex-shrink-0">โหลด</button>
      <button id="soap-tmpl-save" class="text-xs text-slate-400 hover:text-primary transition-colors flex-shrink-0 font-body">+ บันทึกเป็นแม่แบบ</button>
    </div>

    <!-- Medical Notes (HX / PE / Dx / Tx) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${_noteBox('hx', 'HX', 'History', 'border-t-blue-500', 'bg-blue-100 text-blue-700', 'ประวัติ / อาการที่นำมาพบ', r.subjective || '')}
      ${_noteBox('pe', 'PE', 'Physical Exam', 'border-t-purple-500', 'bg-purple-100 text-purple-700', 'ผลการตรวจร่างกาย', r.objective || '')}
      ${_noteBox('dx', 'Dx', 'Diagnosis', 'border-t-orange-400', 'bg-orange-100 text-orange-600', 'การวินิจฉัยโรค', r.assessment || '')}
      ${_noteBox('tx', 'Tx', 'Treatment', 'border-t-primary', 'bg-primary-subtle text-primary-dark', 'แผนการรักษา', r.plan || '')}
    </div>

    <!-- Medical Images (Lab results, X-ray, etc.) -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-navy">🖼 ภาพถ่าย / ผลแลป / X-Ray</h3>
        <label id="img-upload-label"
          class="cursor-pointer text-sm text-primary border border-primary px-3 py-1 rounded-lg
                 hover:bg-primary-subtle transition-colors font-semibold">
          + แนบภาพ
          <input id="img-upload-input" type="file" accept="image/*" class="hidden" multiple>
        </label>
      </div>
      <div id="medical-images-grid" class="flex flex-wrap gap-3">
        <p class="text-slate-400 font-body text-sm py-2">ยังไม่มีภาพ</p>
      </div>
      <p class="text-xs text-slate-400 font-body mt-2">สูงสุด 5 รูป · แต่ละรูปไม่เกิน 500KB</p>
    </div>

    <!-- RX — Prescription -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-navy">💊 RX — ใบสั่งยา</h3>
        <div class="flex gap-2">
          <button id="print-labels-btn"
            class="text-sm text-slate-500 border border-slate-200 px-3 py-1 rounded-lg
                   hover:bg-slate-50 transition-colors">
            🏷 ฉลากยา
          </button>
          <button id="add-rx-btn"
            class="text-sm text-primary border border-primary px-3 py-1 rounded-lg
                   hover:bg-primary-subtle transition-colors">
            + เพิ่มยา
          </button>
        </div>
      </div>
      <div id="rx-list" class="space-y-2">
        <p class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีรายการยา</p>
      </div>
    </div>

  </div>`;
}

function _vitalInput(id, icon, label, value, key) {
  const normal = VITALS_NORMAL[key];
  return `
    <div class="card p-3">
      <div class="text-xs text-slate-400 font-body mb-1.5">${icon} ${label}</div>
      <div class="flex items-baseline gap-1">
        <input id="${id}" value="${value}"
          class="w-full font-bold text-navy text-lg bg-transparent outline-none
                 border-b border-transparent focus:border-primary transition-colors"
          type="number" step="0.1" placeholder="—"
          ${normal?.min != null ? `data-min="${normal.min}" data-max="${normal.max}"` : ''}>
        <span class="text-xs text-slate-400 flex-shrink-0">${normal?.unit || ''}</span>
      </div>
    </div>`;
}

function _noteBox(id, letter, title, borderCls, badgeCls, placeholder, value = '') {
  return `
    <div class="card border-t-4 ${borderCls} p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="px-1.5 py-0.5 rounded-md text-xs font-bold ${badgeCls}">${letter}</span>
        <span class="text-sm font-semibold text-navy">${title}</span>
      </div>
      <textarea id="${id}" rows="6"
        class="note-textarea w-full text-sm font-body text-navy-mid bg-slate-50 rounded-lg p-2.5
               border border-slate-100 focus:border-primary focus:bg-white outline-none
               resize-y transition-colors placeholder:text-slate-300"
        style="min-height:120px"
        placeholder="${placeholder}">${value}</textarea>
    </div>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────

function _bindEvents() {
  const c = _container;

  // Autosave on note input
  c.querySelectorAll('textarea.note-textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      _isDirty = true;
      _updateSaveStatus('● กำลังบันทึก...');
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => _saveRecord('in_progress'), 1500);
      _saveDraft();
    });
  });

  // Vitals color coding on input
  c.querySelectorAll('input[data-min]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      const min = parseFloat(inp.dataset.min);
      const max = parseFloat(inp.dataset.max);
      inp.classList.toggle('text-red-500', !isNaN(v) && (v < min || v > max));
      _saveDraft();
    });
  });

  // Patient info -> mark dirty
  c.querySelectorAll('#opd-pet-name, #opd-owner, #opd-species').forEach(el => {
    el.addEventListener('change', () => { _isDirty = true; _saveDraft(); });
  });

  // Back button
  c.querySelector('#opd-back-btn')?.addEventListener('click', () => {
    _clearDraft();
    const from = _currentQueue ? 'queue' : 'medical';
    import('../partner/dashboard.js').then(({ navigate }) => navigate(from));
  });

  // Save (draft)
  c.querySelector('#opd-save-btn')?.addEventListener('click', () => _saveRecord('in_progress'));

  // Complete + dispense
  c.querySelector('#opd-complete-btn')?.addEventListener('click', () => _completeRecord());

  // Print page
  c.querySelector('#opd-print-btn')?.addEventListener('click', () => window.print());

  // Drug labels
  c.querySelector('#print-labels-btn')?.addEventListener('click', () => {
    if (!_prescriptions.length) { showToast('ยังไม่มีใบสั่งยา', 'error'); return; }
    const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || 'คลินิก';
    const tab = printDrugLabels({
      prescriptions: _prescriptions,
      petName:   c.querySelector('#opd-pet-name')?.value || '',
      ownerName: c.querySelector('#opd-owner')?.value    || '',
      storeName,
      date: new Date().toISOString(),
    });
    if (!tab) showToast('กรุณาอนุญาต Pop-up เพื่อพิมพ์ฉลาก', 'error');
  });

  // Referral letter
  c.querySelector('#opd-referral-btn')?.addEventListener('click', _openReferralModal);

  // Add prescription
  c.querySelector('#add-rx-btn')?.addEventListener('click', _openRxModal);

  // SOAP templates — load list
  _loadSoapTemplates(c);

  // Load selected template
  c.querySelector('#soap-tmpl-load')?.addEventListener('click', () => {
    const sel = c.querySelector('#soap-tmpl-select');
    const tmpl = _soapTemplates.find(t => t.id === sel?.value);
    if (!tmpl) { showToast('กรุณาเลือกแม่แบบก่อน', 'error'); return; }
    const hx = c.querySelector('#hx'); if (hx) hx.value = tmpl.subjective_template || '';
    const pe = c.querySelector('#pe'); if (pe) pe.value = tmpl.objective_template   || '';
    const dx = c.querySelector('#dx'); if (dx) dx.value = tmpl.assessment_template  || '';
    const tx = c.querySelector('#tx'); if (tx) tx.value = tmpl.plan_template        || '';
    if (Array.isArray(tmpl.preset_prescriptions) && tmpl.preset_prescriptions.length) {
      tmpl.preset_prescriptions.forEach(rx => {
        _prescriptions.push({ id: crypto.randomUUID(), ...rx });
      });
      _renderRxList();
    }
    _isDirty = true; _saveDraft();
    showToast(`โหลดแม่แบบ "${tmpl.name}" แล้ว`);
    // increment use count (non-blocking)
    apiFetch(`/api/soap-templates/${tmpl.id}/use`, { method: 'POST' }).catch(() => {});
  });

  // Save current SOAP as template
  c.querySelector('#soap-tmpl-save')?.addEventListener('click', _openSaveTemplateModal);

  // Rx delete — delegated once here so _renderRxList can safely replace innerHTML
  c.querySelector('#rx-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-rx-index]');
    if (!btn) return;
    _prescriptions.splice(parseInt(btn.dataset.rxIndex), 1);
    _renderRxList();
    _isDirty = true;
    _saveDraft();
  });

  // Bind pet search autocomplete
  _bindPetSearch(c);

  // Medical images
  _bindImageUpload(c);
  if (_currentRecord?.medical_images?.length) _renderImages(c, _currentRecord.medical_images);
}

function _bindPetSearch(container) {
  const input = container.querySelector('#opd-pet-name');
  const dropdown = container.querySelector('#opd-pet-dropdown');
  const ownerInput = container.querySelector('#opd-owner');
  const speciesSelect = container.querySelector('#opd-species');
  if (!input || !dropdown) return;

  let timer = null;
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);

  async function loadDropdown(q) {
    const url = q.length >= 2
      ? `/api/pets/owners/search?store_id=${storeId}&q=${encodeURIComponent(q)}`
      : `/api/pets/owners/search?store_id=${storeId}`;
    const res = await apiFetch(url);
    const owners = res?.data || [];

    if (!owners.length) {
      dropdown.innerHTML = `
        <div class="px-4 py-3 text-slate-500 font-body text-sm">
          ${q ? `ไม่พบ "${q}"` : 'ยังไม่มีข้อมูลในระบบ'}
        </div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    const rows = [];
    for (const owner of owners) {
      for (const pet of owner.pets || []) {
        rows.push({ pet_id: pet.id, pet_name: pet.name, species: pet.species, owner_name: owner.name, owner_phone: owner.phone || '' });
      }
    }

    if (!rows.length) {
      dropdown.innerHTML = `<div class="px-4 py-3 text-slate-500 font-body text-sm">ไม่พบสัตว์เลี้ยง</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    const header = q ? '' : `<div class="px-4 py-1.5 text-xs text-slate-400 font-body border-b border-slate-100">ค้นหาสัตว์เลี้ยงในระบบ</div>`;

    dropdown.innerHTML = header + rows.map((r, i) => {
      const emoji = SPECIES_EMOJI[r.species] || '🐾';
      return `
        <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors"
             data-ridx="${i}">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-navy">${emoji} ${r.pet_name}</div>
            <div class="text-xs text-slate-400 font-body">เจ้าของ: ${r.owner_name}${r.owner_phone ? ' · ' + r.owner_phone : ''}</div>
          </div>
        </div>`;
    }).join('');

    dropdown.querySelectorAll('[data-ridx]').forEach(el => {
      el.addEventListener('click', () => {
        const row = rows[el.dataset.ridx];
        input.value = row.pet_name;
        if (ownerInput) ownerInput.value = row.owner_name;
        if (speciesSelect && row.species) speciesSelect.value = row.species;

        // Update current record
        if (_currentRecord) {
          _currentRecord.pet_id = row.pet_id;
          _currentRecord.pet_name = row.pet_name;
          _currentRecord.owner_name = row.owner_name;
          _currentRecord.species = row.species;
        }

        dropdown.classList.add('hidden');
        _isDirty = true;

        // Load pet profile if selected
        if (row.pet_id) _loadPetProfile(row.pet_id);
      });
    });

    dropdown.classList.remove('hidden');
  }

  input.addEventListener('focus', () => {
    loadDropdown(input.value.trim());
  });

  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      loadDropdown(e.target.value.trim());
    }, 300);
  });

  input.addEventListener('blur', () => {
    // Revert to selected pet name if they typed something else but didn't select
    setTimeout(() => {
      if (_currentRecord && _currentRecord.pet_name) {
        input.value = _currentRecord.pet_name;
      } else {
        input.value = '';
      }
    }, 200); // Wait for click on dropdown
  });

  container.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }, { signal: _bindAbort.signal });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function _completeRecord() {
  const btn = _container?.querySelector('#opd-complete-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  await _saveRecord('completed');

  // Dispense inventory for prescriptions linked to products
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const linked = _prescriptions.filter(rx => rx.product_id && rx.qty > 0);

  const dispenseResults = await Promise.all(linked.map(rx =>
    apiFetch('/api/inventory/dispense', {
      method: 'POST',
      body: JSON.stringify({
        store_id: storeId,
        product_id: rx.product_id,
        quantity: rx.qty,
        reference_type: 'medical_record',
        reference_id: _currentRecord?.id || null,
        reason: `OPD: ${rx.drug} x${rx.qty}`,
        performed_by: storage.getJSON(STORAGE_KEYS.USER)?.email || 'vet',
      }),
    })
  ));
  let dispensed = 0, failed = 0;
  dispenseResults.forEach((res, i) => {
    if (res?.success) dispensed++;
    else { failed++; showToast(`ตัดสต็อก ${linked[i].drug} ไม่สำเร็จ: ${res?.error}`, 'error'); }
  });

  _clearDraft();

  // Update complete button to done state
  if (btn) {
    btn.disabled = true;
    btn.textContent = '✅ เสร็จสิ้นแล้ว';
    btn.className = btn.className.replace('btn-primary', 'btn-outline opacity-60');
  }

  // Show "ไปชำระเงิน" button
  const posBtn = _container?.querySelector('#opd-goto-pos');
  if (posBtn) {
    posBtn.classList.remove('hidden');
    posBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('fufu:openPOS', {
        detail: {
          queueItem: _currentQueue,
          medicalRecord: { ..._currentRecord, prescriptions: _prescriptions },
        },
      }));
    });
  }

  const msg = linked.length
    ? `เสร็จสิ้น — ตัดสต็อก ${dispensed} รายการ${failed ? ` (ล้มเหลว ${failed})` : ''}`
    : 'บันทึก OPD เสร็จสิ้น';
  showToast(msg);
}

async function _saveRecord(status = 'in_progress') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const c = _container;
  const g = (id) => c.querySelector(`#${id}`)?.value || '';

  const data = {
    store_id: storeId,
    record_type: 'opd',
    status,
    pet_id: _currentRecord?.pet_id || _currentQueue?.pet_id || null,
    pet_name: g('opd-pet-name'),
    owner_name: g('opd-owner'),
    species: c.querySelector('#opd-species')?.value || 'dog',
    subjective: g('hx'),
    objective: g('pe'),
    assessment: g('dx'),
    plan: g('tx'),
    temperature_c: parseFloat(g('v-temp')) || null,
    weight_kg: parseFloat(g('v-weight')) || null,
    heart_rate: parseInt(g('v-hr')) || null,
    respiratory_rate: parseInt(g('v-rr')) || null,
    vitals: {
      temp: g('v-temp'), weight: g('v-weight'), hr: g('v-hr'), rr: g('v-rr'),
    },
    prescriptions: _prescriptions,
    prescribed_meds: _prescriptions,
  };

  _updateSaveStatus('● กำลังบันทึก...');

  let res;
  if (_currentRecord?.id) {
    res = await apiFetch(`/api/medical-records/${_currentRecord.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } else {
    res = await apiFetch('/api/medical-records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  if (res?.success) {
    if (!_currentRecord) _currentRecord = {};
    _currentRecord.id = res.data?.id || _currentRecord.id;
    _isDirty = false;
    _updateSaveStatus('✓ บันทึกแล้ว');
    _saveDraft(); // update draft with record.id so refresh can locate it
  } else {
    _updateSaveStatus('⚠ บันทึกไม่สำเร็จ');
    showToast('บันทึกไม่สำเร็จ', 'error');
  }
}

// ─── Referral letter modal ────────────────────────────────────────────────────

function _openReferralModal() {
  const c         = _container;
  const petName   = c?.querySelector('#opd-pet-name')?.value || _currentRecord?.pet_name   || '';
  const ownerName = c?.querySelector('#opd-owner')?.value    || _currentRecord?.owner_name  || '';
  const diagnosis = c?.querySelector('#dx')?.value           || _currentRecord?.assessment  || '';
  const subjective= c?.querySelector('#hx')?.value           || _currentRecord?.subjective  || '';
  const objective = c?.querySelector('#pe')?.value           || _currentRecord?.objective   || '';
  const plan      = c?.querySelector('#tx')?.value           || _currentRecord?.plan        || '';

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">📋 ใบส่งตัวสัตว์ป่วย</h3>
      <div>
        <label class="input-label">คลินิก / โรงพยาบาลปลายทาง *</label>
        <input id="ref-dest" class="input-field" placeholder="โรงพยาบาลสัตว์...">
      </div>
      <div>
        <label class="input-label">เหตุผลในการส่งตัว *</label>
        <textarea id="ref-reason" class="input-field" rows="3"
          placeholder="เหตุผล, อาการ, ความเร่งด่วน..."></textarea>
      </div>
      <div>
        <label class="input-label">สัตวแพทย์ผู้ส่งตัว</label>
        <input id="ref-vet" class="input-field" placeholder="น.สพ. / สพ.ญ. ...">
      </div>
      <div>
        <label class="input-label">หมายเหตุเพิ่มเติม</label>
        <input id="ref-notes" class="input-field" placeholder="ข้อมูลอื่นๆ...">
      </div>
      <div class="flex gap-3">
        <button id="ref-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="ref-print"  class="btn-primary flex-1">🖨 พิมพ์ใบส่งตัว</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#ref-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#ref-print').addEventListener('click', () => {
    const dest   = modal.querySelector('#ref-dest').value.trim();
    const reason = modal.querySelector('#ref-reason').value.trim();
    if (!dest || !reason) { showToast('กรุณากรอกคลินิกปลายทางและเหตุผล', 'error'); return; }

    const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || 'คลินิก';
    const tab = printReferralLetter({
      storeName,
      petName, ownerName,
      species: c?.querySelector('#opd-species')?.value || _currentRecord?.species || '',
      hn:      _petProfile?.hn  || null,
      diagnosis, subjective, objective, plan,
      prescriptions: _prescriptions,
      destClinic: dest,
      referredBy: modal.querySelector('#ref-vet').value.trim(),
      reason,
      notes: modal.querySelector('#ref-notes').value.trim(),
      date: new Date().toISOString(),
    });
    if (!tab) showToast('กรุณาอนุญาต Pop-up เพื่อพิมพ์', 'error');
    modal.remove();
  });
}

function _updateSaveStatus(msg) {
  const el = _container?.querySelector('#save-status');
  if (el) el.textContent = msg;
}

// ─── Pet profile ──────────────────────────────────────────────────────────────

async function _loadPetProfile(petId) {
  if (!petId) return;
  const res = await apiFetch(`/api/pets/${petId}`);
  const pet = res?.data;
  if (!pet) return;

  _petProfile = pet;
  const c = _container;
  if (!c) return;

  // Allergies warning banner
  if (pet.allergies) {
    const banner = c.querySelector('#opd-allergy-banner');
    const text = c.querySelector('#opd-allergy-text');
    if (banner && text) {
      text.textContent = pet.allergies;
      banner.classList.remove('hidden');
      banner.classList.add('flex');
    }
  }

  // Extra pet info chips (breed, HN, age)
  const extra = c.querySelector('#opd-pet-extra');
  if (extra) {
    const parts = [];
    if (pet.breed) parts.push(pet.breed);
    if (pet.hn) parts.push(`HN-${String(pet.hn).padStart(5, '0')}`);
    if (pet.dob) parts.push(`อายุ ${_calcAge(pet.dob)}`);
    if (pet.is_neutered) parts.push('ทำหมันแล้ว');
    if (parts.length) {
      extra.innerHTML = parts.map(p =>
        `<span class="text-xs bg-slate-100 text-slate-500 rounded px-2 py-0.5 font-body">${p}</span>`
      ).join('');
      extra.classList.remove('hidden');
      extra.classList.add('flex');
    }
  }

  // Pre-fill weight from pet profile if vitals field is empty
  const weightInput = c.querySelector('#v-weight');
  if (weightInput && !weightInput.value && pet.weight_kg) {
    weightInput.value = pet.weight_kg;
  }

  // Update species selector to match pet's species
  const speciesSelect = c.querySelector('#opd-species');
  if (speciesSelect && pet.species && !_currentRecord?.id) {
    speciesSelect.value = pet.species;
  }
}

function _calcAge(dob) {
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (365.25 * 86400000));
  if (years >= 1) return `${years} ปี`;
  const months = Math.floor(diff / (30.44 * 86400000));
  return months > 0 ? `${months} เดือน` : 'น้อยกว่า 1 เดือน';
}

// ─── Prescription modal ───────────────────────────────────────────────────────

async function _openRxModal() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);

  if (!_invCache || Date.now() - _invCacheAt > _INV_CACHE_TTL) {
    const invRes = await apiFetch(`/api/inventory?store_id=${storeId}`);
    _invCache = invRes?.data || [];
    _invCacheAt = Date.now();
  }
  const products = _invCache;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">เพิ่มรายการยา</h3>

      <!-- Product search from inventory -->
      <div>
        <label class="input-label">เลือกจากสต็อก (หรือพิมพ์ชื่อยาเองด้านล่าง)</label>
        <select id="rx-product" class="input-field">
          <option value="">— พิมพ์ชื่อยาเอง —</option>
          ${products.map(p => `<option value="${p.id}" data-name="${p.name}" data-stock="${p.stock}" data-unit="${p.unit || 'ชิ้น'}">
            ${p.icon || '💊'} ${p.name} (คงเหลือ ${p.stock} ${p.unit || 'ชิ้น'})
          </option>`).join('')}
        </select>
      </div>

      <div>
        <label class="input-label">ชื่อยา *</label>
        <input id="rx-drug" class="input-field" placeholder="Amoxicillin">
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="input-label">จำนวน (ตัดสต็อก)</label>
          <input id="rx-qty" class="input-field" type="number" value="1" min="1">
        </div>
        <div>
          <label class="input-label">ขนาดยา</label>
          <input id="rx-dose" class="input-field" placeholder="250mg">
        </div>
        <div>
          <label class="input-label">จำนวนวัน</label>
          <input id="rx-days" class="input-field" type="number" value="3" min="1">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ความถี่</label>
          <select id="rx-freq" class="input-field">
            ${Object.entries(FREQ_LABELS).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">วิธีใช้</label>
          <select id="rx-route" class="input-field">
            ${['PO', 'SC', 'IM', 'IV', 'TOP'].map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="input-label">หมายเหตุ</label>
        <input id="rx-note" class="input-field" placeholder="กินหลังอาหาร">
      </div>
      <div id="rx-stock-warn" class="hidden text-xs text-red-500 font-body"></div>
      <div class="flex gap-3 pt-2">
        <button id="rx-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="rx-add"    class="btn-primary flex-1">+ เพิ่ม</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Auto-fill name when selecting from inventory
  modal.querySelector('#rx-product').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt.value) {
      modal.querySelector('#rx-drug').value = opt.dataset.name;
      const stock = parseInt(opt.dataset.stock);
      const warn = modal.querySelector('#rx-stock-warn');
      if (stock <= 0) {
        warn.textContent = `⚠️ สต็อกหมด ไม่สามารถตัดได้`;
        warn.classList.remove('hidden');
      } else if (stock <= 5) {
        warn.textContent = `⚠️ สต็อกเหลือน้อย: ${stock} ${opt.dataset.unit}`;
        warn.classList.remove('hidden');
      } else {
        warn.classList.add('hidden');
      }
    }
  });

  modal.querySelector('#rx-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#rx-add').addEventListener('click', () => {
    const drug = modal.querySelector('#rx-drug').value.trim();
    const productSel = modal.querySelector('#rx-product');
    const productId = productSel.value || null;
    const qty = parseInt(modal.querySelector('#rx-qty').value) || 1;

    if (!drug) { showToast('กรุณากรอกชื่อยา', 'error'); return; }

    // Check stock if linked to inventory
    if (productId) {
      const opt = productSel.selectedOptions[0];
      const stock = parseInt(opt?.dataset.stock || '0');
      if (stock < qty) {
        showToast(`สต็อกไม่พอ: มี ${stock} ต้องการ ${qty}`, 'error');
        return;
      }
    }

    _prescriptions.push({
      id:         crypto.randomUUID(),
      drug,
      product_id: productId,
      qty,
      dose:  modal.querySelector('#rx-dose').value.trim(),
      days:  parseInt(modal.querySelector('#rx-days').value) || 3,
      freq:  modal.querySelector('#rx-freq').value,
      route: modal.querySelector('#rx-route').value,
      note:  modal.querySelector('#rx-note').value.trim(),
    });

    _renderRxList();
    _isDirty = true;
    _saveDraft();
    modal.remove();
    showToast(`เพิ่ม ${drug} แล้ว`);
  });
}

function _renderRxList() {
  const el = _container?.querySelector('#rx-list');
  if (!el) return;

  if (_prescriptions.length === 0) {
    el.innerHTML = '<p class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีรายการยา</p>';
    return;
  }

  el.innerHTML = _prescriptions.map((rx, i) => `
    <div class="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
      <div class="flex-1 min-w-0">
        <span class="font-semibold text-navy text-sm">${rx.drug}</span>
        <span class="text-slate-400 mx-1.5 font-body">·</span>
        <span class="text-sm font-body text-slate-600">${rx.dose}</span>
        <span class="text-slate-400 mx-1.5 font-body">·</span>
        <span class="text-sm font-body text-slate-600">${rx.freq} ${rx.days}วัน ${rx.route}</span>
        ${rx.note ? `<span class="text-xs text-slate-400 font-body ml-2">(${rx.note})</span>` : ''}
      </div>
      <button data-rx-index="${i}" class="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
    </div>`).join('');
}

// ─── Medical image helpers ────────────────────────────────────────────────────

function _bindImageUpload(c) {
  const input = c.querySelector('#img-upload-input');
  if (!input) return;

  input.addEventListener('change', async () => {
    if (!_currentRecord?.id) {
      showToast('กรุณาบันทึก OPD ก่อนแนบภาพ', 'error'); return;
    }
    const valid = Array.from(input.files).slice(0, 5).filter(f => {
      if (f.size > 512 * 1024) { showToast(`${f.name} ใหญ่เกิน 500KB`, 'error'); return false; }
      return true;
    });
    const results = await Promise.allSettled(valid.map(async file => {
      const base64 = await _fileToBase64(file);
      return apiFetch(`/api/medical-records/${_currentRecord.id}/images`, {
        method: 'POST',
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size, label: file.name, data: base64 }),
      });
    }));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.success) {
        if (!_currentRecord.medical_images) _currentRecord.medical_images = [];
        _currentRecord.medical_images.push(r.value.data.image);
        showToast(`แนบ ${valid[i].name} แล้ว`);
      } else {
        showToast(r.value?.error || 'แนบภาพไม่สำเร็จ', 'error');
      }
    });
    if (results.some(r => r.status === 'fulfilled' && r.value?.success)) {
      _renderImages(c, _currentRecord.medical_images);
    }
    input.value = '';
  });

  c.querySelector('#medical-images-grid')?.addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-del-img]');
    if (delBtn && _currentRecord?.id) {
      e.stopPropagation();
      const imgId = delBtn.dataset.delImg;
      await apiFetch(`/api/medical-records/${_currentRecord.id}/images/${imgId}`, { method: 'DELETE' });
      _currentRecord.medical_images = (_currentRecord.medical_images || []).filter(i => i.id !== imgId);
      _renderImages(c, _currentRecord.medical_images);
      return;
    }
    const openEl = e.target.closest('[data-open-img]');
    if (openEl) {
      const imgId = openEl.dataset.openImg;
      const img = (_currentRecord.medical_images || []).find(i => i.id === imgId);
      if (img) window.open(img.data, '_blank');
    }
  });
}

function _renderImages(c, images) {
  const grid = c.querySelector('#medical-images-grid');
  if (!grid) return;
  if (!images?.length) {
    grid.innerHTML = '<p class="text-slate-400 font-body text-sm py-2">ยังไม่มีภาพ</p>';
    return;
  }
  grid.innerHTML = images.map(img => `
    <div data-open-img="${img.id}"
         class="relative group w-24 h-24 rounded-xl overflow-hidden border border-slate-200 cursor-pointer">
      <img src="${img.data}" alt="${img.label}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
        <button data-del-img="${img.id}"
          class="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-6 h-6
                 flex items-center justify-center text-xs transition-opacity">
          ×
        </button>
      </div>
      <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs font-body px-1 py-0.5 truncate">
        ${img.label}
      </div>
    </div>`).join('');
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── SOAP Template helpers ────────────────────────────────────────────────────

async function _loadSoapTemplates(c) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const res = await apiFetch(`/api/soap-templates?store_id=${storeId}`);
  const templates = res?.data || [];
  const sel = c.querySelector('#soap-tmpl-select');
  if (!sel) return;
  _soapTemplates = templates;
  if (!templates.length) {
    sel.innerHTML = '<option value="">— ยังไม่มีแม่แบบ (กด "+ บันทึกเป็นแม่แบบ") —</option>';
    return;
  }
  sel.innerHTML = '<option value="">— เลือกแม่แบบ —</option>' +
    templates.map(t =>
      `<option value="${t.id}">${t.name}${t.use_count > 0 ? ` (ใช้ ${t.use_count}×)` : ''}</option>`
    ).join('');
}

function _openSaveTemplateModal() {
  const c         = _container;
  const storeId   = storage.get(STORAGE_KEYS.STORE_ID);
  const hx = c?.querySelector('#hx')?.value || '';
  const pe = c?.querySelector('#pe')?.value || '';
  const dx = c?.querySelector('#dx')?.value || '';
  const tx = c?.querySelector('#tx')?.value || '';

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
      <h3 class="font-bold text-navy text-lg">📋 บันทึกแม่แบบ SOAP</h3>
      <div>
        <label class="input-label">ชื่อแม่แบบ *</label>
        <input id="tmpl-name" class="input-field" placeholder="เช่น โรคพาร์โว, แผลผ่าตัดทำหมัน...">
      </div>
      <div class="text-xs text-slate-400 font-body space-y-0.5">
        ${(() => { const trunc = (s, n=60) => s.length > n ? s.substring(0,n)+'…' : s; return [
          hx && `<div>✓ HX: ${trunc(hx)}</div>`,
          pe && `<div>✓ PE: ${trunc(pe)}</div>`,
          dx && `<div>✓ Dx: ${trunc(dx)}</div>`,
          tx && `<div>✓ Tx: ${trunc(tx)}</div>`,
        ].filter(Boolean).join(''); })()}
        ${_prescriptions.length ? `<div>✓ ยา ${_prescriptions.length} รายการ</div>` : ''}
      </div>
      <div class="flex gap-3">
        <button id="tmpl-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="tmpl-save"   class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#tmpl-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#tmpl-save').addEventListener('click', async () => {
    const name = modal.querySelector('#tmpl-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อแม่แบบ', 'error'); return; }
    const btn = modal.querySelector('#tmpl-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/soap-templates', {
      method: 'POST',
      body: JSON.stringify({
        store_id: storeId,
        name,
        subjective_template:  hx || null,
        objective_template:   pe || null,
        assessment_template:  dx || null,
        plan_template:        tx || null,
        preset_prescriptions: _prescriptions.map(({ drug, dose, freq, days, route, note }) =>
          ({ drug, dose, freq, days, route, note })
        ),
      }),
    });

    if (res?.success) {
      modal.remove();
      showToast(`บันทึกแม่แบบ "${name}" แล้ว`);
      _loadSoapTemplates(c);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  setTimeout(() => modal.querySelector('#tmpl-name')?.focus(), 50);
}
