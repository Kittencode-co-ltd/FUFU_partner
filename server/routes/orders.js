import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('owner', 'staff', 'reception', 'vet'), async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });
  const { data, error } = await req.supabase.from('commerce_orders')
    .select('id,created_at,status,fulfillment_method,customer_phone,customer_note,delivery_address,subtotal,delivery_fee,total_amount,payment_status,commerce_order_items(id,product_name,sku,quantity,unit_price,line_total),order_deliveries(provider,tracking_number,delivered_at),order_status_history(from_status,to_status,reason,created_at)')
    .eq('store_id', store_id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: 'โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง' });
  res.json({ success: true, data });
});

router.post('/:id/transition', requireRole('owner', 'staff', 'reception', 'vet'), async (req, res) => {
  const { store_id, status, reason, provider, tracking_number } = req.body || {};
  const allowed = new Set(['preparing', 'rejected', 'ready_for_pickup', 'handed_to_courier', 'delivered', 'delivery_failed', 'returned']);
  if (!store_id || !allowed.has(status)) return res.status(400).json({ error: 'Invalid order transition' });
  const { data: order, error: readError } = await req.supabase.from('commerce_orders').select('id,store_id').eq('id', req.params.id).eq('store_id', store_id).maybeSingle();
  if (readError || !order) return res.status(404).json({ error: 'Order not found' });
  const { data, error } = await req.supabase.rpc('transition_commerce_order', {
    p_order_id: req.params.id, p_to_status: status, p_reason: typeof reason === 'string' ? reason.slice(0, 1000) : null,
    p_provider: typeof provider === 'string' ? provider.slice(0, 100) : null,
    p_tracking_number: typeof tracking_number === 'string' ? tracking_number.slice(0, 200) : null,
    p_evidence_url: null,
  });
  if (error) return res.status(error.code === '42501' ? 403 : 400).json({ error: transitionError(error.message) });
  res.json({ success: true, data });
});

// Database error codes -> messages staff can act on
function transitionError(message = '') {
  if (message.includes('transition_reason_required')) return 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร';
  if (message.includes('delivery_provider_required')) return 'กรุณาระบุผู้ให้บริการขนส่ง (อย่างน้อย 2 ตัวอักษร)';
  if (message.includes('order_transition_denied')) return 'สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่';
  if (message.includes('order_not_found')) return 'ไม่พบคำสั่งซื้อนี้';
  return 'เปลี่ยนสถานะไม่สำเร็จ กรุณาลองอีกครั้ง';
}

export default router;
