import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();
router.use(requireAuth);

// ── Role mappings ─────────────────────────────────────────────────────────────
// Frontend uses roles[] array; DB uses a single role string with CHECK constraint

const FRONTEND_TO_DB = {
  all:      'manager',
  doctor:   'veterinarian',
  pharmacy: 'pharmacist',
  counter:  'receptionist',
  finance:  'staff',
};
const DB_TO_FRONTEND = {
  manager:      ['all'],
  owner:        ['all'],
  veterinarian: ['doctor'],
  pharmacist:   ['pharmacy'],
  receptionist: ['counter'],
  groomer:      ['counter'],
  staff:        ['counter'],
};

function toDbRole(roles) {
  const arr = Array.isArray(roles) ? roles : [roles || 'counter'];
  for (const key of ['all', 'doctor', 'pharmacy', 'counter', 'finance']) {
    if (arr.includes(key)) return FRONTEND_TO_DB[key];
  }
  return 'staff';
}

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    name:       row.full_name  ?? row.name       ?? '',
    user_email: row.email      ?? row.user_email  ?? '',
    roles:      DB_TO_FRONTEND[row.role] ?? ['counter'],
  };
}

// ── GET /api/staff?store_id=UUID ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data, error } = await req.supabase
    .from('staff')
    .select('*')
    .eq('store_id', store_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: (data || []).map(normalize) });
});

// ── POST /api/staff — add staff member ────────────────────────────────────────
router.post('/', requireRole('owner'), async (req, res) => {
  const { store_id, user_email, name, roles, password, phone, position,
          role_color, start_date, notes } = req.body;

  if (!store_id || !user_email || !name)
    return res.status(400).json({ error: 'store_id, user_email, name required' });

  if (password != null && password !== '' && String(password).length < 6)
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

  const email = user_email.toLowerCase();

  // ── 1. Create/find Auth account ───────────────────────────────────────────
  const adminSb = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: existingUsers } = await adminSb.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);
  let authUserId = existingUser?.id;
  let tempPassword = null;

  if (!existingUser) {
    tempPassword = (password != null && password !== '')
      ? String(password)
      : `FUFU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data: newUser, error: createErr } = await adminSb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name, is_staff: true },
    });
    if (createErr) return res.status(500).json({ error: createErr.message });
    authUserId = newUser.user.id;
  }

  // ── 2. Check if staff row already exists ─────────────────────────────────
  const { data: existing } = await req.supabase
    .from('staff')
    .select('id')
    .eq('store_id', store_id)
    .eq('email', email)
    .maybeSingle();

  const staffPayload = {
    store_id,
    email,
    full_name:  name,
    role:       toDbRole(roles),
    phone:      phone      || null,
    position:   position   || null,
    role_color: role_color || null,
    start_date: start_date || null,
    notes:      notes      || null,
    user_id:    authUserId || null,
    is_active:  true,
    updated_at: new Date().toISOString(),
  };

  let data, error;

  if (existing?.id) {
    // Update existing (re-activate if deactivated)
    ({ data, error } = await req.supabase
      .from('staff')
      .update(staffPayload)
      .eq('id', existing.id)
      .select()
      .single());
  } else {
    // Insert new
    ({ data, error } = await req.supabase
      .from('staff')
      .insert([staffPayload])
      .select()
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });

  // Link to custom role so permissions can be fetched at login
  const roleId = req.body.role_id;
  if (roleId && data?.id) {
    await adminSb.from('staff_roles').delete().eq('staff_id', data.id);
    await adminSb.from('staff_roles').insert([{ staff_id: data.id, role_id: roleId }]);
  }

  res.json({
    success:        true,
    data:           normalize(data),
    temp_password:  tempPassword,
    is_new_account: !!tempPassword,
  });
});

// ── PATCH /api/staff/:id ──────────────────────────────────────────────────────
router.patch('/:id', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  const allowed = ['full_name','role','phone','is_active','position',
                   'role_color','start_date','notes','pin','masking_level'];
  const updates = { updated_at: new Date().toISOString() };

  // Map frontend field names → DB column names
  if (req.body.name      !== undefined) updates.full_name  = req.body.name;
  if (req.body.roles     !== undefined) updates.role       = toDbRole(req.body.roles);

  for (const col of allowed) {
    if (req.body[col] !== undefined) updates[col] = req.body[col];
  }

  // Use service-role client so owner can always update staff (bypass RLS)
  const admin = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin
    .from('staff')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Update custom role link when role_id is provided
  const roleId = req.body.role_id;
  if (roleId) {
    await admin.from('staff_roles').delete().eq('staff_id', req.params.id);
    await admin.from('staff_roles').insert([{ staff_id: req.params.id, role_id: roleId }]);
  }

  res.json({ success: true, data: normalize(data) });
});

// ── PATCH /api/staff/:id/reset-password ──────────────────────────────────────
router.patch('/:id/reset-password', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  try {
    const { password } = req.body || {};
    if (password != null && password !== '' && String(password).length < 6)
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    // Always use admin client to bypass RLS for staff lookup
    const admin = createClient(
      process.env.Project_URL,
      process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: member, error: findErr } = await admin
      .from('staff')
      .select('id, email, full_name, user_id')
      .eq('id', req.params.id)
      .single();

    if (findErr || !member) return res.status(404).json({ error: 'ไม่พบพนักงาน' });

    const newPassword = (password != null && password !== '')
      ? String(password)
      : `FUFU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let authUserId = member.user_id;

    if (!authUserId) {
      // Look up auth user by email (paginated search)
      let found = null;
      let page  = 1;
      while (!found) {
        const { data: pageData } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        const users = pageData?.users || [];
        found = users.find(u => u.email === member.email);
        if (found || users.length < 100) break;
        page++;
      }

      if (found) {
        authUserId = found.id;
      } else {
        // Create auth account on-the-fly
        const { data: nu, error: ce } = await admin.auth.admin.createUser({
          email: member.email,
          password: newPassword,
          email_confirm: true,
          user_metadata: { full_name: member.full_name, is_staff: true },
        });
        if (ce) return res.status(500).json({ error: ce.message });
        authUserId = nu.user.id;
      }

      // Link user_id back to staff record
      await admin.from('staff').update({ user_id: authUserId }).eq('id', member.id);
    }

    // Update password
    const { error: updateErr } = await admin.auth.admin.updateUserById(authUserId, { password: newPassword });
    if (updateErr) return res.status(500).json({ error: updateErr.message });

    res.json({ success: true, temp_password: newPassword, email: member.email, name: member.full_name });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดภายใน' });
  }
});

// ── DELETE /api/staff/:id — soft delete ──────────────────────────────────────
router.delete('/:id', resolveStoreId('staff'), requireRole('owner'), async (req, res) => {
  const { data, error } = await req.supabase
    .from('staff')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: normalize(data) });
});

// ── GET /api/staff/me?store_id=UUID ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  // Use admin client so staff can always read their own row + join regardless of RLS
  const admin = createClient(
    process.env.Project_URL,
    process.env.service_role_key || process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin
    .from('staff')
    .select('*, staff_roles(role_id, roles(name, permissions))')
    .eq('store_id', store_id)
    .eq('email', req.user.email)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return res.json({ success: true, data: null });

  if (!data) return res.json({ success: true, data: null });

  const normalized = normalize(data);
  // Attach the custom role's permissions if linked
  normalized.permissions = data.staff_roles?.[0]?.roles?.permissions || null;
  res.json({ success: true, data: normalized });
});

export default router;
