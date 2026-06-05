import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();
router.use(requireAuth);

// GET /api/staff?store_id=UUID
router.get('/', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('staff')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

// POST /api/staff — invite/add staff member
router.post('/', requireRole('owner'), async (req, res) => {
  const { store_id, user_email, name, roles, pin, password } = req.body;
  if (!store_id || !user_email || !name) {
    return res.status(400).json({ error: 'store_id, user_email, name required' });
  }
  // Optional owner-chosen permanent password; otherwise a random temp is generated.
  if (password != null && password !== '' && String(password).length < 6) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  // Create Supabase Auth account for staff (invite)
  const adminSb = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Check if user already exists in auth
  const { data: existingUsers } = await adminSb.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === user_email);

  let authUserId = existingUser?.id;

  if (!existingUser) {
    // Use the owner-chosen password if given, otherwise generate a random one.
    const accountPassword = (password != null && password !== '')
      ? String(password)
      : `FUFU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { data: newUser, error: createErr } = await adminSb.auth.admin.createUser({
      email: user_email,
      password: accountPassword,
      email_confirm: true,
      user_metadata: { name, is_staff: true },
    });
    if (createErr) return res.status(500).json({ error: createErr.message });
    authUserId = newUser.user.id;

    // Return the password to the owner so they can share it with the staff member.
    req._tempPassword = accountPassword;
  }

  // Add to staff
  const { data, error } = await req.supabase
    .from('staff')
    .upsert([{
      store_id,
      user_email: user_email.toLowerCase(),
      name,
      roles: roles || ['counter'],
      pin:   pin || null,
      invited_by: req.user.email,
      is_active: true,
    }], { onConflict: 'store_id,user_email' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    success: true,
    data,
    temp_password: req._tempPassword || null,
    is_new_account: !!req._tempPassword,
  });
});

// PATCH /api/staff/:id — update name, roles, status, extra fields
router.patch('/:id', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  const extraCols  = ['phone', 'position', 'start_date', 'notes'];
  const baseCols   = ['name', 'roles', 'is_active', 'pin'];

  const pick = (keys) => {
    const obj = {};
    for (const k of keys) if (req.body[k] !== undefined) obj[k] = req.body[k];
    return obj;
  };

  const fullUpdates = { ...pick(baseCols), ...pick(extraCols) };

  const { data, error } = await req.supabase
    .from('staff').update(fullUpdates).eq('id', req.params.id).select().single();

  // If extra columns don't exist yet, retry with base columns only
  if (error && error.message.includes('schema cache')) {
    const { data: d2, error: e2 } = await req.supabase
      .from('staff').update(pick(baseCols)).eq('id', req.params.id).select().single();
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ success: true, data: d2, migration_needed: true });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/staff/:id/reset-password — generate new temp password
router.patch('/:id/reset-password', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  const { password } = req.body || {};
  // Owner-chosen permanent password is optional; otherwise a random one is generated.
  if (password != null && password !== '' && String(password).length < 6) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  // 1. Get staff record
  const { data: member, error: findErr } = await req.supabase
    .from('staff')
    .select('user_email, name')
    .eq('id', req.params.id)
    .single();

  if (findErr || !member) return res.status(404).json({ error: 'ไม่พบพนักงาน' });

  const adminSb = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const tempPassword = (password != null && password !== '')
    ? String(password)
    : `FUFU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 2. Find auth user by email via auth schema
  const authSb = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'auth' } }
  );

  const { data: authUser } = await authSb
    .from('users')
    .select('id')
    .eq('email', member.user_email)
    .single();

  if (authUser) {
    // Account exists — update password
    const { error: updateErr } = await adminSb.auth.admin.updateUserById(authUser.id, {
      password: tempPassword,
    });
    if (updateErr) return res.status(500).json({ error: updateErr.message });
  } else {
    // No account yet — create one with temp password
    const { error: createErr } = await adminSb.auth.admin.createUser({
      email: member.user_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: member.name, is_staff: true },
    });
    if (createErr) return res.status(500).json({ error: createErr.message });
  }

  res.json({ success: true, temp_password: tempPassword, email: member.user_email, name: member.name });
});

// DELETE /api/staff/:id — deactivate (not delete)
router.delete('/:id', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  const { data, error } = await req.supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// GET /api/staff/me?store_id=UUID — get my staff profile + roles for this store
router.get('/me', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('staff')
    .select('*')
    .eq('store_id', store_id)
    .eq('user_email', req.user.email)
    .eq('is_active', true)
    .single();

  if (error) return res.json({ success: true, data: null }); // not a staff member = owner
  res.json({ success: true, data });
});

export default router;
