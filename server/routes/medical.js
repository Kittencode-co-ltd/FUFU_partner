import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/medical-records?store_id=UUID&record_type=opd|ipd&status=...
router.get('/', async (req, res) => {
  const { store_id, record_type, status, limit = 50 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('medical_records')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (record_type) query = query.eq('record_type', record_type);
  if (status)      query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// GET /api/medical-records/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('medical_records')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Record not found' });
  res.json({ success: true, data });
});

// POST /api/medical-records
router.post('/', async (req, res) => {
  const record = {
    ...req.body,
    visit_date: req.body.visit_date || new Date().toISOString().split('T')[0],
    status:     req.body.status     || 'in_progress',
  };

  const { data, error } = await req.supabase
    .from('medical_records')
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error('[Medical] POST error:', error.message, error.code);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true, data });
});

// PATCH /api/medical-records/:id
router.patch('/:id', async (req, res) => {
  const updates = { ...req.body };
  delete updates.id;

  const { data, error } = await req.supabase
    .from('medical_records')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
