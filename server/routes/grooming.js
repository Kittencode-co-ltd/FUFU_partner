// Grooming: daily schedule (booked ahead or walk-in), work board and pet care notes.
// Status flow: booked → waiting (arrived) → in_progress → done → picked_up; booked can be cancelled / no_show.
import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const STAFF = ['owner', 'reception', 'vet'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bad = (res, error, code = 'invalid', status = 400) => res.status(status).json({ success: false, error, code });
const text = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : null) || null;
const money = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1e6 ? Math.round(n * 100) / 100 : null; };
const bkkDay = (d = new Date()) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const dayRange = day => [`${day}T00:00:00+07:00`, `${day}T23:59:59.999+07:00`];

function services(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 15).map(s => (typeof s === 'string' ? { name: text(s, 80), price: 0 } : { name: text(s?.name, 80), price: money(s?.price) ?? 0 })).filter(s => s.name);
}
function careProfile(v) {
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const k of ['coat', 'size', 'temperament', 'skin_notes', 'style', 'health_notes']) if (v[k] != null) out[k] = text(String(v[k]), 500);
  for (const k of ['muzzle', 'sensitive_skin', 'senior', 'matted', 'fleas_found']) if (v[k] != null) out[k] = Boolean(v[k]);
  return out;
}

/** Same App-booking sync as the hotel: customers see confirmed → checked in → completed. */
async function syncAppointment(req, appointmentId, to, reason = null) {
  if (!appointmentId) return null;
  const { data: appt } = await req.supabase.from('appointments').select('id,status').eq('id', appointmentId).maybeSingle();
  if (!appt) return null;
  const from = String(appt.status || '').toLowerCase().replace('pending', 'requested').replace('scheduled', 'confirmed');
  const steps = { confirmed: ['requested', 'reschedule_proposed'], checked_in: ['confirmed'], completed: ['confirmed', 'checked_in'], cancelled: ['requested', 'confirmed', 'checked_in', 'reschedule_proposed'], no_show: ['confirmed'] };
  const path = ['checked_in', 'completed'].includes(to) && ['requested', 'reschedule_proposed'].includes(from) ? ['confirmed', to] : [to];
  let current = from;
  for (const step of path) {
    if (!steps[step]?.includes(current)) continue;
    const { error } = await req.supabase.rpc('transition_appointment', {
      p_appointment_id: appointmentId, p_to_status: step, p_reason: reason, p_idempotency_key: `grooming:${appointmentId}:${step}`, p_proposed_starts_at: null,
    });
    if (error) return error.message;
    current = step;
  }
  return null;
}

// GET /api/grooming?store_id&date — the day's sessions (by booked time, or created time for walk-ins) + App bookings not yet on the board
router.get('/', requireRole(...STAFF), async (req, res) => {
  const day = DAY.test(req.query.date || '') ? req.query.date : bkkDay();
  const [from, to] = dayRange(day);
  const sid = req.query.store_id;
  const [booked, walkIns, requests] = await Promise.all([
    req.supabase.from('grooming_sessions').select('*').eq('store_id', sid).gte('scheduled_at', from).lte('scheduled_at', to),
    req.supabase.from('grooming_sessions').select('*').eq('store_id', sid).is('scheduled_at', null).gte('created_at', from).lte('created_at', to),
    req.supabase.from('appointments').select('id,pet_id,pet_name,user_id,starts_at,appt_date,appt_time,services,status,customer_notes,care_profile,pets(name,species,breed,weight_kg,allergies)')
      .eq('store_id', sid).eq('category', 'Grooming').eq('appt_date', day).in('status', ['requested', 'confirmed', 'Pending', 'Confirmed']).order('starts_at'),
  ]);
  if (booked.error) return bad(res, booked.error.message, 'failed', 500);
  const sessions = [...(booked.data || []), ...(walkIns.data || [])]
    .sort((a, b) => String(a.scheduled_at || a.created_at).localeCompare(String(b.scheduled_at || b.created_at)));
  const linked = new Set(sessions.map(s => s.appointment_id).filter(Boolean));
  res.json({ success: true, date: day, data: sessions, requests: (requests.data || []).filter(a => !linked.has(a.id)) });
});

// GET /api/grooming/:id
router.get('/:id', resolveStoreId('grooming_sessions'), requireRole(...STAFF), async (req, res) => {
  if (!UUID.test(req.params.id)) return bad(res, 'invalid id');
  const { data, error } = await req.supabase.from('grooming_sessions')
    .select('*, pets(id,name,species,breed,dob,age,gender,weight_kg,color,is_neutered,allergies,notes,avatar_url)').eq('id', req.params.id).single();
  if (error) return bad(res, 'Not found', 'not_found', 404);
  res.json({ success: true, data });
});

// POST /api/grooming — book ahead (scheduled_at) or walk-in (no time → waiting now)
router.post('/', requireRole(...STAFF), async (req, res) => {
  const b = req.body;
  let appt = null;
  if (b.appointment_id) {
    if (!UUID.test(b.appointment_id)) return bad(res, 'invalid appointment');
    const { data } = await req.supabase.from('appointments').select('id,store_id,category,status,pet_id,pet_name,starts_at,services').eq('id', b.appointment_id).maybeSingle();
    if (!data || data.store_id !== b.store_id || data.category !== 'Grooming') return bad(res, 'App booking not found', 'appointment_not_found', 404);
    if (!['requested', 'confirmed', 'pending', 'reschedule_proposed'].includes(String(data.status).toLowerCase())) return bad(res, 'App booking is no longer open', 'appointment_closed', 409);
    appt = data;
  }
  const petName = text(b.pet_name, 120) || appt?.pet_name;
  if (!petName) return bad(res, 'Pet name required', 'pet_required');
  let scheduled = b.scheduled_at || appt?.starts_at || null;
  if (scheduled && Number.isNaN(Date.parse(scheduled))) return bad(res, 'invalid time', 'invalid_time');
  const arrivedNow = Boolean(b.arrived_now) || !scheduled;
  const list = services(b.services?.length ? b.services : (appt?.services || []));
  const minutes = Math.min(600, Math.max(5, Number(b.estimated_minutes) || 60));

  const { data, error } = await req.supabase.from('grooming_sessions').insert([{
    store_id: b.store_id,
    pet_id: UUID.test(b.pet_id || '') ? b.pet_id : appt?.pet_id || null,
    appointment_id: appt?.id || null,
    pet_name: petName, owner_name: text(b.owner_name, 120), owner_phone: text(b.owner_phone, 30),
    species: ['dog', 'cat', 'rabbit', 'other'].includes(b.species) ? b.species : 'dog',
    services: list, total_amount: list.reduce((n, s) => n + (s.price || 0), 0),
    groomer_name: text(b.groomer_name, 80), estimated_minutes: minutes,
    scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
    care_profile: careProfile(b.care_profile), notes: text(b.notes, 2000),
    status: arrivedNow ? 'waiting' : 'booked', progress: 0,
  }]).select().single();
  if (error) return error.code === '23505' ? bad(res, 'This App booking is already on the board', 'already_assigned', 409) : bad(res, error.message, 'failed', 500);
  const syncError = await syncAppointment(req, appt?.id, arrivedNow ? 'checked_in' : 'confirmed');
  res.json({ success: true, data, appointment_sync_error: syncError });
});

// PATCH /api/grooming/:id — details (services, groomer, time, care notes, progress); never store_id / status
router.patch('/:id', resolveStoreId('grooming_sessions'), requireRole(...STAFF), async (req, res) => {
  const b = req.body;
  const patch = {};
  if (b.pet_name !== undefined) { const v = text(b.pet_name, 120); if (!v) return bad(res, 'Pet name required', 'pet_required'); patch.pet_name = v; }
  if (b.owner_name !== undefined) patch.owner_name = text(b.owner_name, 120);
  if (b.owner_phone !== undefined) patch.owner_phone = text(b.owner_phone, 30);
  if (b.groomer_name !== undefined) patch.groomer_name = text(b.groomer_name, 80);
  if (b.services !== undefined) { patch.services = services(b.services); patch.total_amount = patch.services.reduce((n, s) => n + (s.price || 0), 0); }
  if (b.estimated_minutes !== undefined) patch.estimated_minutes = Math.min(600, Math.max(5, Number(b.estimated_minutes) || 60));
  if (b.scheduled_at !== undefined) { if (b.scheduled_at && Number.isNaN(Date.parse(b.scheduled_at))) return bad(res, 'invalid time', 'invalid_time'); patch.scheduled_at = b.scheduled_at ? new Date(b.scheduled_at).toISOString() : null; }
  if (b.progress !== undefined) patch.progress = Math.min(100, Math.max(0, Math.round(Number(b.progress) || 0)));
  if (b.care_profile !== undefined) patch.care_profile = careProfile(b.care_profile);
  if (b.notes !== undefined || b.note !== undefined) patch.notes = text(b.notes ?? b.note, 2000);
  if (!Object.keys(patch).length) return bad(res, 'Nothing to update');
  const { data, error } = await req.supabase.from('grooming_sessions').update(patch).eq('id', req.params.id).select().single();
  if (error) return bad(res, error.message, 'failed', 500);
  res.json({ success: true, data });
});

const FLOW = {
  arrive: { from: ['booked'], to: 'waiting', appt: 'checked_in' },
  start: { from: ['waiting', 'booked'], to: 'in_progress', appt: 'checked_in' },
  complete: { from: ['in_progress'], to: 'done' },
  pickup: { from: ['done'], to: 'picked_up', appt: 'completed' },
  cancel: { from: ['booked', 'waiting'], to: 'cancelled', appt: 'cancelled' },
  'no-show': { from: ['booked'], to: 'no_show', appt: 'no_show' },
};

// PATCH /api/grooming/:id/:action — arrive | start | complete | pickup | cancel | no-show
for (const [action, step] of Object.entries(FLOW)) {
  router.patch(`/:id/${action}`, resolveStoreId('grooming_sessions'), requireRole(...STAFF), async (req, res) => {
    const { data: current } = await req.supabase.from('grooming_sessions').select('id,status,appointment_id').eq('id', req.params.id).maybeSingle();
    if (!current) return bad(res, 'Not found', 'not_found', 404);
    if (!step.from.includes(current.status)) return bad(res, 'This step is not possible now', 'invalid_transition', 409);
    const now = new Date().toISOString();
    const patch = { status: step.to };
    if (step.to === 'in_progress') Object.assign(patch, { start_time: now, progress: 10 });
    if (step.to === 'done') Object.assign(patch, { end_time: now, progress: 100, health_report: req.body?.health_report && typeof req.body.health_report === 'object' ? req.body.health_report : null });
    if (step.to === 'picked_up') patch.picked_up_at = now;
    if (step.to === 'cancelled') {
      const reason = text(req.body?.reason, 300);
      if (!reason || reason.length < 3) return bad(res, 'Reason required', 'reason_required');
      patch.cancelled_reason = reason;
    }
    const { data, error } = await req.supabase.from('grooming_sessions').update(patch).eq('id', current.id).eq('status', current.status).select().single();
    if (error || !data) return bad(res, 'Session changed, please reload', 'changed', 409);
    const syncError = step.appt ? await syncAppointment(req, current.appointment_id, step.appt, patch.cancelled_reason || null) : null;
    res.json({ success: true, data, appointment_sync_error: syncError });
  });
}

export default router;
