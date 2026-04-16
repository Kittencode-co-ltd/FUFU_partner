/**
 * FUFU Partner – Form Validators
 * Reusable validation utilities for forms.
 * @module validators
 */

/**
 * Validate an email address format.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check if a field value is non-empty.
 * @param {string} value
 * @returns {boolean}
 */
export function isRequired(value) {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

/**
 * Validate minimum password length.
 * @param {string} password
 * @param {number} minLength
 * @returns {boolean}
 */
export function isValidPassword(password, minLength = 6) {
  return typeof password === 'string' && password.length >= minLength;
}

/**
 * Validate a Thai phone number (10 digits starting with 0).
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidThaiPhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length === 10 && cleaned.startsWith('0');
}

/**
 * Sanitize a string to prevent XSS - escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Validate and return an object of form errors.
 * @param {Object} fields - { fieldName: { value, rules: ['required', 'email', ...] } }
 * @returns {Object} - { fieldName: errorMessage } or empty object if valid
 */
export function validateForm(fields) {
  const errors = {};

  for (const [name, config] of Object.entries(fields)) {
    const { value, rules = [] } = config;

    for (const rule of rules) {
      if (rule === 'required' && !isRequired(value)) {
        errors[name] = 'กรุณากรอกข้อมูล';
        break;
      }
      if (rule === 'email' && !isValidEmail(value)) {
        errors[name] = 'รูปแบบอีเมลไม่ถูกต้อง';
        break;
      }
      if (rule === 'password' && !isValidPassword(value)) {
        errors[name] = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
        break;
      }
      if (rule === 'phone' && !isValidThaiPhone(value)) {
        errors[name] = 'เบอร์โทรไม่ถูกต้อง';
        break;
      }
    }
  }

  return errors;
}
