import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ── Allowed DB columns (prevent mass-assignment of unknown fields) ────────────
const ALLOWED = new Set([
  'store_id', 'pet_id', 'owner_id', 'vet_staff_id', 'customer_id',
  'record_type', 'visit_date', 'status',
  'pet_name', 'owner_name', 'species',
  'subjective', 'objective', 'assessment', 'plan',
  'weight_kg', 'temperature_c', 'heart_rate', 'respiratory_rate',
  'vitals', 'prescriptions', 'prescribed_meds',
  'diagnosis', 'treatment', 'notes',
  'lab_results', 'next_appointment',
]);

function sanitize(body) {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) out[k] = v;
  }
  // Normalize: keep prescriptions and prescribed_meds in sync
  if (out.prescriptions   && !out.prescribed_meds) out.prescribed_meds = out.prescriptions;
  if (out.prescribed_meds && !out.prescriptions)   out.prescriptions   = out.prescribed_meds;
  return out;
}

// GET /api/medical-records
router.get('/', async (req, res) => {
  const { store_id, record_type, status, pet_id, limit = 50 } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let q = req.supabase
    .from('medical_records')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (record_type) q = q.eq('record_type', record_type);
  if (status)      q = q.eq('status', status);
  if (pet_id)      q = q.eq('pet_id', pet_id);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// GET /api/medical-records/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('medical_records')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Record not found' });
  res.json({ success: true, data });
});

// POST /api/medical-records
router.post('/', async (req, res) => {
  const record = sanitize(req.body);

  // Require pet_name — OPD ไม่ควรบันทึกโดยไม่รู้ว่าเป็นสัตว์ตัวไหน
  if (!record.pet_name?.trim() && !record.pet_id) {
    return res.status(400).json({ error: 'pet_name or pet_id required' });
  }

  record.visit_date = record.visit_date || new Date().toISOString();
  record.status     = record.status     || 'in_progress';

  const { data, error } = await req.supabase
    .from('medical_records')
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error('[Medical] POST error:', error.message, JSON.stringify(record, null, 2));
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true, data });
});

// PATCH /api/medical-records/:id
router.patch('/:id', async (req, res) => {
  const updates = sanitize(req.body);
  delete updates.store_id; // ห้ามเปลี่ยน store

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await req.supabase
    .from('medical_records')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/medical-records/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('medical_records')
    .update({ deleted_at: new Date().toISOString(), deleted_by: req.user?.id || null })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log the deletion (non-fatal)
  await req.supabase.from('audit_logs').insert([{
    action: 'delete',
    target_table: 'medical_records',
    target_id: req.params.id,
    performed_by: req.user?.id || null,
    performed_at: new Date().toISOString(),
  }]).catch(() => {});

  res.json({ success: true, data });
});

export default router;
