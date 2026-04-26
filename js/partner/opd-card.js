/**
 * FUFU Partner – OPD Card Module (Smart Medical Record)
 * SOAP Note (Subjective/Objective/Assessment/Plan),
 * Interactive Body Map, Vitals, Drug Prescription (FEFO).
 * @module partner/opd-card
 */

import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/notifications.js';
import { logAudit } from './audit.js';
import { insertToSupabase, updateInSupabase } from '../utils/supabase-client.js';

// ===== BODY MAP SVG PATHS =====
const bodyMapPaths = {
  dog: {
    viewBox: '0 0 400 300',
    regions: [
      { id: 'head', label: 'หัว (Head)', d: 'M180,30 Q200,10 220,30 Q240,50 220,70 Q200,80 180,70 Q160,50 180,30Z', cx: 200, cy: 45 },
      { id: 'ear_l', label: 'หูซ้าย (Left Ear)', d: 'M155,25 Q145,5 160,15 Q165,25 155,35Z', cx: 155, cy: 20 },
      { id: 'ear_r', label: 'หูขวา (Right Ear)', d: 'M245,25 Q255,5 240,15 Q235,25 245,35Z', cx: 245, cy: 20 },
      { id: 'neck', label: 'คอ (Neck)', d: 'M185,70 Q200,85 215,70 Q220,90 215,100 Q200,105 185,100 Q180,90 185,70Z', cx: 200, cy: 88 },
      { id: 'chest', label: 'อก (Chest)', d: 'M170,100 Q200,95 230,100 Q240,130 230,155 Q200,160 170,155 Q160,130 170,100Z', cx: 200, cy: 128 },
      { id: 'abdomen', label: 'ท้อง (Abdomen)', d: 'M175,155 Q200,150 225,155 Q235,185 225,210 Q200,215 175,210 Q165,185 175,155Z', cx: 200, cy: 183 },
      { id: 'back', label: 'หลัง (Back)', d: 'M180,100 Q200,90 220,100 L225,155 Q200,145 175,155Z', cx: 200, cy: 120 },
      { id: 'tail', label: 'หาง (Tail)', d: 'M200,210 Q190,240 180,270 Q175,280 185,275 Q195,260 205,230 Q210,215 200,210Z', cx: 188, cy: 250 },
      { id: 'leg_fl', label: 'ขาหน้าซ้าย', d: 'M165,140 Q160,170 155,200 Q150,230 155,260 Q160,265 165,255 Q168,225 170,195 Q172,170 170,140Z', cx: 160, cy: 200 },
      { id: 'leg_fr', label: 'ขาหน้าขวา', d: 'M235,140 Q240,170 245,200 Q250,230 245,260 Q240,265 235,255 Q232,225 230,195 Q228,170 230,140Z', cx: 240, cy: 200 },
      { id: 'leg_rl', label: 'ขาหลังซ้าย', d: 'M170,195 Q160,220 150,250 Q145,275 150,280 Q160,275 165,250 Q170,225 175,200Z', cx: 155, cy: 250 },
      { id: 'leg_rr', label: 'ขาหลังขวา', d: 'M230,195 Q240,220 250,250 Q255,275 250,280 Q240,275 235,250 Q230,225 225,200Z', cx: 245, cy: 250 },
    ]
  },
  cat: {
    viewBox: '0 0 400 300',
    regions: [
      { id: 'head', label: 'หัว (Head)', d: 'M180,40 Q200,20 220,40 Q235,55 220,75 Q200,85 180,75 Q165,55 180,40Z', cx: 200, cy: 55 },
      { id: 'ear_l', label: 'หูซ้าย', d: 'M168,38 Q155,10 175,30Z', cx: 163, cy: 25 },
      { id: 'ear_r', label: 'หูขวา', d: 'M232,38 Q245,10 225,30Z', cx: 237, cy: 25 },
      { id: 'neck', label: 'คอ', d: 'M188,75 Q200,85 212,75 Q218,90 212,100 Q200,105 188,100 Q182,90 188,75Z', cx: 200, cy: 88 },
      { id: 'body', label: 'ลำตัว (Body)', d: 'M175,100 Q200,95 225,100 Q235,145 225,195 Q200,200 175,195 Q165,145 175,100Z', cx: 200, cy: 148 },
      { id: 'tail', label: 'หาง', d: 'M200,195 Q185,230 170,260 Q160,280 155,290 Q150,295 158,288 Q170,270 185,245 Q195,225 205,200Z', cx: 170, cy: 265 },
      { id: 'leg_fl', label: 'ขาหน้าซ้าย', d: 'M170,135 Q165,165 160,200 Q158,230 160,260 Q163,265 167,255 Q168,225 170,195 Q172,165 173,140Z', cx: 163, cy: 200 },
      { id: 'leg_fr', label: 'ขาหน้าขวา', d: 'M230,135 Q235,165 240,200 Q242,230 240,260 Q237,265 233,255 Q232,225 230,195 Q228,165 227,140Z', cx: 237, cy: 200 },
      { id: 'leg_rl', label: 'ขาหลังซ้าย', d: 'M175,180 Q165,210 155,245 Q150,270 155,275 Q162,268 168,245 Q173,215 178,190Z', cx: 160, cy: 240 },
      { id: 'leg_rr', label: 'ขาหลังขวา', d: 'M225,180 Q235,210 245,245 Q250,270 245,275 Q238,268 232,245 Q227,215 222,190Z', cx: 240, cy: 240 },
    ]
  }
};

// ===== STATE =====
let currentRecord = null;
let bodyMarkers = [];
let selectedRegion = null;

// ===== SEVERITY COLORS =====
const severityColors = {
  mild: '#FBBF24',
  moderate: '#F97316',
  severe: '#EF4444',
  critical: '#DC2626',
};

// ===== RENDER OPD CARD =====
export function renderOPDCard(container, record = null) {
  currentRecord = record || {
    id: null, subjective: '', objective: '', assessment: '', plan: '',
    weight_kg: '', temperature_c: '', heart_rate: '', respiratory_rate: '',
    body_map_data: [], prescribed_meds: [], diagnosis: '', treatment: '',
  };
  bodyMarkers = currentRecord.body_map_data || [];

  container.innerHTML = `
    <div class="opd-card-layout">
      <!-- Column 1: Patient Info + Vitals -->
      <div class="opd-col opd-col-info">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🐾 ข้อมูลสัตว์เลี้ยง</div>
          </div>
          <div class="opd-patient-info" id="opd-patient-info">
            <div class="opd-patient-placeholder">เลือกสัตว์เลี้ยงจากคิว หรือค้นหาจากเบอร์โทร/Microchip</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📏 สัญญาณชีพ (Vitals)</div></div>
          <div class="vitals-grid">
            <div class="vital-item">
              <label class="field-label">น้ำหนัก (kg)</label>
              <input class="field-input" id="opd-weight" type="number" step="0.1" value="${currentRecord.weight_kg || ''}" placeholder="0.0">
            </div>
            <div class="vital-item">
              <label class="field-label">อุณหภูมิ (°C)</label>
              <input class="field-input" id="opd-temp" type="number" step="0.1" value="${currentRecord.temperature_c || ''}" placeholder="38.5">
            </div>
            <div class="vital-item">
              <label class="field-label">ชีพจร (bpm)</label>
              <input class="field-input" id="opd-hr" type="number" value="${currentRecord.heart_rate || ''}" placeholder="120">
            </div>
            <div class="vital-item">
              <label class="field-label">อัตราหายใจ</label>
              <input class="field-input" id="opd-rr" type="number" value="${currentRecord.respiratory_rate || ''}" placeholder="24">
            </div>
          </div>
        </div>
        <!-- Body Map -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🗺️ Body Map</div>
            <div style="display:flex;gap:4px;">
              <select class="field-input" id="opd-animal-type" style="width:auto;padding:4px 8px;font-size:12px;">
                <option value="dog">🐕 สุนัข</option>
                <option value="cat">🐈 แมว</option>
              </select>
            </div>
          </div>
          <div class="body-map-container" id="body-map-container"></div>
          <div class="body-map-markers" id="body-map-markers-list"></div>
        </div>
      </div>

      <!-- Column 2: SOAP Note -->
      <div class="opd-col opd-col-soap">
        <div class="card">
          <div class="card-header"><div class="card-title">📝 SOAP Note</div></div>
          <div class="soap-grid">
            <div class="soap-section soap-s">
              <div class="soap-label"><span class="soap-badge soap-badge-s">S</span> Subjective (อาการที่เจ้าของเล่า)</div>
              <textarea class="soap-textarea" id="opd-soap-s" placeholder="เจ้าของเล่าว่า...">${currentRecord.subjective || ''}</textarea>
            </div>
            <div class="soap-section soap-o">
              <div class="soap-label"><span class="soap-badge soap-badge-o">O</span> Objective (ผลตรวจร่างกาย)</div>
              <textarea class="soap-textarea" id="opd-soap-o" placeholder="PE: ...">${currentRecord.objective || ''}</textarea>
            </div>
            <div class="soap-section soap-a">
              <div class="soap-label"><span class="soap-badge soap-badge-a">A</span> Assessment (การวินิจฉัย)</div>
              <textarea class="soap-textarea" id="opd-soap-a" placeholder="Dx: ...">${currentRecord.assessment || ''}</textarea>
            </div>
            <div class="soap-section soap-p">
              <div class="soap-label"><span class="soap-badge soap-badge-p">P</span> Plan (แผนการรักษา)</div>
              <textarea class="soap-textarea" id="opd-soap-p" placeholder="Tx: ...">${currentRecord.plan || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Column 3: Prescription + Actions -->
      <div class="opd-col opd-col-rx">
        <div class="card">
          <div class="card-header">
            <div class="card-title">💊 สั่งยา / เวชภัณฑ์</div>
            <button class="btn-sm btn-primary" id="opd-add-rx"><i class="fas fa-plus"></i> เพิ่มยา</button>
          </div>
          <div class="rx-list" id="opd-rx-list">
            ${renderPrescriptionList(currentRecord.prescribed_meds || [])}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📎 ไฟล์แนบ</div></div>
          <div class="opd-attachments">
            <button class="btn-sm btn-outline" id="opd-attach-lab"><i class="fas fa-flask"></i> ผล Lab</button>
            <button class="btn-sm btn-outline" id="opd-attach-xray"><i class="fas fa-x-ray"></i> X-Ray</button>
            <button class="btn-sm btn-outline" id="opd-attach-photo"><i class="fas fa-camera"></i> ถ่ายรูป</button>
          </div>
        </div>
        <div class="opd-actions">
          <button class="btn-sm btn-primary" id="opd-save" style="width:100%;padding:12px;">
            <i class="fas fa-save"></i> บันทึก OPD Card
          </button>
          <button class="btn-sm btn-outline" id="opd-print" style="width:100%;padding:12px;margin-top:8px;">
            <i class="fas fa-print"></i> พิมพ์ใบสรุป
          </button>
        </div>
      </div>
    </div>
  `;

  // Init Body Map
  renderBodyMap('dog');
  document.getElementById('opd-animal-type')?.addEventListener('change', (e) => {
    renderBodyMap(e.target.value);
  });

  // Save handler
  document.getElementById('opd-save')?.addEventListener('click', saveOPDCard);
  document.getElementById('opd-add-rx')?.addEventListener('click', addPrescriptionRow);
}

// ===== BODY MAP RENDER =====
function renderBodyMap(animalType = 'dog') {
  const container = document.getElementById('body-map-container');
  if (!container) return;

  const map = bodyMapPaths[animalType] || bodyMapPaths.dog;

  const svg = `
    <svg viewBox="${map.viewBox}" class="body-map-svg" id="body-map-svg">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${map.regions.map(r => `
        <path d="${r.d}" class="body-region" data-region="${r.id}" data-label="${r.label}" fill="rgba(13,148,136,0.15)" stroke="var(--primary)" stroke-width="1.5"/>
      `).join('')}
      ${bodyMarkers.map((m, i) => `
        <circle cx="${m.x}" cy="${m.y}" r="8" fill="${severityColors[m.severity] || '#EF4444'}" stroke="#fff" stroke-width="2" class="body-marker" data-idx="${i}" filter="url(#glow)"/>
        <text x="${m.x}" y="${m.y + 3}" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">${i + 1}</text>
      `).join('')}
    </svg>
  `;

  container.innerHTML = svg;
  renderMarkersList();

  // Click on region to add marker
  container.querySelectorAll('.body-region').forEach(path => {
    path.addEventListener('click', (e) => {
      const rect = container.querySelector('svg').getBoundingClientRect();
      const svgEl = container.querySelector('svg');
      const viewBox = svgEl.viewBox.baseVal;
      const x = ((e.clientX - rect.left) / rect.width) * viewBox.width;
      const y = ((e.clientY - rect.top) / rect.height) * viewBox.height;

      addBodyMarker({
        x: Math.round(x),
        y: Math.round(y),
        region: path.dataset.region,
        label: path.dataset.label,
        severity: 'moderate',
        note: '',
      });
    });

    path.addEventListener('mouseenter', () => {
      path.style.fill = 'rgba(13,148,136,0.35)';
    });
    path.addEventListener('mouseleave', () => {
      path.style.fill = 'rgba(13,148,136,0.15)';
    });
  });
}

function addBodyMarker(marker) {
  bodyMarkers.push(marker);
  const animalType = document.getElementById('opd-animal-type')?.value || 'dog';
  renderBodyMap(animalType);
  showToast(`บันทึกจุด #${bodyMarkers.length} ที่ ${marker.label}`);
}

function removeBodyMarker(idx) {
  bodyMarkers.splice(idx, 1);
  const animalType = document.getElementById('opd-animal-type')?.value || 'dog';
  renderBodyMap(animalType);
}

function renderMarkersList() {
  const list = document.getElementById('body-map-markers-list');
  if (!list) return;

  if (bodyMarkers.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px;">คลิกบนร่างกายเพื่อบันทึกรอยโรค/แผล</div>';
    return;
  }

  list.innerHTML = bodyMarkers.map((m, i) => `
    <div class="marker-item">
      <span class="marker-num" style="background:${severityColors[m.severity]}">${i + 1}</span>
      <span class="marker-label">${m.label}</span>
      <select class="marker-severity" data-idx="${i}">
        <option value="mild" ${m.severity === 'mild' ? 'selected' : ''}>เล็กน้อย</option>
        <option value="moderate" ${m.severity === 'moderate' ? 'selected' : ''}>ปานกลาง</option>
        <option value="severe" ${m.severity === 'severe' ? 'selected' : ''}>รุนแรง</option>
        <option value="critical" ${m.severity === 'critical' ? 'selected' : ''}>วิกฤต</option>
      </select>
      <input class="marker-note" placeholder="หมายเหตุ..." value="${m.note || ''}" data-idx="${i}">
      <button class="marker-remove" data-idx="${i}"><i class="fas fa-times"></i></button>
    </div>
  `).join('');

  list.querySelectorAll('.marker-severity').forEach(sel => {
    sel.addEventListener('change', (e) => {
      bodyMarkers[e.target.dataset.idx].severity = e.target.value;
      const animalType = document.getElementById('opd-animal-type')?.value || 'dog';
      renderBodyMap(animalType);
    });
  });

  list.querySelectorAll('.marker-note').forEach(inp => {
    inp.addEventListener('input', (e) => {
      bodyMarkers[e.target.dataset.idx].note = e.target.value;
    });
  });

  list.querySelectorAll('.marker-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      removeBodyMarker(parseInt(btn.dataset.idx));
    });
  });
}

// ===== PRESCRIPTION LIST =====
function renderPrescriptionList(meds) {
  if (!meds || meds.length === 0) {
    return '<div style="color:var(--text-muted);font-size:13px;padding:12px;text-align:center;">ยังไม่มีรายการยา — กด + เพิ่มยา</div>';
  }
  return meds.map((m, i) => `
    <div class="rx-item">
      <div class="rx-name">${m.name || 'ยา'}</div>
      <div class="rx-detail">${m.dosage || ''} | ${m.frequency || ''}</div>
      <div class="rx-batch">${m.batch ? `Lot: ${m.batch}` : 'FEFO Auto'}</div>
      <button class="rx-remove" data-idx="${i}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

function addPrescriptionRow() {
  const meds = currentRecord.prescribed_meds || [];
  meds.push({ name: '', dosage: '', frequency: '', qty: 1, batch: '' });
  currentRecord.prescribed_meds = meds;

  const list = document.getElementById('opd-rx-list');
  if (list) list.innerHTML = renderPrescriptionList(meds);
  showToast('เพิ่มรายการยาแล้ว');
}

// ===== SAVE OPD CARD =====
async function saveOPDCard() {
  const data = {
    subjective: document.getElementById('opd-soap-s')?.value || '',
    objective: document.getElementById('opd-soap-o')?.value || '',
    assessment: document.getElementById('opd-soap-a')?.value || '',
    plan: document.getElementById('opd-soap-p')?.value || '',
    weight_kg: parseFloat(document.getElementById('opd-weight')?.value) || null,
    temperature_c: parseFloat(document.getElementById('opd-temp')?.value) || null,
    heart_rate: parseInt(document.getElementById('opd-hr')?.value) || null,
    respiratory_rate: parseInt(document.getElementById('opd-rr')?.value) || null,
    body_map_data: bodyMarkers,
    prescribed_meds: currentRecord.prescribed_meds || [],
    status: 'in_progress',
    store_id: localStorage.getItem(STORAGE_KEYS.STORE_ID) || null,
    vet_staff_id: localStorage.getItem(STORAGE_KEYS.STAFF_ID) || null
  };
  
  if (currentRecord.pet_id) data.pet_id = currentRecord.pet_id;
  if (currentRecord.customer_id) data.customer_id = currentRecord.customer_id;

  // Log audit trail
  logAudit('update', 'medical_records', currentRecord.id, null, data, 'บันทึก OPD Card');

  const btn = document.getElementById('opd-save');
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';

  let result;
  if (currentRecord && currentRecord.id) {
    result = await updateInSupabase('medical_records', data, { id: currentRecord.id });
  } else {
    result = await insertToSupabase('medical_records', data);
    if (result && result.length > 0) currentRecord.id = result[0].id;
  }

  if (btn) btn.innerHTML = '<i class="fas fa-save"></i> บันทึก OPD Card';

  if (result) {
    showToast('บันทึก OPD Card สำเร็จ');
    console.log('[OPD] Saved:', data);
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึก OPD Card', 'error');
  }
}
