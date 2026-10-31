/**
 * RBAC middleware — role-based access control at the API level.
 *
 * Staff roles (stored in staff.roles TEXT[]):
 *   owner | vet | reception | staff | accountant | counter
 *
 * Store owners are identified via stores.owner_id (UUID) OR stores.owner_email (fallback).
 */

import { toRbacRole } from '../config/roles.js';

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
    // User-scoped queries keep authorization fail-closed under RLS.
    const { data: store } = await req.supabase
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

    // Not the owner — check staff table. The DB `role` column stores the fixed
    // role key (veterinarian, receptionist, …); translate to the short-form
    // rbac name (vet, reception, …) that requireRole() guards expect.
    const { data: staffRows } = await req.supabase
      .from('staff')
      .select('role')
      .eq('store_id', storeId)
      .eq('email', req.user.email)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    const dbRole = staffRows?.[0]?.role || null;
    req.staffRole = dbRole ? toRbacRole(dbRole) : null;
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
      // A cross-store record is intentionally indistinguishable from not found.
      const { data } = await req.supabase
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

/** Use a route parameter that is itself the store id, then verify membership in requireRole. */
export function useStoreIdParam(param = 'id') {
  return (req, _res, next) => {
    const storeId = req.params[param];
    req.body = req.body || {};
    req.body.store_id = storeId;
    req.query.store_id = storeId;
    next();
  };
}
