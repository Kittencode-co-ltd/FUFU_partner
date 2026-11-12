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
  STORE_ACTIVE:   'fufu_store_active',
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

// Production-safe default. Legacy modules can only be exposed by an explicit
// runtime override in a development environment.
export const PARTNER_MVP_MODE = window.__FUFU_FEATURES__?.PARTNER_MVP_MODE !== false;

export const FEATURE_FLAGS = {
  MVP_MODE:                 PARTNER_MVP_MODE,
  ENABLE_RBAC:              true,
  ENABLE_MEDICAL_MODULE:    !PARTNER_MVP_MODE,
  ENABLE_HOTEL_MODULE:      !PARTNER_MVP_MODE,
  ENABLE_OPD_CARD:          !PARTNER_MVP_MODE,
  ENABLE_IPD_WARD:          !PARTNER_MVP_MODE,
  ENABLE_INVENTORY_ALERTS:  !PARTNER_MVP_MODE,
  ENABLE_PROMPTPAY:         !PARTNER_MVP_MODE,
  ENABLE_POS:               !PARTNER_MVP_MODE,
  ENABLE_CRM:               false,
  ENABLE_DOCUMENTS:         !PARTNER_MVP_MODE,
  ENABLE_KANBAN:            !PARTNER_MVP_MODE,
};

export const CATEGORY_MAP = {
  vet_clinic:   { label: 'คลินิกสัตว์แพทย์', role: 'vet',      icon: 'hospital-alt', emoji: '🏥' },
  pet_shop:     { label: 'ร้านค้าสัตว์เลี้ยง', role: 'shop',    icon: 'store',        emoji: '🛒' },
  pet_hotel:    { label: 'โรงแรมสัตว์เลี้ยง', role: 'hotel',   icon: 'bed',          emoji: '🏨' },
  pet_grooming: { label: 'บริการอาบน้ำตัดขน', role: 'grooming', icon: 'cut',          emoji: '✂️' },
};
