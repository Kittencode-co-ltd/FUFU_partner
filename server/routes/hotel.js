// Pet Hotel: rooms, availability, reservations (phone, walk-in and App requests), stays and care sheets.
// Every query uses the caller's Supabase client, so RLS keeps each store to its own rows.
// Reservations go through reserve_hotel_room() so two people can't book the same room for the same night.
import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const STAFF = ['owner', 'reception', 'vet'];
const ROOM_TYPES = new Set(['standard', 'deluxe', 'suite', 'cat', 'small', 'large', 'vip']);
const ROOM_STATUS = new Set(['available', 'occupied', 'cleaning', 'maintenance']);
const ACTIVE = ['reserved', 'checked_in'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_FIELDS = '*, hotel_rooms(id,room_number,room_type,max_pets,daily_rate)';

const bad = (res, error, code = 'invalid', status = 400) => res.status(status).json({ success: false, error, code });
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); // Bangkok date
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const text = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : null) || null;
const money = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1e7 ? Math.round(n * 100) / 100 : null; };

/** Only the documented keys of a care sheet are kept (no arbitrary JSON from the browser). */
function careProfile(v) {
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const k of ['medications', 'temperament', 'health_notes', 'vet_name', 'vet_phone', 'emergency_name', 'emergency_phone', 'diet', 'walks'])
    if (v[k] != null) out[k] = text(String(v[k]), 1000);
  for (const k of ['vaccines_checked', 'flea_tick_checked', 'neutered', 'can_share_room', 'photo_updates'])
    if (v[k] != null) out[k] = Boolean(v[k]);
  if (v.vaccine_expiry && DAY.test(v.vaccine_expiry)) out.vaccine_expiry = v.vaccine_expiry;
  return out;
}
function feeding(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 8).map(f => ({ time: text(f?.time, 10), food: text(f?.food, 200), amount: text(f?.amount, 60) })).filter(f => f.time || f.food);
}
function belongings(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).map(b => ({ item: text(b?.item, 120), qty: Math.min(99, Math.max(1, Number(b?.qty) || 1)) })).filter(b => b.item);
}

/** Maps reserve_hotel_room() errors to codes the UI can translate. */
function rpcError(res, error) {
  const hint = error?.hint || '';
  const map = { room_full: 409, room_not_found: 404, booking_not_found: 404, room_maintenance: 409, invalid_dates: 400, stay_too_long: 400, invalid_status: 400 };
  if (map[hint]) return res.status(map[hint]).json({ success: false, code: hint, error: error.message, date: error.details || null });
  if (error?.code === '23505') return bad(res, 'This App booking already has a room', 'already_assigned', 409);
  return bad(res, error?.message || 'Request failed', 'failed', 500);
}

/** Moves the linked App booking along (customer gets notified by transition_appointment). Never blocks the hotel action. */
async function syncAppointment(req, appointmentId, to, reason = null) {
  if (!appointmentId) return null;
  const { data: appt } = await req.supabase.from('appointments').select('id,status').eq('id', appointmentId).maybeSingle();
  if (!appt) return null;
  const from = String(appt.status || '').toLowerCase().replace('pending', 'requested').replace('scheduled', 'confirmed');
  const steps = { confirmed: ['requested', 'reschedule_proposed'], checked_in: ['confirmed'], completed: ['confirmed', 'checked_in'], cancelled: ['requested', 'confirmed', 'checked_in', 'reschedule_proposed'], no_show: ['confirmed'] };
  const path = to === 'checked_in' && ['requested', 'reschedule_proposed'].includes(from) ? ['confirmed', 'checked_in']
    : to === 'completed' && ['requested', 'reschedule_proposed'].includes(from) ? ['confirmed', 'completed'] : [to];
  let current = from;
  for (const step of path) {
    if (!steps[step]?.includes(current)) continue;
    const { error } = await req.supabase.rpc('transition_appointment', {
      p_appointment_id: appointmentId, p_to_status: step, p_reason: reason, p_idempotency_key: `hotel:${appointmentId}:${step}`, p_proposed_starts_at: null,
    });
    if (error) return error.message;
    current = step;
  }
  return null;
}

// ── Rooms ────────────────────────────────────────────────────────────────────

// GET /api/hotel/rooms?store_id — rooms with who is in them tonight
router.get('/rooms', requireRole(...STAFF), async (req, res) => {
  const { store_id } = req.query;
  const night = today();
  const [{ data: rooms, error }, { data: stays }] = await Promise.all([
    req.supabase.from('hotel_rooms').select('*').eq('store_id', store_id).order('room_number'),
    req.supabase.from('hotel_bookings').select('id,room_id,pet_name,species,owner_name,check_in_date,check_out_date,status')
      .eq('store_id', store_id).in('status', ACTIVE).lte('check_in_date', night).gt('check_out_date', night),
  ]);
  if (error) return bad(res, error.message, 'failed', 500);
  const byRoom = {};
  (stays || []).forEach(s => { (byRoom[s.room_id] ||= []).push(s); });
  res.json({ success: true, data: (rooms || []).map(r => ({ ...r, tonight: byRoom[r.id] || [] })) });
});

function roomInput(body, partial) {
  const out = {};
  if (!partial || body.room_number !== undefined) { const n = text(body.room_number, 20); if (!n) return { error: 'room_number required' }; out.room_number = n; }
  if (body.room_type !== undefined) { if (!ROOM_TYPES.has(body.room_type)) return { error: 'invalid room_type' }; out.room_type = body.room_type; }
  if (body.max_pets !== undefined) { const n = Number(body.max_pets); if (!Number.isInteger(n) || n < 1 || n > 20) return { error: 'max_pets 1-20' }; out.max_pets = n; }
  if (body.daily_rate !== undefined) { const n = money(body.daily_rate); if (n === null) return { error: 'invalid daily_rate' }; out.daily_rate = n; }
  if (body.floor !== undefined) { const n = Number(body.floor); if (!Number.isInteger(n) || n < -5 || n > 200) return { error: 'invalid floor' }; out.floor = n; }
  if (body.amenities !== undefined) out.amenities = Array.isArray(body.amenities) ? body.amenities.slice(0, 12).map(a => text(String(a), 40)).filter(Boolean) : [];
  return { value: out };
}

// POST /api/hotel/rooms — owner adds a room
router.post('/rooms', requireRole('owner'), async (req, res) => {
  const { value, error } = roomInput(req.body, false);
  if (error) return bad(res, error);
  const { data, error: dbError } = await req.supabase.from('hotel_rooms')
    .insert([{ room_type: 'standard', max_pets: 1, daily_rate: 0, floor: 1, ...value, store_id: req.body.store_id, status: 'available' }]).select().single();
  if (dbError) return dbError.code === '23505' ? bad(res, 'Room number already exists', 'duplicate_room', 409) : bad(res, dbError.message, 'failed', 500);
  res.json({ success: true, data });
});

// PATCH /api/hotel/rooms/:id — owner edits details; any staff can change status (cleaning → available, maintenance)
router.patch('/rooms/:id', resolveStoreId('hotel_rooms'), requireRole(...STAFF), async (req, res) => {
  const details = Object.keys(req.body).some(k => ['room_number', 'room_type', 'max_pets', 'daily_rate', 'floor', 'amenities'].includes(k));
  if (details && req.staffRole !== 'owner') return bad(res, 'Only the owner can edit room details', 'forbidden', 403);
  const { value, error } = roomInput(req.body, true);
  if (error) return bad(res, error);
  if (req.body.status !== undefined) {
    if (!ROOM_STATUS.has(req.body.status) || req.body.status === 'occupied') return bad(res, 'invalid status');
    value.status = req.body.status;
  }
  if (!Object.keys(value).length) return bad(res, 'Nothing to update');
  const { data, error: dbError } = await req.supabase.from('hotel_rooms').update(value).eq('id', req.params.id).select().single();
  if (dbError) return dbError.code === '23505' ? bad(res, 'Room number already exists', 'duplicate_room', 409) : bad(res, dbError.message, 'failed', 500);
  res.json({ success: true, data });
});

// DELETE /api/hotel/rooms/:id — only when no stay is booked in it
router.delete('/rooms/:id', resolveStoreId('hotel_rooms'), requireRole('owner'), async (req, res) => {
  const { count } = await req.supabase.from('hotel_bookings').select('id', { count: 'exact', head: true }).eq('room_id', req.params.id).in('status', ACTIVE);
  if (count) return bad(res, 'Room has active bookings', 'room_in_use', 409);
  const { error } = await req.supabase.from('hotel_rooms').delete().eq('id', req.params.id);
  if (error) return bad(res, error.message, 'failed', 500);
  res.json({ success: true });
});

// ── Availability ─────────────────────────────────────────────────────────────

// GET /api/hotel/availability?store_id&from&to — every room with the stays that overlap the range
router.get('/availability', requireRole(...STAFF), async (req, res) => {
  const from = DAY.test(req.query.from || '') ? req.query.from : today();
  let to = DAY.test(req.query.to || '') ? req.query.to : addDays(from, 13);
  if (to < from) to = from;
  if (addDays(from, 62) < to) to = addDays(from, 62);
  const [{ data: rooms, error }, { data: stays }] = await Promise.all([
    req.supabase.from('hotel_rooms').select('id,room_number,room_type,max_pets,daily_rate,status').eq('store_id', req.query.store_id).order('room_number'),
    // overlap: stay starts on/before the last day AND ends after the first day
    req.supabase.from('hotel_bookings').select('id,room_id,pet_name,species,owner_name,check_in_date,check_out_date,status')
      .eq('store_id', req.query.store_id).in('status', ACTIVE).lte('check_in_date', to).gt('check_out_date', from),
  ]);
  if (error) return bad(res, error.message, 'failed', 500);
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const byRoom = {};
  (stays || []).forEach(s => { (byRoom[s.room_id] ||= []).push(s); });
  res.json({ success: true, from, to, dates, data: (rooms || []).map(r => ({ ...r, bookings: byRoom[r.id] || [] })) });
});

// GET /api/hotel/free-rooms?store_id&from&to — rooms that still have space every night of a stay
router.get('/free-rooms', requireRole(...STAFF), async (req, res) => {
  const { from, to } = req.query;
  if (!DAY.test(from || '') || !DAY.test(to || '') || to <= from) return bad(res, 'valid from/to required', 'invalid_dates');
  const [{ data: rooms, error }, { data: stays }] = await Promise.all([
    req.supabase.from('hotel_rooms').select('*').eq('store_id', req.query.store_id).neq('status', 'maintenance').order('room_number'),
    req.supabase.from('hotel_bookings').select('id,room_id,check_in_date,check_out_date')
      .eq('store_id', req.query.store_id).in('status', ACTIVE).lt('check_in_date', to).gt('check_out_date', from),
  ]);
  if (error) return bad(res, error.message, 'failed', 500);
  const exclude = UUID.test(req.query.exclude || '') ? req.query.exclude : null;
  const free = (rooms || []).filter(r => {
    for (let d = from; d < to; d = addDays(d, 1)) {
      const taken = (stays || []).filter(s => s.room_id === r.id && s.id !== exclude && s.check_in_date <= d && s.check_out_date > d).length;
      if (taken >= r.max_pets) return false;
    }
    return true;
  });
  res.json({ success: true, data: free });
});

// ── Today / overview ─────────────────────────────────────────────────────────

// GET /api/hotel/overview?store_id&date — arrivals, departures, in-house, App requests without a room
router.get('/overview', requireRole(...STAFF), async (req, res) => {
  const day = DAY.test(req.query.date || '') ? req.query.date : today();
  const sid = req.query.store_id;
  const [rooms, active, requests] = await Promise.all([
    req.supabase.from('hotel_rooms').select('id,status,max_pets').eq('store_id', sid),
    req.supabase.from('hotel_bookings').select(BOOKING_FIELDS).eq('store_id', sid).in('status', ACTIVE).lte('check_in_date', addDays(day, 1)).order('check_in_date'),
    req.supabase.from('appointments').select('id,pet_id,pet_name,user_id,check_in_date,check_out_date,status,customer_notes,created_at,pets(name,species,breed)')
      .eq('store_id', sid).eq('category', 'Hotel').in('status', ['requested', 'confirmed', 'Pending', 'Confirmed']).gte('check_out_date', day).order('check_in_date').limit(50),
  ]);
  if (rooms.error) return bad(res, rooms.error.message, 'failed', 500);
  const stays = active.data || [];
  const linked = new Set(stays.map(s => s.appointment_id).filter(Boolean));
  const capacity = (rooms.data || []).filter(r => r.status !== 'maintenance').reduce((n, r) => n + (r.max_pets || 1), 0);
  const inHouse = stays.filter(s => s.status === 'checked_in');
  res.json({
    success: true, date: day,
    stats: {
      rooms: (rooms.data || []).length, capacity,
      in_house: inHouse.length,
      tonight: stays.filter(s => s.check_in_date <= day && s.check_out_date > day).length,
      cleaning: (rooms.data || []).filter(r => r.status === 'cleaning').length,
    },
    arrivals: stays.filter(s => s.status === 'reserved' && s.check_in_date <= day),
    departures: inHouse.filter(s => s.check_out_date <= day),
    in_house: inHouse,
    upcoming: stays.filter(s => s.status === 'reserved' && s.check_in_date > day),
    requests: (requests.data || []).filter(a => !linked.has(a.id)),
  });
});

// ── Bookings ─────────────────────────────────────────────────────────────────

// GET /api/hotel/bookings?store_id&status&from&to&q
router.get('/bookings', requireRole(...STAFF), async (req, res) => {
  let q = req.supabase.from('hotel_bookings').select(BOOKING_FIELDS).eq('store_id', req.query.store_id)
    .order('check_in_date', { ascending: false }).limit(100);
  if (req.query.status) q = q.in('status', String(req.query.status).split(',').slice(0, 5));
  if (DAY.test(req.query.from || '')) q = q.gte('check_out_date', req.query.from);
  if (DAY.test(req.query.to || '')) q = q.lte('check_in_date', req.query.to);
  const term = String(req.query.q || '').replace(/[^\p{L}\p{N}\s@._+-]/gu, ' ').trim().slice(0, 60);
  if (term) q = q.or(`pet_name.ilike.%${term}%,owner_name.ilike.%${term}%,owner_phone.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) return bad(res, error.message, 'failed', 500);
  res.json({ success: true, data: data || [] });
});

// GET /api/hotel/bookings/:id
router.get('/bookings/:id', resolveStoreId('hotel_bookings'), requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.from('hotel_bookings').select(`${BOOKING_FIELDS}, pets(id,name,species,breed,dob,age,gender,weight_kg,color,is_neutered,allergies,notes,avatar_url,microchip_no)`)
    .eq('id', req.params.id).single();
  if (error) return bad(res, 'Booking not found', 'booking_not_found', 404);
  res.json({ success: true, data });
});

// POST /api/hotel/bookings — reserve (phone / App request) or walk-in (check_in_now)
router.post('/bookings', requireRole(...STAFF), async (req, res) => {
  const b = req.body;
  if (!UUID.test(b.room_id || '')) return bad(res, 'Choose a room', 'room_required');
  if (!DAY.test(b.check_in_date || '') || !DAY.test(b.check_out_date || '')) return bad(res, 'Dates required', 'invalid_dates');
  const walkIn = Boolean(b.check_in_now);
  if (walkIn && b.check_in_date !== today()) return bad(res, 'Walk-in check-in must start today', 'invalid_dates');

  let appt = null;
  if (b.appointment_id) {
    if (!UUID.test(b.appointment_id)) return bad(res, 'invalid appointment');
    const { data } = await req.supabase.from('appointments').select('id,store_id,category,status,pet_id,pet_name,user_id').eq('id', b.appointment_id).maybeSingle();
    if (!data || data.store_id !== b.store_id || data.category !== 'Hotel') return bad(res, 'App booking not found', 'appointment_not_found', 404);
    if (!['requested', 'confirmed', 'pending', 'reschedule_proposed'].includes(String(data.status).toLowerCase())) return bad(res, 'App booking is no longer open', 'appointment_closed', 409);
    appt = data;
  }
  const petName = text(b.pet_name, 120) || appt?.pet_name;
  if (!petName) return bad(res, 'Pet name required', 'pet_required');

  const details = {
    status: walkIn ? 'checked_in' : 'reserved',
    pet_id: UUID.test(b.pet_id || '') ? b.pet_id : appt?.pet_id || null,
    customer_id: null,
    appointment_id: appt?.id || null,
    pet_name: petName, owner_name: text(b.owner_name, 120), owner_phone: text(b.owner_phone, 30),
    species: ['dog', 'cat', 'rabbit', 'bird', 'other'].includes(b.species) ? b.species : 'dog',
    deposit_amount: money(b.deposit_amount) ?? 0,
    feeding_schedule: feeding(b.feeding_schedule), belongings_log: belongings(b.belongings_log),
    special_instructions: text(b.special_instructions, 2000), notes: text(b.notes, 2000),
    care_profile: careProfile(b.care_profile),
    add_on_services: Array.isArray(b.add_on_services) ? b.add_on_services.slice(0, 20).map(a => ({ name: text(a?.name, 80), price: money(a?.price) ?? 0, per: a?.per === 'stay' ? 'stay' : 'night' })).filter(a => a.name) : [],
  };
  const { data, error } = await req.supabase.rpc('reserve_hotel_room', {
    p_store_id: b.store_id, p_room_id: b.room_id, p_check_in: b.check_in_date, p_check_out: b.check_out_date, p_details: details, p_booking_id: null,
  });
  if (error) return rpcError(res, error);
  const syncError = await syncAppointment(req, appt?.id, walkIn ? 'checked_in' : 'confirmed');
  res.json({ success: true, data, appointment_sync_error: syncError });
});

// PATCH /api/hotel/bookings/:id — edit stay details, or move room / dates (re-checked for space)
router.patch('/bookings/:id', resolveStoreId('hotel_bookings'), requireRole(...STAFF), async (req, res) => {
  const b = req.body;
  const { data: current, error: findError } = await req.supabase.from('hotel_bookings').select('*').eq('id', req.params.id).single();
  if (findError || !current) return bad(res, 'Booking not found', 'booking_not_found', 404);
  if (!ACTIVE.includes(current.status) && (b.room_id || b.check_in_date || b.check_out_date)) return bad(res, 'Closed bookings cannot be moved', 'booking_closed', 409);

  const moving = (b.room_id && b.room_id !== current.room_id) || (b.check_in_date && b.check_in_date !== current.check_in_date) || (b.check_out_date && b.check_out_date !== current.check_out_date);
  if (moving) {
    const checkIn = current.status === 'checked_in' ? current.check_in_date : (b.check_in_date || current.check_in_date);
    const { error } = await req.supabase.rpc('reserve_hotel_room', {
      p_store_id: current.store_id, p_room_id: b.room_id || current.room_id, p_check_in: checkIn, p_check_out: b.check_out_date || current.check_out_date, p_details: {}, p_booking_id: current.id,
    });
    if (error) return rpcError(res, error);
    if (current.status === 'checked_in' && b.room_id && b.room_id !== current.room_id) {
      await req.supabase.from('hotel_rooms').update({ status: 'cleaning' }).eq('id', current.room_id);
      await req.supabase.from('hotel_rooms').update({ status: 'occupied' }).eq('id', b.room_id);
    }
  }

  const patch = {};
  if (b.pet_name !== undefined) { const v = text(b.pet_name, 120); if (!v) return bad(res, 'Pet name required', 'pet_required'); patch.pet_name = v; }
  if (b.owner_name !== undefined) patch.owner_name = text(b.owner_name, 120);
  if (b.owner_phone !== undefined) patch.owner_phone = text(b.owner_phone, 30);
  if (b.species !== undefined && ['dog', 'cat', 'rabbit', 'bird', 'other'].includes(b.species)) patch.species = b.species;
  if (b.deposit_amount !== undefined) { const v = money(b.deposit_amount); if (v === null) return bad(res, 'invalid deposit'); patch.deposit_amount = v; }
  if (b.special_instructions !== undefined) patch.special_instructions = text(b.special_instructions, 2000);
  if (b.notes !== undefined) patch.notes = text(b.notes, 2000);
  if (b.care_profile !== undefined) patch.care_profile = careProfile(b.care_profile);
  if (b.feeding_schedule !== undefined) patch.feeding_schedule = feeding(b.feeding_schedule);
  if (b.belongings_log !== undefined) patch.belongings_log = belongings(b.belongings_log);
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    const { error } = await req.supabase.from('hotel_bookings').update(patch).eq('id', req.params.id);
    if (error) return bad(res, error.message, 'failed', 500);
  }
  const { data } = await req.supabase.from('hotel_bookings').select(BOOKING_FIELDS).eq('id', req.params.id).single();
  res.json({ success: true, data });
});

// POST /api/hotel/bookings/:id/notes — daily care log ("ate well 08:00", "walked 20 min")
router.post('/bookings/:id/notes', resolveStoreId('hotel_bookings'), requireRole(...STAFF), async (req, res) => {
  const note = text(req.body.note, 500);
  if (!note) return bad(res, 'Note required', 'note_required');
  const { data: current } = await req.supabase.from('hotel_bookings').select('daily_notes,status').eq('id', req.params.id).single();
  if (!current) return bad(res, 'Booking not found', 'booking_not_found', 404);
  const stamp = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const daily_notes = [...(current.daily_notes || []), `${stamp} · ${note}`].slice(-200);
  const { data, error } = await req.supabase.from('hotel_bookings').update({ daily_notes, updated_at: new Date().toISOString() }).eq('id', req.params.id).select(BOOKING_FIELDS).single();
  if (error) return bad(res, error.message, 'failed', 500);
  res.json({ success: true, data });
});

async function changeStatus(req, res, to, extra = {}) {
  const { data: current } = await req.supabase.from('hotel_bookings').select('*').eq('id', req.params.id).single();
  if (!current) return bad(res, 'Booking not found', 'booking_not_found', 404);
  const allowed = { checked_in: ['reserved'], checked_out: ['checked_in'], cancelled: ['reserved'], no_show: ['reserved'] };
  if (!allowed[to].includes(current.status)) return bad(res, 'This step is not possible now', 'invalid_transition', 409);
  if (to === 'checked_in' && current.check_in_date > today()) return bad(res, 'Check-in date has not arrived yet', 'too_early', 409);

  const now = new Date().toISOString();
  const patch = { status: to, updated_at: now, ...extra };
  if (to === 'checked_in') patch.actual_checkin_at = now;
  if (to === 'checked_out') patch.actual_checkout_at = now;
  const { data, error } = await req.supabase.from('hotel_bookings').update(patch).eq('id', current.id).eq('status', current.status).select(BOOKING_FIELDS).single();
  if (error || !data) return bad(res, 'Booking changed, please reload', 'changed', 409);

  if (to === 'checked_in') await req.supabase.from('hotel_rooms').update({ status: 'occupied' }).eq('id', current.room_id);
  if (to === 'checked_out') {
    const { count } = await req.supabase.from('hotel_bookings').select('id', { count: 'exact', head: true }).eq('room_id', current.room_id).eq('status', 'checked_in');
    if (!count) await req.supabase.from('hotel_rooms').update({ status: 'cleaning' }).eq('id', current.room_id);
  }
  const apptStep = { checked_in: 'checked_in', checked_out: 'completed', cancelled: 'cancelled', no_show: 'no_show' }[to];
  const syncError = await syncAppointment(req, current.appointment_id, apptStep, extra.cancelled_reason || null);
  return res.json({ success: true, data, appointment_sync_error: syncError });
}

router.post('/bookings/:id/checkin', resolveStoreId('hotel_bookings'), requireRole(...STAFF), (req, res) => changeStatus(req, res, 'checked_in'));
router.post('/bookings/:id/checkout', resolveStoreId('hotel_bookings'), requireRole(...STAFF), (req, res) => changeStatus(req, res, 'checked_out'));
router.post('/bookings/:id/no-show', resolveStoreId('hotel_bookings'), requireRole(...STAFF), (req, res) => changeStatus(req, res, 'no_show'));
router.post('/bookings/:id/cancel', resolveStoreId('hotel_bookings'), requireRole(...STAFF), (req, res) => {
  const reason = text(req.body.reason, 300);
  if (!reason || reason.length < 3) return bad(res, 'Reason required', 'reason_required');
  return changeStatus(req, res, 'cancelled', { cancelled_reason: reason });
});

export default router;
