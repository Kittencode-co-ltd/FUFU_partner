import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
import { insertWithSeqRetry } from '../utils/seq-retry.js';
// Note: GET /:id uses resolveStoreId to enforce store-scoped access

const router = Router();
router.use(requireAuth);

// ─── Pet Owners ───────────────────────────────────────────────────────────────

// GET /api/pets/owners/search?q=phone_or_name&store_id=UUID
// q is optional — omit or send empty to list recent owners
// searches owner name/phone/email AND pet name/HN
router.get('/owners/search', async (req, res) => {
  const { q, store_id } = req.query;

  const petSelect = store_id
    ? `id, name, species, breed, hn, created_at, allergies, store_id`
    : `id, name, species, breed, hn, created_at, allergies`;

  let ownerQuery = req.supabase
    .from('pet_owners')
    .select(`*, pets(${petSelect})`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (q && q.length >= 2) {
    ownerQuery = ownerQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await ownerQuery;
  if (error) return res.status(500).json({ error: error.message });

  let owners = data || [];

  // Also search by pet name / HN — use separate queries to avoid .or() string-parsing issues
  if (q && q.length >= 2) {
    const petOwnerIds = new Set();

    // Search by pet name
    let petNameQ = req.supabase.from('pets').select('owner_id').ilike('name', `%${q}%`).limit(20);
    if (store_id) petNameQ = petNameQ.eq('store_id', store_id);
    const { data: byName } = await petNameQ;
    (byName || []).forEach(p => p.owner_id && petOwnerIds.add(p.owner_id));

    // Search by HN. Accepts the year-prefixed form ("HN-2025-000042"), the
    // legacy form ("HN-00042"), or a bare number. The stored `hn` is only the
    // sequence, so when an "HN" prefix is present we take the LAST digit group
    // (skipping the year); otherwise a pure-number query is used directly.
    let hnNum = NaN;
    if (/hn/i.test(q)) {
      const groups = q.match(/\d+/g);
      if (groups) hnNum = parseInt(groups[groups.length - 1], 10);
    } else if (/^\s*\d+\s*$/.test(q)) {
      hnNum = parseInt(q.trim(), 10);
    }
    if (!isNaN(hnNum) && hnNum > 0) {
      let petHNQ = req.supabase.from('pets').select('owner_id').eq('hn', hnNum).limit(5);
      if (store_id) petHNQ = petHNQ.eq('store_id', store_id);
      const { data: byHN } = await petHNQ;
      (byHN || []).forEach(p => p.owner_id && petOwnerIds.add(p.owner_id));
    }

    const extraOwnerIds = [...petOwnerIds].filter(id => !owners.some(o => o.id === id));
    if (extraOwnerIds.length) {
      const { data: extraOwners } = await req.supabase
        .from('pet_owners')
        .select(`*, pets(${petSelect})`)
        .in('id', extraOwnerIds);
      owners = [...owners, ...(extraOwners || [])];
    }
  }

  const filtered = owners.map(owner => ({
    ...owner,
    pets: store_id
      ? (owner.pets || []).filter(p => p.store_id === store_id)
      : (owner.pets || []),
  }));

  res.json({ success: true, data: filtered });
});

// POST /api/pets/owners
router.post('/owners', requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
  const { name, phone, line_id, address, notes } = req.body;
  const email = req.body.email?.trim().toLowerCase() || null;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Email uniqueness check
  if (email) {
    const { data: existing } = await req.supabase
      .from('pet_owners')
      .select('id, name')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return res.status(400).json({
        error: `อีเมลนี้มีในระบบแล้ว (${existing.name})`,
        duplicate_owner_id: existing.id,
      });
    }
  }

  const { data, error } = await req.supabase
    .from('pet_owners')
    .insert([{ name, phone, email, line_id, address, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/pets/owners/:id
router.patch('/owners/:id', requireRole('owner', 'vet', 'reception'), async (req, res) => {
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

// GET /api/pets/vaccinations?pet_id=UUID — must be BEFORE /:id to avoid route shadowing
// No requireRole here — store_id not available in query; RLS on pet_vaccinations enforces access
router.get('/vaccinations', async (req, res) => {
  const { pet_id } = req.query;
  if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

  const { data, error } = await req.supabase
    .from('pet_vaccinations')
    .select('*')
    .eq('pet_id', pet_id)
    .order('given_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// ─── Pets ─────────────────────────────────────────────────────────────────────

// GET /api/pets/:id — full profile with history
router.get('/:id', resolveStoreId('pets'), requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
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
router.post('/', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { owner_id, store_id, name, breed, gender, dob, color, weight_kg, microchip_no, is_neutered, allergies, notes } = req.body;
  const species = req.body.species || 'dog';
  if (!name || !owner_id) return res.status(400).json({ error: 'name and owner_id required' });
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  // Generate next HN for this store (per-clinic sequential). The UNIQUE
  // (store_id, hn) constraint rejects concurrent duplicates; insertWithSeqRetry
  // re-reads MAX(hn) and retries on 23505 so simultaneous registrations each
  // get a distinct number.
  const { data, error } = await insertWithSeqRetry(async () => {
    const { data: lastPet } = await req.supabase
      .from('pets')
      .select('hn')
      .eq('store_id', store_id)
      .order('hn', { ascending: false })
      .limit(1);
    const nextHn = (lastPet?.[0]?.hn || 0) + 1;

    return req.supabase
      .from('pets')
      .insert([{ owner_id, store_id, hn: nextHn, name, species, type: species, breed, gender, dob, color, weight_kg, microchip_no, is_neutered: is_neutered ?? false, allergies, notes }])
      .select('*, pet_owners(*)')
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/pets/:id
router.patch('/:id', resolveStoreId('pets'), requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;
  if (updates.note !== undefined && updates.notes === undefined) {
    updates.notes = updates.note;
    delete updates.note;
  }

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
router.post('/vaccinations', requireRole('owner', 'vet'), async (req, res) => {
  const { pet_id, store_id, vaccine_name, given_date, next_due_date, batch_no, vet_name, notes } = req.body;
  if (!pet_id || !vaccine_name) return res.status(400).json({ error: 'pet_id and vaccine_name required' });
  if (!store_id) return res.status(400).json({ error: 'store_id required' });
  if (!given_date) return res.status(400).json({ error: 'given_date required' });

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
router.post('/appointments', requireRole('owner', 'vet', 'reception'), async (req, res) => {
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
router.patch('/appointments/:id', resolveStoreId('appointments'), requireRole('owner', 'vet', 'reception'), async (req, res) => {
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
router.post('/appointments/:id/checkin', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { store_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data: appt, error: apptErr } = await req.supabase
    .from('appointments')
    .select('*, pets(name, pet_owners(name))')
    .eq('id', req.params.id)
    .single();

  if (apptErr) return res.status(404).json({ error: 'Appointment not found' });

  // Auto-increment queue number. Guarded by the UNIQUE
  // (store_id, queue_date, queue_number) constraint + retry on concurrent dupes.
  const today     = new Date().toISOString().split('T')[0];
  const petName   = appt.pets?.name || '';
  const ownerName = appt.pets?.pet_owners?.name || '';

  const { data: queueEntry, error: qErr } = await insertWithSeqRetry(async () => {
    const { data: existing } = await req.supabase
      .from('queue_entries')
      .select('queue_number')
      .eq('store_id', store_id)
      .eq('queue_date', today)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextNum = existing?.length ? existing[0].queue_number + 1 : 1;

    return req.supabase
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
  });

  if (qErr) return res.status(500).json({ error: qErr.message });

  // Link appointment to queue entry
  await req.supabase
    .from('appointments')
    .update({ status: 'arrived', queue_entry_id: queueEntry.id })
    .eq('id', req.params.id);

  res.json({ success: true, data: queueEntry });
});

export default router;
