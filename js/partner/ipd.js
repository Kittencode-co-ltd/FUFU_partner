/**
 * FUFU Partner – IPD Ward Module
 * Visual Cage Map, Admission Management, Treatment Sheet (hourly).
 * @module partner/ipd
 */

import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/notifications.js';
import { logAudit } from './audit.js';

// ===== STATE =====
let cages = [];
let admissions = [];
let selectedCage = null;

// ===== CAGE STATUS COLORS =====
const cageStatusConfig = {
  available: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: 'fa-door-open', label: 'ว่าง' },
  occupied: { color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: 'fa-paw', label: 'มีสัตว์' },
  maintenance: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: 'fa-wrench', label: 'ซ่อม' },
  reserved: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: 'fa-clock', label: 'จอง' },
};

const cageTypeIcons = {
  standard: '🏠', large: '🏡', icu: '🏥', isolation: '⚠️',
};

// ===== DEMO CAGES =====
function getDemoCages() {
  return [
    { id: 'c1', cage_number: 'A-01', cage_type: 'standard', floor: 1, status: 'occupied', daily_rate: 500,
      pet: { name: 'บัดดี้', species: 'สุนัข', breed: 'Golden', owner: 'คุณสมชาย' },
      admission: { admitted_at: '2025-04-20T09:00', reason: 'ผ่าตัด', status: 'admitted' } },
    { id: 'c2', cage_number: 'A-02', cage_type: 'standard', floor: 1, status: 'available', daily_rate: 500 },
    { id: 'c3', cage_number: 'A-03', cage_type: 'large', floor: 1, status: 'occupied', daily_rate: 800,
      pet: { name: 'มิลค์', species: 'แมว', breed: 'Scottish Fold', owner: 'คุณสุดา' },
      admission: { admitted_at: '2025-04-21T14:00', reason: 'ให้น้ำเกลือ', status: 'admitted' } },
    { id: 'c4', cage_number: 'A-04', cage_type: 'icu', floor: 1, status: 'occupied', daily_rate: 1500,
      pet: { name: 'ช็อคโก', species: 'สุนัข', breed: 'Chihuahua', owner: 'คุณวิชัย' },
      admission: { admitted_at: '2025-04-19T08:00', reason: 'ฉุกเฉิน – กินสิ่งแปลกปลอม', status: 'admitted' } },
    { id: 'c5', cage_number: 'B-01', cage_type: 'standard', floor: 1, status: 'available', daily_rate: 500 },
    { id: 'c6', cage_number: 'B-02', cage_type: 'isolation', floor: 1, status: 'maintenance', daily_rate: 700 },
    { id: 'c7', cage_number: 'B-03', cage_type: 'standard', floor: 1, status: 'reserved', daily_rate: 500 },
    { id: 'c8', cage_number: 'B-04', cage_type: 'large', floor: 1, status: 'available', daily_rate: 800 },
  ];
}

// ===== DEMO TREATMENT SHEET =====
function getDemoTreatments(cageId) {
  if (cageId === 'c1') {
    return [
      { time: '08:00', type: 'medication', desc: 'Amoxicillin 250mg', dosage: '1 เม็ด', completed: true, completed_by: 'พญ.สมใจ', eat: 'normal', poop: 'normal', pee: 'normal', notes: 'อาการดีขึ้น' },
      { time: '10:00', type: 'vitals', desc: 'วัดสัญญาณชีพ', dosage: 'T:38.5 HR:90', completed: true, completed_by: 'พยาบาลนุช' },
      { time: '12:00', type: 'feeding', desc: 'อาหารเหลว + น้ำ', dosage: '100ml', completed: false },
      { time: '14:00', type: 'medication', desc: 'Tramadol 50mg', dosage: '½ เม็ด', completed: false },
      { time: '16:00', type: 'observation', desc: 'เช็คแผลผ่าตัด', dosage: '-', completed: false },
      { time: '20:00', type: 'medication', desc: 'Amoxicillin 250mg', dosage: '1 เม็ด', completed: false },
    ];
  }
  if (cageId === 'c4') {
    return [
      { time: '06:00', type: 'vitals', desc: 'วัดสัญญาณชีพ ICU', dosage: 'T:39.2 HR:140', completed: true, completed_by: 'พญ.สมใจ', eat: 'none', poop: 'none', pee: 'abnormal', notes: 'ยังไม่กิน ซึม' },
      { time: '08:00', type: 'medication', desc: 'IV Fluid NaCl 0.9%', dosage: '500ml/hr', completed: true, completed_by: 'พยาบาลนุช' },
      { time: '10:00', type: 'procedure', desc: 'X-Ray ช่องท้อง', dosage: '-', completed: true, completed_by: 'พญ.สมใจ' },
      { time: '12:00', type: 'vitals', desc: 'วัดสัญญาณชีพ ICU', dosage: '-', completed: false },
    ];
  }
  return [];
}

// ===== RENDER IPD WARD =====
export function renderIPDWard(container) {
  cages = getDemoCages();

  const stats = {
    total: cages.length,
    occupied: cages.filter(c => c.status === 'occupied').length,
    available: cages.filter(c => c.status === 'available').length,
    icu: cages.filter(c => c.cage_type === 'icu' && c.status === 'occupied').length,
  };

  container.innerHTML = `
    <div class="ipd-layout">
      <!-- Stats Bar -->
      <div class="ipd-stats-bar">
        <div class="ipd-stat"><span class="ipd-stat-val">${stats.total}</span><span class="ipd-stat-label">กรงทั้งหมด</span></div>
        <div class="ipd-stat ipd-stat-occupied"><span class="ipd-stat-val">${stats.occupied}</span><span class="ipd-stat-label">มีผู้ป่วย</span></div>
        <div class="ipd-stat ipd-stat-available"><span class="ipd-stat-val">${stats.available}</span><span class="ipd-stat-label">ว่าง</span></div>
        <div class="ipd-stat ipd-stat-icu"><span class="ipd-stat-val">${stats.icu}</span><span class="ipd-stat-label">ICU</span></div>
      </div>

      <div class="ipd-main">
        <!-- Visual Cage Map -->
        <div class="ipd-cage-map" id="ipd-cage-map">
          <div class="card-header">
            <div class="card-title">🏥 แผนผัง Ward (Visual Cage Map)</div>
            <div style="display:flex;gap:6px;">
              ${Object.entries(cageStatusConfig).map(([k, v]) => `<span class="cage-legend" style="--c:${v.color}"><i class="fas ${v.icon}"></i> ${v.label}</span>`).join('')}
            </div>
          </div>
          <div class="cage-grid" id="cage-grid">
            ${cages.map(c => renderCageCard(c)).join('')}
          </div>
        </div>

        <!-- Detail Panel -->
        <div class="ipd-detail-panel" id="ipd-detail-panel">
          <div class="ipd-detail-placeholder">
            <i class="fas fa-hand-pointer" style="font-size:32px;color:var(--text-muted);margin-bottom:8px;"></i>
            <div>คลิกที่กรงเพื่อดูข้อมูลผู้ป่วย<br>และตาราง Treatment Sheet</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Cage click handlers
  container.querySelectorAll('.cage-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.cage-card').forEach(c => c.classList.remove('cage-selected'));
      card.classList.add('cage-selected');
      const cage = cages.find(c => c.id === card.dataset.cageId);
      if (cage) renderCageDetail(cage);
    });
  });
}

// ===== CAGE CARD =====
function renderCageCard(cage) {
  const cfg = cageStatusConfig[cage.status] || cageStatusConfig.available;
  const typeIcon = cageTypeIcons[cage.cage_type] || '🏠';

  return `
    <div class="cage-card cage-${cage.status}" data-cage-id="${cage.id}" style="--cage-color:${cfg.color};--cage-bg:${cfg.bg};">
      <div class="cage-header">
        <span class="cage-number">${typeIcon} ${cage.cage_number}</span>
        <span class="cage-status-dot" style="background:${cfg.color};" title="${cfg.label}"></span>
      </div>
      ${cage.status === 'occupied' && cage.pet ? `
        <div class="cage-pet-info">
          <div class="cage-pet-name">${cage.pet.name}</div>
          <div class="cage-pet-detail">${cage.pet.species} | ${cage.pet.breed}</div>
          <div class="cage-pet-owner">${cage.pet.owner}</div>
        </div>
        <div class="cage-admit-info">
          <i class="fas fa-clock"></i> ${timeSince(cage.admission?.admitted_at)}
        </div>
      ` : `
        <div class="cage-empty">
          <i class="fas ${cfg.icon}"></i>
          <span>${cfg.label}</span>
        </div>
      `}
      <div class="cage-rate">฿${cage.daily_rate?.toLocaleString()}/วัน</div>
    </div>
  `;
}

// ===== CAGE DETAIL + TREATMENT SHEET =====
function renderCageDetail(cage) {
  const panel = document.getElementById('ipd-detail-panel');
  if (!panel) return;

  selectedCage = cage;

  if (cage.status !== 'occupied' || !cage.pet) {
    panel.innerHTML = `
      <div class="cage-detail-empty">
        <div class="card-header"><div class="card-title">${cageTypeIcons[cage.cage_type]} กรง ${cage.cage_number}</div></div>
        <div style="padding:24px;text-align:center;">
          <i class="fas fa-door-open" style="font-size:48px;color:var(--primary);margin-bottom:12px;"></i>
          <div style="font-size:14px;color:var(--text-muted);">กรงนี้ว่าง — พร้อมรับผู้ป่วย</div>
          <button class="btn-sm btn-primary" style="margin-top:16px;" id="ipd-admit-btn">
            <i class="fas fa-plus"></i> รับผู้ป่วยเข้ากรง
          </button>
        </div>
      </div>
    `;
    return;
  }

  const treatments = getDemoTreatments(cage.id);
  const completed = treatments.filter(t => t.completed).length;
  const total = treatments.length;

  panel.innerHTML = `
    <div class="cage-detail-content">
      <div class="card-header" style="border-bottom:1px solid var(--border);">
        <div class="card-title">${cageTypeIcons[cage.cage_type]} กรง ${cage.cage_number} — ${cage.pet.name}</div>
        <button class="btn-sm btn-danger" id="ipd-discharge-btn"><i class="fas fa-right-from-bracket"></i> Discharge</button>
      </div>

      <!-- Patient Summary -->
      <div class="ipd-patient-summary">
        <div class="ipd-ps-row"><strong>ชื่อ:</strong> ${cage.pet.name}</div>
        <div class="ipd-ps-row"><strong>พันธุ์:</strong> ${cage.pet.breed} (${cage.pet.species})</div>
        <div class="ipd-ps-row"><strong>เจ้าของ:</strong> ${cage.pet.owner}</div>
        <div class="ipd-ps-row"><strong>เหตุผล:</strong> ${cage.admission?.reason || '-'}</div>
        <div class="ipd-ps-row"><strong>วันที่รับ:</strong> ${formatDateTime(cage.admission?.admitted_at)}</div>
        <div class="ipd-ps-row"><strong>ระยะเวลา:</strong> ${timeSince(cage.admission?.admitted_at)}</div>
      </div>

      <!-- Treatment Sheet -->
      <div class="treatment-sheet">
        <div class="ts-header">
          <span class="ts-title">📋 Treatment Sheet (${completed}/${total} ✓)</span>
          <div class="ts-progress-bar"><div class="ts-progress-fill" style="width:${(completed/total)*100}%"></div></div>
        </div>
        <div class="ts-table-wrap">
          <table class="ts-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ประเภท</th>
                <th>รายละเอียด</th>
                <th>ขนาดยา</th>
                <th>กิน</th>
                <th>อุจจาระ</th>
                <th>ปัสสาวะ</th>
                <th>ผู้ทำ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${treatments.map((t, i) => `
                <tr class="ts-row ${t.completed ? 'ts-done' : ''}">
                  <td class="ts-time">${t.time}</td>
                  <td><span class="ts-type ts-type-${t.type}">${treatmentTypeLabel(t.type)}</span></td>
                  <td>${t.desc}</td>
                  <td>${t.dosage}</td>
                  <td>${statusEmoji(t.eat)}</td>
                  <td>${statusEmoji(t.poop)}</td>
                  <td>${statusEmoji(t.pee)}</td>
                  <td class="ts-staff">${t.completed_by || '-'}</td>
                  <td>
                    ${t.completed
                      ? '<span class="badge badge-success">✓</span>'
                      : `<button class="btn-xs btn-primary ts-complete-btn" data-idx="${i}"><i class="fas fa-check"></i></button>`
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <button class="btn-sm btn-outline" style="margin-top:12px;" id="ts-add-row"><i class="fas fa-plus"></i> เพิ่มรายการ</button>
      </div>
    </div>
  `;

  // Treatment complete buttons
  panel.querySelectorAll('.ts-complete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('tr').classList.add('ts-done');
      btn.outerHTML = '<span class="badge badge-success">✓</span>';
      showToast('บันทึกเรียบร้อย');
      logAudit('update', 'treatment_sheets', null, null, { action: 'complete', cage: cage.cage_number });
    });
  });

  // Discharge
  document.getElementById('ipd-discharge-btn')?.addEventListener('click', () => {
    showToast(`Discharge ${cage.pet.name} จากกรง ${cage.cage_number} สำเร็จ`);
    logAudit('update', 'ipd_admissions', null, null, { action: 'discharge', cage: cage.cage_number });
  });
}

// ===== HELPERS =====
function treatmentTypeLabel(type) {
  const map = { medication: '💊 ยา', feeding: '🍽️ อาหาร', vitals: '🩺 Vitals', observation: '👁️ สังเกต', procedure: '🔧 หัตถการ' };
  return map[type] || type;
}

function statusEmoji(status) {
  if (!status) return '-';
  const map = { normal: '✅', poor: '⚠️', none: '❌', diarrhea: '🟡', abnormal: '🔴' };
  return map[status] || '-';
}

function timeSince(dateStr) {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} ชม.`;
  return `${Math.floor(hours / 24)} วัน ${hours % 24} ชม.`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}
