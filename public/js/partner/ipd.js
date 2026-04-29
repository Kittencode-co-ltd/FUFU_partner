import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { logAudit }  from './audit.js';

let _storeId = '';

const STATUS_CFG = {
  available:   { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  icon: 'fa-door-open', label: 'ว่าง'    },
  occupied:    { color: '#F97316', bg: 'rgba(249,115,22,0.10)',  icon: 'fa-paw',       label: 'มีผู้ป่วย' },
  maintenance: { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: 'fa-wrench',    label: 'ซ่อม'    },
  reserved:    { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  icon: 'fa-clock',     label: 'จอง'     },
};
const TYPE_ICON = { standard: '🏠', large: '🏡', icu: '🏥', isolation: '⚠️' };

export async function renderIPDWard(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
}

async function _render(container) {
  const [cagesRes, admissionsRes] = await Promise.all([
    apiFetch(`/api/ipd/cages?store_id=${_storeId}`),
    apiFetch(`/api/ipd/admissions?store_id=${_storeId}&status=admitted`),
  ]);

  let cages      = cagesRes?.data || [];
  const admitted = admissionsRes?.data || [];

  // Enrich cages with current admission
  const admMap = {};
  admitted.forEach(a => { if (a.cage_id) admMap[a.cage_id] = a; });
  cages = cages.map(c => ({ ...c, current_admission: admMap[c.id] || null,
    status: admMap[c.id] ? 'occupied' : c.status }));

  const stats = {
    total:    cages.length,
    occupied: cages.filter(c => c.status === 'occupied').length,
    available:cages.filter(c => c.status === 'available').length,
    icu:      cages.filter(c => c.cage_type === 'icu' && c.status === 'occupied').length,
  };

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Stats -->
      <div class="grid grid-cols-4 gap-3">
        ${[
          { val: stats.total,     label: 'กรงทั้งหมด', color: '#1E293B'   },
          { val: stats.occupied,  label: 'มีผู้ป่วย',  color: '#F97316'   },
          { val: stats.available, label: 'ว่าง',        color: '#0D9488'   },
          { val: stats.icu,       label: 'ICU',          color: '#EF4444'   },
        ].map(s => `
          <div class="card p-4 text-center">
            <div class="text-2xl font-bold" style="color:${s.color}">${s.val}</div>
            <div class="text-xs text-slate-400 font-body mt-1">${s.label}</div>
          </div>`).join('')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Cage map -->
        <div class="lg:col-span-3 card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-navy">🏥 แผนผัง Ward</h3>
            <div class="flex gap-3">
              <div class="flex flex-wrap gap-2">
                ${Object.entries(STATUS_CFG).map(([, v]) => `
                  <span class="text-xs flex items-center gap-1 font-body" style="color:${v.color}">
                    <i class="fas ${v.icon} text-xs"></i>${v.label}
                  </span>`).join('')}
              </div>
              <button id="add-cage-btn" class="text-xs border border-primary text-primary px-3 py-1 rounded-lg hover:bg-primary-subtle transition-colors font-semibold whitespace-nowrap">
                + เพิ่มกรง
              </button>
            </div>
          </div>
          ${cages.length === 0
            ? `<div class="py-16 text-center text-slate-400 font-body text-sm">
                ยังไม่มีกรง — กด "+ เพิ่มกรง" เพื่อเริ่มต้น
               </div>`
            : `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="cage-grid">
                ${cages.map(_cageCard).join('')}
               </div>`}
        </div>

        <!-- Detail panel -->
        <div class="lg:col-span-2 card p-4" id="ipd-detail">
          <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400">
            <i class="fas fa-hand-pointer text-4xl mb-3 opacity-40"></i>
            <div class="font-body text-sm">คลิกที่กรงเพื่อดูข้อมูล<br>และ Treatment Sheet</div>
          </div>
        </div>
      </div>
    </div>`;

  // Add cage
  container.querySelector('#add-cage-btn')?.addEventListener('click', () => _openAddCageModal(container));

  // Cage click
  container.querySelector('#cage-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.cage-card');
    if (!card) return;
    container.querySelectorAll('.cage-card').forEach(c => c.style.outline = '');
    card.style.outline = '2px solid #0D9488';
    const cage = cages.find(c => c.id === card.dataset.cageId);
    if (cage) _renderDetail(cage, container);
  });
}

function _cageCard(cage) {
  const cfg = STATUS_CFG[cage.status] || STATUS_CFG.available;
  const adm = cage.current_admission;
  return `
    <div class="cage-card rounded-xl p-3 cursor-pointer transition-all hover:shadow-md border-2 border-transparent"
         data-cage-id="${cage.id}" style="background:${cfg.bg}">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-bold text-navy">${TYPE_ICON[cage.cage_type] || '🏠'} ${cage.cage_number}</span>
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${cfg.color}"></span>
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

async function _renderDetail(cage, container) {
  const panel = container.querySelector('#ipd-detail');
  if (!panel) return;
  logAudit('view_sensitive', 'ipd_cage', cage.id, null, null, `เปิดดูกรง ${cage.cage_number}`);

  if (cage.status !== 'occupied' || !cage.current_admission) {
    panel.innerHTML = `
      <div class="text-center py-8">
        <div class="font-semibold text-navy mb-1">${TYPE_ICON[cage.cage_type] || '🏠'} กรง ${cage.cage_number}</div>
        <div class="text-xs text-slate-400 font-body mb-2">${STATUS_CFG[cage.status]?.label || ''} — ฿${(cage.daily_rate||0).toLocaleString()}/วัน</div>
        ${cage.status === 'available' ? `
          <button id="admit-btn" class="btn-primary text-sm px-4 py-2 mt-2">+ รับผู้ป่วยเข้ากรง</button>` : `
          <div class="text-xs text-slate-400 font-body mt-3">${STATUS_CFG[cage.status]?.label}</div>`}
      </div>`;
    panel.querySelector('#admit-btn')?.addEventListener('click', () => _openAdmitModal(cage, container));
    return;
  }

  const adm = cage.current_admission;
  const treatRes = await apiFetch(`/api/ipd/treatments/${adm.id}`);
  const treatments = treatRes?.data || [];
  const done = treatments.filter(t => t.status === 'done').length;

  panel.innerHTML = `
    <div class="space-y-3 h-full overflow-y-auto">
      <div class="flex items-center justify-between">
        <div class="font-semibold text-navy text-sm">${TYPE_ICON[cage.cage_type]} กรง ${cage.cage_number} — ${adm.pet_name}</div>
        <button id="discharge-btn"
          class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
          style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D">
          <i class="fas fa-right-from-bracket mr-1"></i>Discharge
        </button>
      </div>

      <div class="bg-slate-50 rounded-xl p-3 text-xs space-y-1 font-body">
        <div><strong>ชื่อ:</strong> ${adm.pet_name} (${adm.species || 'สุนัข'})</div>
        <div><strong>เจ้าของ:</strong> ${adm.owner_name || '-'}</div>
        <div><strong>เหตุผล:</strong> ${adm.admission_reason || '-'}</div>
        <div><strong>ระยะเวลา:</strong> ${_timeSince(adm.admitted_at)}</div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="font-semibold text-sm text-navy">📋 Treatment (${done}/${treatments.length})</span>
          <button id="add-treatment-btn" class="text-xs text-primary hover:underline font-semibold">+ เพิ่ม</button>
        </div>
        ${treatments.length > 0 ? `
          <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div class="h-1.5 rounded-full bg-primary" style="width:${treatments.length ? (done/treatments.length*100) : 0}%"></div>
          </div>` : ''}
        <div class="space-y-1.5 max-h-52 overflow-y-auto" id="treatment-list">
          ${treatments.length === 0
            ? `<div class="text-center py-4 text-xs text-slate-400 font-body">ยังไม่มีรายการ</div>`
            : treatments.map(_treatmentRow).join('')}
        </div>
      </div>
    </div>`;

  panel.querySelector('#discharge-btn')?.addEventListener('click', () => _discharge(adm.id, container));
  panel.querySelector('#add-treatment-btn')?.addEventListener('click', () => _openAddTreatmentModal(adm, container, cage));
  panel.querySelector('#treatment-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-done-id]');
    if (!btn) return;
    const res = await apiFetch(`/api/ipd/treatments/${btn.dataset.doneId}/done`, {
      method: 'PATCH', body: JSON.stringify({ completed_by: 'staff' }),
    });
    if (res?.success) { showToast('บันทึกเรียบร้อย'); _renderDetail(cage, container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _treatmentRow(t) {
  const TYPE_LABEL = { medication: '💊', feeding: '🍽️', vitals: '🩺', observation: '👁️', procedure: '🔧' };
  return `
    <div class="flex items-center gap-2 p-2 rounded-lg text-xs ${t.status === 'done' ? 'bg-green-50' : 'bg-white border border-slate-100'}">
      <span class="text-slate-400 font-mono w-10 flex-shrink-0">${t.treatment_time}</span>
      <span class="text-base">${TYPE_LABEL[t.treatment_type] || '📝'}</span>
      <span class="flex-1 truncate font-semibold">${t.description || '-'}</span>
      <span class="text-slate-400 flex-shrink-0">${t.dosage || ''}</span>
      ${t.status === 'done'
        ? '<span class="text-green-600 font-bold flex-shrink-0">✓</span>'
        : `<button data-done-id="${t.id}" class="text-primary hover:text-primary/80 flex-shrink-0"><i class="fas fa-check"></i></button>`}
    </div>`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────

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
    const res = await apiFetch('/api/ipd/cages', { method: 'POST', body: JSON.stringify({
      store_id: _storeId,
      cage_number,
      cage_type:  m.querySelector('#c-type').value,
      floor:      parseInt(m.querySelector('#c-floor').value) || 1,
      daily_rate: parseInt(m.querySelector('#c-rate').value) || 500,
    })});
    if (res?.success) { m.remove(); showToast(`เพิ่มกรง ${cage_number} แล้ว`); await _render(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openAdmitModal(cage, container) {
  const m = _modal(`รับผู้ป่วย — กรง ${cage.cage_number}`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="a-pet" class="input-field" placeholder="บัดดี้"></div>
        <div><label class="input-label">ชื่อเจ้าของ</label>
          <input id="a-owner" class="input-field" placeholder="คุณสมชาย"></div>
        <div><label class="input-label">สายพันธุ์/ชนิด</label>
          <input id="a-species" class="input-field" placeholder="สุนัข Golden"></div>
        <div class="col-span-2"><label class="input-label">เหตุผลในการ Admit</label>
          <input id="a-reason" class="input-field" placeholder="ผ่าตัด, ให้น้ำเกลือ..."></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const pet_name = m.querySelector('#a-pet').value.trim();
    if (!pet_name) { showToast('กรุณาระบุชื่อสัตว์เลี้ยง', 'error'); return; }
    const res = await apiFetch('/api/ipd/admissions', { method: 'POST', body: JSON.stringify({
      store_id: _storeId, cage_id: cage.id, pet_name,
      owner_name:       m.querySelector('#a-owner').value.trim()   || null,
      species:          m.querySelector('#a-species').value.trim() || 'dog',
      admission_reason: m.querySelector('#a-reason').value.trim() || null,
      daily_rate:       cage.daily_rate,
    })});
    if (res?.success) {
      m.remove(); showToast(`รับ ${pet_name} เข้ากรง ${cage.cage_number} แล้ว`);
      logAudit('create', 'ipd_admissions', res.data.id, null, res.data, 'admit patient');
      await _render(container);
    } else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

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
        <div class="col-span-2"><label class="input-label">รายละเอียด *</label>
          <input id="t-desc" class="input-field" placeholder="Amoxicillin 250mg"></div>
        <div><label class="input-label">ขนาด/ปริมาณ</label>
          <input id="t-dose" class="input-field" placeholder="1 เม็ด, 100ml"></div>
        <div><label class="input-label">หมายเหตุ</label>
          <input id="t-notes" class="input-field" placeholder="กินหลังอาหาร"></div>
      </div>
    </div>`);

  m.querySelector('#modal-confirm').addEventListener('click', async () => {
    const description = m.querySelector('#t-desc').value.trim();
    const treatment_time = m.querySelector('#t-time').value;
    if (!description || !treatment_time) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
    const res = await apiFetch('/api/ipd/treatments', { method: 'POST', body: JSON.stringify({
      admission_id:   adm.id,
      store_id:       _storeId,
      treatment_time,
      treatment_type: m.querySelector('#t-type').value,
      description,
      dosage:         m.querySelector('#t-dose').value.trim() || null,
      notes:          m.querySelector('#t-notes').value.trim() || null,
    })});
    if (res?.success) { m.remove(); showToast('เพิ่มรายการแล้ว'); _renderDetail(cage, container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

async function _discharge(admId, container) {
  const res = await apiFetch(`/api/ipd/admissions/${admId}/discharge`, { method: 'PATCH', body: '{}' });
  if (res?.success) {
    showToast('Discharge สำเร็จ');
    logAudit('update', 'ipd_admissions', admId, null, { status: 'discharged' }, 'discharge patient');
    await _render(container);
    container.querySelector('#ipd-detail').innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-center text-slate-400">
        <i class="fas fa-check-circle text-4xl mb-3" style="color:#10B981"></i>
        <div class="font-body text-sm">Discharge สำเร็จ<br>เลือกกรงอื่นเพื่อดูข้อมูล</div>
      </div>`;
  } else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

function _modal(title, body) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
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
  if (!dateStr) return '-';
  const hrs = Math.floor((Date.now() - new Date(dateStr)) / 3600000);
  return hrs < 24 ? `${hrs} ชม.` : `${Math.floor(hrs / 24)} วัน ${hrs % 24} ชม.`;
}
