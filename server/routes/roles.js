import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const DEFAULT_PERMISSIONS = {
  queue:    ['view'],
  opd:      ['view'],
  ipd:      [],
  stock:    [],
  finance:  [],
  settings: [],
};

// GET /api/roles?store_id=UUID
router.get('/', requireRole('owner'), async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('roles')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/roles
router.post('/', requireRole('owner'), async (req, res) => {
  const { store_id, name, color, permissions } = req.body;
  if (!store_id || !name) return res.status(400).json({ error: 'store_id and name required' });

  const { data, error } = await req.supabase
    .from('roles')
    .insert([{
      store_id,
      name,
      color:       color       || '#6B7280',
      permissions: permissions || DEFAULT_PERMISSIONS,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/roles/:id
router.patch('/:id', resolveStoreId('roles'), requireRole('owner'), async (req, res) => {
  const { name, color, permissions } = req.body;
  const updates = {};
  if (name !== undefined)        updates.name        = name;
  if (color !== undefined)       updates.color       = color;
  if (permissions !== undefined) updates.permissions = permissions;

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no fields to update' });

  const { data, error } = await req.supabase
    .from('roles')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/roles/:id
router.delete('/:id', resolveStoreId('roles'), requireRole('owner'), async (req, res) => {
  const { error } = await req.supabase
    .from('roles')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/roles/staff/:staff_id — get roles for a staff member
router.get('/staff/:staff_id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('staff_roles')
    .select('role_id, roles(*)')
    .eq('staff_id', req.params.staff_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: (data || []).map(r => r.roles) });
});

// POST /api/roles/staff — assign role to staff
router.post('/staff', async (req, res) => {
  const { staff_id, role_id } = req.body;
  if (!staff_id || !role_id) return res.status(400).json({ error: 'staff_id and role_id required' });

  const { data, error } = await req.supabase
    .from('staff_roles')
    .upsert([{ staff_id, role_id }], { onConflict: 'staff_id,role_id' })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/roles/staff — remove role from staff
router.delete('/staff', async (req, res) => {
  const { staff_id, role_id } = req.body;
  if (!staff_id || !role_id) return res.status(400).json({ error: 'staff_id and role_id required' });

  const { error } = await req.supabase
    .from('staff_roles')
    .delete()
    .eq('staff_id', staff_id)
    .eq('role_id', role_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
