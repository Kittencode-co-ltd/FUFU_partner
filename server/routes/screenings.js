import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = 'id,user_id,pet_id,body_part,diagnosis,confidence,status,image_url,model_version,created_at,scanned_at,result_json,screening_status,triage_level,symptom_answers,referral_status,owner_contact,owner_note,referred_at,referral_consent_at,vet_assessment,vet_feedback,reviewed_at,reviewed_by';

router.get('/', requireRole('owner', 'vet', 'reception'), async (req, res) => {
  const { store_id, bucket = 'new' } = req.query;
  if (!UUID.test(store_id || '')) return res.status(400).json({ error: 'valid store_id required' });
  let query = req.supabase.from('scan_results').select(fields, { count: 'exact' })
    .eq('referral_store_id', store_id).order('referred_at', { ascending: false }).limit(100);
  if (bucket === 'new') query = query.eq('referral_status', 'requested');
  else if (bucket === 'active') query = query.eq('referral_status', 'accepted');
  else query = query.in('referral_status', ['declined', 'completed']);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const petIds = [...new Set((data || []).map(row => row.pet_id).filter(Boolean))];
  const { data: pets, error: petsError } = petIds.length
    ? await req.supabase.from('pets').select('id,name,species,breed,weight_kg').in('id', petIds)
    : { data: [], error: null };
  if (petsError) return res.status(500).json({ error: petsError.message });
  const petMap = new Map((pets || []).map(pet => [pet.id, pet]));
  const rows = await Promise.all((data || []).map(async row => {
    if (!row.image_path) return { ...row, pet: petMap.get(row.pet_id) || null, image_url: null };
    const { data: signed } = await req.supabase.storage.from('scan-images').createSignedUrl(row.image_path, 5 * 60);
    return { ...row, pet: petMap.get(row.pet_id) || null, image_url: signed?.signedUrl || null };
  }));
  res.json({ success: true, data: rows, count: count || 0 });
});

router.patch('/:id', async (req, res, next) => {
  if (!UUID.test(req.params.id || '')) return res.status(400).json({ error: 'valid screening id required' });
  const { data, error } = await req.supabase.from('scan_results').select('referral_store_id').eq('id', req.params.id).single();
  if (error || !data?.referral_store_id) return res.status(404).json({ error: 'Referral not found' });
  req.body = req.body || {};
  req.body.store_id = data.referral_store_id;
  req.query.store_id = data.referral_store_id;
  next();
}, requireRole('owner', 'vet'), async (req, res) => {
  const { status, assessment, feedback } = req.body;
  if (!['accepted', 'declined', 'completed'].includes(status)) return res.status(400).json({ error: 'invalid referral status' });
  if (typeof assessment !== 'string' || assessment.trim().length < 3 || assessment.length > 5000) {
    return res.status(400).json({ error: 'vet assessment is required (3–5000 characters)' });
  }
  if (!feedback || !['confirmed', 'changed', 'uncertain'].includes(feedback.match)) {
    return res.status(400).json({ error: 'veterinarian feedback is required' });
  }

  const { data, error } = await req.supabase.from('scan_results').update({
    referral_status: status,
    vet_assessment: assessment.trim(),
    vet_feedback: { match: feedback.match, diagnosis: String(feedback.diagnosis || '').trim().slice(0, 500) },
    reviewed_at: new Date().toISOString(),
    reviewed_by: req.user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', req.params.id).select(fields).single();
  if (error) return res.status(error.code === '42501' ? 403 : 500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
