import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';

const router   = Router();
const supabase = createClient(
  process.env.Project_URL,
  process.env.publishable_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Lazy admin client (needs SERVICE_ROLE_KEY — bypass RLS + email confirm)
let _adminSb = null;
function adminSb() {
  if (!_adminSb) {
    _adminSb = createClient(
      process.env.Project_URL,
      process.env.SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _adminSb;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  // Optional partner-access RPC gate — skip if function doesn't exist yet.
  // If it exists and returns false → user is purely a mobile app user, still allowed
  // to login but will get needs_onboarding: true (handled below).
  const { data: isStaff, error: rpcErr } = await supabase
    .rpc('is_fufu_staff', { user_id: data.user.id });

  const rpcMissing  = rpcErr?.code === 'PGRST202' || rpcErr?.message?.includes('Could not find');
  const isConfirmed = rpcMissing || isStaff !== false; // default allow if RPC missing

  // Use user-scoped client (respects RLS)
  const userSb = createClient(
    process.env.Project_URL,
    process.env.publishable_key,
    {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    },
  );

  // 1. Look up owned stores (by owner_id, then by owner_email fallback)
  let { data: stores } = await userSb
    .from('stores')
    .select('id, name, category')
    .eq('owner_id', data.user.id);

  if (!stores?.length) {
    const { data: byEmail } = await userSb
      .from('stores')
      .select('id, name, category')
      .eq('owner_email', data.user.email);
    stores = byEmail;
  }

  // 2. If not owner → check store_staff membership
  let isStaffMember = false;
  if (!stores?.length) {
    const { data: staffRows } = await userSb
      .from('store_staff')
      .select('store_id, roles, name')
      .eq('user_email', data.user.email)
      .eq('is_active', true);

    if (staffRows?.length) {
      isStaffMember = true;
      const storeIds = [...new Set(staffRows.map(s => s.store_id))];
      const { data: staffStores } = await userSb
        .from('stores')
        .select('id, name, category')
        .in('id', storeIds);
      stores = (staffStores || []).map(store => {
        const staffRow = staffRows.find(s => s.store_id === store.id);
        return { ...store, staff_roles: staffRow?.roles, is_staff: true };
      });
    }
  }

  // 3. No store and not staff → user is a mobile-only account, needs onboarding
  const needs_onboarding = !stores?.length && !isStaffMember;

  res.json({
    success:          true,
    is_staff:         isStaffMember,
    needs_onboarding, // frontend will show create-store form when true
    token:            data.session.access_token,
    refresh_token:    data.session.refresh_token,
    user: {
      id:    data.user.id,
      email: data.user.email,
    },
    stores: stores || [],
  });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Creates auth account + first store in one step.
// Uses SERVICE_ROLE_KEY so email confirmation is skipped — no email needed.

router.post('/register', async (req, res) => {
  const { email, password, name, phone, store_name, store_category } = req.body;

  if (!email || !password || !name || !store_name) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกข้อมูลให้ครบ: ชื่อ, อีเมล, รหัสผ่าน, และชื่อร้าน',
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  }

  // Step 1: Create auth account via admin API (email_confirm: true = skip email verification)
  const { data: newUser, error: createErr } = await adminSb().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone: phone || null, is_partner: true },
  });

  if (createErr) {
    // Handle "User already registered" gracefully
    if (createErr.message?.includes('already') || createErr.status === 422) {
      return res.status(409).json({
        success:        false,
        already_exists: true,
        error:          'อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบแทน',
      });
    }
    return res.status(400).json({ success: false, error: createErr.message });
  }

  // Step 2: Sign in immediately to get a valid session token
  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr || !session?.session) {
    // Account created but can't sign in — shouldn't happen but handle gracefully
    return res.status(500).json({
      success: false,
      error:   'สร้างบัญชีสำเร็จ แต่เข้าสู่ระบบไม่ได้ กรุณาลอง login ใหม่',
    });
  }

  const token    = session.session.access_token;
  const userId   = newUser.user.id;
  const userEmail = email.toLowerCase().trim();

  // Step 3: Create first store for this partner
  const userSb = createClient(
    process.env.Project_URL,
    process.env.publishable_key,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: store, error: storeErr } = await userSb
    .from('stores')
    .insert([{
      name:        store_name.trim(),
      category:    store_category || 'vet_clinic',
      owner_id:    userId,
      owner_email: userEmail,
      is_active:   true,
    }])
    .select('id, name, category')
    .single();

  if (storeErr) {
    console.error('[Register] store insert failed:', storeErr.message);
    // Account is created — return token so user can create store manually
    return res.json({
      success: true,
      needs_onboarding: true,
      token,
      refresh_token: session.session.refresh_token,
      user: { id: userId, email: userEmail },
      stores: [],
      warning: 'สร้างบัญชีสำเร็จแต่สร้างร้านไม่ได้ กรุณาสร้างร้านในหน้า Dashboard',
    });
  }

  res.json({
    success:       true,
    token,
    refresh_token: session.session.refresh_token,
    user:  { id: userId, email: userEmail },
    stores: [store],
  });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────

router.post('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }
  const token        = header.split(' ')[1];
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  }

  const { data: { user }, error: verifyErr } = await supabase.auth.getUser(token);
  if (verifyErr || !user) {
    return res.status(401).json({ success: false, error: 'Token ไม่ถูกต้อง' });
  }

  const { error } = await adminSb().auth.admin.updateUserById(user.id, { password: new_password });
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

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

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

export default router;
