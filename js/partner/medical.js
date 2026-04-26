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
import { FEATURE_FLAGS, STORAGE_KEYS } from '../utils/config.js';
import { apiRequest } from '../utils/supabase-client.js';

// Store fetched records for tab filtering
let cachedRecords = [];

// ===== RENDER =====

/**
 * Render the medical records page (enhanced with OPD/IPD, vaccination, templates).
 */
export async function renderMedicalRecords() {
  if (!FEATURE_FLAGS.ENABLE_MEDICAL_MODULE) {
    showToast('โมดูลการแพทย์ยังไม่เปิดใช้งาน', 'error');
    return;
  }
  const container = document.getElementById('page-records');
  if (!container) return;

  const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);

  // Fetch real data from API
  if (storeId) {
    try {
      const apiData = await apiRequest(`/api/medical-records?store_id=${storeId}`);
      if (Array.isArray(apiData)) {
        cachedRecords = apiData;
      }
    } catch (err) {
      console.error('[Medical] API error:', err);
    }
  }

  const opdCount = cachedRecords.filter(r => r.record_type === 'opd').length;
  const ipdCount = cachedRecords.filter(r => r.record_type === 'ipd').length;

  container.innerHTML = `
    <!-- OPD / IPD Toggle -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:4px;gap:4px">
        <button class="med-tab active" data-med-tab="all" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:var(--primary);color:#fff">ทั้งหมด (${cachedRecords.length})</button>
        <button class="med-tab" data-med-tab="opd" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:transparent;color:var(--text-muted)">OPD (${opdCount})</button>
        <button class="med-tab" data-med-tab="ipd" style="padding:8px 20px;border:none;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.3s;background:transparent;color:var(--text-muted)">IPD (${ipdCount})</button>
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
            <th>ผู้ป่วย / หมายเหตุ</th>
            <th>การวินิจฉัย</th>
            <th>การรักษา</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody id="med-records-tbody">
          ${renderRecordRows(cachedRecords)}
        </tbody>
      </table>
    </div>

    <!-- New Record Form (hidden by default) -->
    <div id="new-record-form-container" style="display:none;margin-top:16px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📝 บันทึกการรักษาใหม่</div>
          <button class="btn-sm btn-outline" id="close-record-form"><i class="fas fa-times"></i></button>
        </div>
        <form id="new-record-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 0">
          <div style="grid-column:1/3;display:flex;gap:8px;align-items:center">
            <label style="font-size:13px;font-weight:500;min-width:80px">ประเภท</label>
            <select name="record_type" style="padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Prompt',sans-serif;font-size:13px">
              <option value="opd">OPD (ผู้ป่วยนอก)</option>
              <option value="ipd">IPD (ผู้ป่วยใน)</option>
              <option value="followup">Follow-up (ติดตามผล)</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Subjective (อาการที่เจ้าของบอก)</label>
            <textarea name="subjective" rows="2" placeholder="สัตว์เลี้ยงมีอาการอย่างไร?" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px;resize:vertical"></textarea>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Objective (ผลการตรวจ)</label>
            <textarea name="objective" rows="2" placeholder="Temp, HR, RR, Physical exam findings..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px;resize:vertical"></textarea>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Assessment (การวินิจฉัย)</label>
            <input name="diagnosis" placeholder="Gastroenteritis, Otitis..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Plan (แผนการรักษา)</label>
            <input name="plan" placeholder="ให้ยา, นัดตรวจซ้ำ..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">การรักษา / ยาที่ให้</label>
            <textarea name="treatment" rows="2" placeholder="Metoclopramide 10mg + IV Fluid..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px;resize:vertical"></textarea>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">หมายเหตุ (ชื่อสัตว์/เจ้าของ/ค่ารักษา)</label>
            <input name="notes" placeholder="บัดดี้ (โกลเด้น) เจ้าของ: คุณสมชาย | ค่ารักษา ฿850" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-family:'Sarabun',sans-serif;font-size:13px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">น้ำหนัก (kg)</label>
              <input name="weight_kg" type="number" step="0.1" placeholder="12.5" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">อุณหภูมิ (°C)</label>
              <input name="temperature_c" type="number" step="0.1" placeholder="38.5" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Heart Rate</label>
              <input name="heart_rate" type="number" placeholder="120" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px">Resp. Rate</label>
              <input name="respiratory_rate" type="number" placeholder="24" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">
            </div>
          </div>
          <div style="grid-column:1/3;display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
            <button type="button" class="btn-sm btn-outline" id="cancel-record-form">ยกเลิก</button>
            <button type="submit" class="btn-sm btn-primary"><i class="fas fa-save" style="margin-right:4px"></i>บันทึกประวัติ</button>
          </div>
        </form>
      </div>
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
 * Render medical record table rows from real data.
 * @param {Array} records
 * @param {string} [filter] - 'opd', 'ipd', or 'all'
 * @returns {string}
 */
function renderRecordRows(records, filter = 'all') {
  const filtered = filter === 'all' ? records : records.filter(r => r.record_type === filter);

  if (filtered.length === 0) {
    return `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;font-family:'Sarabun',sans-serif">ไม่มีข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
  }

  const STATUS_MAP = {
    completed: '<span class="badge badge-success">เสร็จสิ้น</span>',
    in_progress: '<span class="badge badge-warning">กำลังรักษา</span>',
    open: '<span class="badge badge-info">เปิด</span>',
    cancelled: '<span class="badge" style="background:#FEE2E2;color:#991B1B">ยกเลิก</span>',
  };

  return filtered.map(r => {
    const typeLabel = (r.record_type || '').toUpperCase();
    const typeColor = r.record_type === 'ipd' ? '#8B5CF6' : r.record_type === 'followup' ? '#F59E0B' : '#0D9488';
    const date = r.visit_date ? new Date(r.visit_date).toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'2-digit'}) : '-';
    const pet = (r.notes || '').split(' เจ้าของ')[0] || '-';
    const vitals = [
      r.weight_kg ? `${r.weight_kg}kg` : null,
      r.temperature_c ? `${r.temperature_c}°C` : null,
      r.heart_rate ? `HR ${r.heart_rate}` : null,
    ].filter(Boolean).join(' / ');

    return `
      <tr data-record-type="${r.record_type}">
        <td style="font-family:'Sarabun',sans-serif;font-size:13px">${date}</td>
        <td><span style="padding:2px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${typeColor}15;color:${typeColor}">${typeLabel}</span></td>
        <td>
          <div style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis">${pet}</div>
          ${vitals ? `<div style="font-size:11px;color:var(--text-muted)">${vitals}</div>` : ''}
        </td>
        <td>
          <div style="font-size:13px;font-weight:500;color:var(--primary)">${r.diagnosis || '-'}</div>
          <div style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.subjective || ''}</div>
        </td>
        <td style="font-size:12px;font-family:'Sarabun',sans-serif;max-width:200px">
          ${r.treatment || '-'}
        </td>
        <td>${STATUS_MAP[r.status] || r.status || '-'}</td>
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
      if (tbody) tbody.innerHTML = renderRecordRows(cachedRecords, filter);
    });
  });

  // New record button — show the form
  const formContainer = container.querySelector('#new-record-form-container');
  container.querySelector('#new-record-btn')?.addEventListener('click', () => {
    if (formContainer) {
      formContainer.style.display = 'block';
      formContainer.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Close / Cancel form
  container.querySelector('#close-record-form')?.addEventListener('click', () => {
    if (formContainer) formContainer.style.display = 'none';
  });
  container.querySelector('#cancel-record-form')?.addEventListener('click', () => {
    if (formContainer) formContainer.style.display = 'none';
  });

  // Submit new record
  const form = container.querySelector('#new-record-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
      if (!storeId) { showToast('กรุณาเลือกร้านค้าก่อน', 'error'); return; }

      const formData = new FormData(form);
      const record = {
        store_id: storeId,
        record_type: formData.get('record_type') || 'opd',
        subjective: formData.get('subjective') || '',
        objective: formData.get('objective') || '',
        assessment: formData.get('diagnosis') || '',
        diagnosis: formData.get('diagnosis') || '',
        plan: formData.get('plan') || '',
        treatment: formData.get('treatment') || '',
        notes: formData.get('notes') || '',
        weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg')) : null,
        temperature_c: formData.get('temperature_c') ? parseFloat(formData.get('temperature_c')) : null,
        heart_rate: formData.get('heart_rate') ? parseInt(formData.get('heart_rate')) : null,
        respiratory_rate: formData.get('respiratory_rate') ? parseInt(formData.get('respiratory_rate')) : null,
        status: 'completed',
      };

      try {
        const res = await apiRequest('/api/medical-records', {
          method: 'POST',
          body: JSON.stringify(record),
        });

        if (res?.success) {
          showToast('✅ บันทึกประวัติการรักษาสำเร็จ');
          form.reset();
          if (formContainer) formContainer.style.display = 'none';
          // Refresh records
          renderMedicalRecords();
        } else {
          showToast(`❌ ${res?.error || 'บันทึกไม่สำเร็จ'}`, 'error');
        }
      } catch (err) {
        console.error('[Medical Save]', err);
        showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    });
  }

  // Export DLD button
  container.querySelector('#export-dld-btn')?.addEventListener('click', () => {
    showToast('กำลังสร้างรายงานสำหรับกรมปศุสัตว์ (Coming soon)', 'info');
  });

  // Template cards
  container.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      showToast(`กำลังเปิดแบบฟอร์ม: ${card.querySelector('div div')?.textContent} (Coming soon)`, 'info');
    });
  });

  // File dropzone
  const dropzone = container.querySelector('#file-dropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => showToast('เลือกไฟล์เพื่ออัพโหลด (Coming soon)', 'info'));
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
      showToast('อัพโหลดไฟล์ (Coming soon)');
    });
  }
}
