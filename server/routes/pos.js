import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const COMMISSION_RATE = 0.05;

// POST /api/pos/checkout
router.post('/checkout', async (req, res) => {
  const { store_id, queue_entry_id, medical_record_id, pet_name, owner_name,
          line_items, discount = 0, payment_method = 'cash', payment_reference } = req.body;

  if (!store_id || !line_items?.length) {
    return res.status(400).json({ error: 'store_id and line_items required' });
  }

  const subtotal = line_items.reduce((s, i) => s + (i.qty * i.unit_price), 0);
  const total    = Math.max(0, subtotal - discount);
  const commission = Math.round(total * COMMISSION_RATE);
  const net_amount = total - commission;

  // Generate invoice number
  const today    = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const { count } = await req.supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store_id)
    .gte('created_at', new Date().toISOString().split('T')[0]);

  const inv_number = `INV-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

  // Create invoice
  const { data: invoice, error: invErr } = await req.supabase
    .from('invoices')
    .insert([{
      store_id, queue_entry_id: queue_entry_id || null,
      medical_record_id: medical_record_id || null,
      pet_name, owner_name,
      invoice_number: inv_number,
      line_items, subtotal, discount, total,
      payment_method, payment_reference: payment_reference || null,
      status: 'paid',
      created_by: req.user.email,
    }])
    .select().single();

  if (invErr) return res.status(500).json({ error: invErr.message });

  // Create transaction
  const { error: txErr } = await req.supabase
    .from('transactions')
    .insert([{
      store_id,
      invoice_number:    inv_number,
      subtotal,
      discount,
      total,
      commission_rate:   COMMISSION_RATE,
      commission_amount: commission,
      payment_method,
      payment_status:    'paid',
    }]);

  if (txErr) console.warn('[POS] transaction insert failed:', txErr.message);

  // Mark queue as completed
  if (queue_entry_id) {
    await req.supabase
      .from('queue_entries')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', queue_entry_id);
  }

  res.json({ success: true, data: { invoice, invoice_number: inv_number, total, commission } });
});

// GET /api/pos/invoice/:id
router.get('/invoice/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('invoices').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ success: true, data });
});

// GET /api/pos/invoices?store_id=UUID
router.get('/invoices', async (req, res) => {
  const { store_id, limit = 50 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('invoices').select('*').eq('store_id', store_id)
    .order('created_at', { ascending: false }).limit(parseInt(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

export default router;
