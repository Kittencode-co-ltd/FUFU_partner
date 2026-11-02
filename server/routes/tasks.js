import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS   = new Set(['todo', 'in_progress', 'done']);
const VALID_PRIORITY = new Set(['low', 'normal', 'high', 'urgent']);

// GET /api/tasks?store_id=UUID&status=todo
router.get('/', requireRole('owner', 'vet', 'reception', 'staff', 'counter'), async (req, res) => {
  const { store_id, status } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let q = req.supabase.from('tasks').select('*').eq('store_id', store_id)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/tasks
router.post('/', requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
  const { store_id, title, description, priority, assigned_to, due_date, tags } = req.body;
  if (!store_id || !title) return res.status(400).json({ error: 'store_id and title required' });

  const row = { store_id, title, priority: VALID_PRIORITY.has(priority) ? priority : 'normal', status: 'todo' };
  if (description) row.description = description;
  if (assigned_to) row.assigned_to = assigned_to;
  if (due_date)    row.due_date    = due_date;
  if (tags?.length) row.tags       = tags;

  const { data, error } = await req.supabase.from('tasks').insert([row]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/tasks/:id
router.patch('/:id', resolveStoreId('tasks'), requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'tags'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no fields to update' });

  if (updates.status && !VALID_STATUS.has(updates.status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  // Only add completed_at if the column exists — use try approach
  if (updates.status === 'done') updates.completed_at = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('tasks').update(updates).eq('id', req.params.id).select().single();

  if (error && error.message.includes('schema cache')) {
    // completed_at or updated_at not in cache yet — retry without them
    delete updates.completed_at;
    delete updates.updated_at;
    const { data: d2, error: e2 } = await req.supabase.from('tasks').update(updates).eq('id', req.params.id).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2 });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/tasks/:id
router.delete('/:id', resolveStoreId('tasks'), requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
  const { error } = await req.supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
