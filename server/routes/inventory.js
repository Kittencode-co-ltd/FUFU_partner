import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Products ─────────────────────────────────────────────────────────────────

// GET /api/inventory?store_id=UUID
// Returns products with computed total stock from active batches
router.get('/', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data: products, error } = await req.supabase
    .from('products')
    .select('*')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  // Attach stock totals from batches
  const { data: batches } = await req.supabase
    .from('inventory_batches')
    .select('product_id, quantity, expiry_date')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .gt('quantity', 0);

  const stockMap = {};
  const expiryMap = {};
  (batches || []).forEach(b => {
    stockMap[b.product_id]  = (stockMap[b.product_id] || 0) + b.quantity;
    if (b.expiry_date) {
      if (!expiryMap[b.product_id] || b.expiry_date < expiryMap[b.product_id]) {
        expiryMap[b.product_id] = b.expiry_date;
      }
    }
  });

  const enriched = (products || []).map(p => ({
    ...p,
    stock:            stockMap[p.id] || 0,
    nearest_expiry:   expiryMap[p.id] || null,
  }));

  res.json({ success: true, data: enriched });
});

const VALID_CATEGORIES = new Set(['medicine', 'vaccine', 'food', 'accessory', 'service', 'grooming']);

// POST /api/inventory/products — create product
router.post('/products', async (req, res) => {
  const { store_id, name, category, unit, cost_price, sell_price, reorder_point, reorder_qty } = req.body;
  if (!store_id || !name) return res.status(400).json({ error: 'store_id and name required' });

  const safeCategory = VALID_CATEGORIES.has(category) ? category : 'medicine';

  const row = {
    store_id, name,
    category:      safeCategory,
    unit:          unit          || null,
    cost_price:    cost_price    ?? null,
    sell_price:    sell_price    ?? null,
    reorder_point: reorder_point ?? null,
    reorder_qty:   reorder_qty   ?? null,
    is_active:     true,
  };

  const { data, error } = await req.supabase.from('products').insert([row]).select().single();

  if (error && error.message.includes('schema cache')) {
    const base = { store_id, name, category: safeCategory, is_active: true };
    const { data: d2, error: e2 } = await req.supabase.from('products').insert([base]).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2, migration_needed: true });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/inventory/products/:id
router.patch('/products/:id', async (req, res) => {
  const allowed = ['name', 'category', 'unit', 'cost_price', 'sell_price', 'reorder_point', 'reorder_qty', 'is_active'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('products').update(updates).eq('id', req.params.id).select().single();

  if (error && error.message.includes('schema cache')) {
    const base = {};
    for (const k of ['name', 'category', 'is_active']) if (updates[k] !== undefined) base[k] = updates[k];
    const { data: d2, error: e2 } = await req.supabase.from('products').update(base).eq('id', req.params.id).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2, migration_needed: true });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Stock Receive ────────────────────────────────────────────────────────────

// POST /api/inventory/receive
router.post('/receive', async (req, res) => {
  const { store_id, product_id, lot_number, quantity, expiry_date, cost_price, supplier_id, notes } = req.body;
  if (!store_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'store_id, product_id, quantity required' });
  }

  const { data: batch, error: bErr } = await req.supabase
    .from('inventory_batches')
    .insert([{
      store_id, product_id,
      lot_number:   lot_number || `LOT-${Date.now()}`,
      quantity:     parseInt(quantity),
      initial_qty:  parseInt(quantity),
      expiry_date:  expiry_date || null,
      cost_price:   cost_price || null,
      supplier_id:  supplier_id || null,
      notes:        notes || null,
      is_active:    true,
    }])
    .select()
    .single();

  if (bErr) return res.status(500).json({ error: bErr.message });

  // Log movement
  await req.supabase.from('stock_movements').insert([{
    store_id, product_id,
    batch_id:       batch.id,
    movement_type:  'IN',
    quantity:       parseInt(quantity),
    reference_type: 'purchase',
    reason:         `รับสินค้าเข้า Lot: ${batch.lot_number}`,
    performed_by:   req.user.email || 'staff',
  }]);

  res.json({ success: true, data: batch });
});

// ─── FEFO Dispense ────────────────────────────────────────────────────────────

// POST /api/inventory/dispense
router.post('/dispense', async (req, res) => {
  const { store_id, product_id, quantity, reference_type, reference_id, reason, performed_by } = req.body;
  if (!store_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'store_id, product_id, quantity required' });
  }

  const qty = parseInt(quantity);
  const today = new Date().toISOString().split('T')[0];

  // FEFO: active batches ordered by earliest expiry (nulls last)
  const { data: batches, error: bErr } = await req.supabase
    .from('inventory_batches')
    .select('id, quantity, expiry_date, lot_number')
    .eq('store_id', store_id)
    .eq('product_id', product_id)
    .eq('is_active', true)
    .gt('quantity', 0)
    .or(`expiry_date.gt.${today},expiry_date.is.null`)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  if (bErr) return res.status(500).json({ error: bErr.message });

  const totalStock = (batches || []).reduce((s, b) => s + b.quantity, 0);
  if (totalStock < qty) {
    return res.status(400).json({ error: `สต็อกไม่พอ: มี ${totalStock} ต้องการ ${qty}` });
  }

  let remaining = qty;
  const movements = [];

  for (const batch of (batches || [])) {
    if (remaining <= 0) break;
    const deduct  = Math.min(batch.quantity, remaining);
    const newQty  = batch.quantity - deduct;

    await req.supabase
      .from('inventory_batches')
      .update({ quantity: newQty, is_active: newQty > 0 })
      .eq('id', batch.id);

    movements.push({
      store_id, product_id,
      batch_id:       batch.id,
      movement_type:  'OUT',
      quantity:       -deduct,
      reference_type: reference_type || 'manual',
      reference_id:   reference_id || null,
      reason:         reason || `FEFO dispense Lot: ${batch.lot_number}`,
      performed_by:   performed_by || req.user.email || 'staff',
    });

    remaining -= deduct;
  }

  if (movements.length) {
    await req.supabase.from('stock_movements').insert(movements);
  }

  res.json({ success: true, dispensed: qty, movements: movements.length });
});

// ─── Movement Log ─────────────────────────────────────────────────────────────

// GET /api/inventory/movements?store_id=UUID&product_id=UUID
router.get('/movements', async (req, res) => {
  const { store_id, product_id, limit = 100 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('stock_movements')
    .select('*, products(*)')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (product_id) query = query.eq('product_id', product_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// ─── Expiry Alerts ────────────────────────────────────────────────────────────

// GET /api/inventory/expiry-alerts?store_id=UUID
router.get('/expiry-alerts', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const { data, error } = await req.supabase
    .from('inventory_batches')
    .select('*, products(*)')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .gt('quantity', 0)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', in90)
    .order('expiry_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// ─── Reorder Alerts ───────────────────────────────────────────────────────────

// GET /api/inventory/reorder-needed?store_id=UUID
router.get('/reorder-needed', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data: products, error } = await req.supabase
    .from('products')
    .select('*')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .not('reorder_point', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const { data: batches } = await req.supabase
    .from('inventory_batches')
    .select('product_id, quantity')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .gt('quantity', 0);

  const stockMap = {};
  (batches || []).forEach(b => {
    stockMap[b.product_id] = (stockMap[b.product_id] || 0) + b.quantity;
  });

  const reorderList = (products || []).filter(p =>
    (stockMap[p.id] || 0) <= (p.reorder_point || 0)
  ).map(p => ({ ...p, current_stock: stockMap[p.id] || 0 }));

  res.json({ success: true, data: reorderList });
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('suppliers')
    .select('*')
    .eq('store_id', store_id)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/suppliers', async (req, res) => {
  const { store_id, name, contact, phone, email, notes } = req.body;
  if (!store_id || !name) return res.status(400).json({ error: 'store_id and name required' });

  const { data, error } = await req.supabase
    .from('suppliers')
    .insert([{ store_id, name, contact, phone, email, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Batches for a product ────────────────────────────────────────────────────

router.get('/batches', async (req, res) => {
  const { store_id, product_id } = req.query;
  if (!store_id || !product_id) return res.status(400).json({ error: 'store_id and product_id required' });

  const { data, error } = await req.supabase
    .from('inventory_batches')
    .select('*')
    .eq('store_id', store_id)
    .eq('product_id', product_id)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

export default router;
