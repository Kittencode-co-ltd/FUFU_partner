import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { formatThaiDate } from '../utils/formatters.js';

const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };

const VACCINE_LIST = [
  // สุนัข
  { name: 'DHPPiL 5 โรค',             en: 'DHPP + Leptospirosis',                          days: 365 },
  { name: 'DHPPiL+CCV 7 โรค',         en: 'DHPP + Lepto + Coronavirus',                    days: 365 },
  { name: 'พิษสุนัขบ้า',              en: 'Rabies',                                         days: 365 },
  { name: 'Bordetella (ไอหวัดหมา)',   en: 'Bordetella bronchiseptica',                      days: 180 },
  { name: 'Leptospirosis',             en: 'Leptospirosis',                                  days: 365 },
  { name: 'Coronavirus CCV',           en: 'Canine Coronavirus (CCV)',                       days: 365 },
  { name: 'Canine Influenza',          en: 'Canine Influenza H3N2/H3N8',                     days: 365 },
  // แมว
  { name: 'FVRCP แมว 3 โรค',          en: 'FVRCP (Rhinotracheitis, Calicivirus, Panleuko)', days: 365 },
  { name: 'FeLV มะเร็งเม็ดเลือดขาว',  en: 'Feline Leukemia Virus (FeLV)',                   days: 365 },
  { name: 'Chlamydophila felis',       en: 'Chlamydophila felis',                            days: 365 },
  // ทั่วไป
  { name: 'Rabies (สัตว์เลี้ยงอื่น)', en: 'Rabies (other species)',                         days: 365 },
  { name: 'อื่นๆ (ระบุชื่อเอง)',       en: 'Other — type manually',                          days: 365 },
];
const FREQ_LABELS   = { SID: 'วันละ 1×', BID: 'วันละ 2×', TID: 'วันละ 3×', QID: 'วันละ 4×', PRN: 'เมื่อจำเป็น' };
const VITALS_NORMAL = {
  temp:   { min: 37.5, max: 39.5, unit: '°C' },
  weight: { unit: 'kg' },
  hr:     { min: 60, max: 140, unit: 'bpm' },
  rr:     { min: 10, max: 30,  unit: '/min' },
};

// ── Module state ──────────────────────────────────────────────────────────────
let _container    = null;
let _queueItem    = null;
let _currentRecord = null;
let _prescriptions = [];
let _petData      = null;
let _autosaveTimer = null;
let _activeTab    = 'opd';
let _invCache     = null;
let _invCacheAt   = 0;
let _bindAbort    = null;

const _INV_CACHE_TTL = 60_000;

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderDoctorWorkroom(container, queueItem = null) {
  if (_bindAbort) _bindAbort.abort();
  _bindAbort    = new AbortController();
  _container    = container;
  _queueItem    = queueItem;
  _currentRecord = null;
  _prescriptions = [];
  _petData      = null;
  _activeTab    = 'opd';
  clearTimeout(_autosaveTimer);

  container.innerHTML = _buildLayout();
  _bindTabSwitching();
  _bindDoneButton();
  _renderActiveTab();

  if (queueItem) {
    _loadPetPanel();
  } else {
    _renderEmptyPetPanel();
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

function _buildLayout() {
  const q        = _queueItem;
  const num      = q?.queue_number ? `A${String(q.queue_number).padStart(3, '0')}` : '';
  const petName  = q?.pet_name  || '';
  const ownerName= q?.owner_name || '';

  return `
<style>
.wr-layout{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg-main,#f8fafc);}
.wr-topbar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#fff;border-bottom:1px solid var(--border-soft,#e2e8f0);flex-shrink:0;flex-wrap:wrap;}
.wr-patient-chip{display:flex;align-items:center;gap:6px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600;color:#0f766e;white-space:nowrap;}
.wr-queue-chip{background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;color:#1d4ed8;white-space:nowrap;}
.wr-spacer{flex:1;}
.wr-autosave{font-size:11px;color:#94a3b8;}
.wr-btn-done{background:var(--primary,#0d9488);color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s;}
.wr-btn-done:hover:not(:disabled){opacity:.85;}
.wr-btn-done:disabled{opacity:.4;cursor:not-allowed;}
.wr-body{display:grid;grid-template-columns:260px 1fr;flex:1;overflow:hidden;min-height:0;}
.wr-left{overflow-y:auto;border-right:1px solid var(--border-soft,#e2e8f0);background:#fff;padding:14px;font-size:13px;}
.wr-right{display:flex;flex-direction:column;overflow:hidden;}
.wr-tabs{display:flex;border-bottom:2px solid var(--border-soft,#e2e8f0);background:#fff;flex-shrink:0;}
.wr-tab{padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s;white-space:nowrap;}
.wr-tab:hover{color:var(--primary,#0d9488);}
.wr-tab.active{color:var(--primary,#0d9488);border-bottom-color:var(--primary,#0d9488);}
.wr-tab-content{flex:1;overflow-y:auto;padding:14px;}
.wr-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8;gap:12px;padding:40px;text-align:center;}
.wr-vaccine-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;}
.wr-vaccine-badge.ok{background:#dcfce7;color:#166534;}
.wr-vaccine-badge.soon{background:#fef9c3;color:#854d0e;}
.wr-vaccine-badge.expired{background:#fee2e2;color:#991b1b;}
.wr-pet-avatar{font-size:48px;text-align:center;margin-bottom:8px;}
.wr-section-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 5px;}
.wr-info-row{display:flex;gap:6px;margin-bottom:4px;}
.wr-info-label{color:#64748b;flex-shrink:0;min-width:58px;}
.wr-info-value{color:#1e293b;font-weight:500;}
.wr-allergy-box{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:8px 10px;color:#991b1b;font-size:12px;font-weight:600;margin-top:6px;}
.wr-vaccine-item{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;}
.wr-vaccine-name{color:#334155;font-weight:500;font-size:12px;}
.wr-vaccine-date{color:#94a3b8;font-size:11px;}
.wr-note-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
.wr-note-box{border-radius:10px;border:1px solid var(--border-soft,#e2e8f0);border-top-width:3px;padding:12px;}
.wr-note-label{display:flex;align-items:center;gap:6px;margin-bottom:8px;}
.wr-note-badge{padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;}
.wr-note-title{font-size:13px;font-weight:600;color:#1e293b;}
.wr-note-ta{width:100%;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;resize:vertical;min-height:100px;outline:none;transition:border-color .2s;font-family:inherit;color:#334155;line-height:1.55;}
.wr-note-ta:focus{border-color:var(--primary,#0d9488);background:#fff;}
.wr-vitals-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
.wr-vital-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;}
.wr-vital-label{font-size:11px;color:#94a3b8;margin-bottom:4px;}
.wr-vital-row{display:flex;align-items:baseline;gap:4px;}
.wr-vital-input{width:100%;font-size:18px;font-weight:700;color:#1e293b;border:none;border-bottom:1px solid transparent;outline:none;background:transparent;transition:border-color .2s;font-family:inherit;}
.wr-vital-input:focus{border-bottom-color:var(--primary,#0d9488);}
.wr-vital-input.out-of-range{color:#ef4444;}
.wr-vital-unit{font-size:11px;color:#94a3b8;flex-shrink:0;}
.wr-rx-item{display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:13px;margin-bottom:6px;}
.wr-rx-info{flex:1;min-width:0;}
.wr-rx-del{color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;transition:color .15s;background:none;border:none;padding:0 4px;}
.wr-rx-del:hover{color:#ef4444;}
.wr-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;}
.wr-history-item{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;}
.wr-history-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:#fff;}
.wr-history-hdr:hover{background:#f8fafc;}
.wr-history-body{padding:12px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:none;font-size:13px;line-height:1.6;}
.wr-history-body.open{display:block;}
.wr-invoice-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;}
.wr-invoice-total{display:flex;justify-content:space-between;padding:12px 0 0;font-weight:700;font-size:15px;color:#0f766e;border-top:2px solid #e2e8f0;}
.wr-appt-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;}
.wr-appt-date-box{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:6px 10px;text-align:center;flex-shrink:0;min-width:52px;}
.wr-appt-day{font-size:18px;font-weight:700;color:#0f766e;line-height:1;}
.wr-appt-month{font-size:10px;color:#0d9488;font-weight:600;}
.wr-appt-info{flex:1;min-width:0;}
.wr-appt-service{font-weight:600;font-size:13px;color:#1e293b;}
.wr-appt-meta{font-size:11px;color:#94a3b8;margin-top:1px;}
.wr-appt-status{font-size:11px;font-weight:600;border-radius:10px;padding:2px 8px;white-space:nowrap;}
.wr-appt-cancel{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:4px;border-radius:4px;transition:color .15s;}
.wr-appt-cancel:hover{color:#ef4444;}
.wr-form-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.wr-form-group{margin-bottom:12px;}
.wr-form-label{font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;display:block;}
.wr-form-input{width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;transition:border-color .2s;background:#fff;color:#1e293b;}
.wr-form-input:focus{border-color:var(--primary,#0d9488);}
.wr-divider{border:none;border-top:1px solid #e2e8f0;margin:16px 0;}
.wr-submit-btn{width:100%;background:var(--primary,#0d9488);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s;}
.wr-submit-btn:hover{opacity:.85;}
.wr-submit-btn:disabled{opacity:.4;cursor:not-allowed;}
/* Responsive height so panels scroll independently */
#doctor-workroom-root .wr-layout{height:calc(100vh - 76px);}
@media(min-width:640px){#doctor-workroom-root .wr-layout{height:calc(100vh - 100px);}}
@media(min-width:768px){#doctor-workroom-root .wr-layout{height:calc(100vh - 88px);}}
@media(max-width:767px){
  .wr-body{grid-template-columns:1fr;}
  .wr-left{display:none;}
  .wr-note-grid{grid-template-columns:1fr;}
  .wr-vitals-grid{grid-template-columns:repeat(2,1fr);}
}
</style>
<div class="wr-layout">
  <div class="wr-topbar">
    ${q ? `
      <div class="wr-patient-chip">🐾 ${_esc(petName)}${ownerName ? ' · ' + _esc(ownerName) : ''}</div>
      ${num ? `<div class="wr-queue-chip">คิว ${num}</div>` : ''}
    ` : '<div class="wr-patient-chip" style="background:#f1f5f9;color:#64748b;border-color:#e2e8f0;">🔍 ยังไม่มีผู้ป่วย</div>'}
    <div class="wr-spacer"></div>
    <span class="wr-autosave" id="wr-autosave"></span>
    <button class="wr-btn-done" id="wr-done-btn"${!q ? ' disabled' : ''}>✓ เสร็จสิ้น</button>
  </div>

  <div class="wr-body">
    <div class="wr-left" id="wr-pet-panel">
      <div style="display:flex;flex-direction:column;align-items:center;padding:20px 0;gap:8px;color:#94a3b8;">
        <span style="font-size:32px;">🐾</span>
        <span style="font-size:13px;">กำลังโหลด...</span>
      </div>
    </div>

    <div class="wr-right">
      <div class="wr-tabs">
        <div class="wr-tab active" data-tab="opd">OPD Card</div>
        <div class="wr-tab" data-tab="history">ประวัติรักษา</div>
        <div class="wr-tab" data-tab="invoice">ใบสั่งยา / Invoice</div>
        <div class="wr-tab" data-tab="appt">📅 นัดหมาย</div>
      </div>
      <div class="wr-tab-content" id="wr-tab-content"></div>
    </div>
  </div>
</div>`;
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _bindTabSwitching() {
  const tabs = _container?.querySelectorAll('.wr-tab');
  tabs?.forEach(tab => {
    tab.addEventListener('click', () => {
      _activeTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      _renderActiveTab();
    }, { signal: _bindAbort.signal });
  });
}

function _renderActiveTab() {
  const content = _container?.querySelector('#wr-tab-content');
  if (!content) return;
  if (_activeTab === 'opd')          _renderOPDTab(content);
  else if (_activeTab === 'history') _renderHistoryTab(content);
  else if (_activeTab === 'invoice') _renderInvoiceTab(content);
  else if (_activeTab === 'appt')    _renderApptTab(content);
}

// ── Done button ───────────────────────────────────────────────────────────────

function _bindDoneButton() {
  _container?.querySelector('#wr-done-btn')
    ?.addEventListener('click', _handleDone, { signal: _bindAbort.signal });
}

async function _handleDone() {
  if (!_queueItem) return; // no patient selected at all
  const btn = _container?.querySelector('#wr-done-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  clearTimeout(_autosaveTimer);
  await _saveRecord('completed');

  // Only update queue status if this came from an actual queue entry (id is set)
  if (_queueItem.id) {
    await apiFetch(`/api/queue/${_queueItem.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => {});
  }

  // ── ไม่ reset workroom — แสดง "บันทึกแล้ว" และเปิดปุ่มส่งชำระเงิน ──────────
  if (btn) {
    btn.textContent = '✅ บันทึกเสร็จสิ้น';
    btn.style.background = '#dcfce7';
    btn.style.color      = '#166534';
    btn.style.border     = '1px solid #86efac';
    btn.disabled = true;
  }

  // แสดงปุ่ม "ส่งชำระเงิน" ในแถบบน (ถัดจากปุ่มเสร็จสิ้น)
  const topbar = _container?.querySelector('.wr-topbar');
  if (topbar && !topbar.querySelector('#wr-send-pay-top')) {
    const payTopBtn = document.createElement('button');
    payTopBtn.id        = 'wr-send-pay-top';
    payTopBtn.className = 'wr-btn-done';
    payTopBtn.style.cssText = 'background:#0369a1;';
    payTopBtn.textContent   = '📤 ส่งชำระเงิน';
    payTopBtn.addEventListener('click', _sendToPayment);
    topbar.appendChild(payTopBtn);
  }

  // อัปเดต Invoice tab ถ้ากำลังแสดงอยู่
  if (_activeTab === 'invoice') {
    const c = _container?.querySelector('#wr-tab-content');
    if (c) _renderInvoiceTab(c);
  }

  showToast('✅ บันทึก OPD เสร็จสิ้น — กด "ส่งชำระเงิน" เพื่อส่งไปเคาน์เตอร์');
}

// ── ส่งรายการไปชำระที่เคาน์เตอร์ ─────────────────────────────────────────────

function _sendToPayment() {
  document.dispatchEvent(new CustomEvent('fufu:openPOS', {
    detail: {
      queueItem:     _queueItem,
      medicalRecord: { ...(_currentRecord || {}), prescriptions: _prescriptions },
    },
  }));
}

// ── Left panel — Pet info ─────────────────────────────────────────────────────

async function _loadPetPanel() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const q = _queueItem;
  if (!q) { _renderEmptyPetPanel(); return; }

  // Direct lookup by pet_id if available
  if (q.pet_id) {
    const res = await apiFetch(`/api/pets/${q.pet_id}`);
    if (res?.data) {
      _petData = res.data;
      _renderPetPanel();
      _loadVaccinations(q.pet_id);
      return;
    }
  }

  // Search by pet name
  if (q.pet_name) {
    const res = await apiFetch(`/api/pets/owners/search?store_id=${encodeURIComponent(storeId)}&q=${encodeURIComponent(q.pet_name)}`);
    const owners = res?.data || [];
    for (const owner of owners) {
      for (const pet of owner.pets || []) {
        if (pet.name?.toLowerCase() === q.pet_name?.toLowerCase()) {
          _petData = { ...pet, owner_name: owner.name, owner_phone: owner.phone || q.owner_phone || '' };
          _renderPetPanel();
          _loadVaccinations(pet.id);
          return;
        }
      }
    }
  }

  // Fallback to queue info
  _petData = { name: q.pet_name || '', species: 'other', owner_name: q.owner_name || '', owner_phone: q.owner_phone || '' };
  _renderPetPanel();
}

async function _loadVaccinations(petId) {
  const section = _container?.querySelector('#wr-vaccine-section');
  if (!section) return;

  const res     = await apiFetch(`/api/pets/vaccinations?pet_id=${petId}`);
  const vaccines = res?.data || [];

  const today   = new Date();
  const soonCut = new Date(); soonCut.setDate(today.getDate() + 30);

  const hdr = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div class="wr-section-label" style="margin:0;">💉 วัคซีน</div>
      <button id="wr-add-vax-btn"
        style="background:var(--primary,#0d9488);color:#fff;border:none;border-radius:6px;
               padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">
        + บันทึก
      </button>
    </div>`;

  const list = vaccines.length
    ? vaccines.map(v => {
        const exp = v.next_due_date ? new Date(v.next_due_date) : null;
        let cls = 'ok', label = 'ปกติ';
        if (exp) {
          if (exp < today)        { cls = 'expired'; label = 'เกินกำหนด'; }
          else if (exp <= soonCut){ cls = 'soon';    label = 'ใกล้หมด'; }
        }
        return `
          <div class="wr-vaccine-item">
            <div>
              <div class="wr-vaccine-name">${_esc(v.vaccine_name || 'วัคซีน')}</div>
              ${v.given_date  ? `<div class="wr-vaccine-date">ฉีด: ${formatThaiDate(v.given_date)}</div>` : ''}
              ${exp ? `<div class="wr-vaccine-date">ครั้งหน้า: ${formatThaiDate(v.next_due_date)}</div>` : ''}
            </div>
            <span class="wr-vaccine-badge ${cls}">${label}</span>
          </div>`;
      }).join('')
    : `<p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">ยังไม่มีข้อมูลวัคซีน</p>`;

  section.innerHTML = hdr + list;

  section.querySelector('#wr-add-vax-btn')?.addEventListener('click', () => _openVaccineModalWR(petId));
}

function _renderPetPanel() {
  const panel = _container?.querySelector('#wr-pet-panel');
  if (!panel) return;
  const p = _petData || {};
  const emoji = SPECIES_EMOJI[p.species] || '🐾';
  const genderMap = { male: 'เพศผู้', female: 'เพศเมีย' };

  let age = '';
  if (p.dob) {
    const ms = Date.now() - new Date(p.dob).getTime();
    const yrs = Math.floor(ms / (365.25 * 86400000));
    age = yrs >= 1 ? `${yrs} ปี` : `${Math.floor(ms / (30.44 * 86400000))} เดือน`;
  }

  panel.innerHTML = `
    <div class="wr-pet-avatar">${emoji}</div>
    <div style="font-size:17px;font-weight:700;color:#1e293b;text-align:center;margin-bottom:3px;">${_esc(p.name || '—')}</div>
    ${p.breed ? `<div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:10px;">${_esc(p.breed)}</div>` : ''}

    <div class="wr-section-label">ข้อมูลสัตว์เลี้ยง</div>
    ${p.gender    ? `<div class="wr-info-row"><span class="wr-info-label">เพศ</span><span class="wr-info-value">${genderMap[p.gender] || p.gender}</span></div>` : ''}
    ${age         ? `<div class="wr-info-row"><span class="wr-info-label">อายุ</span><span class="wr-info-value">${age}</span></div>` : ''}
    ${p.weight_kg ? `<div class="wr-info-row"><span class="wr-info-label">น้ำหนัก</span><span class="wr-info-value">${p.weight_kg} kg</span></div>` : ''}
    ${p.hn        ? `<div class="wr-info-row"><span class="wr-info-label">HN</span><span class="wr-info-value">HN-${String(p.hn).padStart(5,'0')}</span></div>` : ''}
    ${p.is_neutered ? `<div class="wr-info-row"><span class="wr-info-label">ทำหมัน</span><span class="wr-info-value">แล้ว ✓</span></div>` : ''}

    <div class="wr-section-label">เจ้าของ</div>
    <div class="wr-info-row"><span class="wr-info-label">ชื่อ</span><span class="wr-info-value">${_esc(p.owner_name || _queueItem?.owner_name || '—')}</span></div>
    ${(p.owner_phone || _queueItem?.owner_phone) ? `<div class="wr-info-row"><span class="wr-info-label">โทร</span><span class="wr-info-value">${_esc(p.owner_phone || _queueItem?.owner_phone)}</span></div>` : ''}

    <div class="wr-section-label">โรคประจำตัว / แพ้ยา</div>
    ${p.allergies ? `<div class="wr-allergy-box">⚠️ แพ้: ${_esc(p.allergies)}</div>` : `<span style="font-size:12px;color:#94a3b8;">ไม่มี</span>`}
    ${p.chronic_conditions ? `<div style="font-size:12px;color:#334155;margin-top:6px;">${_esc(p.chronic_conditions)}</div>` : ''}

    <div id="wr-vaccine-section" style="margin-top:4px;">
      <div class="wr-section-label">💉 วัคซีน</div>
      <p style="color:#94a3b8;font-size:12px;">กำลังโหลด...</p>
    </div>`;
}

function _renderEmptyPetPanel() {
  const panel = _container?.querySelector('#wr-pet-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="wr-section-label" style="margin-top:0;">🔍 ค้นหาผู้ป่วย</div>

    <!-- Search input -->
    <div style="position:relative;margin-bottom:8px;">
      <div id="wr-search-wrap"
        style="display:flex;align-items:center;gap:6px;border:1px solid #e2e8f0;border-radius:8px;
               padding:7px 10px;background:#f8fafc;transition:border-color .2s;cursor:text;"
        onclick="this.querySelector('input').focus()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="flex-shrink:0;">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="wr-patient-search" autocomplete="off" spellcheck="false"
          placeholder="HN-00001, ชื่อสัตว์ หรือชื่อเจ้าของ..."
          style="flex:1;border:none;outline:none;background:transparent;font-size:12px;
                 color:#334155;font-family:inherit;min-width:0;">
        <button id="wr-search-clear"
          style="display:none;background:none;border:none;color:#94a3b8;cursor:pointer;
                 font-size:18px;line-height:1;padding:0;flex-shrink:0;">×</button>
      </div>
      <!-- Results dropdown -->
      <div id="wr-search-results"
        style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);
               background:#fff;border:1px solid #e2e8f0;border-radius:10px;
               box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:50;
               max-height:280px;overflow-y:auto;">
      </div>
    </div>

    <!-- Walk-in -->
    <button id="wr-walkin-btn"
      style="width:100%;background:transparent;border:1px dashed #cbd5e1;border-radius:8px;
             padding:7px;font-size:12px;color:#64748b;cursor:pointer;
             font-family:inherit;transition:all .15s;text-align:center;"
      onmouseover="this.style.borderColor='#0d9488';this.style.color='#0d9488';"
      onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b';">
      🚶 Walk-in / ไม่มีประวัติ
    </button>

    <div style="margin-top:14px;border-top:1px solid #f1f5f9;padding-top:12px;">
      <div class="wr-section-label" style="margin-top:0;">🟢 คิวที่กำลังตรวจอยู่</div>
      <div id="wr-queue-list" style="font-size:12px;color:#94a3b8;">กำลังโหลด...</div>
    </div>`;

  _bindPanelSearch(panel);
  _loadQueueSection(panel);
}

// ── In-progress queue list in sidebar ────────────────────────────────────────

async function _loadQueueSection(panel) {
  const listEl  = panel.querySelector('#wr-queue-list');
  if (!listEl) return;
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  // ใช้ toISOString เหมือน queue.js เพราะ queue_date ถูก store ไว้ด้วยค่า UTC เดียวกัน
  const today   = new Date().toISOString().split('T')[0];

  const res   = await apiFetch(`/api/queue?store_id=${storeId}&date=${today}`);
  const items = (res?.data || []).filter(q => q.status === 'in_progress');

  if (!items.length) {
    listEl.style.cssText = 'font-size:11px;color:#cbd5e1;text-align:center;padding:4px 0;font-style:italic;';
    listEl.textContent   = '— ยังไม่มีคิวกำลังตรวจ';
    return;
  }

  listEl.innerHTML = items.map((q, i) => {
    const [petName = '', ownerName = ''] = (q.notes || '').split(' - ');
    const num = q.queue_number ? `A${String(q.queue_number).padStart(3,'0')}` : '?';
    return `
      <div data-qidx="${i}"
        style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;
               border:1px solid #99f6e4;background:#f0fdfa;cursor:pointer;margin-bottom:6px;
               transition:background .12s;"
        onmouseover="this.style.background='#ccfbf1'"
        onmouseout="this.style.background='#f0fdfa'">
        <span style="font-size:10px;font-weight:700;color:#0f766e;background:#fff;
                     border:1px solid #99f6e4;border-radius:5px;padding:2px 5px;
                     font-family:monospace;flex-shrink:0;">${num}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:12px;color:#1e293b;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${_esc(petName || `คิว ${num}`)}
          </div>
          ${ownerName ? `<div style="font-size:11px;color:#64748b;
                                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${_esc(ownerName)}</div>` : ''}
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f766e" stroke-width="2.5" style="flex-shrink:0;">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-qidx]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const q = items[+el.dataset.qidx];
      const [petName = '', ownerName = ''] = (q.notes || '').split(' - ');

      // Set as current queue item (keep real id so เสร็จสิ้น updates queue status)
      _queueItem = {
        id:           q.id,
        pet_id:       q.pet_id       || null,
        pet_name:     petName        || q.pet_name    || '',
        owner_name:   ownerName      || q.owner_name  || '',
        owner_phone:  q.owner_phone  || '',
        queue_number: q.queue_number,
      };

      // Update topbar
      const chip = _container?.querySelector('.wr-patient-chip');
      if (chip) {
        chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600;color:#0f766e;white-space:nowrap;';
        chip.textContent   = `🐾 ${_queueItem.pet_name}${_queueItem.owner_name ? ' · ' + _queueItem.owner_name : ''}`;
      }
      const qChip = _container?.querySelector('.wr-queue-chip');
      if (qChip) qChip.textContent = `คิว A${String(q.queue_number).padStart(3,'0')}`;
      else if (chip?.parentElement && q.queue_number) {
        const c = document.createElement('div');
        c.className   = 'wr-queue-chip';
        c.textContent = `คิว A${String(q.queue_number).padStart(3,'0')}`;
        chip.insertAdjacentElement('afterend', c);
      }

      // Enable done button
      const doneBtn = _container?.querySelector('#wr-done-btn');
      if (doneBtn) doneBtn.disabled = false;

      // Load full pet data and refresh view
      _loadPetPanel();
      _renderActiveTab();
    });
  });
}

// ── Patient search in sidebar ─────────────────────────────────────────────────

function _bindPanelSearch(panel) {
  const inp      = panel.querySelector('#wr-patient-search');
  const results  = panel.querySelector('#wr-search-results');
  const clearBtn = panel.querySelector('#wr-search-clear');
  const walkin   = panel.querySelector('#wr-walkin-btn');
  const storeId  = storage.get(STORAGE_KEYS.STORE_ID);
  let timer = null;

  async function _doSearch(q) {
    const url = `/api/pets/owners/search?store_id=${encodeURIComponent(storeId)}${q ? '&q=' + encodeURIComponent(q) : ''}`;
    const res  = await apiFetch(url);
    const owners = res?.data || [];

    const rows = [];
    for (const owner of owners) {
      for (const pet of owner.pets || []) {
        rows.push({ pet, owner });
      }
    }

    if (!rows.length) {
      results.innerHTML = `
        <div style="padding:16px;text-align:center;font-size:12px;color:#94a3b8;">
          ${q ? `ไม่พบผลลัพธ์สำหรับ "${_esc(q)}"` : 'ยังไม่มีผู้ป่วยในระบบ'}
        </div>`;
      results.style.display = 'block';
      return;
    }

    results.innerHTML = rows.map((r, i) => {
      const emoji    = SPECIES_EMOJI[r.pet.species] || '🐾';
      const hnBadge  = r.pet.hn
        ? `<span style="background:#ccfbf1;color:#0f766e;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700;font-family:monospace;">HN-${String(r.pet.hn).padStart(5,'0')}</span>`
        : '';
      const allBadge = r.pet.allergies
        ? `<span style="background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 5px;font-size:10px;">⚠ แพ้ยา</span>`
        : '';
      return `
        <div data-ridx="${i}"
          style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;
                 border-bottom:1px solid #f1f5f9;transition:background .12s;"
          onmouseover="this.style.background='#f0fdfa'"
          onmouseout="this.style.background=''">
          <span style="font-size:22px;flex-shrink:0;">${emoji}</span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:2px;">
              <span style="font-size:13px;font-weight:600;color:#1e293b;">${_esc(r.pet.name)}</span>
              ${hnBadge}${allBadge}
            </div>
            <div style="font-size:11px;color:#94a3b8;">
              เจ้าของ: ${_esc(r.owner.name)}${r.owner.phone ? ' · ' + _esc(r.owner.phone) : ''}
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" style="flex-shrink:0;">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>`;
    }).join('');

    results.querySelectorAll('[data-ridx]').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // keep input focused so blur doesn't close first
        const { pet, owner } = rows[parseInt(el.dataset.ridx)];
        _selectPatientFromSearch(pet, owner);
        results.style.display = 'none';
      });
    });

    results.style.display = 'block';
  }

  inp.addEventListener('focus', () => _doSearch(inp.value.trim()));
  inp.addEventListener('input', e => {
    const q = e.target.value.trim();
    clearBtn.style.display = q ? '' : 'none';
    clearTimeout(timer);
    timer = setTimeout(() => _doSearch(q), 280);
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => { results.style.display = 'none'; }, 200);
  });
  clearBtn?.addEventListener('click', () => {
    inp.value = '';
    clearBtn.style.display = 'none';
    _doSearch('');
    inp.focus();
  });
  walkin?.addEventListener('click', () => _selectPatientFromSearch(null, null));

  setTimeout(() => inp?.focus(), 80);
}

// ── Select patient from search result ────────────────────────────────────────

function _selectPatientFromSearch(pet, owner) {
  if (pet) {
    _petData   = { ...pet, owner_name: owner?.name || '', owner_phone: owner?.phone || '' };
    _queueItem = {
      id:          null,          // synthetic — no queue entry, skip queue PATCH in _handleDone
      pet_id:      pet.id,
      pet_name:    pet.name,
      owner_name:  owner?.name  || '',
      owner_phone: owner?.phone || '',
    };
  } else {
    // Walk-in: no pet record
    _petData   = { name: '', species: 'other', owner_name: '', owner_phone: '' };
    _queueItem = { id: null, pet_name: '', owner_name: '', owner_phone: '' };
  }

  // Update topbar chip
  const chip = _container?.querySelector('.wr-patient-chip');
  if (chip) {
    chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600;color:#0f766e;white-space:nowrap;';
    chip.textContent   = `🐾 ${pet ? pet.name : 'Walk-in'}${owner?.name ? ' · ' + owner.name : ''}`;
  }

  // Enable done button
  const doneBtn = _container?.querySelector('#wr-done-btn');
  if (doneBtn) doneBtn.disabled = false;

  // Re-render left panel with patient data + "เปลี่ยน" button
  _renderPetPanel();
  const panel = _container?.querySelector('#wr-pet-panel');
  if (panel) {
    const changeWrap = document.createElement('div');
    changeWrap.style.cssText = 'margin-bottom:10px;text-align:center;';
    changeWrap.innerHTML = `
      <button id="wr-change-patient"
        style="background:transparent;border:1px solid #e2e8f0;border-radius:8px;
               padding:5px 14px;font-size:11px;color:#64748b;cursor:pointer;
               font-family:inherit;transition:all .15s;"
        onmouseover="this.style.borderColor='#0d9488';this.style.color='#0d9488';"
        onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#64748b';">
        🔄 เปลี่ยนผู้ป่วย
      </button>`;
    panel.prepend(changeWrap);
    changeWrap.querySelector('#wr-change-patient')?.addEventListener('click', () => {
      _queueItem    = null;
      _currentRecord = null;
      _prescriptions = [];
      _petData      = null;
      _renderEmptyPetPanel();
      _renderActiveTab();
      // Reset topbar chip
      const c = _container?.querySelector('.wr-patient-chip');
      if (c) {
        c.style.cssText = 'display:flex;align-items:center;gap:6px;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600;white-space:nowrap;';
        c.textContent = '🔍 ยังไม่มีผู้ป่วย';
      }
      const db = _container?.querySelector('#wr-done-btn');
      if (db) db.disabled = true;
    });
  }

  if (pet?.id) _loadVaccinations(pet.id);
  _renderActiveTab();
}

// ── Vaccine modal ─────────────────────────────────────────────────────────────

function _openVaccineModalWR(petId) {
  const storeId  = storage.get(STORAGE_KEYS.STORE_ID);
  const petName  = _petData?.name || _queueItem?.pet_name || '';
  const ownerId  = _petData?.owner_id || null;

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:16px;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:440px;
                box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;">
      <h3 style="font-weight:700;font-size:16px;color:#1e293b;margin-bottom:4px;">💉 บันทึกวัคซีน</h3>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">${_esc(petName)}</p>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">ชื่อวัคซีน *</label>
        <select id="vx-preset" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;
                font-size:13px;outline:none;font-family:inherit;background:#fff;color:#334155;">
          ${VACCINE_LIST.map((v,i) => `<option value="${i}">${_esc(v.name)}${v.en !== v.name ? ' — ' + v.en : ''}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">หรือพิมพ์ชื่อวัคซีนเอง</label>
        <input id="vx-name" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;
               font-size:13px;outline:none;font-family:inherit;" placeholder="เช่น Nobivac DHPPi+L">
        <p style="font-size:10px;color:#94a3b8;margin:3px 0 0;">ถ้าพิมพ์ไว้จะใช้แทนชื่อจาก dropdown</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">วันที่ฉีด *</label>
          <input id="vx-date" type="date" value="${todayStr}"
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">นัดฉีดครั้งต่อไป</label>
          <input id="vx-next" type="date"
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Batch / Lot No.</label>
          <input id="vx-lot" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;
                 font-size:13px;outline:none;font-family:inherit;" placeholder="LOT-2026-001">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">สัตวแพทย์ผู้ฉีด</label>
          <input id="vx-vet" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;
                 font-size:13px;outline:none;font-family:inherit;" placeholder="นสพ. ...">
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">หมายเหตุ</label>
        <textarea id="vx-notes" rows="2"
          style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;
                 font-size:13px;outline:none;font-family:inherit;resize:vertical;"
          placeholder="เช่น ปฏิกิริยาหลังฉีด, ขนาดยา..."></textarea>
      </div>

      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:12px;color:#0f766e;">
        📅 ระบบจะ <strong>สร้างนัดหมายอัตโนมัติ</strong> สำหรับการฉีดครั้งต่อไปให้อัตโนมัติ (ถ้าระบุวันนัด)
      </div>

      <div style="display:flex;gap:10px;">
        <button id="vx-cancel"
          style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;
                 font-size:13px;font-weight:600;cursor:pointer;color:#64748b;font-family:inherit;">
          ยกเลิก
        </button>
        <button id="vx-save"
          style="flex:2;background:var(--primary,#0d9488);color:#fff;border:none;border-radius:8px;
                 padding:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
          💾 บันทึกวัคซีน
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Auto-fill next due date when preset or given date changes
  function _updateNextDate() {
    const idx      = parseInt(modal.querySelector('#vx-preset').value) || 0;
    const givenVal = modal.querySelector('#vx-date').value;
    if (!givenVal) return;
    const given = new Date(givenVal + 'T00:00');
    const days  = VACCINE_LIST[idx]?.days || 365;
    given.setDate(given.getDate() + days);
    const ns = `${given.getFullYear()}-${String(given.getMonth()+1).padStart(2,'0')}-${String(given.getDate()).padStart(2,'0')}`;
    modal.querySelector('#vx-next').value = ns;
  }
  _updateNextDate();
  modal.querySelector('#vx-preset').addEventListener('change', _updateNextDate);
  modal.querySelector('#vx-date').addEventListener('change',   _updateNextDate);

  modal.querySelector('#vx-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#vx-save').addEventListener('click', async () => {
    const saveBtn   = modal.querySelector('#vx-save');
    const idx       = parseInt(modal.querySelector('#vx-preset').value) || 0;
    const customName = modal.querySelector('#vx-name').value.trim();
    const vaccineName = customName || VACCINE_LIST[idx]?.name || 'วัคซีน';
    const givenDate  = modal.querySelector('#vx-date').value;
    const nextDate   = modal.querySelector('#vx-next').value || null;

    if (!givenDate) { showToast('กรุณาระบุวันที่ฉีด', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';

    // 1. บันทึกวัคซีน
    const vaxRes = await apiFetch('/api/pets/vaccinations', {
      method: 'POST',
      body: JSON.stringify({
        pet_id:        petId,
        store_id:      storeId,
        vaccine_name:  vaccineName,
        given_date:    givenDate,
        next_due_date: nextDate,
        batch_no:      modal.querySelector('#vx-lot').value.trim()   || null,
        vet_name:      modal.querySelector('#vx-vet').value.trim()   || null,
        notes:         modal.querySelector('#vx-notes').value.trim() || null,
      }),
    });

    if (!vaxRes?.success) {
      showToast(vaxRes?.error || 'บันทึกวัคซีนไม่สำเร็จ', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 บันทึกวัคซีน';
      return;
    }

    // 2. สร้างนัดหมายอัตโนมัติถ้ามีวันนัดครั้งหน้า
    if (nextDate && petId) {
      await apiFetch('/api/pets/appointments', {
        method: 'POST',
        body: JSON.stringify({
          store_id:     storeId,
          pet_id:       petId,
          owner_id:     ownerId,
          appt_date:    nextDate,
          service_type: 'วัคซีน',
          notes:        `ฉีดวัคซีน ${vaccineName} (นัดต่อเนื่องจากการฉีดวันที่ ${givenDate})`,
          status:       'scheduled',
        }),
      }).catch(() => {});
    }

    showToast(`💉 บันทึกวัคซีน ${vaccineName} แล้ว${nextDate ? ' · สร้างนัดหมายครั้งหน้าแล้ว 📅' : ''}`);
    modal.remove();

    // รีเฟรช vaccine section
    _loadVaccinations(petId);
  });
}

// ── OPD Tab ───────────────────────────────────────────────────────────────────

function _renderOPDTab(content) {
  if (!_queueItem) {
    content.innerHTML = `
      <div class="wr-empty-state" style="cursor:default;">
        <span style="font-size:48px;">🩺</span>
        <span>ค้นหาผู้ป่วยในช่องค้นหาทางซ้าย</span>
        <button onclick="document.querySelector('#wr-patient-search')?.focus()"
          style="margin-top:4px;background:var(--primary,#0d9488);color:#fff;border:none;
                 border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;
                 cursor:pointer;font-family:inherit;">
          🔍 ค้นหาผู้ป่วย
        </button>
      </div>`;
    return;
  }

  const r = _currentRecord || {};
  const v = r.vitals || {};

  content.innerHTML = `
    <div class="wr-vitals-grid">
      ${_vitalCard('wr-temp',   '🌡', 'อุณหภูมิ', r.temperature_c    || v.temp   || '', 'temp')}
      ${_vitalCard('wr-weight', '⚖',  'น้ำหนัก',  r.weight_kg        || v.weight || '', 'weight')}
      ${_vitalCard('wr-hr',     '❤',  'ชีพจร',     r.heart_rate       || v.hr     || '', 'hr')}
      ${_vitalCard('wr-rr',     '🫁', 'หายใจ',     r.respiratory_rate || v.rr     || '', 'rr')}
    </div>

    <div class="wr-note-grid">
      ${_noteBox('wr-hx', 'HX', 'History — ประวัติ',          '#3b82f6', 'background:#dbeafe;color:#1e40af', 'ประวัติ / อาการที่นำมาพบ', r.subjective  || '')}
      ${_noteBox('wr-pe', 'PE', 'Physical Exam',               '#8b5cf6', 'background:#ede9fe;color:#5b21b6', 'ผลการตรวจร่างกาย',         r.objective   || '')}
      ${_noteBox('wr-dx', 'Dx', 'Diagnosis — วินิจฉัย',        '#f97316', 'background:#ffedd5;color:#c2410c', 'การวินิจฉัยโรค',           r.assessment  || '')}
      ${_noteBox('wr-tx', 'Tx', 'Treatment — แผนรักษา',        '#0d9488', 'background:#ccfbf1;color:#0f766e', 'แผนการรักษา / คำแนะนำ',    r.plan        || '')}
    </div>

    <div class="wr-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:600;color:#1e293b;">💊 รายการยา</span>
        <button id="wr-add-rx" style="background:transparent;border:1px solid var(--primary,#0d9488);color:var(--primary,#0d9488);border-radius:8px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;">+ เพิ่มยา</button>
      </div>
      <div id="wr-rx-list"></div>
    </div>`;

  _renderRxList();
  _bindOPDEvents(content);
  _loadExistingRecord();
}

function _vitalCard(id, icon, label, value, key) {
  const n = VITALS_NORMAL[key] || {};
  return `
    <div class="wr-vital-card">
      <div class="wr-vital-label">${icon} ${label}</div>
      <div class="wr-vital-row">
        <input id="${id}" class="wr-vital-input" type="number" step="0.1"
          value="${_escAttr(String(value))}" placeholder="—"
          ${n.min != null ? `data-min="${n.min}" data-max="${n.max}"` : ''}>
        <span class="wr-vital-unit">${n.unit || ''}</span>
      </div>
    </div>`;
}

function _noteBox(id, letter, title, borderColor, badgeStyle, placeholder, value) {
  return `
    <div class="wr-note-box" style="border-top-color:${borderColor}">
      <div class="wr-note-label">
        <span class="wr-note-badge" style="${badgeStyle}">${letter}</span>
        <span class="wr-note-title">${title}</span>
      </div>
      <textarea id="${id}" class="wr-note-ta" placeholder="${placeholder}" rows="5">${_esc(value)}</textarea>
    </div>`;
}

function _bindOPDEvents(content) {
  const sig = { signal: _bindAbort.signal };

  content.querySelectorAll('.wr-note-ta').forEach(ta => {
    ta.addEventListener('input', _onFieldInput, sig);
  });

  content.querySelectorAll('.wr-vital-input').forEach(inp => {
    inp.addEventListener('input', e => {
      _onFieldInput();
      if (e.target.dataset.min != null) {
        const v = parseFloat(e.target.value);
        const min = parseFloat(e.target.dataset.min);
        const max = parseFloat(e.target.dataset.max);
        e.target.classList.toggle('out-of-range', !isNaN(v) && (v < min || v > max));
      }
    }, sig);
  });

  content.querySelector('#wr-add-rx')
    ?.addEventListener('click', _openRxModal, sig);

  // Delegated delete for prescriptions
  content.querySelector('#wr-rx-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-rx-del]');
    if (!btn) return;
    _prescriptions.splice(parseInt(btn.dataset.rxDel), 1);
    _renderRxList();
    _onFieldInput();
  }, sig);
}

function _onFieldInput() {
  _setAutosave('● กำลังบันทึก...');
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => _saveRecord('in_progress'), 3000);
}

async function _loadExistingRecord() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const petId   = _petData?.id || _queueItem?.pet_id;
  if (!petId) return;

  const res = await apiFetch(
    `/api/medical-records?store_id=${storeId}&pet_id=${petId}&status=in_progress&limit=1`
  );
  const rec = res?.data?.[0];
  if (!rec) return;

  // Only restore if same queue (or no queue_id to compare)
  if (_queueItem?.id && rec.queue_id && rec.queue_id !== _queueItem.id) return;

  _currentRecord = rec;
  _prescriptions = Array.isArray(rec.prescriptions)    ? rec.prescriptions
    : Array.isArray(rec.prescribed_meds) ? rec.prescribed_meds : [];

  const c = _container;
  const fill = (id, val) => { const el = c?.querySelector(`#${id}`); if (el && val != null) el.value = val; };
  fill('wr-hx',     rec.subjective);
  fill('wr-pe',     rec.objective);
  fill('wr-dx',     rec.assessment);
  fill('wr-tx',     rec.plan);
  fill('wr-temp',   rec.temperature_c);
  fill('wr-weight', rec.weight_kg);
  fill('wr-hr',     rec.heart_rate);
  fill('wr-rr',     rec.respiratory_rate);
  _renderRxList();
  _setAutosave('✓ โหลดร่างแล้ว');
}

// ── History Tab ───────────────────────────────────────────────────────────────

async function _renderHistoryTab(content) {
  if (!_queueItem) {
    content.innerHTML = `<div class="wr-empty-state"><span>กรุณาค้นหาผู้ป่วยก่อน</span></div>`;
    return;
  }

  content.innerHTML = `<p style="color:#94a3b8;font-size:13px;padding:30px;text-align:center;">กำลังโหลดประวัติ...</p>`;

  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const petId   = _petData?.id || _queueItem?.pet_id;
  if (!petId) {
    content.innerHTML = `<div class="wr-empty-state"><span style="font-size:36px;">📂</span><span>ไม่พบ ID สัตว์เลี้ยง</span></div>`;
    return;
  }
  const res = await apiFetch(
    `/api/medical-records?store_id=${storeId}&pet_id=${petId}&limit=50`
  );
  const records = res?.data || [];

  if (!records.length) {
    content.innerHTML = `<div class="wr-empty-state"><span style="font-size:36px;">📂</span><span>ยังไม่มีประวัติการรักษา</span></div>`;
    return;
  }

  const statusLabel = { in_progress: 'กำลังรักษา', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
  const statusColor = {
    in_progress: 'background:#fef9c3;color:#854d0e',
    completed:   'background:#dcfce7;color:#166534',
    cancelled:   'background:#fee2e2;color:#991b1b',
  };

  content.innerHTML = records.map(r => {
    const st      = r.status || 'in_progress';
    const dateStr = r.created_at ? formatThaiDate(r.created_at) : '—';
    const dx      = r.assessment || r.diagnosis || 'ไม่ระบุการวินิจฉัย';
    const rxArr   = r.prescriptions || r.prescribed_meds || [];

    return `
      <div class="wr-history-item">
        <div class="wr-history-hdr" data-hist="${r.id}">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;color:#1e293b;">${_esc(dx)}</div>
            <div style="font-size:11px;color:#94a3b8;">${dateStr}${rxArr.length ? ` · ยา ${rxArr.length} รายการ` : ''}</div>
          </div>
          <span style="font-size:11px;font-weight:600;border-radius:10px;padding:2px 8px;${statusColor[st] || ''}">${statusLabel[st] || st}</span>
          <span style="color:#94a3b8;font-size:12px;margin-left:6px;">▸</span>
        </div>
        <div class="wr-history-body" id="hist-${r.id}">
          ${r.subjective  ? `<p style="margin-bottom:6px;"><strong>HX:</strong> ${_esc(r.subjective)}</p>`  : ''}
          ${r.objective   ? `<p style="margin-bottom:6px;"><strong>PE:</strong> ${_esc(r.objective)}</p>`   : ''}
          ${r.assessment  ? `<p style="margin-bottom:6px;"><strong>Dx:</strong> ${_esc(r.assessment)}</p>`  : ''}
          ${r.plan        ? `<p style="margin-bottom:6px;"><strong>Tx:</strong> ${_esc(r.plan)}</p>`        : ''}
          ${rxArr.length  ? `<p style="font-size:12px;color:#64748b;margin-top:6px;">💊 ${rxArr.map(rx => _esc(rx.drug || rx.name || '')).join(', ')}</p>` : ''}
        </div>
      </div>`;
  }).join('');

  content.querySelectorAll('.wr-history-hdr').forEach(hdr => {
    hdr.addEventListener('click', () => {
      content.querySelector(`#hist-${hdr.dataset.hist}`)?.classList.toggle('open');
    });
  });
}

// ── Invoice Tab ───────────────────────────────────────────────────────────────

async function _renderInvoiceTab(content) {
  if (!_queueItem) {
    content.innerHTML = `<div class="wr-empty-state"><span>กรุณาค้นหาผู้ป่วยก่อน</span></div>`;
    return;
  }

  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!_invCache || Date.now() - _invCacheAt > _INV_CACHE_TTL) {
    const inv = await apiFetch(`/api/inventory?store_id=${storeId}`);
    _invCache   = inv?.data || [];
    _invCacheAt = Date.now();
  }

  const rxItems = _prescriptions.map(rx => {
    const inv   = _invCache.find(p => p.id === rx.product_id || p.name === rx.drug);
    const price = inv?.sell_price || inv?.price || 0;
    const qty   = rx.qty || 1;
    return { ...rx, price, subtotal: price * qty };
  });

  const rxTotal = rxItems.reduce((s, r) => s + r.subtotal, 0);

  // ตรวจว่า OPD บันทึกเสร็จสิ้นแล้วหรือยัง
  const isDone = _currentRecord?.status === 'completed';

  content.innerHTML = `
    <div style="max-width:480px;margin:0 auto;">

      ${isDone ? '' : `
      <div style="display:flex;align-items:center;gap:8px;background:#fffbeb;border:1px solid #fde68a;
                  border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e;">
        ⚠️ <span>กรุณากด <strong>เสร็จสิ้น</strong> ที่มุมขวาบนก่อน เพื่อบันทึก OPD ให้เรียบร้อย</span>
      </div>`}

      <div class="wr-card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-weight:700;font-size:14px;color:#1e293b;">ใบสั่งยา / Invoice</span>
          ${isDone ? `<span style="background:#dcfce7;color:#166534;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">✅ บันทึกแล้ว</span>` : ''}
        </div>

        ${rxItems.length ? rxItems.map(rx => `
          <div class="wr-invoice-row">
            <div>
              <div style="font-weight:500;">${_esc(rx.drug)}</div>
              <div style="font-size:11px;color:#94a3b8;">
                ${[rx.dose, rx.freq, rx.days ? rx.days + 'วัน' : '', rx.route].filter(Boolean).join(' ')}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="color:#64748b;">${rx.qty || 1} × ฿${rx.price.toLocaleString()}</div>
              <div style="font-weight:600;">฿${rx.subtotal.toLocaleString()}</div>
            </div>
          </div>`).join('') : `
          <p style="color:#94a3b8;font-size:13px;text-align:center;padding:16px 0;">
            ยังไม่มีรายการยา<br>
            <span style="font-size:11px;">กลับไปที่ OPD Card เพื่อเพิ่มยา</span>
          </p>`}

        <div class="wr-invoice-total">
          <span>รวมทั้งหมด</span>
          <span>฿${rxTotal.toLocaleString()}</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button id="wr-print-rx"
          style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;
                 padding:10px;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;">
          🖨 พิมพ์ใบสั่งยา
        </button>
        <button id="wr-send-pay"
          style="flex:2;background:${isDone ? '#0369a1' : '#94a3b8'};color:#fff;border:none;
                 border-radius:8px;padding:10px;font-size:13px;font-weight:600;
                 cursor:${isDone ? 'pointer' : 'not-allowed'};opacity:${isDone ? '1' : '.6'};"
          ${isDone ? '' : 'disabled title="กด เสร็จสิ้น ก่อน"'}>
          📤 ส่งไปชำระที่เคาน์เตอร์
        </button>
      </div>

      ${!isDone ? `<p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:8px;">
        ปุ่มจะเปิดใช้งานหลังจากกด <strong>เสร็จสิ้น</strong>
      </p>` : ''}
    </div>`;

  content.querySelector('#wr-print-rx')?.addEventListener('click', () => window.print());
  content.querySelector('#wr-send-pay')?.addEventListener('click', _sendToPayment);
}

// ── Appointment Tab ───────────────────────────────────────────────────────────

async function _renderApptTab(content) {
  if (!_queueItem) {
    content.innerHTML = `<div class="wr-empty-state"><span style="font-size:36px;">📅</span><span>กรุณาค้นหาผู้ป่วยก่อน</span></div>`;
    return;
  }

  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const petId   = _petData?.id || _queueItem.pet_id || null;
  const ownerId = _petData?.owner_id || null;

  // Use appointments already loaded with pet profile, or fetch fresh
  let upcoming = _petData?.appointments || null;
  if (!upcoming) {
    if (petId) {
      const res = await apiFetch(`/api/pets/${petId}`);
      upcoming  = res?.data?.appointments || [];
      if (_petData && res?.data) _petData.appointments = upcoming;
    } else {
      upcoming = [];
    }
  }

  const apptStatusLabel = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
  const apptStatusStyle = {
    pending:   'background:#fef9c3;color:#854d0e',
    confirmed: 'background:#dcfce7;color:#166534',
    completed: 'background:#f1f5f9;color:#64748b',
    cancelled: 'background:#fee2e2;color:#991b1b',
  };

  const SERVICES = ['ตรวจทั่วไป', 'วัคซีน', 'ผ่าตัด', 'ทำฟัน', 'ตรวจเลือด', 'ติดตามผล', 'อื่นๆ'];

  // Default next appointment: 2 weeks from today
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 14);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  const upcomingHtml = upcoming.length
    ? upcoming.map(a => {
        const d   = new Date(a.appt_date);
        const day = d.toLocaleDateString('th-TH', { day: 'numeric' });
        const mon = d.toLocaleDateString('th-TH', { month: 'short' });
        const st  = a.status || 'pending';
        return `
          <div class="wr-appt-item" data-appt-id="${a.id}">
            <div class="wr-appt-date-box">
              <div class="wr-appt-day">${day}</div>
              <div class="wr-appt-month">${mon}</div>
            </div>
            <div class="wr-appt-info">
              <div class="wr-appt-service">${_esc(a.service_type || 'นัดหมาย')}</div>
              <div class="wr-appt-meta">${a.appt_time ? a.appt_time.slice(0, 5) + ' น. · ' : ''}${_esc(a.notes || '')}</div>
            </div>
            <span class="wr-appt-status" style="${apptStatusStyle[st] || ''}">${apptStatusLabel[st] || st}</span>
            ${st !== 'completed' && st !== 'cancelled' ? `
              <button class="wr-appt-cancel" data-cancel-appt="${a.id}" title="ยกเลิกนัด">×</button>
            ` : ''}
          </div>`;
      }).join('')
    : `<p style="color:#94a3b8;font-size:13px;text-align:center;padding:14px 0;">ยังไม่มีนัดหมายที่กำลังจะมา</p>`;

  content.innerHTML = `
    <div style="max-width:520px;margin:0 auto;">

      <!-- Upcoming -->
      <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:10px;">นัดหมายที่กำลังจะมา</div>
      <div id="wr-appt-list">${upcomingHtml}</div>

      <hr class="wr-divider">

      <!-- Create new appointment -->
      <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:14px;">📅 นัดหมายใหม่</div>

      ${!petId ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;color:#92400e;margin-bottom:14px;">
          ⚠️ ยังไม่พบโปรไฟล์สัตว์เลี้ยงในระบบ — นัดหมายจะไม่ผูกกับสัตว์เลี้ยงโดยอัตโนมัติ
        </div>` : ''}

      <div class="wr-form-grid2">
        <div class="wr-form-group">
          <label class="wr-form-label">วันที่นัด *</label>
          <input id="ap-date" class="wr-form-input" type="date" value="${defaultDateStr}">
        </div>
        <div class="wr-form-group">
          <label class="wr-form-label">เวลา</label>
          <input id="ap-time" class="wr-form-input" type="time" value="09:00">
        </div>
      </div>

      <div class="wr-form-group">
        <label class="wr-form-label">บริการ</label>
        <select id="ap-service" class="wr-form-input">
          ${SERVICES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>

      <div class="wr-form-group">
        <label class="wr-form-label">หมายเหตุ / อาการเบื้องต้น</label>
        <textarea id="ap-notes" class="wr-form-input" rows="3" style="resize:vertical;" placeholder="เช่น ติดตามผลหลังผ่าตัด, ฉีดวัคซีนประจำปี..."></textarea>
      </div>

      <button class="wr-submit-btn" id="ap-save-btn">💾 บันทึกนัดหมาย</button>
    </div>`;

  // Cancel appointment
  content.querySelector('#wr-appt-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-cancel-appt]');
    if (!btn) return;
    const apptId = btn.dataset.cancelAppt;
    if (!confirm('ยืนยันการยกเลิกนัดหมายนี้?')) return;
    btn.disabled = true;
    const res = await apiFetch(`/api/pets/appointments/${apptId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (res?.success) {
      // Update local cache and re-render list
      if (_petData?.appointments) {
        _petData.appointments = _petData.appointments.map(a =>
          a.id === apptId ? { ...a, status: 'cancelled' } : a
        );
      }
      showToast('ยกเลิกนัดหมายแล้ว', 'info');
      _renderApptTab(content);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false;
    }
  });

  // Save new appointment
  content.querySelector('#ap-save-btn')?.addEventListener('click', async () => {
    const date = content.querySelector('#ap-date')?.value;
    if (!date) { showToast('กรุณาเลือกวันที่', 'error'); return; }

    const btn = content.querySelector('#ap-save-btn');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const payload = {
      store_id:     storeId,
      pet_id:       petId || null,
      owner_id:     ownerId || null,
      appt_date:    date,
      appt_time:    content.querySelector('#ap-time')?.value || null,
      service_type: content.querySelector('#ap-service')?.value || 'ตรวจทั่วไป',
      notes:        content.querySelector('#ap-notes')?.value.trim() || null,
    };

    const res = await apiFetch('/api/pets/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res?.success) {
      // Prepend new appointment to local cache
      const newAppt = res.data;
      if (_petData) {
        _petData.appointments = [newAppt, ...(_petData.appointments || [])];
      }
      showToast(`บันทึกนัดหมาย ${formatThaiDate(date)} แล้ว`);
      _renderApptTab(content);
    } else {
      showToast(res?.error || 'บันทึกนัดหมายไม่สำเร็จ', 'error');
      btn.disabled = false; btn.textContent = '💾 บันทึกนัดหมาย';
    }
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function _saveRecord(status = 'in_progress') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const c = _container;
  if (!c || !_queueItem) return;

  const g = id => c.querySelector(`#${id}`)?.value || '';

  const data = {
    store_id:          storeId,
    record_type:       'opd',
    status,
    queue_id:          _queueItem.id || null,
    pet_id:            _petData?.id  || _queueItem.pet_id || null,
    pet_name:          _queueItem.pet_name  || '',
    owner_name:        _queueItem.owner_name || '',
    subjective:        g('wr-hx'),
    objective:         g('wr-pe'),
    assessment:        g('wr-dx'),
    plan:              g('wr-tx'),
    temperature_c:     parseFloat(g('wr-temp'))   || null,
    weight_kg:         parseFloat(g('wr-weight'))  || null,
    heart_rate:        parseInt(g('wr-hr'))         || null,
    respiratory_rate:  parseInt(g('wr-rr'))         || null,
    vitals:            { temp: g('wr-temp'), weight: g('wr-weight'), hr: g('wr-hr'), rr: g('wr-rr') },
    prescriptions:     _prescriptions,
  };

  _setAutosave('● กำลังบันทึก...');

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
    _setAutosave(`✓ บันทึกแล้ว ${_timeStr()}`);
  } else {
    _setAutosave('⚠ บันทึกไม่สำเร็จ');
    if (status === 'completed') showToast('บันทึกไม่สำเร็จ', 'error');
  }
}

// ── Prescription modal ────────────────────────────────────────────────────────

function _renderRxList() {
  const el = _container?.querySelector('#wr-rx-list');
  if (!el) return;

  if (!_prescriptions.length) {
    el.innerHTML = '<p style="color:#94a3b8;font-size:12px;text-align:center;padding:12px 0;">ยังไม่มีรายการยา</p>';
    return;
  }

  el.innerHTML = _prescriptions.map((rx, i) => `
    <div class="wr-rx-item">
      <div class="wr-rx-info">
        <span style="font-weight:600;color:#1e293b;">${_esc(rx.drug)}</span>
        <span style="color:#94a3b8;margin:0 5px;">·</span>
        <span style="color:#475569;">${_esc(rx.dose || '')} ${rx.freq || ''}${rx.days ? ' ' + rx.days + 'วัน' : ''} ${rx.route || ''}</span>
        ${rx.note ? `<span style="color:#94a3b8;font-size:11px;margin-left:5px;">(${_esc(rx.note)})</span>` : ''}
      </div>
      <button class="wr-rx-del" data-rx-del="${i}" title="ลบ">×</button>
    </div>`).join('');
}

async function _openRxModal() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!_invCache || Date.now() - _invCacheAt > _INV_CACHE_TTL) {
    const inv = await apiFetch(`/api/inventory?store_id=${storeId}`);
    _invCache   = inv?.data || [];
    _invCacheAt = Date.now();
  }
  const products = _invCache;

  const inputStyle = 'width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;';
  const labelStyle = 'font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;display:block;';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);padding:16px;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;">
      <h3 style="font-weight:700;font-size:16px;color:#1e293b;margin-bottom:16px;">เพิ่มรายการยา</h3>

      <div style="margin-bottom:12px;">
        <label style="${labelStyle}">เลือกจากสต็อก</label>
        <select id="rx-product" style="${inputStyle}">
          <option value="">— พิมพ์ชื่อยาเองด้านล่าง —</option>
          ${products.map(p => `<option value="${p.id}" data-name="${_escAttr(p.name)}" data-stock="${p.stock||0}" data-unit="${_escAttr(p.unit||'ชิ้น')}">${p.name} (${p.stock||0} ${p.unit||''})</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:12px;">
        <label style="${labelStyle}">ชื่อยา *</label>
        <input id="rx-drug" style="${inputStyle}" placeholder="Amoxicillin">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><label style="${labelStyle}">จำนวน</label><input id="rx-qty" type="number" value="1" min="1" style="${inputStyle}"></div>
        <div><label style="${labelStyle}">ขนาดยา</label><input id="rx-dose" style="${inputStyle}" placeholder="250mg"></div>
        <div><label style="${labelStyle}">จำนวนวัน</label><input id="rx-days" type="number" value="3" min="1" style="${inputStyle}"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="${labelStyle}">ความถี่</label>
          <select id="rx-freq" style="${inputStyle}">
            ${Object.entries(FREQ_LABELS).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="${labelStyle}">วิธีใช้</label>
          <select id="rx-route" style="${inputStyle}">
            ${['PO','SC','IM','IV','TOP'].map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="${labelStyle}">หมายเหตุ</label>
        <input id="rx-note" style="${inputStyle}" placeholder="กินหลังอาหาร">
      </div>

      <div id="rx-warn" style="display:none;font-size:12px;color:#ef4444;margin-bottom:10px;"></div>

      <div style="display:flex;gap:10px;">
        <button id="rx-cancel" style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;">ยกเลิก</button>
        <button id="rx-add" style="flex:1;background:var(--primary,#0d9488);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;">+ เพิ่ม</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#rx-product').addEventListener('change', e => {
    const opt = e.target.selectedOptions[0];
    if (opt.value) {
      modal.querySelector('#rx-drug').value = opt.dataset.name;
      const stock = parseInt(opt.dataset.stock || '0');
      const warn  = modal.querySelector('#rx-warn');
      if (stock <= 0) {
        warn.textContent = '⚠️ สต็อกหมด ไม่สามารถตัดสต็อกได้';
        warn.style.display = 'block';
      } else if (stock <= 5) {
        warn.textContent = `⚠️ สต็อกเหลือน้อย: ${stock} ${opt.dataset.unit}`;
        warn.style.display = 'block';
      } else {
        warn.style.display = 'none';
      }
    }
  });

  modal.querySelector('#rx-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#rx-add').addEventListener('click', () => {
    const drug = modal.querySelector('#rx-drug').value.trim();
    if (!drug) { showToast('กรุณากรอกชื่อยา', 'error'); return; }

    const productSel = modal.querySelector('#rx-product');
    const productId  = productSel.value || null;
    const qty        = parseInt(modal.querySelector('#rx-qty').value) || 1;

    if (productId) {
      const opt   = productSel.selectedOptions[0];
      const stock = parseInt(opt?.dataset.stock || '0');
      if (stock < qty) { showToast(`สต็อกไม่พอ: มี ${stock} ต้องการ ${qty}`, 'error'); return; }
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
    _onFieldInput();
    modal.remove();
    showToast(`เพิ่ม ${drug} แล้ว`);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _setAutosave(msg) {
  const el = _container?.querySelector('#wr-autosave');
  if (el) el.textContent = msg;
}

function _timeStr() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
