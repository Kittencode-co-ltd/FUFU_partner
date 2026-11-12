import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, useStoreIdParam } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const STORE_FIELDS = 'id, name, category, branch_name, phone, address, tax_id, website, receipt_header_note, business_hours, default_service_rates';
const BASE_STORE_FIELDS = 'id, name, category';

function isMissingBranchName(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('branch_name') && (message.includes('schema cache') || error?.code === 'PGRST204' || error?.code === '42703');
}

async function listStores(makeQuery) {
  const result = await makeQuery(STORE_FIELDS);
  if (!isMissingBranchName(result.error)) return result;
  return makeQuery(BASE_STORE_FIELDS);
}

// GET /api/stores — list stores for current user
router.get('/', async (req, res) => {
  let { data: stores, error } = await listStores((fields) => req.supabase
    .from('stores').select(fields).eq('owner_id', req.user.id));

  if (!stores?.length) {
    const byEmailResult = await listStores((fields) => req.supabase
      .from('stores').select(fields).eq('owner_email', req.user.email));
    stores = byEmailResult.data;
    error = byEmailResult.error;
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: stores || [] });
});

// POST /api/stores — create a new store
router.post('/', async (req, res) => {
  const { name, category, branch_name } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category required' });
  }

  const store = { name, category, owner_id: req.user.id, owner_email: req.user.email, is_verified: false };
  if (branch_name) store.branch_name = branch_name;

  let { data, error } = await req.supabase
    .from('stores')
    .insert([store])
    .select(BASE_STORE_FIELDS)
    .single();

  // Older production schemas do not have branch_name. Retry without that
  // optional field so store onboarding remains available during migrations.
  if (isMissingBranchName(error) && Object.hasOwn(store, 'branch_name')) {
    delete store.branch_name;
    ({ data, error } = await req.supabase
      .from('stores')
      .insert([store])
      .select(BASE_STORE_FIELDS)
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/stores/:id — update store settings (business_hours, default_service_rates, etc.)
router.patch('/:id', useStoreIdParam('id'), requireRole('owner'), async (req, res) => {
  const ALLOWED = new Set(['name', 'branch_name', 'phone', 'address', 'tax_id', 'website', 'receipt_header_note', 'business_hours', 'default_service_rates']);
  const updates = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (ALLOWED.has(k)) updates[k] = v;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no valid fields' });

  const { data, error } = await req.supabase
    .from('stores')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
