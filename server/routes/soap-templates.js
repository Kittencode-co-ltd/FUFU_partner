import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

// GET /api/soap-templates?store_id=UUID&q=...
router.get('/', async (req, res) => {
  const { store_id, q } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('soap_templates')
    .select('id,name,category,subjective_template,objective_template,assessment_template,plan_template,preset_prescriptions,use_count')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .order('use_count', { ascending: false })
    .order('name')
    .limit(100);

  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/soap-templates
router.post('/', requireRole('owner', 'vet'), async (req, res) => {
  const { store_id, name, category = 'disease', subjective_template, objective_template, assessment_template, plan_template, preset_prescriptions } = req.body;
  if (!store_id || !name?.trim()) return res.status(400).json({ error: 'store_id and name required' });

  const { data, error } = await req.supabase
    .from('soap_templates')
    .insert([{
      store_id,
      name: name.trim(),
      category,
      subjective_template:  subjective_template  || null,
      objective_template:   objective_template   || null,
      assessment_template:  assessment_template  || null,
      plan_template:        plan_template        || null,
      preset_prescriptions: preset_prescriptions || [],
      created_by: req.user.email,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/soap-templates/:id
router.patch('/:id', requireRole('owner', 'vet'), async (req, res) => {
  const allowed = ['name', 'category', 'subjective_template', 'objective_template', 'assessment_template', 'plan_template', 'preset_prescriptions', 'is_active'];
  const updates = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('soap_templates').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/soap-templates/:id — soft delete
router.delete('/:id', requireRole('owner', 'vet'), async (req, res) => {
  const { error } = await req.supabase
    .from('soap_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/soap-templates/:id/use — increment use_count
router.post('/:id/use', async (req, res) => {
  const { error } = await req.supabase.rpc('increment_soap_template_use', { template_id: req.params.id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
