import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Cages ────────────────────────────────────────────────────────────────────

router.get('/cages', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('ipd_cages').select('*, ipd_admissions!inner(*)')
    .eq('store_id', store_id).order('cage_number');

  // Fallback: select cages then admissions separately to avoid join issues
  if (error) {
    const { data: cages, error: e2 } = await req.supabase
      .from('ipd_cages').select('*').eq('store_id', store_id).order('cage_number');
    if (e2) return res.status(500).json({ error: e2.message });

    const { data: admissions } = await req.supabase
      .from('ipd_admissions').select('*')
      .eq('store_id', store_id).eq('status', 'admitted');

    const admMap = {};
    (admissions || []).forEach(a => { admMap[a.cage_id] = a; });
    const enriched = (cages || []).map(c => ({
      ...c,
      current_admission: admMap[c.id] || null,
    }));
    return res.json({ success: true, data: enriched });
  }

  res.json({ success: true, data: data || [] });
});

router.post('/cages', async (req, res) => {
  const { store_id, cage_number, cage_type = 'standard', floor = 1, daily_rate = 500, notes } = req.body;
  if (!store_id || !cage_number) return res.status(400).json({ error: 'store_id and cage_number required' });

  const row = { store_id, cage_number, cage_type, floor: parseInt(floor) || 1, daily_rate: parseFloat(daily_rate) || 500, status: 'available' };
  if (notes) row.notes = notes;

  const { data, error } = await req.supabase.from('ipd_cages').insert([row]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.patch('/cages/:id', async (req, res) => {
  const allowed = ['status', 'cage_type', 'floor', 'daily_rate', 'notes'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('ipd_cages').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
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

router.post('/admissions', async (req, res) => {
  const { store_id, cage_id, pet_name, owner_name, species, admission_reason, daily_rate, notes } = req.body;
  if (!store_id || !cage_id || !pet_name) {
    return res.status(400).json({ error: 'store_id, cage_id, pet_name required' });
  }

  const admRow = { store_id, cage_id, pet_name, species: species || 'dog', status: 'admitted', daily_rate: parseFloat(daily_rate) || 500 };
  if (owner_name) admRow.owner_name = owner_name;
  if (admission_reason) admRow.admission_reason = admission_reason;
  if (notes) admRow.notes = notes;

  const [admRes] = await Promise.all([
    req.supabase.from('ipd_admissions').insert([admRow]).select().single(),
  ]);

  if (admRes.error) return res.status(500).json({ error: admRes.error.message });

  // Update cage status
  await req.supabase.from('ipd_cages').update({ status: 'occupied' }).eq('id', cage_id);

  res.json({ success: true, data: admRes.data });
});

router.patch('/admissions/:id/discharge', async (req, res) => {
  const { data: adm, error: findErr } = await req.supabase
    .from('ipd_admissions').select('cage_id').eq('id', req.params.id).single();
  if (findErr) return res.status(404).json({ error: 'Admission not found' });

  const { data, error } = await req.supabase
    .from('ipd_admissions')
    .update({ status: 'discharged', discharged_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Free cage
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

router.post('/treatments', async (req, res) => {
  const { admission_id, store_id, treatment_time, treatment_type, description, dosage, notes } = req.body;
  if (!admission_id || !treatment_time) return res.status(400).json({ error: 'admission_id and treatment_time required' });

  const tRow = { admission_id, treatment_time, treatment_type: treatment_type || 'medication', status: 'pending' };
  if (store_id) tRow.store_id = store_id;
  if (description) tRow.description = description;
  if (dosage) tRow.dosage = dosage;
  if (notes) tRow.notes = notes;

  const { data, error } = await req.supabase.from('ipd_treatments').insert([tRow]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.patch('/treatments/:id/done', async (req, res) => {
  const { completed_by, eat_status, poop_status, pee_status, notes } = req.body;
  const { data, error } = await req.supabase
    .from('ipd_treatments')
    .update({ status: 'done', completed_by: completed_by || req.user.email, eat_status, poop_status, pee_status, notes, completed_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.delete('/treatments/:id', async (req, res) => {
  const { error } = await req.supabase.from('ipd_treatments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
