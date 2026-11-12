import { apiFetch }   from '../utils/api-client.js';
import { storage }    from '../utils/storage.js';
import { showToast }  from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { formatThaiDate, escapeHtml } from '../utils/formatters.js';

const SPECIES_EMOJI = { dog: '', cat: '', rabbit: '', bird: '', other: '' };
const STATUS_CFG = {
  in_progress: { label: 'กำลังรักษา', cls: 'bg-blue-50 text-blue-600' },
  completed:   { label: 'เสร็จสิ้น',   cls: 'badge-teal' },
};
const FREQ_LABELS = { SID: 'วันละ 1×', BID: 'วันละ 2×', TID: 'วันละ 3×', QID: 'วันละ 4×', PRN: 'เมื่อจำเป็น' };

let _storeId    = '';
let _allRecords = [];
let _container  = null;

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderMedicalRecords(container) {
  _storeId   = storage.get(STORAGE_KEYS.STORE_ID);
  _container = container;

  container.innerHTML = `
    <div class="space-y-4 w-full">
      <div class="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input id="med-search" class="input-field flex-1" placeholder="ค้นหาชื่อสัตว์เลี้ยง / เจ้าของ...">
        <select id="med-filter" class="input-field w-44">
          <option value="">ทุกสถานะ</option>
          <option value="in_progress">กำลังรักษา</option>
          <option value="completed">เสร็จสิ้น</option>
        </select>
      </div>
      <div id="med-list" class="space-y-2">
        <div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>
      </div>
    </div>`;

  container.querySelector('#med-search').addEventListener('input',  _applyFilter);
  container.querySelector('#med-filter').addEventListener('change', _applyFilter);
  container.querySelector('#med-list').addEventListener('click',    _handleRowClick);

  await _loadRecords();
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function _loadRecords() {
  const res   = await apiFetch(`/api/medical-records?store_id=${_storeId}&limit=100`);
  _allRecords = res?.data || [];
  _renderList(_allRecords);
}

function _applyFilter() {
  const q      = _container?.querySelector('#med-search')?.value.toLowerCase() || '';
  const status = _container?.querySelector('#med-filter')?.value || '';
  const filtered = _allRecords.filter(r => {
    const matchText   = !q || (r.pet_name||'').toLowerCase().includes(q) || (r.owner_name||'').toLowerCase().includes(q);
    const matchStatus = !status || r.status === status;
    return matchText && matchStatus;
  });
  _renderList(filtered);
}

// ─── List ─────────────────────────────────────────────────────────────────────

function _renderList(records) {
  const el = _container?.querySelector('#med-list');
  if (!el) return;

  if (!records.length) {
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ไม่พบประวัติการรักษา</div>`;
    return;
  }
  el.innerHTML = records.map(_recordRow).join('');
}

function _recordRow(r) {
  const sp      = SPECIES_EMOJI[r.species] || '';
  const cfg     = STATUS_CFG[r.status]     || STATUS_CFG.in_progress;
  const date    = formatThaiDate(r.visit_date || r.created_at);
  const rxCount = (r.prescriptions || r.prescribed_meds || []).length;
  const snippet = r.assessment || r.diagnosis || r.subjective || '';

  return `
    <div class="card px-3 py-2.5 hover:shadow-card-hover transition-shadow cursor-pointer"
         data-record-id="${r.id}">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-primary-subtle flex items-center justify-center text-base flex-shrink-0">${sp}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-navy text-sm truncate">${escapeHtml(r.pet_name) || '(ไม่ระบุชื่อ)'}</span>
            <span class="badge ${cfg.cls}">${cfg.label}</span>
            ${rxCount ? `<span class="text-xs badge badge-navy">${rxCount}</span>` : ''}
          </div>
          <div class="text-xs text-slate-500 font-body mt-0.5 truncate">
            ${r.owner_name ? `${escapeHtml(r.owner_name)} · ` : ''}${date}${snippet ? ` · ${escapeHtml(snippet)}` : ''}
          </div>
        </div>
        <div class="flex-shrink-0 flex gap-1.5 items-center">
          ${r.weight_kg     ? `<span class="hidden sm:inline-flex text-xs badge badge-navy">${r.weight_kg}kg</span>` : ''}
          ${r.temperature_c ? `<span class="hidden sm:inline-flex text-xs badge badge-navy">${r.temperature_c}°C</span>` : ''}
          <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>`;
}

function _handleRowClick(e) {
  const row = e.target.closest('[data-record-id]');
  if (!row) return;
  const record = _allRecords.find(r => r.id === row.dataset.recordId);
  if (record) _openRecordView(record);
}

// ─── Read-only view modal ─────────────────────────────────────────────────────

function _openRecordView(r) {
  const sp        = SPECIES_EMOJI[r.species] || '';
  const cfg       = STATUS_CFG[r.status]     || STATUS_CFG.in_progress;
  const date      = formatThaiDate(r.visit_date || r.created_at);
  const rxs       = r.prescriptions || r.prescribed_meds || [];
  const staffRole = storage.get(STORAGE_KEYS.STAFF_ROLE);
  const canEdit   = staffRole === 'owner' || staffRole === 'vet';

  function _field(label, val) {
    if (!val) return '';
    const text = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
    return `
      <div>
        <div class="text-xs font-semibold text-slate-400 font-body mb-0.5">${label}</div>
        <div class="text-sm text-navy whitespace-pre-wrap">${escapeHtml(text)}</div>
      </div>`;
  }

  const vitalsHtml = (r.temperature_c || r.heart_rate || r.respiratory_rate || r.weight_kg) ? `
    <div class="flex flex-wrap gap-2">
      ${r.temperature_c    ? `<span class="badge badge-navy">${r.temperature_c}°C</span>` : ''}
      ${r.heart_rate       ? `<span class="badge badge-navy">${r.heart_rate} bpm</span>` : ''}
      ${r.respiratory_rate ? `<span class="badge badge-navy">${r.respiratory_rate}/min</span>` : ''}
      ${r.weight_kg        ? `<span class="badge badge-navy">${r.weight_kg} kg</span>` : ''}
    </div>` : '';

  const rxHtml = rxs.length ? `
    <div>
      <div class="text-xs font-semibold text-slate-400 font-body mb-1.5">ใบสั่งยา (${rxs.length} รายการ)</div>
      <div class="space-y-1.5">
        ${rxs.map(rx => `
          <div class="flex items-start gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
            <span class="text-base"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/></svg></span>
            <div class="flex-1 min-w-0">
              <span class="font-semibold text-navy">${escapeHtml(rx.drug || rx.name || '?')}</span>
              ${rx.dose ? `<span class="text-slate-500 font-body ml-1">· ${escapeHtml(rx.dose)}</span>` : ''}
              ${rx.freq ? `<span class="text-xs text-slate-400 font-body ml-1">${FREQ_LABELS[rx.freq] || escapeHtml(rx.freq)}</span>` : ''}
              ${rx.days ? `<span class="text-xs text-slate-400 font-body ml-1">· ${escapeHtml(String(rx.days))} วัน</span>` : ''}
              ${rx.note ? `<div class="text-xs text-slate-400 font-body mt-0.5">${escapeHtml(rx.note)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>` : '';

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${sp}</span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-navy">${escapeHtml(r.pet_name) || '(ไม่ระบุชื่อ)'}</span>
              <span class="badge ${cfg.cls}">${cfg.label}</span>
            </div>
            <div class="text-xs text-slate-400 font-body">
              ${r.owner_name ? `เจ้าของ: ${escapeHtml(r.owner_name)} · ` : ''}${date}
            </div>
          </div>
        </div>
        <button id="view-close"
          class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400
                 hover:text-navy hover:bg-slate-100 transition-colors text-xl leading-none">
          ×
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        ${vitalsHtml}
        ${_field('HX (ประวัติ)',       r.subjective)}
        ${_field('PE (ตรวจร่างกาย)',   r.objective)}
        ${_field('Dx (การวินิจฉัย)',  r.assessment || r.diagnosis)}
        ${_field('Tx (แผนการรักษา)', r.plan       || r.treatment)}
        ${_field('หมายเหตุ',           r.notes)}
        ${_field('ผลแลป',             r.lab_results ? (typeof r.lab_results === 'object' ? JSON.stringify(r.lab_results, null, 2) : r.lab_results) : null)}
        ${_field('นัดครั้งต่อไป',     r.next_appointment)}
        ${rxHtml}
        ${!vitalsHtml && !r.subjective && !r.objective && !r.assessment && !r.diagnosis && !rxs.length ? `
          <div class="text-center py-8 text-slate-400 font-body text-sm">ยังไม่มีข้อมูลในบันทึกนี้</div>` : ''}
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
        ${canEdit ? `
          <button id="view-edit"
            class="btn-primary flex-1 text-sm py-2.5">
           แก้ไข OPD Card
          </button>
          <button id="view-delete"
            class="text-sm px-4 py-2.5 rounded-xl border border-red-200 text-red-400
                   hover:bg-red-50 hover:text-red-500 transition-colors font-semibold">
            ลบ
          </button>
        ` : `
          <button id="view-close-btn" class="btn-outline flex-1 text-sm py-2.5">ปิด</button>
        `}
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#view-close').addEventListener('click', close);
  modal.querySelector('#view-close-btn')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#view-edit')?.addEventListener('click', () => {
    close();
    document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: { _existingRecord: r } }));
  });

  modal.querySelector('#view-delete')?.addEventListener('click', () => _deleteRecord(r, modal));
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function _deleteRecord(r, modal) {
  const dateStr = formatThaiDate(r.visit_date || r.created_at);
  if (!confirm(`ลบประวัติของ "${r.pet_name || 'สัตว์'}" วันที่ ${dateStr}?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;

  const res = await apiFetch(`/api/medical-records/${r.id}`, { method: 'DELETE' });
  if (res?.success) {
    modal.remove();
    showToast('ลบประวัติการรักษาแล้ว');
    _allRecords = _allRecords.filter(x => x.id !== r.id);
    _renderList(_allRecords);
  } else {
    showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  }
}
