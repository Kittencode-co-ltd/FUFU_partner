// Who can sign certificates (the owner and active vet staff) and their licence numbers, which are remembered
// for next time. The certificate itself is printed in the browser (public/js/utils/print-docs.js printCertificate).
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requireClinicStore } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VET_ROLES = ['owner', 'manager', 'veterinarian', 'vet'];
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// GET /api/certificates/vets?store_id
router.get('/vets', requireRole('owner', 'vet', 'reception', 'staff'), requireClinicStore, async (req, res) => {
  const storeId = req.query.store_id;
  const [{ data: store }, { data: staff, error }] = await Promise.all([
    req.supabase.from('stores').select('owner_id, owner_vet_name, owner_license_no, name').eq('id', storeId).maybeSingle(),
    req.supabase.from('staff').select('id, user_id, full_name, role, license_no').eq('store_id', storeId).eq('is_active', true).in('role', VET_ROLES),
  ]);
  if (error) return res.status(500).json({ success: false, error: 'Unable to load vets' });
  const vets = (staff || []).filter(s => s.user_id !== store?.owner_id)
    .map(s => ({ id: s.id, kind: 'staff', name: s.full_name, license_no: s.license_no || '' }));
  vets.unshift({ id: 'owner', kind: 'owner', name: store?.owner_vet_name || '', license_no: store?.owner_license_no || '' });
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: vets, me: req.user?.id === store?.owner_id ? 'owner' : (staff || []).find(s => s.user_id === req.user?.id)?.id || null });
});

// PUT /api/certificates/vets { store_id, id: 'owner' | staff id, name, license_no } — remember for next time
router.put('/vets', requireRole('owner', 'vet'), requireClinicStore, async (req, res) => {
  const name = clean(req.body.name, 120);
  const license = clean(req.body.license_no, 40);
  if (req.body.id === 'owner') {
    if (req.staffRole !== 'owner') return res.status(403).json({ success: false, error: 'เฉพาะเจ้าของร้าน' });
    const { error } = await req.supabase.from('stores').update({ owner_vet_name: name || null, owner_license_no: license || null }).eq('id', req.body.store_id);
    if (error) return res.status(500).json({ success: false, error: 'บันทึกไม่สำเร็จ' });
    return res.json({ success: true });
  }
  if (!UUID.test(req.body.id || '')) return res.status(400).json({ success: false, error: 'invalid vet' });
  // A vet may only update their own licence; the owner may update anyone's
  if (req.staffRole !== 'owner') {
    const { data: me } = await req.supabase.from('staff').select('id').eq('store_id', req.body.store_id).eq('user_id', req.user.id).maybeSingle();
    if (me?.id !== req.body.id) return res.status(403).json({ success: false, error: 'แก้ได้เฉพาะเลขใบอนุญาตของตัวเอง' });
  }
  const { error } = await req.supabase.from('staff').update({ license_no: license || null, updated_at: new Date().toISOString() })
    .eq('id', req.body.id).eq('store_id', req.body.store_id);
  if (error) return res.status(500).json({ success: false, error: 'บันทึกไม่สำเร็จ' });
  res.json({ success: true });
});

export default router;
