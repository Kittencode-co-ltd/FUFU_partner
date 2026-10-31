/** Fixed Partner MVP roles. Authorization is enforced again by API guards/RLS. */
const FULL = ['view', 'create', 'edit', 'delete'];

export const FIXED_ROLES = {
  owner: {
    key: 'owner', rbac: 'owner', label: 'เจ้าของคลินิก', color: '#D4AF37', icon: '👑',
    desc: 'จัดการคลินิก เวลาทำการ บริการ และผู้ใช้งาน', modes: ['all'],
    permissions: { appointments: FULL, patients: FULL, summaries: FULL, clinic: FULL, users: FULL },
  },
  vet: {
    key: 'vet', rbac: 'vet', label: 'สัตวแพทย์', color: '#0EA5E9', icon: '👨‍⚕️',
    desc: 'ดูข้อมูลที่ได้รับอนุญาตและเขียนสรุปการเข้ารับบริการ', modes: ['vet'],
    permissions: {
      appointments: ['view', 'edit'], patients: ['view'], summaries: ['view', 'create', 'edit'],
      clinic: ['view'], users: [],
    },
  },
  reception: {
    key: 'reception', rbac: 'reception', label: 'ต้อนรับ', color: '#8B5CF6', icon: '📋',
    desc: 'ดูและจัดการนัดหมาย ติดต่อเจ้าของ และเช็กอิน', modes: ['reception'],
    permissions: {
      appointments: ['view', 'edit'], patients: ['view'], summaries: ['view'],
      clinic: ['view'], users: [],
    },
  },
};

export const ASSIGNABLE_ROLES = [FIXED_ROLES.reception, FIXED_ROLES.vet];

const LEGACY_TO_MVP = { veterinarian: 'vet', receptionist: 'reception' };

export function toRbacRole(dbRole) {
  const normalized = LEGACY_TO_MVP[dbRole] || dbRole;
  return FIXED_ROLES[normalized]?.rbac || null;
}

export function permissionsFor(dbRole) {
  const normalized = LEGACY_TO_MVP[dbRole] || dbRole;
  return FIXED_ROLES[normalized]?.permissions || null;
}

export function isValidRole(dbRole) {
  return dbRole === 'vet' || dbRole === 'reception';
}
