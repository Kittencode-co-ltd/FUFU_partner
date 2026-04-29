import { STORAGE_KEYS } from '../utils/config.js';
import { apiFetch }     from '../utils/api-client.js';

let auditBuffer = [];

export function logAudit(action, entityType, entityId = null, oldData = null, newData = null, reason = '') {
  const entry = {
    id:          crypto.randomUUID(),
    staff_id:    localStorage.getItem('fufu_staff_id') || null,
    store_id:    localStorage.getItem(STORAGE_KEYS.STORE_ID) || null,
    action,
    entity_type: entityType,
    entity_id:   entityId,
    old_data:    oldData,
    new_data:    newData,
    reason,
    user_agent:  navigator.userAgent,
    created_at:  new Date().toISOString(),
  };
  auditBuffer.push(entry);
  console.log(`[Audit] ${action.toUpperCase()} on ${entityType}`, entry);
  if (auditBuffer.length >= 20) flushAuditLogs();
}

export async function flushAuditLogs() {
  if (auditBuffer.length === 0) return;
  const batch = [...auditBuffer];
  auditBuffer = [];
  try {
    await apiFetch('/api/audit', { method: 'POST', body: JSON.stringify({ logs: batch }) });
  } catch (err) {
    console.warn('[Audit] flush failed, re-queuing', err);
    auditBuffer = [...batch, ...auditBuffer];
  }
}

export async function fetchAuditLogs(storeId, limit = 50) {
  const res = await apiFetch(`/api/audit?store_id=${storeId}&limit=${limit}`);
  return res?.data || [];
}

if (typeof window !== 'undefined') {
  setInterval(flushAuditLogs, 30000);
  window.addEventListener('beforeunload', flushAuditLogs);
}
