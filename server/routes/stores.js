import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/stores — list stores for current user
router.get('/', async (req, res) => {
  let { data: stores } = await req.supabase
    .from('stores')
    .select('id, name, category')
    .eq('owner_id', req.user.id);

  if (!stores?.length) {
    const { data: byEmail } = await req.supabase
      .from('stores')
      .select('id, name, category')
      .eq('owner_email', req.user.email);
    stores = byEmail;
  }

  res.json({ success: true, data: stores || [] });
});

// POST /api/stores — create a new store
router.post('/', async (req, res) => {
  const { name, category, branch_name } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category required' });
  }

  const { data, error } = await req.supabase
    .from('stores')
    .insert([{
      name,
      category,
      branch_name: branch_name || '',
      owner_id:    req.user.id,
      owner_email: req.user.email,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/stores/:id — update store settings (business_hours, default_service_rates, etc.)
router.patch('/:id', async (req, res) => {
  const ALLOWED = new Set(['name', 'branch_name', 'business_hours', 'default_service_rates']);
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
