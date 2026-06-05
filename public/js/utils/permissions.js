/**
 * Granular permission helper for custom staff roles.
 *
 * Permissions are stored in localStorage as `fufu_staff_permissions` when a
 * staff member logs in (loaded from staff_roles → roles.permissions in the DB).
 * Owner accounts never have this key set, so they always get full access.
 *
 * Usage:
 *   import { can } from '../utils/permissions.js';
 *   if (can('opd', 'edit')) { showSaveButton(); }
 *
 * Modules: 'home' | 'queue' | 'opd' | 'ipd' | 'stock' | 'finance' | 'pos' | 'settings'
 * Actions: 'view' | 'create' | 'edit' | 'delete'
 */
export function can(module, action) {
  const raw = localStorage.getItem('fufu_staff_permissions');
  if (!raw) return true; // owner or no custom permissions configured → full access
  try {
    const perms = JSON.parse(raw);
    return Array.isArray(perms[module]) && perms[module].includes(action);
  } catch {
    return true;
  }
}
