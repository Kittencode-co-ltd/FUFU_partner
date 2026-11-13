// Cashier — bills waiting for payment, the cash drawer, and all-or-nothing settlement.
// The money logic lives in Postgres functions (supabase/migrations/20261114000100_cashier_settlement.sql),
// so a payment, its receipt number, the stock deduction and the queue status commit together or not at all.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const CASHIER_ROLES = ['owner', 'vet', 'reception', 'accountant', 'counter'];
const TREATMENT_ROLES = ['owner', 'vet', 'reception', 'staff'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Messages raised by the SQL functions → what the person at the counter should read
const ERRORS = {
  drawer_closed:          [409, 'ยังไม่ได้เปิดลิ้นชักเงินสด กรุณาเปิดกะก่อนรับชำระ'],
  drawer_already_open:    [409, 'มีลิ้นชักเงินสดที่เปิดอยู่แล้ว'],
  session_closed:         [409, 'กะนี้ปิดไปแล้ว'],
  session_not_found:      [404, 'ไม่พบกะเงินสด'],
  invoice_not_found:      [404, 'ไม่พบใบแจ้งหนี้'],
  invoice_not_pending:    [409, 'ใบแจ้งหนี้นี้ชำระหรือยกเลิกไปแล้ว'],
  invoice_already_open:   [409, 'คิวนี้มีใบแจ้งหนี้รอชำระอยู่แล้ว'],
  queue_not_found:        [404, 'ไม่พบคิวนี้'],
  queue_not_in_treatment: [409, 'ส่งชำระเงินได้เฉพาะคิวที่กำลังตรวจ'],
  no_line_items:          [400, 'ยังไม่มีรายการค่าบริการ'],
  invalid_line_item:      [400, 'รายการค่าบริการไม่ถูกต้อง (ชื่อ จำนวน และราคา; สินค้านับเป็นจำนวนเต็ม)'],
  no_payments:            [400, 'ยังไม่ได้ระบุการชำระเงิน'],
  invalid_payment:        [400, 'ช่องทางหรือจำนวนเงินไม่ถูกต้อง'],
  invalid_vat_rate:       [400, 'อัตรา VAT ต้องเป็น 0% หรือ 7%'],
  payment_total_mismatch: [400, 'ยอดที่รับยังไม่เท่ากับยอดสุทธิ'],
  invalid_float:          [400, 'เงินทอนตั้งต้นต้องไม่ติดลบ'],
  not_store_member:       [403, 'ไม่มีสิทธิ์ในร้านนี้'],
  invoice_not_paid:       [409, 'ออกเอกสารได้หลังรับชำระแล้วเท่านั้น'],
  buyer_required:         [400, 'ใบกำกับภาษีเต็มรูปต้องมีชื่อผู้ซื้อ'],
  tax_invoice_locked:     [409, 'ออกใบกำกับภาษีเต็มรูปไปแล้ว แก้ข้อมูลผู้ซื้อไม่ได้'],
  invalid_tax_id:         [400, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'],
};

function sendRpcError(res, error) {
  const message = String(error?.message || '');
  // Function or table not created yet → the migration has not been applied on this database
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) {
    return res.status(503).json({ success: false, code: 'cashier_not_ready', error: 'ระบบแคชเชียร์ยังไม่ได้เปิดใช้งานบนฐานข้อมูลนี้' });
  }
  if (message.startsWith('insufficient_stock:')) {
    return res.status(409).json({ success: false, code: 'insufficient_stock', error: `สต็อกไม่พอ: ${message.slice(19)} · ไม่มีการบันทึกใดๆ` });
  }
  const [status, text] = ERRORS[message] || [500, 'ทำรายการไม่สำเร็จ · ไม่มีการบันทึกใดๆ'];
  return res.status(status).json({ success: false, code: ERRORS[message] ? message : 'cashier_error', error: text });
}

const money = value => Math.round(Number(value) * 100) / 100;

function cleanLineItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) return null;
  const lines = [];
  for (const item of items) {
    const name = String(item?.name || '').trim().slice(0, 200);
    const qty = Number(item?.qty);
    const unitPrice = money(item?.unit_price);
    if (!name || !Number.isFinite(qty) || qty <= 0 || qty > 10000 || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    const line = { name, qty, unit_price: unitPrice };
    if (item.product_id) {
      if (!UUID.test(String(item.product_id)) || !Number.isInteger(qty)) return null;
      line.product_id = String(item.product_id);
    }
    if (item.service_item_id && UUID.test(String(item.service_item_id))) line.service_item_id = String(item.service_item_id);
    lines.push(line);
  }
  return lines;
}

// GET /api/cashier/invoices?store_id=&status=pending|paid&limit=
router.get('/invoices', requireRole(...CASHIER_ROLES, 'staff'), async (req, res) => {
  const { store_id, status = 'pending' } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  if (!['pending', 'paid'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  let query = req.supabase.from('invoices')
    .select('id, store_id, queue_entry_id, pet_name, owner_name, invoice_number, line_items, subtotal, discount, vat_rate, vat_amount, total, payment_method, status, created_at, paid_at')
    .eq('store_id', store_id).eq('status', status)
    .order(status === 'pending' ? 'created_at' : 'paid_at', { ascending: status === 'pending' })
    .limit(limit);
  if (status === 'paid') query = query.gte('paid_at', new Date(Date.now() - 86400000).toISOString());
  const { data, error } = await query;
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data: data || [] });
});

// POST /api/cashier/invoices — treatment done, send the bill to the cashier
router.post('/invoices', requireRole(...TREATMENT_ROLES), async (req, res) => {
  const { store_id, queue_entry_id, medical_record_id } = req.body;
  const lineItems = cleanLineItems(req.body.line_items);
  if (!lineItems) return res.status(400).json({ success: false, error: ERRORS.invalid_line_item[1] });
  if (queue_entry_id && !UUID.test(String(queue_entry_id))) return res.status(400).json({ error: 'invalid queue_entry_id' });
  const { data, error } = await req.supabase.rpc('fufu_open_invoice', {
    p_store_id: store_id,
    p_queue_entry_id: queue_entry_id || null,
    p_pet_name: String(req.body.pet_name || '').slice(0, 120) || null,
    p_owner_name: String(req.body.owner_name || '').slice(0, 120) || null,
    p_line_items: lineItems,
    p_medical_record_id: medical_record_id && UUID.test(String(medical_record_id)) ? medical_record_id : null,
  });
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data });
});

// POST /api/cashier/invoices/:id/settle  { payments: [{method, amount, reference}], discount, vat_rate }
router.post('/invoices/:id/settle', resolveStoreId('invoices'), requireRole(...CASHIER_ROLES), async (req, res) => {
  const payments = Array.isArray(req.body.payments) ? req.body.payments.slice(0, 6).map(p => ({
    method: String(p?.method || ''),
    amount: money(p?.amount),
    reference: p?.reference ? String(p.reference).slice(0, 120) : null,
  })) : [];
  const { data, error } = await req.supabase.rpc('fufu_settle_invoice', {
    p_invoice_id: req.params.id,
    p_payments: payments,
    p_discount: money(req.body.discount || 0),
    p_vat_rate: Number(req.body.vat_rate) === 7 ? 7 : 0,
  });
  if (error) return sendRpcError(res, error);
  await req.supabase.from('audit_logs').insert({
    store_id: data.store_id, action: 'PAYMENT', entity_type: 'invoice', entity_id: data.id,
    new_data: { invoice_number: data.invoice_number, total: data.total, payment_method: data.payment_method },
    reason: 'รับชำระที่แคชเชียร์',
  }).then(() => {}, () => {});
  res.json({ success: true, data });
});

// POST /api/cashier/invoices/:id/return — send back to the vet to fix the treatment
router.post('/invoices/:id/return', resolveStoreId('invoices'), requireRole(...CASHIER_ROLES), async (req, res) => {
  const { error } = await req.supabase.rpc('fufu_return_to_treatment', { p_invoice_id: req.params.id });
  if (error) return sendRpcError(res, error);
  res.json({ success: true });
});

// GET /api/cashier/invoices/:id — everything a receipt document needs (invoice, payments, seller)
router.get('/invoices/:id', resolveStoreId('invoices'), requireRole(...CASHIER_ROLES, 'staff'), async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const { data: invoice, error } = await req.supabase.from('invoices').select('*').eq('id', req.params.id).single();
  if (error || !invoice) return sendRpcError(res, error || { message: 'invoice_not_found' });
  const [{ data: payments }, { data: store }] = await Promise.all([
    req.supabase.from('invoice_payments').select('method, amount, reference, created_at').eq('invoice_id', invoice.id).order('created_at'),
    req.supabase.from('stores').select('*').eq('id', invoice.store_id).maybeSingle(),
  ]);
  // Only what a receipt shows about the seller (select * so an optional branch_name column is picked up)
  const seller = store ? { name: store.name, address: store.address, phone: store.phone, tax_id: store.tax_id, branch_name: store.branch_name || null, receipt_header_note: store.receipt_header_note, logo_url: store.logo_url } : null;
  res.json({ success: true, data: { invoice, payments: payments || [], store: seller } });
});

// POST /api/cashier/invoices/:id/print { full_tax_invoice } → print number (1 = original, >1 = copy)
router.post('/invoices/:id/print', resolveStoreId('invoices'), requireRole(...CASHIER_ROLES, 'staff'), async (req, res) => {
  const { data, error } = await req.supabase.rpc('fufu_mark_invoice_printed', {
    p_invoice_id: req.params.id, p_full_tax_invoice: req.body?.full_tax_invoice === true,
  });
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data: { print_no: data } });
});

// PATCH /api/cashier/invoices/:id/buyer { name, address, tax_id, branch } — for a full tax invoice
router.patch('/invoices/:id/buyer', resolveStoreId('invoices'), requireRole(...CASHIER_ROLES), async (req, res) => {
  const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
  const { data, error } = await req.supabase.rpc('fufu_set_invoice_buyer', {
    p_invoice_id: req.params.id,
    p_name: clip(req.body?.name, 200), p_address: clip(req.body?.address, 400),
    p_tax_id: clip(req.body?.tax_id, 20), p_branch: clip(req.body?.branch, 60),
  });
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data });
});

// GET /api/cashier/session?store_id= — the open drawer (null when closed) with today's takings
router.get('/session', requireRole(...CASHIER_ROLES, 'staff'), async (req, res) => {
  const { data: session, error } = await req.supabase.from('cash_sessions')
    .select('*').eq('store_id', req.query.store_id).is('closed_at', null).maybeSingle();
  if (error) return sendRpcError(res, error);
  if (!session) return res.json({ success: true, data: null });
  const { data: payments, error: payErr } = await req.supabase.from('invoice_payments')
    .select('method, amount').eq('cash_session_id', session.id);
  if (payErr) return sendRpcError(res, payErr);
  const totals = { cash: 0, transfer: 0, card: 0, qr: 0 };
  for (const p of payments || []) totals[p.method] = money((totals[p.method] || 0) + Number(p.amount));
  res.json({ success: true, data: { ...session, totals, expected_cash: money(Number(session.opening_float) + totals.cash) } });
});

// POST /api/cashier/session/open { store_id, opening_float }
router.post('/session/open', requireRole(...CASHIER_ROLES), async (req, res) => {
  const float = money(req.body.opening_float || 0);
  if (!Number.isFinite(float) || float < 0) return res.status(400).json({ error: ERRORS.invalid_float[1] });
  const { data, error } = await req.supabase.rpc('fufu_open_cash_session', {
    p_store_id: req.body.store_id, p_opening_float: float, p_name: req.user?.email || null,
  });
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data });
});

// POST /api/cashier/session/:id/close { counted_cash, note }
router.post('/session/:id/close', resolveStoreId('cash_sessions'), requireRole(...CASHIER_ROLES), async (req, res) => {
  const counted = money(req.body.counted_cash);
  if (!Number.isFinite(counted) || counted < 0) return res.status(400).json({ error: 'กรุณากรอกเงินสดที่นับได้' });
  const { data, error } = await req.supabase.rpc('fufu_close_cash_session', {
    p_session_id: req.params.id, p_counted_cash: counted, p_note: req.body.note ? String(req.body.note).slice(0, 300) : null,
  });
  if (error) return sendRpcError(res, error);
  res.json({ success: true, data });
});

export default router;
