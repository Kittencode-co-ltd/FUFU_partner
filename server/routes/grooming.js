import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/grooming?store_id=UUID&date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { store_id, date } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const from = date || new Date().toISOString().split('T')[0];
  const to   = from + 'T23:59:59';

  const { data, error } = await req.supabase
    .from('grooming_sessions').select('*')
    .eq('store_id', store_id)
    .gte('created_at', from).lte('created_at', to)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/grooming — create session
router.post('/', async (req, res) => {
  const { store_id, pet_name, owner_name, species, services, groomer_name, estimated_minutes, notes } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('grooming_sessions').insert([{
      store_id, pet_name, owner_name, species: species || 'dog',
      services: services || [], groomer_name, estimated_minutes: estimated_minutes || 60,
      notes, status: 'waiting',
    }]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/grooming/:id/start
router.patch('/:id/start', async (req, res) => {
  const { data, error } = await req.supabase
    .from('grooming_sessions')
    .update({ status: 'in_progress', start_time: new Date().toISOString(), progress: 0 })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/grooming/:id/complete
router.patch('/:id/complete', async (req, res) => {
  const { health_report } = req.body;
  const { data, error } = await req.supabase
    .from('grooming_sessions')
    .update({ status: 'done', end_time: new Date().toISOString(), progress: 100, health_report: health_report || null })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/grooming/:id — general update (progress, services, etc.)
router.patch('/:id', async (req, res) => {
  const updates = { ...req.body };
  delete updates.id;
  const { data, error } = await req.supabase
    .from('grooming_sessions').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
