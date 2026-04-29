import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const VITALS_NORMAL = {
  temp:   { min: 37.5, max: 39.2, unit: '°C' },
  weight: { min: null, max: null, unit: 'kg'  },
  hr:     { min: 60,   max: 140,  unit: 'bpm' },
  rr:     { min: 10,   max: 30,   unit: '/min' },
};

const FREQ_LABELS = { SID: 'วันละ 1×', BID: 'วันละ 2×', TID: 'วันละ 3×', QID: 'วันละ 4×', PRN: 'เมื่อจำเป็น' };
const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };
const COMMISSION_RATE = 0.05;

let _currentQueue  = null;
let _currentRecord = null;
let _prescriptions = [];
let _autosaveTimer = null;
let _isDirty       = false;
let _container     = null;

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderOPDCard(container, detail = null) {
  _container = container;
  _prescriptions = [];
  _isDirty = false;
  clearTimeout(_autosaveTimer);

  const existing = detail?._existingRecord;

  if (existing) {
    // Opened from medical records list — load full existing record
    _currentQueue  = null;
    _currentRecord = { ...existing };
    _prescriptions = Array.isArray(existing.prescriptions)
      ? existing.prescriptions
      : (Array.isArray(existing.prescribed_meds) ? existing.prescribed_meds : []);
  } else if (detail && !existing) {
    // Opened from queue card
    _currentQueue = detail;
    const notes = detail.notes || '';
    const [petName, ownerName] = notes.includes(' - ')
      ? notes.split(' - ').map(s => s.trim())
      : [notes, ''];
    _currentRecord = { id: null, pet_name: petName, owner_name: ownerName, species: 'dog' };
  } else {
    _currentQueue  = null;
    _currentRecord = { id: null, pet_name: '', owner_name: '', species: 'dog' };
  }

  container.innerHTML = _buildHTML();
  _bindEvents();
  if (_prescriptions.length) _renderRxList();
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function _buildHTML() {
  const r   = _currentRecord;
  const q   = _currentQueue;
  const num = q?.queue_number ? `A${String(q.queue_number).padStart(3, '0')}` : '';
  const sp  = r.species || 'dog';
  const v   = r.vitals || {};

  return `
  <div class="space-y-4 max-w-4xl mx-auto">

    <!-- Patient bar -->
    <div class="card p-4 flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-primary-subtle flex items-center justify-center text-2xl flex-shrink-0">
        ${SPECIES_EMOJI[sp] || '🐾'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <input id="opd-pet-name" value="${r.pet_name || ''}"
            class="font-bold text-navy text-lg bg-transparent border-b border-transparent
                   hover:border-slate-200 focus:border-primary outline-none transition-colors min-w-32"
            placeholder="ชื่อสัตว์เลี้ยง">
          <select id="opd-species"
            class="text-sm text-slate-500 bg-transparent border border-slate-200 rounded-lg px-2 py-1
                   focus:border-primary outline-none">
            ${Object.entries(SPECIES_EMOJI).map(([k,v]) =>
              `<option value="${k}" ${k === sp ? 'selected' : ''}>${v} ${k}</option>`
            ).join('')}
          </select>
          ${num ? `<span class="badge badge-teal">${num}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs text-slate-400 font-body">เจ้าของ:</span>
          <input id="opd-owner" value="${r.owner_name || ''}"
            class="text-sm text-slate-600 font-body bg-transparent border-b border-transparent
                   hover:border-slate-200 focus:border-primary outline-none transition-colors flex-1 min-w-24"
            placeholder="ชื่อเจ้าของ">
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span id="save-status" class="text-xs text-slate-400 font-body"></span>
        <button id="opd-back-btn"     class="btn-outline text-sm px-3 py-2">← กลับ</button>
        <button id="opd-save-btn"     class="btn-outline text-sm px-4 py-2">💾 บันทึก</button>
        <button id="opd-complete-btn" class="btn-primary text-sm px-4 py-2">✓ เสร็จสิ้น</button>
      </div>
    </div>

    <!-- Vitals -->
    <div class="grid grid-cols-4 gap-3">
      ${_vitalInput('v-temp',   '🌡', 'อุณหภูมิ', r.temperature_c  || v.temp   || '', 'temp')}
      ${_vitalInput('v-weight', '⚖', 'น้ำหนัก',  r.weight_kg      || v.weight || '', 'weight')}
      ${_vitalInput('v-hr',     '❤', 'ชีพจร',    r.heart_rate     || v.hr     || '', 'hr')}
      ${_vitalInput('v-rr',     '🫁', 'หายใจ',    r.respiratory_rate || v.rr  || '', 'rr')}
    </div>

    <!-- SOAP -->
    <div class="grid grid-cols-2 gap-3">
      ${_soapBox('soap-s', 'S', 'Subjective', 'border-t-blue-500',   'soap-letter-s', 'ประวัติ / อาการ', r.subjective  || '')}
      ${_soapBox('soap-o', 'O', 'Objective',  'border-t-purple-500', 'soap-letter-o', 'ผลการตรวจร่างกาย',             r.objective   || '')}
      ${_soapBox('soap-a', 'A', 'Assessment', 'border-t-orange-400', 'soap-letter-a', 'การวินิจฉัย',                  r.assessment  || '')}
      ${_soapBox('soap-p', 'P', 'Plan',       'border-t-primary',    'soap-letter-p', 'แผนการรักษา',                  r.plan        || '')}
    </div>

    <!-- Prescription -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-navy">💊 ใบสั่งยา</h3>
        <button id="add-rx-btn" class="text-sm text-primary border border-primary px-3 py-1 rounded-lg hover:bg-primary-subtle transition-colors">
          + เพิ่มยา
        </button>
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

function _soapBox(id, letter, title, borderCls, letterCls, placeholder, value = '') {
  const colors = {
    'soap-letter-s': 'bg-blue-100 text-blue-700',
    'soap-letter-o': 'bg-purple-100 text-purple-700',
    'soap-letter-a': 'bg-orange-100 text-orange-600',
    'soap-letter-p': 'bg-primary-subtle text-primary-dark',
  };
  return `
    <div class="card border-t-4 ${borderCls} p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${colors[letterCls] || ''}">
          ${letter}
        </span>
        <span class="text-sm font-semibold text-navy">${title}</span>
      </div>
      <textarea id="${id}" rows="4"
        class="w-full text-sm font-body text-navy-mid bg-slate-50 rounded-lg p-2.5
               border border-slate-100 focus:border-primary focus:bg-white outline-none
               resize-none transition-colors placeholder:text-slate-300"
        placeholder="${placeholder}">${value}</textarea>
    </div>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────

function _bindEvents() {
  const c = _container;

  // Autosave on SOAP input
  c.querySelectorAll('textarea[id^="soap-"]').forEach(ta => {
    ta.addEventListener('input', () => {
      _isDirty = true;
      _updateSaveStatus('● กำลังบันทึก...');
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => _saveRecord('in_progress'), 1500);
    });
  });

  // Vitals color coding on input
  c.querySelectorAll('input[data-min]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v   = parseFloat(inp.value);
      const min = parseFloat(inp.dataset.min);
      const max = parseFloat(inp.dataset.max);
      inp.classList.toggle('text-red-500', !isNaN(v) && (v < min || v > max));
    });
  });

  // Patient info -> mark dirty
  c.querySelectorAll('#opd-pet-name, #opd-owner, #opd-species').forEach(el => {
    el.addEventListener('change', () => { _isDirty = true; });
  });

  // Back button
  c.querySelector('#opd-back-btn')?.addEventListener('click', () => {
    const from = _currentQueue ? 'queue' : 'medical';
    import('../partner/dashboard.js').then(({ navigate }) => navigate(from));
  });

  // Save (draft)
  c.querySelector('#opd-save-btn')?.addEventListener('click', () => _saveRecord('in_progress'));

  // Complete + dispense
  c.querySelector('#opd-complete-btn')?.addEventListener('click', () => _completeRecord());

  // Print
  c.querySelector('#opd-print-btn')?.addEventListener('click', () => window.print());

  // Add prescription
  c.querySelector('#add-rx-btn')?.addEventListener('click', _openRxModal);
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function _completeRecord() {
  const btn = _container?.querySelector('#opd-complete-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  await _saveRecord('completed');

  // Dispense inventory for prescriptions linked to products
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const linked  = _prescriptions.filter(rx => rx.product_id && rx.qty > 0);

  if (linked.length === 0) {
    if (btn) { btn.disabled = false; btn.textContent = '✓ เสร็จสิ้น'; }
    showToast('บันทึกเสร็จสิ้น (ไม่มียาที่ต้องตัดสต็อก)');
    return;
  }

  let dispensed = 0, failed = 0;
  for (const rx of linked) {
    const res = await apiFetch('/api/inventory/dispense', {
      method: 'POST',
      body: JSON.stringify({
        store_id:       storeId,
        product_id:     rx.product_id,
        quantity:       rx.qty,
        reference_type: 'medical_record',
        reference_id:   _currentRecord?.id || null,
        reason:         `OPD: ${rx.drug} x${rx.qty}`,
        performed_by:   storage.getJSON(STORAGE_KEYS.USER)?.email || 'vet',
      }),
    });
    if (res?.success) dispensed++;
    else { failed++; showToast(`ตัดสต็อก ${rx.drug} ไม่สำเร็จ: ${res?.error}`, 'error'); }
  }

  if (btn) { btn.disabled = false; btn.textContent = '✓ เสร็จสิ้น'; }
  showToast(`เสร็จสิ้น — ตัดสต็อก ${dispensed} รายการ${failed ? ` (ล้มเหลว ${failed})` : ''}`);
}

async function _saveRecord(status = 'in_progress') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const c = _container;
  const g = (id) => c.querySelector(`#${id}`)?.value || '';

  const data = {
    store_id:    storeId,
    record_type: 'opd',
    status,
    pet_name:    g('opd-pet-name'),
    owner_name:  g('opd-owner'),
    species:     c.querySelector('#opd-species')?.value || 'dog',
    subjective:  g('soap-s'),
    objective:   g('soap-o'),
    assessment:  g('soap-a'),
    plan:        g('soap-p'),
    temperature_c:    parseFloat(g('v-temp'))   || null,
    weight_kg:        parseFloat(g('v-weight')) || null,
    heart_rate:       parseInt(g('v-hr'))       || null,
    respiratory_rate: parseInt(g('v-rr'))       || null,
    vitals: {
      temp: g('v-temp'), weight: g('v-weight'), hr: g('v-hr'), rr: g('v-rr'),
    },
    prescriptions:  _prescriptions,
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
  } else {
    _updateSaveStatus('⚠ บันทึกไม่สำเร็จ');
    showToast('บันทึกไม่สำเร็จ', 'error');
  }
}

function _updateSaveStatus(msg) {
  const el = _container?.querySelector('#save-status');
  if (el) el.textContent = msg;
}

// ─── Prescription modal ───────────────────────────────────────────────────────

async function _openRxModal() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);

  // Load inventory products for search
  const invRes   = await apiFetch(`/api/inventory?store_id=${storeId}`);
  const products = invRes?.data || [];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">เพิ่มรายการยา</h3>

      <!-- Product search from inventory -->
      <div>
        <label class="input-label">เลือกจากสต็อก (หรือพิมพ์ชื่อยาเองด้านล่าง)</label>
        <select id="rx-product" class="input-field">
          <option value="">— พิมพ์ชื่อยาเอง —</option>
          ${products.map(p => `<option value="${p.id}" data-name="${p.name}" data-stock="${p.stock}" data-unit="${p.unit||'ชิ้น'}">
            ${p.icon||'💊'} ${p.name} (คงเหลือ ${p.stock} ${p.unit||'ชิ้น'})
          </option>`).join('')}
        </select>
      </div>

      <div>
        <label class="input-label">ชื่อยา *</label>
        <input id="rx-drug" class="input-field" placeholder="Amoxicillin">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">จำนวน (ตัดสต็อก)</label>
          <input id="rx-qty" class="input-field" type="number" value="1" min="1">
        </div>
        <div>
          <label class="input-label">ขนาดยา</label>
          <input id="rx-dose" class="input-field" placeholder="250mg">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ความถี่</label>
          <select id="rx-freq" class="input-field">
            ${Object.entries(FREQ_LABELS).map(([k,v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">วิธีใช้</label>
          <select id="rx-route" class="input-field">
            ${['PO','SC','IM','IV','TOP'].map(r => `<option value="${r}">${r}</option>`).join('')}
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
      const warn  = modal.querySelector('#rx-stock-warn');
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
    const drug       = modal.querySelector('#rx-drug').value.trim();
    const productSel = modal.querySelector('#rx-product');
    const productId  = productSel.value || null;
    const qty        = parseInt(modal.querySelector('#rx-qty').value) || 1;

    if (!drug) { showToast('กรุณากรอกชื่อยา', 'error'); return; }

    // Check stock if linked to inventory
    if (productId) {
      const opt   = productSel.selectedOptions[0];
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
      freq:  modal.querySelector('#rx-freq').value,
      route: modal.querySelector('#rx-route').value,
      note:  modal.querySelector('#rx-note').value.trim(),
    });

    _renderRxList();
    _isDirty = true;
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

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rx-index]');
    if (!btn) return;
    _prescriptions.splice(parseInt(btn.dataset.rxIndex), 1);
    _renderRxList();
    _isDirty = true;
  });
}
