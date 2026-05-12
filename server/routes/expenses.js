import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const VALID_CATEGORIES = new Set(['salary','supplies','rent','utilities','goods','marketing','other']);

// GET /api/expenses?store_id=&from=&to=&category=
router.get('/', async (req, res) => {
  const { store_id, from, to, category } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let q = req.supabase
    .from('expenses')
    .select('*')
    .eq('store_id', store_id)
    .order('expense_date', { ascending: false })
    .order('created_at',   { ascending: false })
    .limit(500);

  if (from)     q = q.gte('expense_date', from);
  if (to)       q = q.lte('expense_date', to);
  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const total = (data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  res.json({ success: true, data: data || [], total });
});

// POST /api/expenses
router.post('/', requireRole('owner', 'accountant'), async (req, res) => {
  const {
    store_id, expense_date, category = 'other', amount, description, receipt_note,
    withholding_tax_rate = 0, vat_included = false, vat_amount = 0,
    payee_name, payee_tax_id, tax_document_id,
  } = req.body;
  if (!store_id || !amount) return res.status(400).json({ error: 'store_id and amount required' });
  if (!VALID_CATEGORIES.has(category)) return res.status(400).json({ error: 'invalid category' });

  const parsedAmount = parseFloat(amount);
  const whtRate      = parseFloat(withholding_tax_rate) || 0;
  const whtAmount    = Math.round(parsedAmount * (whtRate / 100) * 100) / 100;

  const { data, error } = await req.supabase
    .from('expenses')
    .insert([{
      store_id,
      expense_date: expense_date || new Date().toISOString().split('T')[0],
      category,
      amount: parsedAmount,
      description: description?.trim() || null,
      receipt_note: receipt_note?.trim() || null,
      withholding_tax_rate:   whtRate,
      withholding_tax_amount: whtAmount,
      vat_included:   !!vat_included,
      vat_amount:     parseFloat(vat_amount) || 0,
      payee_name:     payee_name?.trim()     || null,
      payee_tax_id:   payee_tax_id?.trim()   || null,
      tax_document_id: tax_document_id?.trim() || null,
      created_by: req.user.email,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/expenses/:id
router.patch('/:id', requireRole('owner', 'accountant'), async (req, res) => {
  const allowed = [
    'expense_date', 'category', 'amount', 'description', 'receipt_note',
    'withholding_tax_rate', 'withholding_tax_amount', 'vat_included', 'vat_amount',
    'payee_name', 'payee_tax_id', 'tax_document_id',
  ];
  const updates = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (updates.amount !== undefined) updates.amount = parseFloat(updates.amount);
  if (updates.withholding_tax_rate !== undefined) {
    updates.withholding_tax_rate   = parseFloat(updates.withholding_tax_rate) || 0;
    const base = updates.amount ?? 0;
    updates.withholding_tax_amount = Math.round(base * (updates.withholding_tax_rate / 100) * 100) / 100;
  }

  const { data, error } = await req.supabase
    .from('expenses').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/expenses/:id
router.delete('/:id', requireRole('owner', 'accountant'), async (req, res) => {
  const { error } = await req.supabase.from('expenses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
