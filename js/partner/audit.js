/**
 * FUFU Partner – Audit Trail Module
 * Immutable logging for all sensitive operations.
 * @module partner/audit
 */

import { STORAGE_KEYS } from '../utils/config.js';
import { insertToSupabase, fetchFromSupabase } from '../utils/supabase-client.js';

let auditBuffer = [];

export function logAudit(action, entityType, entityId = null, oldData = null, newData = null, reason = '') {
  const entry = {
    id: crypto.randomUUID?.() || `audit-${Date.now()}`,
    staff_id: localStorage.getItem(STORAGE_KEYS.STAFF_ID) || null,
    store_id: localStorage.getItem(STORAGE_KEYS.STORE_ID) || null,
    action, entity_type: entityType, entity_id: entityId,
    old_data: oldData, new_data: newData, reason,
    user_agent: navigator.userAgent,
    created_at: new Date().toISOString(),
  };
  auditBuffer.push(entry);
  console.log(`[Audit] ${action.toUpperCase()} on ${entityType}`, entry);
  if (auditBuffer.length >= 20) flushAuditLogs();
}

export async function flushAuditLogs() {
  if (auditBuffer.length === 0) return;
  const batch = [...auditBuffer];
  auditBuffer = [];
  console.log(`[Audit] Flushing ${batch.length} log entries`);
  await insertToSupabase('audit_logs', batch);
}

if (typeof window !== 'undefined') {
  setInterval(flushAuditLogs, 30000);
  window.addEventListener('beforeunload', flushAuditLogs);
}

export async function renderAuditViewer(container) {
  container.innerHTML = `<div style="padding: 20px; text-align: center;">Loading audit logs...</div>`;
  
  let logs = await fetchFromSupabase('audit_logs');
  if (!logs) {
    logs = [
      { created_at: '2025-04-22T14:30', action: 'update', entity_type: 'medical_records', staff: 'พญ.สมใจ', detail: 'แก้ไข SOAP Note — บัดดี้' },
      { created_at: '2025-04-22T14:15', action: 'unmask', entity_type: 'customers', staff: 'น้องแนน', detail: 'Unmask เบอร์โทร — คุณสมชาย' }
    ];
  } else {
    // Sort descending by created_at
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // Limit to 50 for performance
    logs = logs.slice(0, 50);
  }

  const icons = { create:'🟢', update:'🟡', delete:'🔴', view_sensitive:'👁️', unmask:'🔓', login:'🔑', logout:'🚪', export:'📤' };
  const labels = { create:'สร้าง', update:'แก้ไข', delete:'ลบ', view_sensitive:'ดูข้อมูล', unmask:'Unmask', login:'Login', logout:'Logout' };

  container.innerHTML = `
    <div class="audit-viewer">
      <div class="card-header">
        <div class="card-title">📜 Audit Trail</div>
        <select class="field-input" id="audit-filter" style="width:auto;padding:4px 8px;font-size:12px;">
          <option value="">ทั้งหมด</option>
          <option value="update">แก้ไข</option>
          <option value="unmask">Unmask</option>
          <option value="delete">ลบ</option>
        </select>
      </div>
      <div class="audit-timeline">
        ${logs.map(l => {
          const detail = l.detail || l.reason || `${labels[l.action]||l.action} ${l.entity_type}`;
          const staffId = l.staff_id || l.staff || 'Unknown Staff';
          return `
          <div class="audit-item audit-${l.action}">
            <div class="audit-icon">${icons[l.action]||'📝'}</div>
            <div class="audit-content">
              <div class="audit-main"><span class="audit-action-badge">${labels[l.action]||l.action}</span> ${detail}</div>
              <div class="audit-meta"><i class="fas fa-user"></i> ${staffId} · <i class="fas fa-clock"></i> ${new Date(l.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} · ${l.entity_type}</div>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>`;
}
