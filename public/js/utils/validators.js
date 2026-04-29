export const isRequired      = (v) => v !== null && v !== undefined && String(v).trim() !== '';
export const isValidEmail    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
export const isValidThaiPhone = (v) => /^0[0-9]{8,9}$/.test(String(v).replace(/[-\s]/g, ''));
