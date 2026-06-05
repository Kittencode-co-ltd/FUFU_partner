export const API_BASE = window.location.hostname === 'localhost'
  ? `http://localhost:${window.location.port || 3000}`
  : '';  // same-origin in production

export const STORAGE_KEYS = {
  TOKEN:          'fufu_token',
  REFRESH_TOKEN:  'fufu_refresh_token',
  USER:           'fufu_user',
  ROLE:           'fufu_role',
  STORE_ID:       'fufu_store_id',
  STORE_NAME:     'fufu_store_name',
  STORE_CATEGORY: 'fufu_store_category',
  MASKING_LEVEL:  'fufu_masking_level',
  FONT_SCALE:     'fufu_font_scale',
  STAFF_ID:       'fufu_staff_id',
  STAFF_ROLE:     'fufu_staff_role',
  PROMPTPAY_ID:   'fufu_promptpay_id',
  STORE_INFO:     'fufu_store_info',
  REMEMBER:       'fufu_remember',       // '1' = keep me signed in (cleared on explicit logout)
  STORES_LIST:    'fufu_stores_list',    // JSON array of all accessible stores (owned + staff)
};

// Remembered login email — kept OUTSIDE STORAGE_KEYS so it survives logout
// (clearSession wipes every STORAGE_KEYS entry) and can pre-fill the email field.
export const REMEMBER_EMAIL_KEY = 'fufu_remember_email';

export const FEATURE_FLAGS = {
  ENABLE_RBAC:              true,
  ENABLE_MEDICAL_MODULE:    true,
  ENABLE_HOTEL_MODULE:      true,
  ENABLE_OPD_CARD:          true,
  ENABLE_IPD_WARD:          true,
  ENABLE_INVENTORY_ALERTS:  true,
  ENABLE_PROMPTPAY:         true,
  ENABLE_POS:               true,
  ENABLE_CRM:               false,
  ENABLE_DOCUMENTS:         true,
  ENABLE_KANBAN:            true,
};

export const CATEGORY_MAP = {
  vet_clinic:   { label: 'คลินิกสัตว์แพทย์', role: 'vet',      icon: 'fas fa-hospital-alt' },
  pet_shop:     { label: 'ร้านค้าสัตว์เลี้ยง', role: 'shop',    icon: 'fas fa-store' },
  pet_hotel:    { label: 'โรงแรมสัตว์เลี้ยง', role: 'hotel',   icon: 'fas fa-bed' },
  pet_grooming: { label: 'บริการอาบน้ำตัดขน', role: 'grooming', icon: 'fas fa-cut' },
};
