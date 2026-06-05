import { Router }      from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
import { insertWithSeqRetry } from '../utils/seq-retry.js';

const router = Router();
router.use(requireAuth);

// Service-role client for reading cross-store appointment data (bypasses RLS)
const adminSb = createClient(
  process.env.Project_URL,
  process.env.service_role_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Map store category → appointment category values from mobile app
const STORE_TO_APPT_CAT = {
  vet_clinic:   ['Vet', 'vet', 'VET'],
  vet_hospital: ['Vet', 'vet', 'VET'],
  pet_grooming: ['Grooming', 'grooming', 'GROOMING'],
  pet_hotel:    ['Hotel', 'hotel', 'HOTEL'],
  pet_shop:     ['Shop', 'shop', 'SHOP', 'Retail'],
};

// ─── GET /api/appointments/inbox?store_id=UUID ────────────────────────────────
// การจองที่รอการยืนยันจากแอปลูกค้า
router.get('/inbox', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { store_id, days_ahead = 7 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  // Get store category — use adminSb to bypass RLS (stores table may have no policies)
  const { data: store, error: storeErr } = await adminSb
    .from('stores').select('category').eq('id', store_id).single();
  if (storeErr || !store) return res.status(404).json({ error: 'Store not found' });

  const apptCategories = STORE_TO_APPT_CAT[store.category] || [];
  if (!apptCategories.length) return res.json({ success: true, data: [], store_category: store.category });

  const today   = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + parseInt(days_ahead) * 86400000).toISOString().split('T')[0];

  // Find pending appointments: store's OR unassigned (store_id IS NULL) + matching category
  // Use adminSb to bypass RLS (partner needs to see null-store_id appointments from mobile app)
  const { data, error } = await adminSb
    .from('appointments')
    .select('*')
    .in('category', apptCategories)
    .eq('status', 'Pending')
    .gte('appt_date', today)
    .lte('appt_date', maxDate)
    .or(`store_id.eq.${store_id},store_id.is.null`)
    .order('appt_date', { ascending: true })
    .order('appt_time_slot', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [], store_category: store.category });
});

// ─── PATCH /api/appointments/:id/confirm ─────────────────────────────────────
// ยืนยันการจอง → สร้าง queue_entry + อัปเดต appointment
router.patch('/:id/confirm', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { store_id, notes } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  // Get appointment (use adminSb — may have null store_id from mobile app)
  const { data: appt, error: apptErr } = await adminSb
    .from('appointments').select('*').eq('id', req.params.id).single();
  if (apptErr || !appt) return res.status(404).json({ error: 'Appointment not found' });

  // Guard: already confirmed — return existing queue entry
  if (appt.status === 'Confirmed' && appt.queue_entry_id) {
    const { data: existingQ } = await adminSb
      .from('queue_entries').select('*').eq('id', appt.queue_entry_id).single();
    return res.json({ success: true, data: { appointment: appt, queue_entry: existingQ } });
  }

  // Guard: queue entry already exists for this appointment (orphaned from failed update)
  const { data: orphanQ } = await adminSb
    .from('queue_entries').select('*').eq('appointment_id', appt.id).maybeSingle();
  if (orphanQ) {
    // Just update the appointment status to link it properly
    await adminSb.from('appointments').update({
      status: 'Confirmed', store_id, queue_entry_id: orphanQ.id,
    }).eq('id', req.params.id);
    return res.json({ success: true, data: { appointment: appt, queue_entry: orphanQ } });
  }

  // Auto-assign queue number for the appointment date. Guarded by the UNIQUE
  // (store_id, queue_date, queue_number) constraint + retry on concurrent dupes.
  const queueDate = appt.appt_date;
  const entryNotes = notes || appt.pet_name;

  const { data: qEntry, error: qErr } = await insertWithSeqRetry(async () => {
    const { data: existing } = await req.supabase
      .from('queue_entries')
      .select('queue_number')
      .eq('store_id', store_id)
      .eq('queue_date', queueDate)
      .order('queue_number', { ascending: false })
      .limit(1);
    const nextNum = ((existing?.[0]?.queue_number) || 0) + 1;

    return req.supabase
      .from('queue_entries')
      .insert([{
        store_id,
        appointment_id: appt.id,
        queue_number:   nextNum,
        queue_date:     queueDate,
        service_type:   (appt.services || [])[0] || appt.category,
        priority:       'normal',
        source:         'app_booking',
        status:         'waiting',
        notes:          entryNotes,
      }])
      .select().single();
  });

  if (qErr) return res.status(500).json({ error: qErr.message });

  // Update appointment
  const { error: updErr } = await adminSb
    .from('appointments')
    .update({
      status:         'Confirmed',
      store_id,
      queue_entry_id: qEntry.id,
    })
    .eq('id', req.params.id);

  if (updErr) return res.status(500).json({ error: updErr.message });

  res.json({ success: true, data: { appointment: appt, queue_entry: qEntry } });
});

// ─── PATCH /api/appointments/:id/reject ──────────────────────────────────────
router.patch('/:id/reject', resolveStoreId('appointments'), requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { reason } = req.body;

  const { error } = await adminSb
    .from('appointments')
    .update({ status: 'rejected', reject_reason: reason || null })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── GET /api/appointments/count?store_id=UUID ────────────────────────────────
// จำนวน pending สำหรับแสดง badge
router.get('/count', requireRole('owner', 'vet', 'reception', 'staff', 'counter'), async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data: store } = await req.supabase
    .from('stores').select('category').eq('id', store_id).single();

  const apptCategories = STORE_TO_APPT_CAT[store?.category] || [];
  if (!apptCategories.length) return res.json({ success: true, count: 0 });

  const today = new Date().toISOString().split('T')[0];
  const { count, error } = await adminSb
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .in('category', apptCategories)
    .eq('status', 'Pending')
    .gte('appt_date', today)
    .or(`store_id.eq.${store_id},store_id.is.null`);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: count || 0 });
});

export default router;
