/**
 * FUFU Partner – Formatters
 * Thai date, currency, and phone number formatters.
 * @module formatters
 */

/**
 * Format a date to Thai locale string.
 * @param {Date|string} date
 * @param {Object} opts - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatThaiDate(date, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const defaults = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  };
  return d.toLocaleDateString('th-TH', { ...defaults, ...opts });
}

/**
 * Format a short Thai date (e.g., "1 เม.ย.")
 * @param {Date|string} date
 * @returns {string}
 */
export function formatThaiDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

/**
 * Format number as Thai Baht currency.
 * @param {number} amount
 * @param {boolean} withSymbol - Include ฿ prefix
 * @returns {string}
 */
export function formatBaht(amount, withSymbol = true) {
  const formatted = Number(amount).toLocaleString('th-TH');
  return withSymbol ? `฿${formatted}` : formatted;
}

/**
 * Format a Thai phone number (08x-xxx-xxxx).
 * @param {string} phone
 * @returns {string}
 */
export function formatPhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
