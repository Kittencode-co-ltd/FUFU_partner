import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

// ─── Cages ────────────────────────────────────────────────────────────────────

router.get('/cages', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('ipd_cages').select('*')
    .eq('store_id', store_id).order('cage_number');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

const VALID_CAGE_TYPES = new Set(['standard', 'large', 'icu', 'isolation']);

router.post('/cages', requireRole('owner', 'vet'), async (req, res) => {
  const { store_id, cage_number, cage_type = 'standard', floor = 1, daily_rate = 500, notes } = req.body;
  if (!store_id || !cage_number) return res.status(400).json({ error: 'store_id and cage_number required' });
  if (!VALID_CAGE_TYPES.has(cage_type)) {
    return res.status(400).json({ error: `cage_type must be one of: ${[...VALID_CAGE_TYPES].join(', ')}` });
  }

  const row = { store_id, cage_number, cage_type, floor: parseInt(floor) || 1, daily_rate: parseFloat(daily_rate) || 500, status: 'available' };
  if (notes) row.notes = notes;

  const { data, error } = await req.supabase.from('ipd_cages').insert([row]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.patch('/cages/:id', async (req, res) => {
  const allowed = ['cage_number', 'status', 'cage_type', 'floor', 'daily_rate', 'notes'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('ipd_cages').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/cages/:id', resolveStoreId('ipd_cages'), requireRole('owner', 'vet'), async (req, res) => {
  const { data: cage, error: findErr } = await req.supabase
    .from('ipd_cages').select('status, cage_number').eq('id', req.params.id).single();
  if (findErr) return res.status(404).json({ error: 'Cage not found' });
  if (cage.status === 'occupied') {
    return res.status(400).json({ error: `ไม่สามารถลบกรง ${cage.cage_number} ที่มีผู้ป่วยอยู่ได้` });
  }

  const { error } = await req.supabase.from('ipd_cages').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Admissions ───────────────────────────────────────────────────────────────

router.get('/admissions', async (req, res) => {
  const { store_id, status } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let q = req.supabase.from('ipd_admissions').select('*').eq('store_id', store_id)
    .order('admitted_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/admissions', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { store_id, cage_id, pet_id, pet_name, owner_name, species, admission_reason, daily_rate, notes } = req.body;
  if (!store_id || !cage_id || !pet_name) {
    return res.status(400).json({ error: 'store_id, cage_id, pet_name required' });
  }

  const admRow = {
    store_id, cage_id,
    pet_id:           pet_id           || null,
    pet_name,
    owner_name:       owner_name       || null,
    species:          species          || 'dog',
    admission_reason: admission_reason || null,
    daily_rate:       parseFloat(daily_rate) || 500,
    status:           'admitted',
    belongings_log:   [],
  };
  if (notes) admRow.daily_notes = notes;

  const { data, error } = await req.supabase
    .from('ipd_admissions').insert([admRow]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await req.supabase.from('ipd_cages').update({ status: 'occupied' }).eq('id', cage_id);
  res.json({ success: true, data });
});

router.patch('/admissions/:id', async (req, res) => {
  const allowed = ['pet_name', 'owner_name', 'species', 'admission_reason', 'daily_notes', 'belongings_log', 'daily_rate'];
  const updates = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('ipd_admissions').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.patch('/admissions/:id/discharge', async (req, res) => {
  const { data: adm, error: findErr } = await req.supabase
    .from('ipd_admissions').select('cage_id, admitted_at, daily_rate').eq('id', req.params.id).single();
  if (findErr) return res.status(404).json({ error: 'Admission not found' });

  // Calculate total cost
  const hrs        = (Date.now() - new Date(adm.admitted_at)) / 3600000;
  const days       = Math.ceil(hrs / 24) || 1;
  const total_cost = days * (parseFloat(adm.daily_rate) || 500);

  const { data, error } = await req.supabase
    .from('ipd_admissions')
    .update({ status: 'discharged', discharged_at: new Date().toISOString(), total_cost })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (adm.cage_id) {
    await req.supabase.from('ipd_cages').update({ status: 'available' }).eq('id', adm.cage_id);
  }
  res.json({ success: true, data });
});

// ─── Treatments ───────────────────────────────────────────────────────────────

router.get('/treatments/:admission_id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('ipd_treatments').select('*').eq('admission_id', req.params.admission_id)
    .order('treatment_time');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/treatments', requireRole('owner', 'vet'), async (req, res) => {
  const { admission_id, store_id, treatment_time, treatment_type, description, dosage, notes } = req.body;
  if (!admission_id || !treatment_time || !store_id) {
    return res.status(400).json({ error: 'admission_id, store_id, and treatment_time required' });
  }

  const tRow = {
    admission_id,
    store_id,
    treatment_time,
    treatment_type: treatment_type || 'medication',
    status: 'pending',
  };
  if (description) tRow.description = description;
  if (dosage)     tRow.dosage     = dosage;
  if (notes)      tRow.notes      = notes;

  const { data, error } = await req.supabase.from('ipd_treatments').insert([tRow]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.patch('/treatments/:id/done', async (req, res) => {
  const { completed_by, eat_status, poop_status, pee_status, notes } = req.body;
  const updates = {
    status:       'done',
    completed_by: completed_by || req.user.email,
    completed_at: new Date().toISOString(),
  };
  if (eat_status  !== undefined) updates.eat_status  = eat_status;
  if (poop_status !== undefined) updates.poop_status = poop_status;
  if (pee_status  !== undefined) updates.pee_status  = pee_status;
  if (notes       !== undefined) updates.notes       = notes;

  const { data, error } = await req.supabase
    .from('ipd_treatments').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/treatments/:id', async (req, res) => {
  const { error } = await req.supabase.from('ipd_treatments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Vital Signs ─────────────────────────────────────────────────────────────

router.get('/vitals/:admission_id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('ipd_vitals')
    .select('*')
    .eq('admission_id', req.params.admission_id)
    .order('recorded_at', { ascending: true })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

router.post('/vitals', async (req, res) => {
  const { admission_id, store_id, recorded_at, temperature, heart_rate, weight_kg, respiratory_rate, pain_score, notes } = req.body;
  if (!admission_id) return res.status(400).json({ error: 'admission_id required' });

  const row = {
    admission_id,
    recorded_at: recorded_at || new Date().toISOString(),
    recorded_by: req.user.email,
  };
  if (store_id         != null) row.store_id         = store_id;
  if (temperature      != null) row.temperature      = parseFloat(temperature);
  if (heart_rate       != null) row.heart_rate        = parseInt(heart_rate);
  if (weight_kg        != null) row.weight_kg         = parseFloat(weight_kg);
  if (respiratory_rate != null) row.respiratory_rate  = parseInt(respiratory_rate);
  if (pain_score       != null) row.pain_score        = parseInt(pain_score);
  if (notes != null)            row.notes             = notes;

  const { data, error } = await req.supabase.from('ipd_vitals').insert([row]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/vitals/:id', async (req, res) => {
  const { error } = await req.supabase.from('ipd_vitals').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
