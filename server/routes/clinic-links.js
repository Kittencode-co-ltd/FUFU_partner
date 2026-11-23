// Clinic ↔ App linking (phases 2–5): the clinic's QR / code, one-time invites for a customer record,
// and the list of customers who linked. All work happens in Postgres functions (see
// supabase/migrations/20261121000100_clinic_links.sql) called with the staff member's own session.
import { Router } from 'express';
import QRCode from 'qrcode';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const STAFF = ['owner', 'reception', 'vet'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_URL = (process.env.APP_PUBLIC_URL || 'https://app.fufupetcare.com').replace(/\/$/, '');

const linkUrl = code => `${APP_URL}/link?code=${encodeURIComponent(code)}`;
const qrSvg = url => QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1D3640', light: '#FFFFFF' } });

function fail(res, error) {
  const status = error?.code === '42501' ? 403 : error?.code === 'P0002' ? 404 : error?.code === '22023' ? 400 : error?.code === 'P0003' ? 402 : 500;
  const code = { 403: 'forbidden', 404: 'not_found', 400: 'not_a_clinic', 402: 'plan_paused' }[status] || 'failed';
  return res.status(status).json({ success: false, code, error: error?.message || 'Request failed' });
}

// GET /api/clinic-links/code?store_id — the clinic's permanent code + QR (created on first use)
router.get('/code', requireRole(...STAFF), async (req, res) => {
  const { data: code, error } = await req.supabase.rpc('clinic_store_code', { p_store_id: req.query.store_id, p_rotate: false });
  if (error) return fail(res, error);
  const url = linkUrl(code);
  res.json({ success: true, data: { code, url, qr_svg: await qrSvg(url) } });
});

// POST /api/clinic-links/code/rotate — owner replaces a leaked code; the old QR stops working
router.post('/code/rotate', requireRole('owner'), async (req, res) => {
  const { data: code, error } = await req.supabase.rpc('clinic_store_code', { p_store_id: req.body.store_id, p_rotate: true });
  if (error) return fail(res, error);
  const url = linkUrl(code);
  res.json({ success: true, data: { code, url, qr_svg: await qrSvg(url) } });
});

// POST /api/clinic-links/invite { store_id, owner_id } — one-time code for an existing customer record (7 days)
router.post('/invite', requireRole(...STAFF), async (req, res) => {
  if (!UUID.test(req.body.owner_id || '')) return res.status(400).json({ success: false, code: 'invalid', error: 'owner_id required' });
  const { data, error } = await req.supabase.rpc('clinic_invite_code', { p_store_id: req.body.store_id, p_owner_id: req.body.owner_id });
  if (error) return fail(res, error);
  const row = Array.isArray(data) ? data[0] : data;
  const url = linkUrl(row.code);
  res.json({ success: true, data: { code: row.code, expires_at: row.expires_at, url, qr_svg: await qrSvg(url) } });
});

// GET /api/clinic-links/customers?store_id — who linked (name, how, when) and what each one shares
router.get('/customers', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.rpc('clinic_linked_customers', { p_store_id: req.query.store_id });
  if (error) return fail(res, error);
  res.json({ success: true, data: data || [] });
});

// GET /api/clinic-links/owners?store_id — customer records already linked to an App account: [{ owner_id, user_id }]
router.get('/owners', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.from('clinic_links')
    .select('owner_id, user_id').eq('store_id', req.query.store_id).eq('status', 'active').not('owner_id', 'is', null);
  if (error) return fail(res, error);
  res.json({ success: true, data: data || [] });
});

// GET /api/clinic-links/shared?store_id&user_id — what this customer chose to share from the App (phase 3).
// The database function checks consent on every call and records the view (the customer can see it).
router.get('/shared', requireRole(...STAFF), async (req, res) => {
  if (!UUID.test(req.query.user_id || '')) return res.status(400).json({ success: false, code: 'invalid', error: 'user_id required' });
  const { data, error } = await req.supabase.rpc('clinic_shared_data', { p_store_id: req.query.store_id, p_user_id: req.query.user_id });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data });
});

// ── Emergency codes (phase 4): a customer at a clinic they never linked shows a 72-hour code from the App ──
// POST /api/clinic-links/emergency { store_id, code } — open (and claim) a code; the first clinic to open it keeps it
router.post('/emergency', requireRole(...STAFF), async (req, res) => {
  const code = String(req.body.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  if (code.length !== 6) return res.status(400).json({ success: false, code: 'invalid_code', error: 'code required' });
  const { data, error } = await req.supabase.rpc('open_emergency_share', { p_store_id: req.body.store_id, p_code: code });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data });
});

// GET /api/clinic-links/emergency?store_id — emergency codes this clinic opened that are still valid
router.get('/emergency', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.from('emergency_shares')
    .select('id, pet_ids, claimed_at, expires_at').eq('store_id', req.query.store_id)
    .is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('claimed_at', { ascending: false }).limit(20);
  if (error) return fail(res, error);
  res.json({ success: true, data: data || [] });
});

// GET /api/clinic-links/emergency/:id?store_id — re-open one of those (still checked and logged in the database)
router.get('/emergency/:id', requireRole(...STAFF), async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ success: false, code: 'invalid', error: 'invalid id' });
  const { data, error } = await req.supabase.rpc('open_emergency_share', { p_store_id: req.query.store_id, p_share_id: req.params.id });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data });
});

// GET /api/clinic-links/billing?store_id — the clinic's FUFU package (phase 5). Invoices are for the owner only.
router.get('/billing', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.rpc('clinic_billing_status', { p_store_id: req.query.store_id });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: req.staffRole === 'owner' ? data : { ...data, invoices: undefined } });
});

// POST /api/clinic-links/billing/order { store_id, plan_id, cycle } — the owner picks a package; an invoice is issued
// at once with FUFU's payment details. FUFU confirms the transfer in Admin, which activates the package.
router.post('/billing/order', requireRole('owner'), async (req, res) => {
  const cycle = req.body.cycle === 'yearly' ? 'yearly' : 'monthly';
  if (!UUID.test(req.body.plan_id || '')) return res.status(400).json({ success: false, code: 'invalid', error: 'plan_id required' });
  const { data, error } = await req.supabase.rpc('clinic_order_plan', { p_store_id: req.body.store_id, p_plan_id: req.body.plan_id, p_cycle: cycle });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data });
});

export default router;
