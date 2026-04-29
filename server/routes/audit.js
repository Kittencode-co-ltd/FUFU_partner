import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// POST /api/audit — batch insert audit logs
router.post('/', async (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs array required' });
  }

  const isUUID = (s) => s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const rows = logs.map(l => ({
    staff_id:    isUUID(l.staff_id) ? l.staff_id : null,
    store_id:    isUUID(l.store_id) ? l.store_id : null,
    action:      l.action,
    entity_type: l.entity_type,
    entity_id:   isUUID(l.entity_id) ? l.entity_id : null,
    old_data:    l.old_data    || null,
    new_data:    l.new_data    || null,
    reason:      l.reason      || '',
    user_agent:  l.user_agent  || null,
    created_at:  l.created_at  || new Date().toISOString(),
  }));

  const { error } = await req.supabase.from('audit_logs').insert(rows);
  if (error) {
    console.warn('[Audit] insert error:', error.message);
    // Return success to avoid breaking the frontend — audit is best-effort
  }
  res.json({ success: true, count: rows.length });
});

// GET /api/audit?store_id=UUID&limit=50
router.get('/', async (req, res) => {
  const { store_id, limit = 50 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('audit_logs')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

export default router;
