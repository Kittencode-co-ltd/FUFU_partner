/**
 * FUFU Partner – Document Center
 * Consent Forms, Lab Reports, Referrals, E-Signature, PDF export.
 * @module partner/documents
 */

import { showToast } from '../utils/notifications.js';
import { logAudit } from './audit.js';

const docTemplates = {
  consent: { icon: '📋', title: 'หนังสือยินยอม', color: '#0D9488' },
  lab_report: { icon: '🔬', title: 'ผล Lab', color: '#8B5CF6' },
  referral: { icon: '📤', title: 'ใบส่งตัว', color: '#F97316' },
  prescription: { icon: '💊', title: 'ใบสั่งยา', color: '#10B981' },
  receipt: { icon: '🧾', title: 'ใบเสร็จ', color: '#3B82F6' },
  certificate: { icon: '📜', title: 'ใบรับรอง', color: '#EAB308' },
};

export function renderDocumentCenter(container) {
  const demoDocs = [
    { id: 'd1', doc_type: 'consent', title: 'ยินยอมผ่าตัดทำหมัน — บัดดี้', status: 'signed', created_at: '2025-04-22T10:00', staff: 'พญ.สมใจ' },
    { id: 'd2', doc_type: 'lab_report', title: 'CBC + Blood Chem — มิลค์', status: 'finalized', created_at: '2025-04-21T15:00', staff: 'Lab Tech' },
    { id: 'd3', doc_type: 'referral', title: 'ส่งตัว X-Ray — ช็อคโก', status: 'draft', created_at: '2025-04-22T14:00', staff: 'พญ.สมใจ' },
    { id: 'd4', doc_type: 'receipt', title: 'ใบเสร็จ INV-003', status: 'finalized', created_at: '2025-04-22T13:45', staff: 'แคชเชียร์' },
  ];

  const statusBadge = (s) => {
    const m = { draft: 'badge-warning', signed: 'badge-success', finalized: 'badge-info', voided: 'badge-danger' };
    const l = { draft: 'แบบร่าง', signed: 'เซ็นแล้ว', finalized: 'สมบูรณ์', voided: 'ยกเลิก' };
    return `<span class="badge ${m[s] || ''}">${l[s] || s}</span>`;
  };

  container.innerHTML = `
    <div class="doc-center">
      <div class="card-header">
        <div class="card-title">📄 ศูนย์เอกสาร (Document Center)</div>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm btn-primary" id="doc-create"><i class="fas fa-plus"></i> สร้างเอกสาร</button>
        </div>
      </div>
      <!-- Template Quick Access -->
      <div class="doc-templates">
        ${Object.entries(docTemplates).map(([k, v]) => `
          <div class="doc-template-card" data-type="${k}" style="--tmpl-color:${v.color}">
            <span class="doc-tmpl-icon">${v.icon}</span>
            <span class="doc-tmpl-label">${v.title}</span>
          </div>
        `).join('')}
      </div>
      <!-- Document List -->
      <div class="doc-list">
        ${demoDocs.map(d => {
          const tmpl = docTemplates[d.doc_type] || {};
          return `
            <div class="doc-item" data-id="${d.id}">
              <div class="doc-item-icon" style="color:${tmpl.color}">${tmpl.icon}</div>
              <div class="doc-item-info">
                <div class="doc-item-title">${d.title}</div>
                <div class="doc-item-meta">${tmpl.title} · ${d.staff} · ${new Date(d.created_at).toLocaleDateString('th-TH')}</div>
              </div>
              <div class="doc-item-actions">
                ${statusBadge(d.status)}
                <button class="btn-xs btn-outline" title="ดู"><i class="fas fa-eye"></i></button>
                <button class="btn-xs btn-outline" title="พิมพ์"><i class="fas fa-print"></i></button>
                ${d.status === 'draft' ? '<button class="btn-xs btn-primary" title="เซ็น"><i class="fas fa-signature"></i></button>' : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.doc-template-card').forEach(c => {
    c.addEventListener('click', () => showToast(`สร้าง ${docTemplates[c.dataset.type]?.title} ใหม่`));
  });
}
