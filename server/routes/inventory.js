import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

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
    // stock_qty is the shared sellable balance used by POS and online orders.
    stock:            Number(p.stock_qty) || 0,
    nearest_expiry:   expiryMap[p.id] || null,
  }));

  res.json({ success: true, data: enriched });
});

const VALID_CATEGORIES = new Set(['medicine', 'vaccine', 'food', 'accessory', 'service', 'grooming']);

// POST /api/inventory/products — create product
router.post('/products', requireRole('owner', 'vet', 'staff'), async (req, res) => {
  const { store_id, name, category, unit, cost_price, sell_price, stock_qty, reorder_point, reorder_qty, description, photo_url, is_published, supports_pickup, supports_delivery } = req.body;
  if (!store_id || !name) return res.status(400).json({ error: 'store_id and name required' });
  if (String(name).trim().length > 160 || Number(sell_price ?? 0) < 0 || !Number.isInteger(Number(stock_qty ?? 0)) || Number(stock_qty ?? 0) < 0) return res.status(400).json({ error: 'Invalid product details' });

  const safeCategory = VALID_CATEGORIES.has(category) ? category : 'medicine';

  const row = {
    store_id, name,
    category:      safeCategory,
    unit:          unit          || null,
    cost_price:    cost_price    ?? null,
    sell_price:    sell_price    ?? null,
    reorder_point: reorder_point ?? null,
    reorder_qty:   reorder_qty   ?? null,
    description: typeof description === 'string' ? description.trim().slice(0, 4000) : null,
    photo_url: typeof photo_url === 'string' ? photo_url.trim().slice(0, 1000) || null : null,
    stock_qty: Number(stock_qty ?? 0),
    is_published: is_published === true,
    supports_pickup: supports_pickup !== false,
    supports_delivery: supports_delivery !== false,
    is_active: true,
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
router.patch('/products/:id', resolveStoreId('products'), requireRole('owner', 'vet', 'staff'), async (req, res) => {
  // Accept legacy field names from older clients
  if (req.body.price !== undefined && req.body.sell_price === undefined) req.body.sell_price = req.body.price;
  if (req.body.min_stock !== undefined && req.body.reorder_point === undefined) req.body.reorder_point = req.body.min_stock;

  const allowed = ['name', 'category', 'unit', 'cost_price', 'sell_price', 'reorder_point', 'reorder_qty', 'is_active', 'description', 'photo_url', 'is_published', 'supports_pickup', 'supports_delivery'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length < 1 || updates.name.trim().length > 160)) return res.status(400).json({ error: 'Invalid product name' });
  if (updates.sell_price !== undefined && (!Number.isFinite(Number(updates.sell_price)) || Number(updates.sell_price) < 0)) return res.status(400).json({ error: 'Invalid sell price' });
  if (updates.stock_qty !== undefined && (!Number.isInteger(Number(updates.stock_qty)) || Number(updates.stock_qty) < 0)) return res.status(400).json({ error: 'Invalid stock quantity' });
  if (updates.description !== undefined) updates.description = String(updates.description).trim().slice(0, 4000);
  if (updates.photo_url !== undefined) updates.photo_url = typeof updates.photo_url === 'string' ? updates.photo_url.trim().slice(0, 1000) || null : null;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update. Valid: name, category, unit, cost_price, sell_price, reorder_point, reorder_qty, is_active' });
  }

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

router.post('/products/:id/photo', resolveStoreId('products'), requireRole('owner', 'vet', 'staff'), async (req, res) => {
  const match = typeof req.body?.data_url === 'string' ? req.body.data_url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!match) return res.status(400).json({ error: 'กรุณาเลือกรูป JPG, PNG หรือ WebP' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'รูปต้องมีขนาดไม่เกิน 2 MB' });
  const extension = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[match[1]];
  const path = `${req.query.store_id}/${req.params.id}.${extension}`;
  const { error: uploadError } = await req.supabase.storage.from('product-images').upload(path, buffer, { contentType: match[1], upsert: true });
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  const { data: { publicUrl } } = req.supabase.storage.from('product-images').getPublicUrl(path);
  const { data, error } = await req.supabase.from('products').update({ photo_url: publicUrl }).eq('id', req.params.id).select('id,photo_url').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Stock Receive ────────────────────────────────────────────────────────────

// POST /api/inventory/receive
router.post('/receive', requireRole('owner', 'vet', 'staff'), async (req, res) => {
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

  const { error: stockError } = await req.supabase.rpc('adjust_product_sellable_stock', { p_product_id: product_id, p_delta: parseInt(quantity, 10) });
  if (stockError) return res.status(400).json({ error: stockError.message });

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

// POST /api/inventory/dispense — vet เท่านั้นที่จ่ายยา/dispense ได้
router.post('/dispense', requireRole('owner', 'vet'), async (req, res) => {
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

  const { error: stockError } = await req.supabase.rpc('adjust_product_sellable_stock', { p_product_id: product_id, p_delta: -qty });
  if (stockError) return res.status(400).json({ error: stockError.message });

  res.json({ success: true, dispensed: qty, movements: movements.length });
});

// ─── Movement Log ─────────────────────────────────────────────────────────────

// GET /api/inventory/movements?store_id=UUID&product_id=UUID&from=DATE&to=DATE
router.get('/movements', async (req, res) => {
  const { store_id, product_id, from, to, limit = 200 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('stock_movements')
    .select('*, products(*)')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to)   query = query.lte('created_at', `${to}T23:59:59`);

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

router.post('/suppliers', requireRole('owner', 'vet', 'staff'), async (req, res) => {
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

router.patch('/suppliers/:id', resolveStoreId('suppliers'), requireRole('owner', 'vet', 'staff'), async (req, res) => {
  const allowed = ['name', 'contact', 'phone', 'email', 'notes'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no fields to update' });

  const { data, error } = await req.supabase
    .from('suppliers').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/suppliers/:id', resolveStoreId('suppliers'), requireRole('owner'), async (req, res) => {
  const { error } = await req.supabase.from('suppliers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Stock Adjustment ─────────────────────────────────────────────────────────

// POST /api/inventory/adjust — correct stock count with an audited reason
router.post('/adjust', requireRole('owner', 'vet', 'staff'), async (req, res) => {
  const { store_id, product_id, batch_id, quantity_delta, reason } = req.body;
  if (!store_id || !product_id || quantity_delta === undefined) {
    return res.status(400).json({ error: 'store_id, product_id, quantity_delta required' });
  }
  const delta = parseInt(quantity_delta);
  if (isNaN(delta) || delta === 0) return res.status(400).json({ error: 'quantity_delta must be a non-zero integer' });

  // Update batch quantity if batch_id provided, else update newest active batch
  let targetBatchId = batch_id;
  if (!targetBatchId) {
    const { data: batches } = await req.supabase
      .from('inventory_batches')
      .select('id, quantity')
      .eq('store_id', store_id)
      .eq('product_id', product_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!batches?.length) return res.status(400).json({ error: 'ไม่พบ batch ที่ active' });
    targetBatchId = batches[0].id;
    const newQty = batches[0].quantity + delta;
    if (newQty < 0) return res.status(400).json({ error: `ไม่สามารถปรับยอดติดลบได้ (มี ${batches[0].quantity})` });
    await req.supabase.from('inventory_batches')
      .update({ quantity: newQty, is_active: newQty > 0 })
      .eq('id', targetBatchId);
  } else {
    const { data: batch } = await req.supabase
      .from('inventory_batches').select('quantity').eq('id', targetBatchId).single();
    if (!batch) return res.status(404).json({ error: 'batch not found' });
    const newQty = batch.quantity + delta;
    if (newQty < 0) return res.status(400).json({ error: `ไม่สามารถปรับยอดติดลบได้ (มี ${batch.quantity})` });
    await req.supabase.from('inventory_batches')
      .update({ quantity: newQty, is_active: newQty > 0 })
      .eq('id', targetBatchId);
  }

  const { data, error } = await req.supabase.from('stock_movements').insert([{
    store_id, product_id,
    batch_id:       targetBatchId,
    movement_type:  'ADJUST',
    quantity:       delta,
    reference_type: 'adjustment',
    reason:         reason || 'ปรับยอดสต็อก',
    performed_by:   req.user.email || 'staff',
  }]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  const { error: stockError } = await req.supabase.rpc('adjust_product_sellable_stock', { p_product_id: product_id, p_delta: delta });
  if (stockError) return res.status(400).json({ error: stockError.message });
  res.json({ success: true, data });
});

// ─── Expire Batch ─────────────────────────────────────────────────────────────

// POST /api/inventory/expire-batch — mark expired batch as inactive and log it
router.post('/expire-batch', requireRole('owner', 'vet', 'staff'), async (req, res) => {
  const { store_id, batch_id } = req.body;
  if (!store_id || !batch_id) return res.status(400).json({ error: 'store_id and batch_id required' });

  const { data: batch, error: fetchErr } = await req.supabase
    .from('inventory_batches').select('*').eq('id', batch_id).single();
  if (fetchErr || !batch) return res.status(404).json({ error: 'batch not found' });

  const remaining = batch.quantity;

  await req.supabase.from('inventory_batches')
    .update({ quantity: 0, is_active: false })
    .eq('id', batch_id);

  if (remaining > 0) {
    await req.supabase.from('stock_movements').insert([{
      store_id,
      product_id:     batch.product_id,
      batch_id,
      movement_type:  'EXPIRED',
      quantity:       -remaining,
      reference_type: 'expiry_check',
      reason:         `ตัดสต็อกหมดอายุ Lot: ${batch.lot_number}`,
      performed_by:   req.user.email || 'staff',
    }]);
    const { error: stockError } = await req.supabase.rpc('adjust_product_sellable_stock', { p_product_id: batch.product_id, p_delta: -remaining });
    if (stockError) return res.status(400).json({ error: stockError.message });
  }

  res.json({ success: true, expired_qty: remaining, lot_number: batch.lot_number });
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
