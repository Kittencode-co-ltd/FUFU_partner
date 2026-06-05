/**
 * FIXED ROLES — single source of truth for staff roles & permissions.
 *
 * Stores do NOT create their own roles. Every staff member is assigned one of
 * these fixed roles. The role key is stored in `staff.role` (must match the DB
 * CHECK constraint: owner|manager|veterinarian|receptionist|pharmacist|groomer|staff).
 *
 * Each role defines:
 *   - rbac:        short-form name used by requireRole() in route guards
 *   - label:       Thai display name
 *   - color/icon:  UI presentation
 *   - modes:       dashboard mode keys (drives sidebar nav visibility)
 *   - permissions: granular { module: [actions] } used by frontend can()
 *
 * Modules: home | queue | opd | ipd | stock | finance | pos | settings
 * Actions: view | create | edit | delete
 */

const FULL = ['view', 'create', 'edit', 'delete'];

export const FIXED_ROLES = {
  owner: {
    key: 'owner', rbac: 'owner', label: 'เจ้าของร้าน', color: '#D4AF37', icon: '👑',
    desc: 'เข้าถึงได้ทุกส่วน', modes: ['all'],
    permissions: {
      home: FULL, queue: FULL, opd: FULL, ipd: FULL,
      stock: FULL, finance: FULL, pos: FULL, settings: FULL,
    },
  },

  manager: {
    key: 'manager', rbac: 'owner', label: 'ผู้จัดการ', color: '#6366F1', icon: '👔',
    desc: 'เข้าถึงได้ทุกส่วน ยกเว้นการตั้งค่าระดับเจ้าของ', modes: ['all'],
    permissions: {
      home: ['view'], queue: FULL, opd: FULL, ipd: FULL,
      stock: FULL, finance: FULL, pos: FULL, settings: ['view'],
    },
  },

  veterinarian: {
    key: 'veterinarian', rbac: 'vet', label: 'สัตวแพทย์', color: '#0EA5E9', icon: '👨‍⚕️',
    desc: 'ตรวจรักษา OPD/IPD บันทึกประวัติ สั่งยา', modes: ['doctor'],
    permissions: {
      home: [], queue: ['view'], opd: ['view', 'create', 'edit'], ipd: ['view', 'create', 'edit'],
      stock: ['view'], finance: [], pos: [], settings: [],
    },
  },

  receptionist: {
    key: 'receptionist', rbac: 'reception', label: 'เคาน์เตอร์ / ต้อนรับ', color: '#8B5CF6', icon: '📋',
    desc: 'รับคิว นัดหมาย ชำระเงิน', modes: ['counter'],
    permissions: {
      home: [], queue: FULL, opd: ['view'], ipd: [],
      stock: ['view'], finance: ['view'], pos: ['view', 'create', 'edit'], settings: [],
    },
  },

  pharmacist: {
    key: 'pharmacist', rbac: 'staff', label: 'สต็อก / เภสัช', color: '#F59E0B', icon: '📦',
    desc: 'จัดยา รับ-จ่ายสินค้า จัดการสต็อก', modes: ['pharmacy'],
    permissions: {
      home: [], queue: ['view'], opd: ['view'], ipd: [],
      stock: FULL, finance: [], pos: ['view'], settings: [],
    },
  },

  groomer: {
    key: 'groomer', rbac: 'counter', label: 'ช่างตัดแต่ง / Grooming', color: '#EC4899', icon: '✂️',
    desc: 'รับงาน Grooming บันทึกผลงาน', modes: ['counter'],
    permissions: {
      home: [], queue: ['view', 'create', 'edit'], opd: [], ipd: [],
      stock: ['view'], finance: [], pos: ['view', 'create'], settings: [],
    },
  },

  staff: {
    key: 'staff', rbac: 'staff', label: 'พนักงานทั่วไป', color: '#10B981', icon: '🙋',
    desc: 'ดูข้อมูลทั่วไป ช่วยงานหน้าร้าน', modes: ['counter'],
    permissions: {
      home: [], queue: ['view', 'create'], opd: ['view'], ipd: [],
      stock: ['view'], finance: [], pos: ['view'], settings: [],
    },
  },
};

/** Roles assignable to staff (owner is auto-detected, never assigned). */
export const ASSIGNABLE_ROLES = Object.values(FIXED_ROLES).filter(r => r.key !== 'owner');

/** DB role value → short-form rbac role used by requireRole(). */
export function toRbacRole(dbRole) {
  return FIXED_ROLES[dbRole]?.rbac || dbRole || null;
}

/** DB role value → granular permissions object. */
export function permissionsFor(dbRole) {
  return FIXED_ROLES[dbRole]?.permissions || null;
}

/** Is this a valid fixed role key? */
export function isValidRole(dbRole) {
  return !!FIXED_ROLES[dbRole];
}
