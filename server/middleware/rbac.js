/**
 * RBAC middleware — role-based access control at the API level.
 *
 * Staff roles (stored in store_staff.role):
 *   owner | vet | reception | staff | accountant
 *
 * Store owners are stored in stores.owner_id (not in store_staff).
 */

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
    const { data: store } = await req.supabase
      .from('stores').select('owner_id').eq('id', storeId).single();

    if (store?.owner_id === req.user.id) {
      req.staffRole = 'owner';
      return next();
    }

    const { data: staff } = await req.supabase
      .from('store_staff')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_email', req.user.email)
      .eq('is_active', true)
      .single();

    req.staffRole = staff?.role || null;
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
