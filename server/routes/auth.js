import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';

const router   = Router();
const supabase = createClient(
  process.env.Project_URL,
  process.env.publishable_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  // Verify partner access via RPC (optional — skip if RPC not found)
  const { data: isStaff, error: rpcErr } = await supabase
    .rpc('is_fufu_staff', { user_id: data.user.id });

  const rpcMissing = rpcErr?.code === 'PGRST202' || rpcErr?.message?.includes('Could not find');
  if (!rpcMissing && (rpcErr || isStaff === false)) {
    console.warn('[Auth] is_fufu_staff check failed:', rpcErr?.message);
    return res.status(403).json({
      success: false,
      error: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึง Partner Portal',
    });
  }

  // Use user-scoped client so RLS policies allow reading own stores
  const userSupabase = createClient(
    process.env.Project_URL,
    process.env.publishable_key,
    {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    },
  );

  // 1. Try as owner (owner_id or owner_email)
  let { data: stores } = await userSupabase
    .from('stores')
    .select('id, name, category')
    .eq('owner_id', data.user.id);

  if (!stores?.length) {
    const { data: byEmail } = await userSupabase
      .from('stores')
      .select('id, name, category')
      .eq('owner_email', data.user.email);
    stores = byEmail;
  }

  // 2. If not owner → check store_staff (staff member)
  let isStaffMember = false;
  if (!stores?.length) {
    const { data: staffRows } = await userSupabase
      .from('store_staff')
      .select('store_id, roles, name')
      .eq('user_email', data.user.email)
      .eq('is_active', true);

    if (staffRows?.length) {
      isStaffMember = true;
      // Fetch the stores they belong to
      const storeIds = [...new Set(staffRows.map(s => s.store_id))];
      const { data: staffStores } = await userSupabase
        .from('stores')
        .select('id, name, category')
        .in('id', storeIds);
      stores = (staffStores || []).map(store => {
        const staffRow = staffRows.find(s => s.store_id === store.id);
        return { ...store, staff_roles: staffRow?.roles, is_staff: true };
      });
    }
  }

  res.json({
    success:        true,
    is_staff:       isStaffMember,
    token:          data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id:    data.user.id,
      email: data.user.email,
    },
    stores: stores || [],
  });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, phone, partnerType } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
  }

  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    return res.status(400).json({ success: false, error: authErr.message });
  }
  if (!authData.user) {
    return res.status(400).json({ success: false, error: 'ไม่สามารถสร้างบัญชีได้' });
  }

  const { error: partnerErr } = await supabase
    .from('partners')
    .insert([{ user_id: authData.user.id, name, email, phone, type: partnerType || 'vet_clinic' }]);

  if (partnerErr) {
    console.error('[Register] partner insert:', partnerErr.message);
  }

  res.json({ success: true, user: { id: authData.user.id, email } });
});

// POST /api/auth/change-password  (authenticated)
router.post('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }
  const token      = header.split(' ')[1];
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  }

  // Use admin client to update user password
  const adminSb = createClient(
    process.env.Project_URL,
    process.env.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Verify current token to get user
  const { data: { user }, error: verifyErr } = await supabase.auth.getUser(token);
  if (verifyErr || !user) {
    return res.status(401).json({ success: false, error: 'Token ไม่ถูกต้อง' });
  }

  const { error } = await adminSb.auth.admin.updateUserById(user.id, { password: new_password });
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true });
});

// POST /api/auth/refresh  — exchange refresh_token for a new access_token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'refresh_token required' });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data?.session) {
    return res.status(401).json({ success: false, error: 'Session หมดอายุ — กรุณาเข้าสู่ระบบใหม่' });
  }

  res.json({
    success:       true,
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

// POST /api/auth/logout  (client-side clears token, this just confirms)
router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

export default router;
