import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Pet Owners ───────────────────────────────────────────────────────────────

// GET /api/pets/owners/search?q=phone_or_name
router.get('/owners/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  const { data, error } = await req.supabase
    .from('pet_owners')
    .select('*, pets(id, name, species, breed)')
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/pets/owners
router.post('/owners', async (req, res) => {
  const { name, phone, email, line_id, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const { data, error } = await req.supabase
    .from('pet_owners')
    .insert([{ name, phone, email, line_id, address, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/pets/owners/:id
router.patch('/owners/:id', async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;

  const { data, error } = await req.supabase
    .from('pet_owners')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Pets ─────────────────────────────────────────────────────────────────────

// GET /api/pets/:id — full profile with history
router.get('/:id', async (req, res) => {
  const { data: pet, error } = await req.supabase
    .from('pets')
    .select('*, pet_owners(*)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Pet not found' });

  // Fetch recent medical records
  const { data: records } = await req.supabase
    .from('medical_records')
    .select('id, visit_date, record_type, status, diagnosis, assessment, prescriptions, weight_kg')
    .eq('pet_id', req.params.id)
    .order('visit_date', { ascending: false })
    .limit(20);

  // Fetch vaccinations
  const { data: vaccinations } = await req.supabase
    .from('pet_vaccinations')
    .select('*')
    .eq('pet_id', req.params.id)
    .order('given_date', { ascending: false });

  // Fetch upcoming appointments
  const today = new Date().toISOString().split('T')[0];
  const { data: appointments } = await req.supabase
    .from('appointments')
    .select('*')
    .eq('pet_id', req.params.id)
    .gte('appt_date', today)
    .order('appt_date', { ascending: true })
    .limit(5);

  res.json({
    success: true,
    data: {
      ...pet,
      medical_records: records  || [],
      vaccinations:    vaccinations || [],
      appointments:    appointments || [],
    },
  });
});

// POST /api/pets
router.post('/', async (req, res) => {
  const { owner_id, name, species, breed, gender, dob, color, weight_kg, microchip_no, is_neutered, allergies, notes } = req.body;
  if (!name || !owner_id) return res.status(400).json({ error: 'name and owner_id required' });

  const { data, error } = await req.supabase
    .from('pets')
    .insert([{ owner_id, name, species, breed, gender, dob, color, weight_kg, microchip_no, is_neutered, allergies, notes }])
    .select('*, pet_owners(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/pets/:id
router.patch('/:id', async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;

  const { data, error } = await req.supabase
    .from('pets')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, pet_owners(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Vaccinations ─────────────────────────────────────────────────────────────

// POST /api/pets/vaccinations
router.post('/vaccinations', async (req, res) => {
  const { pet_id, store_id, vaccine_name, given_date, next_due_date, batch_no, vet_name, notes } = req.body;
  if (!pet_id || !vaccine_name) return res.status(400).json({ error: 'pet_id and vaccine_name required' });

  const { data, error } = await req.supabase
    .from('pet_vaccinations')
    .insert([{ pet_id, store_id, vaccine_name, given_date, next_due_date, batch_no, vet_name, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── Appointments ─────────────────────────────────────────────────────────────

// GET /api/pets/appointments?store_id=UUID&date=YYYY-MM-DD
router.get('/appointments/list', async (req, res) => {
  const { store_id, date, from, to } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('appointments')
    .select('*, pets(id, name, species, breed, pet_owners(name, phone))')
    .eq('store_id', store_id)
    .order('appt_date', { ascending: true })
    .order('appt_time', { ascending: true });

  if (date) query = query.eq('appt_date', date);
  if (from) query = query.gte('appt_date', from);
  if (to)   query = query.lte('appt_date', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/pets/appointments
router.post('/appointments', async (req, res) => {
  const { pet_id, store_id, appt_date, appt_time, service_type, notes } = req.body;
  if (!store_id || !appt_date) return res.status(400).json({ error: 'store_id and appt_date required' });

  const { data, error } = await req.supabase
    .from('appointments')
    .insert([{
      pet_id:       pet_id || null,
      store_id,
      appt_date,
      appt_time:    appt_time || null,
      service_type: service_type || 'ตรวจทั่วไป',
      notes:        notes || null,
      status:       'scheduled',
      created_by:   'staff',
    }])
    .select('*, pets(name, species, pet_owners(name, phone))')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/pets/appointments/:id
router.patch('/appointments/:id', async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;

  const { data, error } = await req.supabase
    .from('appointments')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// POST /api/pets/appointments/:id/checkin — convert appointment to queue entry
router.post('/appointments/:id/checkin', async (req, res) => {
  const { store_id } = req.body;

  const { data: appt, error: apptErr } = await req.supabase
    .from('appointments')
    .select('*, pets(name, pet_owners(name))')
    .eq('id', req.params.id)
    .single();

  if (apptErr) return res.status(404).json({ error: 'Appointment not found' });

  // Auto-increment queue number
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await req.supabase
    .from('queue_entries')
    .select('queue_number')
    .eq('store_id', store_id)
    .eq('queue_date', today)
    .order('queue_number', { ascending: false })
    .limit(1);

  const nextNum   = existing?.length ? existing[0].queue_number + 1 : 1;
  const petName   = appt.pets?.name || '';
  const ownerName = appt.pets?.pet_owners?.name || '';

  const { data: queueEntry, error: qErr } = await req.supabase
    .from('queue_entries')
    .insert([{
      store_id,
      queue_number:   nextNum,
      queue_date:     today,
      service_type:   appt.service_type,
      priority:       'normal',
      notes:          ownerName ? `${petName} - ${ownerName}` : petName,
      estimated_time: 20,
      status:         'waiting',
      source:         'appointment',
    }])
    .select()
    .single();

  if (qErr) return res.status(500).json({ error: qErr.message });

  // Link appointment to queue entry
  await req.supabase
    .from('appointments')
    .update({ status: 'arrived', queue_entry_id: queueEntry.id })
    .eq('id', req.params.id);

  res.json({ success: true, data: queueEntry });
});

export default router;
