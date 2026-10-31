import { createHash } from 'node:crypto';
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { isDate, isTimezone, isUuid, minutes, timeFromMinutes, zonedLocalToUtc } from '../utils/validation.js';

const router = Router();
const supabase = createClient(process.env.Project_URL, process.env.publishable_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cacheJson(req, res, payload, maxAge = 60) {
  const body = JSON.stringify(payload);
  const etag = `"${createHash('sha256').update(body).digest('base64url')}"`;
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.set({ ETag: etag, 'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=300` });
  res.type('json').send(body);
}

router.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid clinic id' });
  const [storeResult, hoursResult, holidayResult, serviceResult] = await Promise.all([
    supabase.from('stores').select('id,name,description,phone,email,address,province,district,website,logo_url,location_lat,location_lng,timezone,is_verified,accepting_appointments').eq('id', req.params.id).eq('is_active', true).eq('is_verified', true).single(),
    supabase.from('store_business_hours').select('day_of_week,opens_at,closes_at,is_closed').eq('store_id', req.params.id).order('day_of_week'),
    supabase.from('store_holidays').select('date,reason,is_closed,opens_at,closes_at').eq('store_id', req.params.id).gte('date', new Date().toISOString().slice(0, 10)).order('date').limit(90),
    supabase.from('store_services').select('id,name,description,duration_minutes,capacity_per_slot').eq('store_id', req.params.id).eq('is_active', true).order('name'),
  ]);
  if (storeResult.error || !storeResult.data) return res.status(404).json({ error: 'Clinic not found' });
  const store = storeResult.data;
  cacheJson(req, res, { success: true, data: {
    ...store,
    latitude: store.location_lat,
    longitude: store.location_lng,
    location_lat: undefined,
    location_lng: undefined,
    business_hours: hoursResult.data || [],
    holidays: holidayResult.data || [],
    services: serviceResult.data || [],
  } });
});

router.get('/:id/available-slots', async (req, res) => {
  const { date, service_id } = req.query;
  if (!isUuid(req.params.id) || !isDate(date) || !isUuid(service_id)) return res.status(400).json({ error: 'Valid clinic id, date and service_id are required' });
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const [storeResult, serviceResult, hoursResult, holidayResult, appointmentsResult] = await Promise.all([
    supabase.from('stores').select('id,timezone,accepting_appointments').eq('id', req.params.id).eq('is_active', true).eq('is_verified', true).single(),
    supabase.from('store_services').select('id,duration_minutes,capacity_per_slot').eq('id', service_id).eq('store_id', req.params.id).eq('is_active', true).single(),
    supabase.from('store_business_hours').select('opens_at,closes_at,is_closed').eq('store_id', req.params.id).eq('day_of_week', dayOfWeek).maybeSingle(),
    supabase.from('store_holidays').select('opens_at,closes_at,is_closed').eq('store_id', req.params.id).eq('date', date).maybeSingle(),
    supabase.rpc('public_slot_booking_counts', { p_store_id: req.params.id, p_service_id: service_id, p_date: date }),
  ]);
  const store = storeResult.data;
  const service = serviceResult.data;
  if (!store || !service) return res.status(404).json({ error: 'Clinic or service not found' });
  if (!isTimezone(store.timezone)) return res.status(500).json({ error: 'Clinic timezone is invalid' });
  if (!store.accepting_appointments) return cacheJson(req, res, { success: true, data: [], accepting_appointments: false }, 15);
  const schedule = holidayResult.data || hoursResult.data;
  if (!schedule || schedule.is_closed || !schedule.opens_at || !schedule.closes_at) return cacheJson(req, res, { success: true, data: [] }, 30);
  const counts = new Map();
  for (const appointment of appointmentsResult.data || []) counts.set(appointment.appt_time_slot.slice(0, 5), Number(appointment.booking_count));
  const slots = [];
  for (let cursor = minutes(schedule.opens_at.slice(0, 5)); cursor + service.duration_minutes <= minutes(schedule.closes_at.slice(0, 5)); cursor += service.duration_minutes) {
    const time = timeFromMinutes(cursor);
    const booked = counts.get(time) || 0;
    if (booked < service.capacity_per_slot) slots.push({
      date, time, timezone: store.timezone,
      starts_at: zonedLocalToUtc(date, time, store.timezone),
      remaining_capacity: service.capacity_per_slot - booked,
    });
  }
  cacheJson(req, res, { success: true, data: slots }, 15);
});

export default router;
