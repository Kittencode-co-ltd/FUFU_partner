import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };
const STATUS_CFG = {
  in_progress: { label: 'กำลังรักษา', cls: 'bg-blue-50 text-blue-600' },
  completed:   { label: 'เสร็จสิ้น',   cls: 'badge-teal' },
};

let _storeId = '';
let _allRecords = [];

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderMedicalRecords(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);

  container.innerHTML = `
    <div class="space-y-4 max-w-4xl">
      <!-- Search bar -->
      <div class="card p-4 flex gap-3">
        <input id="med-search" class="input-field flex-1" placeholder="🔍 ค้นหาชื่อสัตว์เลี้ยง / เจ้าของ">
        <select id="med-filter" class="input-field w-40">
          <option value="">ทุกสถานะ</option>
          <option value="in_progress">กำลังรักษา</option>
          <option value="completed">เสร็จสิ้น</option>
        </select>
      </div>

      <!-- Records list -->
      <div id="med-list" class="space-y-2">
        <div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>
      </div>
    </div>`;

  container.querySelector('#med-search').addEventListener('input', _applyFilter);
  container.querySelector('#med-filter').addEventListener('change', _applyFilter);

  await _loadRecords();
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function _loadRecords() {
  const res = await apiFetch(`/api/medical-records?store_id=${_storeId}&record_type=opd&limit=100`);
  _allRecords = res?.data || [];
  _renderList(_allRecords);
}

function _applyFilter() {
  const q      = document.getElementById('med-search')?.value.toLowerCase() || '';
  const status = document.getElementById('med-filter')?.value || '';

  const filtered = _allRecords.filter(r => {
    const matchText = !q ||
      (r.pet_name   || '').toLowerCase().includes(q) ||
      (r.owner_name || '').toLowerCase().includes(q);
    const matchStatus = !status || r.status === status;
    return matchText && matchStatus;
  });
  _renderList(filtered);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _renderList(records) {
  const el = document.getElementById('med-list');
  if (!el) return;

  if (records.length === 0) {
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ไม่พบประวัติการรักษา</div>`;
    return;
  }

  el.innerHTML = records.map(_recordRow).join('');
  el.addEventListener('click', _handleRowClick);
}

function _recordRow(r) {
  const sp      = SPECIES_EMOJI[r.species] || '🐾';
  const cfg     = STATUS_CFG[r.status]     || STATUS_CFG.in_progress;
  const date    = r.visit_date
    ? new Date(r.visit_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
    : new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  const hasSoap = r.subjective || r.objective || r.assessment || r.plan;

  return `
    <div class="card p-4 hover:shadow-card-hover transition-shadow cursor-pointer"
         data-record-id="${r.id}" data-record='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-primary-subtle flex items-center justify-center text-xl flex-shrink-0">
          ${sp}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-navy">${r.pet_name || '(ไม่ระบุชื่อ)'}</span>
            <span class="badge ${cfg.cls}">${cfg.label}</span>
          </div>
          <div class="text-sm text-slate-500 font-body mt-0.5">
            ${r.owner_name ? `เจ้าของ: ${r.owner_name} · ` : ''}${date}
          </div>
          ${hasSoap ? `
            <div class="text-xs text-slate-400 font-body mt-1 truncate">
              ${r.assessment ? `Dx: ${r.assessment}` : r.subjective ? r.subjective : ''}
            </div>` : ''}
        </div>
        <div class="flex-shrink-0 flex gap-2 items-center">
          ${r.weight_kg    ? `<span class="text-xs badge badge-navy">⚖ ${r.weight_kg}kg</span>` : ''}
          ${r.temperature_c ? `<span class="text-xs badge badge-navy">🌡 ${r.temperature_c}°C</span>` : ''}
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

  try {
    const record = JSON.parse(row.dataset.record.replace(/&#39;/g, "'"));
    document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: { _existingRecord: record } }));
  } catch {
    showToast('ไม่สามารถเปิด OPD card ได้', 'error');
  }
}
