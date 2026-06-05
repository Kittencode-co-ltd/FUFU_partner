/**
 * RBAC middleware — role-based access control at the API level.
 *
 * Staff roles (stored in staff.roles TEXT[]):
 *   owner | vet | reception | staff | accountant | counter
 *
 * Store owners are identified via stores.owner_id (UUID) OR stores.owner_email (fallback).
 */

import { createClient } from '@supabase/supabase-js';

// Admin (service-role) client — bypasses RLS for ownership verification.
// Lazy-init so env vars are available when first used.
let _adminSb = null;
function _admin() {
  if (!_adminSb) {
    _adminSb = createClient(
      process.env.Project_URL,
      // .env defines the key as lowercase `service_role_key`; accept either casing
      // so owner-role resolution (which relies on this admin client) never silently
      // breaks and 403s legitimate store owners.
      process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _adminSb;
}

/**
 * Resolves the current user's role for the given store and attaches it as req.staffRole.
 * Reads store_id from req.query.store_id or req.body.store_id.
 * Sets req.staffRole = null when no match is found.
 */
export async function attachStoreRole(req, res, next) {
  const storeId = req.query.store_id || req.body?.store_id;
  if (!storeId || !req.user?.id) {
    req.staffRole = null;
    return next();
  }

  try {
    // Use admin client so RLS on the `stores` table never blocks ownership lookup.
    // Check both owner_id (UUID match) and owner_email (legacy / email-only stores).
    const { data: store } = await _admin()
      .from('stores')
      .select('owner_id, owner_email')
      .eq('id', storeId)
      .single();

    const isOwnerById    = store?.owner_id    && store.owner_id === req.user.id;
    const isOwnerByEmail = store?.owner_email && store.owner_email.toLowerCase() === req.user.email?.toLowerCase();

    if (isOwnerById || isOwnerByEmail) {
      req.staffRole = 'owner';
      return next();
    }

    // Not the owner — check staff table (supports both `role` TEXT and `roles` TEXT[]).
    // The app's multi-role model lives in `roles[]`, so prefer it; fall back to the
    // single `role` column only when no array roles are set.
    const { data: staff } = await req.supabase
      .from('staff')
      .select('role, roles')
      .eq('store_id', storeId)
      .eq('user_email', req.user.email)
      .eq('is_active', true)
      .single();

    req.staffRole = (Array.isArray(staff?.roles) && staff.roles.length)
      ? staff.roles[0]
      : (staff?.role || null);
    next();
  } catch {
    req.staffRole = null;
    next();
  }
}

/**
 * Middleware factory — only passes requests where req.staffRole is one of `allowed`.
 * Automatically calls attachStoreRole first.
 *
 * Usage:
 *   router.delete('/:id', requireRole('owner','vet'), handler);
 *   router.use(requireRole('owner','accountant'));
 */
export function requireRole(...allowed) {
  return [
    attachStoreRole,
    (req, res, next) => {
      if (!req.staffRole) {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง store นี้' });
      }
      if (!allowed.includes(req.staffRole)) {
        return res.status(403).json({
          error: `ต้องการสิทธิ์: ${allowed.join(' หรือ ')}`,
          your_role: req.staffRole,
        });
      }
      next();
    },
  ];
}

/**
 * Middleware that looks up store_id from a DB record and injects it into the request
 * so that requireRole() can resolve the user's role for that store.
 *
 * Usage (for PATCH/DELETE /:id routes where store_id is not in the body):
 *   router.patch('/:id', resolveStoreId('medical_records'), requireRole('owner','vet'), handler);
 *
 * @param {string} table - Supabase table name that has a store_id column
 * @param {string} [idParam='id'] - req.params key for the record ID
 */
export function resolveStoreId(table, idParam = 'id') {
  return async (req, res, next) => {
    const recordId = req.params[idParam];
    if (!recordId) return next();

    try {
      // Use admin client to bypass RLS — the user-scoped client may not be able
      // to read the record (e.g. queue_entries with restrictive RLS), which would
      // silently leave store_id unset and cause a 403 downstream.
      const { data } = await _admin()
        .from(table).select('store_id').eq('id', recordId).single();

      if (!data?.store_id) return next(); // record not found — let requireRole 403

      req.body        = req.body || {};
      req.body.store_id  = data.store_id;
      req.query.store_id = data.store_id;
      next();
    } catch {
      next();
    }
  };
}
