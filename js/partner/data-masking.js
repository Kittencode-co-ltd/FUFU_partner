/**
 * FUFU Partner – Data Masking Module
 * 3-level masking: L1 (full), L2 (partial), L3 (none/owner-only).
 * Eye-toggle per field, audit log on unmask.
 * @module partner/data-masking
 */

import { STORAGE_KEYS } from '../utils/config.js';
import { logAudit } from './audit.js';

/**
 * Get current staff masking level (1=see all, 2=partial, 3=minimal).
 */
export function getMaskingLevel() {
  return parseInt(localStorage.getItem(STORAGE_KEYS.MASKING_LEVEL) || '3');
}

/**
 * Mask a phone number based on level.
 * L1: 081-234-5678 | L2: 081-2XX-XXXX | L3: XXX-XXX-XXXX
 */
export function maskPhone(phone, level) {
  if (!phone) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return phone;
  const clean = phone.replace(/\D/g, '');
  if (l === 2) return clean.slice(0, 4) + 'XX-XXXX';
  return 'XXX-XXX-XXXX';
}

/**
 * Mask an email.
 * L1: full | L2: s****@gmail.com | L3: ****@****
 */
export function maskEmail(email, level) {
  if (!email) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return email;
  const [user, domain] = email.split('@');
  if (l === 2) return user[0] + '****@' + domain;
  return '****@****';
}

/**
 * Mask a name.
 * L1: full | L2: สมชาย ก. | L3: ส***
 */
export function maskName(name, level) {
  if (!name) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return name;
  const parts = name.split(' ');
  if (l === 2) return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
  return name[0] + '***';
}

/**
 * Mask ID card / Microchip.
 */
export function maskId(id, level) {
  if (!id) return '-';
  const l = level ?? getMaskingLevel();
  if (l <= 1) return id;
  if (l === 2) return id.slice(0, 4) + '-XXXX-' + id.slice(-4);
  return 'XXXX-XXXX-XXXX';
}

/**
 * Create a maskable span with eye toggle.
 * @param {string} value - Original value
 * @param {string} maskedValue - Masked value
 * @param {string} fieldType - phone|email|name|id
 * @param {string} entityId - For audit logging
 */
export function createMaskableField(value, maskedValue, fieldType, entityId) {
  const id = `mask-${fieldType}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const level = getMaskingLevel();
  const isMasked = level > 1;

  return `
    <span class="maskable-field" id="${id}" data-masked="true" data-original="${encodeURIComponent(value)}" data-type="${fieldType}" data-entity="${entityId}">
      <span class="mask-value">${isMasked ? maskedValue : value}</span>
      ${isMasked ? `<button class="mask-toggle" onclick="window.__unmaskField('${id}')"><i class="fas fa-eye"></i></button>` : ''}
    </span>
  `;
}

// Global unmask handler
if (typeof window !== 'undefined') {
  window.__unmaskField = function(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const isMasked = el.dataset.masked === 'true';
    const valueEl = el.querySelector('.mask-value');
    const toggleEl = el.querySelector('.mask-toggle i');

    if (isMasked) {
      valueEl.textContent = decodeURIComponent(el.dataset.original);
      el.dataset.masked = 'false';
      toggleEl.className = 'fas fa-eye-slash';
      logAudit('unmask', el.dataset.type, el.dataset.entity, null, { field: el.dataset.type });
    } else {
      // Re-mask
      const original = decodeURIComponent(el.dataset.original);
      const type = el.dataset.type;
      const level = getMaskingLevel();
      const masked = type === 'phone' ? maskPhone(original, level)
        : type === 'email' ? maskEmail(original, level)
        : type === 'name' ? maskName(original, level)
        : maskId(original, level);
      valueEl.textContent = masked;
      el.dataset.masked = 'true';
      toggleEl.className = 'fas fa-eye';
    }
  };
}
