import { STORAGE_KEYS } from '../utils/config.js';
import { logAudit }     from './audit.js';

export function getMaskingLevel() {
  return parseInt(localStorage.getItem(STORAGE_KEYS.MASKING_LEVEL) || '3');
}

export function maskPhone(phone, level) {
  if (!phone) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return phone;
  const clean = phone.replace(/\D/g, '');
  if (l === 2) return clean.slice(0, 4) + 'XX-XXXX';
  return 'XXX-XXX-XXXX';
}

export function maskEmail(email, level) {
  if (!email) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return email;
  const [user, domain] = email.split('@');
  if (l === 2) return user[0] + '****@' + domain;
  return '****@****';
}

export function maskName(name, level) {
  if (!name) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return name;
  const parts = name.split(' ');
  if (l === 2) return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
  return name[0] + '***';
}

export function maskId(id, level) {
  if (!id) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return id;
  if (l === 2) return id.slice(0, 4) + '-XXXX-' + id.slice(-4);
  return 'XXXX-XXXX-XXXX';
}

export function createMaskableField(value, maskedValue, fieldType, entityId) {
  const uid     = `mask-${fieldType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isMasked = getMaskingLevel() > 1;
  return `
    <span class="maskable-field" id="${uid}" data-masked="${isMasked}" data-original="${encodeURIComponent(value)}" data-type="${fieldType}" data-entity="${entityId || ''}">
      <span class="mask-value">${isMasked ? maskedValue : value}</span>
      ${isMasked ? `<button class="mask-toggle" onclick="window.__unmaskField('${uid}')"><i class="fas fa-eye"></i></button>` : ''}
    </span>`;
}

if (typeof window !== 'undefined') {
  window.__unmaskField = function(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const isMasked  = el.dataset.masked === 'true';
    const valueEl   = el.querySelector('.mask-value');
    const toggleEl  = el.querySelector('.mask-toggle i');
    if (isMasked) {
      valueEl.textContent = decodeURIComponent(el.dataset.original);
      el.dataset.masked   = 'false';
      if (toggleEl) toggleEl.className = 'fas fa-eye-slash';
      logAudit('unmask', el.dataset.type, el.dataset.entity, null, { field: el.dataset.type });
    } else {
      const original = decodeURIComponent(el.dataset.original);
      const level    = getMaskingLevel();
      const type     = el.dataset.type;
      const masked   = type === 'phone' ? maskPhone(original, level)
                     : type === 'email' ? maskEmail(original, level)
                     : type === 'name'  ? maskName(original, level)
                     : maskId(original, level);
      valueEl.textContent = masked;
      el.dataset.masked   = 'true';
      if (toggleEl) toggleEl.className = 'fas fa-eye';
    }
  };
}
