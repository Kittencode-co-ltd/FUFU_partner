import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/queue?store_id=UUID&date=YYYY-MM-DD&status=...
router.get('/', async (req, res) => {
  const { store_id, date, status } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('queue_entries')
    .select('*')
    .eq('store_id', store_id)
    .order('queue_number', { ascending: true });

  if (date)   query = query.eq('queue_date', date);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// GET /api/queue/range?store_id=UUID&from=DATE&to=DATE
router.get('/range', async (req, res) => {
  const { store_id, from, to } = req.query;
  if (!store_id || !from || !to) return res.status(400).json({ error: 'store_id, from, to required' });

  const { data, error } = await req.supabase
    .from('queue_entries')
    .select('status, service_type, priority, created_at, queue_date')
    .eq('store_id', store_id)
    .gte('queue_date', from)
    .lte('queue_date', to)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  const rows = data || [];

  // Daily count
  const byDay = {};
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    byDay[d.toISOString().split('T')[0]] = 0;
  }
  rows.forEach(r => {
    const day = r.queue_date || (r.created_at || '').split('T')[0];
    if (day in byDay) byDay[day]++;
  });

  // By service
  const byService = {};
  rows.forEach(r => {
    const s = r.service_type || 'ทั่วไป';
    byService[s] = (byService[s] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      total:     rows.length,
      completed: rows.filter(r => r.status === 'completed').length,
      emergency: rows.filter(r => r.priority === 'emergency').length,
      no_show:   rows.filter(r => r.status === 'no_show').length,
      by_day:    Object.entries(byDay).map(([date, count]) => ({ date, count })),
      by_service: byService,
    },
  });
});

// POST /api/queue
router.post('/', async (req, res) => {
  const { store_id, pet_id, pet_name, owner_name, service_type, priority, notes, estimated_time } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await req.supabase
    .from('queue_entries')
    .select('queue_number')
    .eq('store_id', store_id)
    .eq('queue_date', today)
    .order('queue_number', { ascending: false })
    .limit(1);

  const nextNum = existing?.length ? existing[0].queue_number + 1 : 1;
  const combinedNotes = notes || (pet_name && owner_name ? `${pet_name} - ${owner_name}` : pet_name || '');

  const { data, error } = await req.supabase
    .from('queue_entries')
    .insert([{
      store_id,
      pet_id:         pet_id || null,
      queue_number:   nextNum,
      queue_date:     today,
      service_type:   service_type || 'ตรวจทั่วไป',
      priority:       priority || 'normal',
      notes:          combinedNotes,
      estimated_time: estimated_time || 20,
      status:         'waiting',
      source:         'walk_in',
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/queue/:id
router.patch('/:id', async (req, res) => {
  const updates = { ...req.body };
  delete updates.id;

  if (updates.status === 'called')      updates.called_at    = new Date().toISOString();
  if (updates.status === 'in_progress') updates.started_at   = new Date().toISOString();
  if (updates.status === 'completed')   updates.completed_at = new Date().toISOString();
  if (updates.status === 'no_show')     updates.completed_at = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('queue_entries')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
