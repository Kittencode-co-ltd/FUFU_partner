import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_TYPES = new Set(['consent', 'lab_report', 'referral', 'prescription', 'receipt', 'certificate']);

// GET /api/documents?store_id=UUID&type=consent&status=draft
router.get('/', async (req, res) => {
  const { store_id, type, status, limit = 50 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let q = req.supabase.from('documents').select('*').eq('store_id', store_id)
    .order('created_at', { ascending: false }).limit(parseInt(limit));
  if (type)   q = q.eq('doc_type', type);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/documents
router.post('/', async (req, res) => {
  const { store_id, doc_type, title, content, pet_name, owner_name, ref_type, ref_id } = req.body;
  if (!store_id || !doc_type || !title) {
    return res.status(400).json({ error: 'store_id, doc_type, title required' });
  }
  if (!VALID_TYPES.has(doc_type)) {
    return res.status(400).json({ error: `doc_type must be one of: ${[...VALID_TYPES].join(', ')}` });
  }

  const row = { store_id, doc_type, title, status: 'draft' };
  if (content)    row.content    = content;
  if (pet_name)   row.pet_name   = pet_name;
  if (owner_name) row.owner_name = owner_name;
  if (ref_type)   row.ref_type   = ref_type;
  if (ref_id)     row.ref_id     = ref_id;

  const { data, error } = await req.supabase.from('documents').insert([row]).select().single();

  if (error && error.message.includes('schema cache')) {
    // Optional columns not in cache yet — retry with base columns only
    const base = { store_id, doc_type, title, status: 'draft' };
    const { data: d2, error: e2 } = await req.supabase.from('documents').insert([base]).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2 });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/documents/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['title', 'content', 'status', 'pet_name', 'owner_name'];
  const updates = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  if (updates.status === 'signed') updates.signed_at = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('documents').update(updates).eq('id', req.params.id).select().single();

  if (error && error.message.includes('schema cache')) {
    delete updates.signed_at;
    const { data: d2, error: e2 } = await req.supabase.from('documents').update(updates).eq('id', req.params.id).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2 });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  const { error } = await req.supabase.from('documents').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
