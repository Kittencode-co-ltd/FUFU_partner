import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId, useStoreIdParam } from '../middleware/rbac.js';
import { finiteInRange, isDate, isHttpUrl, isPhone, isTime, isTimezone, isUuid } from '../utils/validation.js';

const router = Router();
router.use(requireAuth);
router.param('store_id', (req, _res, next, value) => {
  req.query.store_id = value;
  next();
});

const STORE_FIELDS = 'id,name,description,phone,email,address,province,district,website,logo_url,location_lat,location_lng,timezone,is_verified,is_active,accepting_appointments';

router.get('/:store_id', requireRole('owner', 'reception', 'vet'), async (req, res) => {
  const { data, error } = await req.supabase.from('stores').select(STORE_FIELDS).eq('id', req.params.store_id).single();
  if (error || !data) return res.status(404).json({ success: false, error: 'Clinic not found' });
  res.json({ success: true, data });
});

router.patch('/:id', useStoreIdParam('id'), requireRole('owner'), async (req, res) => {
  const allowed = ['name','description','phone','email','address','province','district','website','timezone','accepting_appointments'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (req.body.latitude !== undefined) updates.location_lat = req.body.latitude;
  if (req.body.longitude !== undefined) updates.location_lng = req.body.longitude;
  if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length < 2 || updates.name.length > 160)) return res.status(400).json({ error: 'Invalid clinic name' });
  if (!isPhone(updates.phone)) return res.status(400).json({ error: 'Invalid phone' });
  if (!isHttpUrl(updates.website)) return res.status(400).json({ error: 'Invalid website URL' });
  if (updates.timezone !== undefined && !isTimezone(updates.timezone)) return res.status(400).json({ error: 'Invalid timezone' });
  if (updates.location_lat !== undefined && !finiteInRange(updates.location_lat, -90, 90)) return res.status(400).json({ error: 'Invalid latitude' });
  if (updates.location_lng !== undefined && !finiteInRange(updates.location_lng, -180, 180)) return res.status(400).json({ error: 'Invalid longitude' });
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });
  const { data, error } = await req.supabase.from('stores').update(updates).eq('id', req.params.id).select(STORE_FIELDS).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

router.get('/:store_id/hours', requireRole('owner', 'reception', 'vet'), async (req, res) => {
  const { data, error } = await req.supabase.from('store_business_hours').select('*').eq('store_id', req.params.store_id).order('day_of_week');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.put('/:store_id/hours', requireRole('owner'), async (req, res) => {
  const hours = req.body?.hours;
  if (!Array.isArray(hours) || hours.length !== 7) return res.status(400).json({ error: 'hours must contain all 7 days' });
  const seen = new Set();
  const rows = [];
  for (const item of hours) {
    const day = Number(item.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) return res.status(400).json({ error: 'Invalid or duplicate day_of_week' });
    seen.add(day);
    const closed = Boolean(item.is_closed);
    if (!closed && (!isTime(item.opens_at) || !isTime(item.closes_at) || item.opens_at >= item.closes_at)) return res.status(400).json({ error: `Invalid hours for day ${day}` });
    rows.push({ store_id: req.params.store_id, day_of_week: day, opens_at: closed ? null : item.opens_at, closes_at: closed ? null : item.closes_at, is_closed: closed });
  }
  const { data, error } = await req.supabase.from('store_business_hours').upsert(rows).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

router.get('/:store_id/holidays', requireRole('owner', 'reception', 'vet'), async (req, res) => {
  const { data, error } = await req.supabase.from('store_holidays').select('*').eq('store_id', req.params.store_id).order('date');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/:store_id/holidays', requireRole('owner'), async (req, res) => {
  const { date, reason, is_closed = true, opens_at, closes_at } = req.body || {};
  if (!isDate(date) || (reason && String(reason).length > 200)) return res.status(400).json({ error: 'Invalid holiday' });
  if (!is_closed && (!isTime(opens_at) || !isTime(closes_at) || opens_at >= closes_at)) return res.status(400).json({ error: 'Invalid holiday hours' });
  const row = { store_id: req.params.store_id, date, reason: reason || null, is_closed: Boolean(is_closed), opens_at: is_closed ? null : opens_at, closes_at: is_closed ? null : closes_at };
  const { data, error } = await req.supabase.from('store_holidays').upsert(row, { onConflict: 'store_id,date' }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/holidays/:id', resolveStoreId('store_holidays'), requireRole('owner'), async (req, res) => {
  const { error } = await req.supabase.from('store_holidays').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

router.get('/:store_id/services', requireRole('owner', 'reception', 'vet'), async (req, res) => {
  const { data, error } = await req.supabase.from('store_services').select('*').eq('store_id', req.params.store_id).order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/:store_id/services', requireRole('owner'), async (req, res) => {
  const { name, description, duration_minutes, capacity_per_slot = 1, is_active = true } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120 || !Number.isInteger(Number(duration_minutes)) || !finiteInRange(duration_minutes, 5, 480) || !Number.isInteger(Number(capacity_per_slot)) || !finiteInRange(capacity_per_slot, 1, 50)) return res.status(400).json({ error: 'Invalid service' });
  const { data, error } = await req.supabase.from('store_services').insert({ store_id: req.params.store_id, name: name.trim(), description: description || null, duration_minutes: Number(duration_minutes), capacity_per_slot: Number(capacity_per_slot), is_active: Boolean(is_active) }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ success: true, data });
});

router.patch('/services/:id', resolveStoreId('store_services'), requireRole('owner'), async (req, res) => {
  const allowed = ['name','description','duration_minutes','capacity_per_slot','is_active'];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length < 2 || updates.name.length > 120)) return res.status(400).json({ error: 'Invalid service name' });
  if (updates.duration_minutes !== undefined && (!Number.isInteger(Number(updates.duration_minutes)) || !finiteInRange(updates.duration_minutes, 5, 480))) return res.status(400).json({ error: 'Invalid duration' });
  if (updates.capacity_per_slot !== undefined && (!Number.isInteger(Number(updates.capacity_per_slot)) || !finiteInRange(updates.capacity_per_slot, 1, 50))) return res.status(400).json({ error: 'Invalid capacity' });
  const { data, error } = await req.supabase.from('store_services').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/services/:id', resolveStoreId('store_services'), requireRole('owner'), async (req, res) => {
  const { data, error } = await req.supabase.from('store_services').update({ is_active: false }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

router.post('/:store_id/logo', requireRole('owner'), async (req, res) => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.data || '');
  if (!match) return res.status(400).json({ error: 'Logo must be a JPEG, PNG or WebP data URL' });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Logo must be 2 MB or smaller' });
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[match[1]];
  const path = `${req.user.id}/${req.params.store_id}/logo.${extension}`;
  const { error: uploadError } = await req.supabase.storage.from('clinic-logos').upload(path, bytes, { contentType: match[1], upsert: true });
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  const { data: publicData } = req.supabase.storage.from('clinic-logos').getPublicUrl(path);
  const { data, error } = await req.supabase.from('stores').update({ logo_url: publicData.publicUrl }).eq('id', req.params.store_id).select(STORE_FIELDS).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
