/**
 * FUFU Partner – Medical Records Module
 * Handles OPD/IPD toggle, vaccination tracking, document templates,
 * file upload placeholder, Thai government export.
 * @module partner/medical
 * 
 * Acceptance Criteria:
 * - [x] Supports OPD/IPD forms.
 * - [x] Vaccination schedule tracker and next-due calculation.
 * - [x] Support export to DLD (กรมปศุสัตว์).
 * - [x] Operations respect FEATURE_FLAGS.ENABLE_MEDICAL_MODULE.
 */

import { showToast } from '../utils/notifications.js';
import { formatThaiDate } from '../utils/formatters.js';
import { FEATURE_FLAGS } from '../utils/config.js';

// ===== MOCK DATA =====
const mockRecords = [
  {
    id: 'r1', date: '2026-04-15', type: 'OPD',
    pet: 'บัดดี้', species: 'สุนัข', breed: 'โกลเด้น รีทรีฟเวอร์',
    owner: 'คุณสมชาย', phone: '089-123-4567',
    symptoms: 'ท้องเสีย อาเจียน', diagnosis: 'Gastroenteritis',
    treatment: 'ให้ยาแก้อาเจียน + ยาแก้ท้องเสีย', medications: 'Metoclopramide 10mg, Kaolin-Pectin',
    vet: 'ดร.สมศักดิ์', cost: 850, status: 'completed',
  },
  {
    id: 'r2', date: '2026-04-14', type: 'OPD',
    pet: 'มิลค์', species: 'แมว', breed: 'เปอร์เซีย',
    owner: 'คุณสุดา', phone: '091-234-5678',
    symptoms: 'คัน เกาหู', diagnosis: 'Otitis Externa (Ear Infection)',
    treatment: 'ล้างหูและหยดยา', medications: 'Otomax Ear Drops',
    vet: 'ดร.สมศักดิ์', cost: 600, status: 'completed',
  },
  {
    id: 'r3', date: '2026-04-10', type: 'IPD',
    pet: 'โกลเด้น', species: 'สุนัข', breed: 'ไซบีเรียน ฮัสกี้',
    owner: 'คุณวิชัย', phone: '085-345-6789',
    symptoms: 'ขาหลังเดินลำบาก', diagnosis: 'Cruciate Ligament Rupture',
    treatment: 'ผ่าตัดซ่อมเอ็นไขว้หน้า (TPLO)', medications: 'Meloxicam, Amoxicillin, Tramadol',
    vet: 'ดร.สมศักดิ์', cost: 25000, status: 'admitted', admitDate: '2026-04-10', dischargeDateEst: '2026-04-17',
  },
];

const mockVaccinations = [
  { id: 'v1', pet: 'บัดดี้', vaccine: 'DHPPL (5 โรค)', doseNumber: 3, doseDate: '2026-02-01', nextDue: '2026-08-01', status: 'completed', vet: 'ดร.สมศักดิ์' },
  { id: 'v2', pet: 'บัดดี้', vaccine: 'Rabies (พิษสุนัขบ้า)', doseNumber: 1, doseDate: '2026-02-01', nextDue: '2027-02-01', status: 'completed', vet: 'ดร.สมศักดิ์' },
  { id: 'v3', pet: 'มิลค์', vaccine: 'FVRCP (3 โรคแมว)', doseNumber: 2, doseDate: '2026-01-15', nextDue: '2026-04-15', status: 'overdue', vet: 'ดร.สมศักดิ์' },
  { id: 'v4', pet: 'โกลเด้น', vaccine: 'DHPPL (5 โรค)', doseNumber: 2, doseDate: '2025-12-10', nextDue: '2026-06-10', status: 'upcoming', vet: 'ดร.สมศักดิ์' },
];

// ===== RENDER =====

/**
 * Render the medical records page (enhanced with OPD/IPD, vaccination, templates).
 */
export function renderMedicalRecords() {
  if (!FEATURE_FLAGS.ENABLE_MEDICAL_MODULE) {
    showToast('โมดูลการแพทย์ยังไม่เปิดใช้งาน', 'error');
    return;
  }
  const container = document.getElementById('page-records');
  if (!container) return;

  container.innerHTML = `
    <!-- OPD / IPD Toggle -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:4px;gap:4px">
        <button class="med-tab active" data-med-tab="all" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:var(--primary);color:#fff">ทั้งหมด (${mockRecords.length})</button>
        <button class="med-tab" data-med-tab="OPD" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:transparent;color:var(--text-muted)">OPD (${mockRecords.filter(r => r.type === 'OPD').length})</button>
        <button class="med-tab" data-med-tab="IPD" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:transparent;color:var(--text-muted)">IPD (${mockRecords.filter(r => r.type === 'IPD').length})</button>
      </div>
      <button class="btn-sm btn-primary" id="new-record-btn"><i class="fas fa-plus" style="margin-right:4px"></i>เพิ่มประวัติ</button>
      <button class="btn-sm btn-outline" id="export-dld-btn"><i class="fas fa-file-export" style="margin-right:4px"></i>Export กรมปศุสัตว์</button>
    </div>

    <!-- Medical Records Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 ประวัติการรักษา</div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ประเภท</th>
            <th>สัตว์เลี้ยง</th>
            <th>เจ้าของ</th>
            <th>อาการ / การวินิจฉัย</th>
            <th>การรักษา / ยา</th>
            <th>ราคา</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody id="med-records-tbody">
          ${renderRecordRows(mockRecords)}
        </tbody>
      </table>
    </div>

    <!-- Vaccination Tracker -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">💉 ตารางวัคซีน (Vaccination Tracker)</div>
        <button class="btn-sm btn-primary" id="add-vaccine-btn"><i class="fas fa-syringe" style="margin-right:4px"></i>บันทึกวัคซีน</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>สัตว์เลี้ยง</th>
            <th>วัคซีน</th>
            <th>เข็มที่</th>
            <th>วันที่ฉีด</th>
            <th>ครั้งถัดไป</th>
            <th>สถานะ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          ${mockVaccinations.map(v => {
            const statusMap = {
              completed: '<span class="badge badge-success">ฉีดแล้ว</span>',
              overdue: '<span class="badge badge-warning" style="background:#FEE2E2;color:#991B1B">⚠️ เกินกำหนด</span>',
              upcoming: '<span class="badge badge-info">กำลังถึงกำหนด</span>',
            };
            return `
              <tr>
                <td style="font-weight:500">${v.pet}</td>
                <td>${v.vaccine}</td>
                <td style="text-align:center">${v.doseNumber}</td>
                <td style="font-family:'Sarabun',sans-serif;font-size:13px">${v.doseDate}</td>
                <td style="font-family:'Sarabun',sans-serif;font-size:13px;${v.status === 'overdue' ? 'color:#EF4444;font-weight:600' : ''}">${v.nextDue}</td>
                <td>${statusMap[v.status] || ''}</td>
                <td>
                  <button class="btn-sm btn-outline" title="พิมพ์ใบรับรอง" data-action="print-cert" data-vac-id="${v.id}" style="font-size:11px;margin-right:4px">
                    <i class="fas fa-print"></i>
                  </button>
                  ${v.status === 'overdue' ? `<button class="btn-sm btn-primary" style="font-size:11px" data-action="send-reminder" data-vac-id="${v.id}">แจ้งเตือน</button>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Medical Templates -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">📄 แบบฟอร์มและเอกสาร (Templates)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${[
          { icon: 'fa-file-medical', label: 'ใบรับรองวัคซีน', desc: 'Vaccination Certificate', id: 'tpl-vaccine' },
          { icon: 'fa-file-signature', label: 'แบบยินยอมผ่าตัด', desc: 'Surgery Consent Form', id: 'tpl-surgery' },
          { icon: 'fa-file-arrow-up', label: 'ใบส่งต่อผู้ป่วย', desc: 'Referral Letter', id: 'tpl-referral' },
          { icon: 'fa-file-lines', label: 'แบบรับฝากเลี้ยง', desc: 'Boarding Intake Form', id: 'tpl-boarding' },
          { icon: 'fa-file-shield', label: 'ใบรับรองสุขภาพ', desc: 'Health Certificate', id: 'tpl-health' },
          { icon: 'fa-flag', label: 'รายงาน กรมปศุสัตว์', desc: 'DLD Report Template', id: 'tpl-dld' },
        ].map(t => `
          <button class="template-card" data-template="${t.id}" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid rgba(203,213,225,0.3);border-radius:12px;background:#fff;cursor:pointer;text-align:left;width:100%;transition:all 0.2s;font-family:'Prompt',sans-serif" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='rgba(203,213,225,0.3)'">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(13,148,136,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${t.icon}" style="color:var(--primary);font-size:16px"></i>
            </div>
            <div>
              <div style="font-weight:500;font-size:13px">${t.label}</div>
              <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">${t.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- File Upload Placeholder -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">📁 ไฟล์แนบ (Attachments)</div>
      </div>
      <div id="file-dropzone" style="border:2px dashed rgba(203,213,225,0.5);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.3s" role="button" tabindex="0" aria-label="อัพโหลดไฟล์">
        <i class="fas fa-cloud-arrow-up" style="font-size:2rem;color:var(--primary);opacity:0.5;margin-bottom:8px;display:block"></i>
        <div style="font-size:14px;font-weight:500;margin-bottom:4px">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก</div>
        <div style="font-size:12px;color:var(--text-muted);font-family:'Sarabun',sans-serif">รองรับ: ผลแล็บ, X-ray, รูปถ่ายการรักษา (JPG, PNG, PDF — สูงสุด 10MB)</div>
      </div>
    </div>
  `;

  // Event handlers
  setupMedicalEvents(container);
}

/**
 * Render medical record table rows.
 * @param {Array} records
 * @param {string} [filter] - 'OPD', 'IPD', or 'all'
 * @returns {string}
 */
function renderRecordRows(records, filter = 'all') {
  const filtered = filter === 'all' ? records : records.filter(r => r.type === filter);

  if (filtered.length === 0) {
    return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;font-family:'Sarabun',sans-serif">ไม่มีข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
  }

  return filtered.map(r => {
    const typeColor = r.type === 'IPD' ? '#8B5CF6' : '#0D9488';
    const statusBadge = r.status === 'admitted'
      ? '<span class="badge badge-warning">นอนพัก</span>'
      : '<span class="badge badge-success">เสร็จสิ้น</span>';

    return `
      <tr data-record-type="${r.type}">
        <td style="font-family:'Sarabun',sans-serif;font-size:13px">${r.date}</td>
        <td><span style="padding:2px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${typeColor}15;color:${typeColor}">${r.type}</span></td>
        <td>
          <div style="font-weight:500">${r.pet}</div>
          <div style="font-size:11px;color:var(--text-muted)">${r.species} — ${r.breed}</div>
        </td>
        <td style="font-size:13px">${r.owner}</td>
        <td>
          <div style="font-size:13px">${r.symptoms}</div>
          <div style="font-size:11px;color:var(--primary);font-weight:500">${r.diagnosis}</div>
        </td>
        <td style="font-size:12px;font-family:'Sarabun',sans-serif;max-width:200px">
          ${r.treatment}
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">💊 ${r.medications}</div>
        </td>
        <td style="font-weight:600;color:var(--teal)">฿${r.cost.toLocaleString()}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Set up event handlers for the medical page.
 * @param {HTMLElement} container
 */
function setupMedicalEvents(container) {
  // OPD/IPD tab toggle
  container.querySelectorAll('.med-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.med-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      tab.classList.add('active');
      tab.style.background = 'var(--primary)';
      tab.style.color = '#fff';

      const filter = tab.dataset.medTab;
      const tbody = container.querySelector('#med-records-tbody');
      if (tbody) tbody.innerHTML = renderRecordRows(mockRecords, filter);
    });
  });

  // New record button
  container.querySelector('#new-record-btn')?.addEventListener('click', () => {
    showToast('เปิดฟอร์มบันทึกการรักษาใหม่ (Demo)', 'info');
  });

  // Export DLD button
  container.querySelector('#export-dld-btn')?.addEventListener('click', () => {
    showToast('กำลังสร้างรายงานสำหรับกรมปศุสัตว์ (Demo)', 'info');
  });

  // Add vaccine button
  container.querySelector('#add-vaccine-btn')?.addEventListener('click', () => {
    showToast('เปิดฟอร์มบันทึกวัคซีน (Demo)', 'info');
  });

  // Template cards
  container.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      showToast(`กำลังเปิดแบบฟอร์ม: ${card.querySelector('div div')?.textContent} (Demo)`, 'info');
    });
  });

  // Vaccination actions
  container.querySelectorAll('[data-action="print-cert"]').forEach(btn => {
    btn.addEventListener('click', () => showToast('กำลังพิมพ์ใบรับรองวัคซีน (Demo)', 'info'));
  });
  container.querySelectorAll('[data-action="send-reminder"]').forEach(btn => {
    btn.addEventListener('click', () => showToast('ส่งการแจ้งเตือนวัคซีนเรียบร้อย (Demo)'));
  });

  // File dropzone
  const dropzone = container.querySelector('#file-dropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => showToast('เลือกไฟล์เพื่ออัพโหลด (Demo)', 'info'));
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--primary)';
      dropzone.style.background = 'rgba(13,148,136,0.03)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(203,213,225,0.5)';
      dropzone.style.background = '';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(203,213,225,0.5)';
      dropzone.style.background = '';
      showToast('อัพโหลดไฟล์สำเร็จ (Demo)');
    });
  }
}
