import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

// GET /api/finance/transactions?store_id=UUID&from=DATE&to=DATE
router.get('/transactions', async (req, res) => {
  const { store_id, from, to, limit = 100 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('transactions')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (from) query = query.gte('created_at', from);
  if (to)   query = query.lte('created_at', `${to}T23:59:59`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// GET /api/finance/summary?store_id=UUID
router.get('/summary', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const now        = new Date();
  const today      = now.toISOString().split('T')[0];
  const weekAgo    = new Date(now - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { data, error } = await req.supabase
    .from('transactions')
    .select('total, commission_amount, created_at')
    .eq('store_id', store_id)
    .gte('created_at', monthStart);

  if (error) return res.status(500).json({ error: error.message });

  const rows   = data || [];
  const sum    = (arr, f) => arr.reduce((s, r) => s + (r[f] || 0), 0);
  const since  = (d) => rows.filter(r => (r.created_at || '').split('T')[0] >= d);

  res.json({
    success: true,
    data: {
      today:      sum(since(today),   'total'),
      week:       sum(since(weekAgo), 'total'),
      month:      sum(rows,           'total'),
      commission: sum(rows,           'commission_amount'),
    },
  });
});

// GET /api/finance/weekly?store_id=UUID — รายได้รายวัน 7 วันย้อนหลัง
router.get('/weekly', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const days = 7;
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const { data, error } = await req.supabase
    .from('transactions')
    .select('total, created_at')
    .eq('store_id', store_id)
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Group by date
  const grouped = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    grouped[d] = 0;
  }
  (data || []).forEach(r => {
    const d = (r.created_at || '').split('T')[0];
    if (d in grouped) grouped[d] += r.total || 0;
  });

  const result = Object.entries(grouped).map(([date, total]) => ({ date, total }));
  res.json({ success: true, data: result });
});

// GET /api/finance/range?store_id=UUID&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/range', async (req, res) => {
  const { store_id, from, to } = req.query;
  if (!store_id || !from || !to) return res.status(400).json({ error: 'store_id, from, to required' });

  const { data, error } = await req.supabase
    .from('transactions')
    .select('total, commission_amount, payment_method, created_at')
    .eq('store_id', store_id)
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];

  // Daily breakdown
  const byDay = {};
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    byDay[d.toISOString().split('T')[0]] = 0;
  }
  rows.forEach(r => {
    const day = (r.created_at || '').split('T')[0];
    if (day in byDay) byDay[day] += r.total || 0;
  });

  // Payment method breakdown
  const byMethod = {};
  rows.forEach(r => {
    const m = r.payment_method || 'other';
    byMethod[m] = (byMethod[m] || 0) + (r.total || 0);
  });

  const total      = rows.reduce((s, r) => s + (r.total || 0), 0);
  const commission = rows.reduce((s, r) => s + (r.commission_amount || 0), 0);
  const dayCount   = Math.max(Object.keys(byDay).length, 1);

  res.json({
    success: true,
    data: {
      total,
      count:       rows.length,
      commission,
      avg_per_day: Math.round(total / dayCount),
      by_day:      Object.entries(byDay).map(([date, t]) => ({ date, total: t })),
      by_method:   byMethod,
    },
  });
});

// POST /api/finance/transactions
router.post('/transactions', requireRole('owner', 'accountant', 'reception', 'staff'), async (req, res) => {
  const { store_id, total, subtotal, discount = 0, payment_method = 'cash', description } = req.body;
  if (!store_id || !total) return res.status(400).json({ error: 'store_id and total required' });

  // Round once to whole baht, matching the POS path (server/routes/pos.js) so
  // commission_amount is computed identically no matter where the transaction
  // originates — avoids reconciliation drift between manual and POS entries.
  const COMMISSION_RATE = 0.05;
  const commission_amount = Math.round(total * COMMISSION_RATE);

  const row = {
    store_id,
    subtotal:          subtotal || total,
    discount:          discount || 0,
    total:             Math.round(total),
    commission_rate:   COMMISSION_RATE,
    commission_amount,
    payment_method,
    payment_status:    'paid',
  };
  if (description) row.description = description;

  const { data, error } = await req.supabase
    .from('transactions').insert([row]).select().single();

  if (error && error.message.includes('description')) {
    delete row.description;
    const { data: d2, error: e2 } = await req.supabase.from('transactions').insert([row]).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2, migration_needed: true });
  }
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
