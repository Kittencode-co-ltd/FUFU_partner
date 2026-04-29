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

export default router;
