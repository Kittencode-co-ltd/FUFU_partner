import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';
import { authRateLimit, clearFailedLoginAttempts, loginAttemptThrottle, recordFailedLogin } from '../middleware/security.js';
import { requireAuth } from '../middleware/auth.js';

const router   = Router();
const supabase = createClient(
  process.env.Project_URL,
  process.env.publishable_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmail = value => typeof value === 'string' && value.length <= 254 && EMAIL.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128;

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', loginAttemptThrottle, authRateLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!validEmail(email) || typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 400 || error.status === 401) {
      const throttle = recordFailedLogin(req);
      if (throttle.blocked) {
        res.set('retry-after', String(throttle.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          error: 'ลองรหัสผ่านผิดหลายครั้ง ระบบพักการเข้าสู่ระบบชั่วคราว',
          code: 'LOGIN_TEMPORARILY_BLOCKED',
          retry_after_seconds: throttle.retryAfterSeconds,
          request_id: req.requestId,
        });
      }
      return res.status(401).json({
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        attempts_remaining: throttle.attemptsRemaining,
      });
    }
    const status = error.status === 429 ? 429 : 503;
    return res.status(status).json({ success: false, error: status === 429 ? 'ระบบเข้าสู่ระบบจำกัดคำขอชั่วคราว กรุณารอสักครู่' : 'ระบบเข้าสู่ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' });
  }
  clearFailedLoginAttempts(req);

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
    .select('id, name, category, is_verified')
    .eq('owner_id', data.user.id);

  if (!stores?.length) {
    const { data: byEmail } = await userSb
      .from('stores')
      .select('id, name, category, is_verified')
      .eq('owner_email', data.user.email);
    stores = byEmail;
  }
  let hasPartnerStore = Boolean(stores?.length);
  stores = (stores || []).filter(store => store.is_verified === true);

  // 2. If not owner → check staff membership
  let isStaffMember = false;
  if (!stores?.length) {
    const { data: staffRows } = await userSb
      .from('staff')
      .select('store_id, role, full_name')
      .eq('email', data.user.email)
      .eq('is_active', true);

    if (staffRows?.length) {
      isStaffMember = true;
      const storeIds = [...new Set(staffRows.map(s => s.store_id))];
      const { data: staffStores } = await userSb
        .from('stores')
        .select('id, name, category, is_verified')
        .in('id', storeIds);
      hasPartnerStore = hasPartnerStore || Boolean(staffStores?.length);
      stores = (staffStores || []).filter(store => store.is_verified === true).map(store => {
        const staffRow = staffRows.find(s => s.store_id === store.id);
        // normalize role → roles[] for frontend compatibility
        const roleArr = staffRow?.role ? [staffRow.role] : ['staff'];
        return { ...store, staff_roles: roleArr, staff_role: staffRow?.role, is_staff: true };
      });
    }
  }

  if (hasPartnerStore && !stores?.length) {
    return res.status(403).json({
      success: false,
      code: 'PARTNER_PENDING_APPROVAL',
      error: 'บัญชีพาร์ทเนอร์กำลังรอ FUFU อนุมัติ กรุณารอการตรวจสอบก่อนเข้าใช้งาน',
    });
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
// Creates an Auth account through the public signup flow. Email verification is
// never bypassed; store onboarding happens after the first verified login.

router.post('/register', authRateLimit, async (req, res) => {
  const { email, password, name, phone, store_name, store_category } = req.body;

  if (!validEmail(email) || !password || !name || !store_name || name.length > 120 || store_name.length > 160) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกข้อมูลให้ครบ: ชื่อ, อีเมล, รหัสผ่าน, และชื่อร้าน',
    });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  }

  let signup;
  try {
    signup = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone: phone || null, is_partner: true } },
    });
  } catch (error) {
    const cause = error?.cause?.code;
    console.error('[Register] Supabase Auth request failed:', cause || error?.name || 'network error');
    return res.status(503).json({
      success: false,
      error: 'เชื่อมต่อ Supabase ไม่ได้ กรุณาตรวจสอบค่า Project_URL และลองใหม่อีกครั้ง',
      code: 'SUPABASE_UNREACHABLE',
    });
  }
  const { data: newUser, error: createErr } = signup;

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

  if (!newUser.user) {
    return res.status(502).json({ success: false, error: 'ไม่สามารถสร้างบัญชีได้ กรุณาลองอีกครั้ง' });
  }

  if (!newUser.session) {
    return res.status(202).json({
      success: true,
      needs_email_verification: true,
      user: { id: newUser.user.id, email: newUser.user.email },
      stores: [],
    });
  }

  const token    = newUser.session.access_token;
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
      is_verified: false,
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
      refresh_token: newUser.session.refresh_token,
      user: { id: userId, email: userEmail },
      stores: [],
      warning: 'สร้างบัญชีสำเร็จแต่สร้างร้านไม่ได้ กรุณาสร้างร้านในหน้า Dashboard',
    });
  }

  res.status(202).json({
    success: true,
    pending_approval: true,
    user: { id: userId, email: userEmail },
    stores: [store],
    message: 'สมัครสำเร็จ บัญชีกำลังรอ FUFU อนุมัติก่อนเข้าใช้งาน',
  });
});

// Confirm access on every dashboard load, including sessions issued before
// approval checks were enabled.
router.get('/partner-access', requireAuth, async (req, res) => {
  let { data: owned } = await req.supabase
    .from('stores')
    .select('id, is_verified')
    .eq('owner_id', req.user.id);
  if (!owned?.length) {
    const { data: byEmail } = await req.supabase
      .from('stores').select('id, is_verified').eq('owner_email', req.user.email);
    owned = byEmail;
  }
  const ownedStores = owned || [];
  const verifiedOwned = ownedStores.some(store => store.is_verified === true);
  if (verifiedOwned) return res.json({ success: true, status: 'approved' });

  const { data: staffRows } = await req.supabase
    .from('staff').select('store_id').eq('email', req.user.email).eq('is_active', true);
  if (staffRows?.length) {
    const { data: staffStores } = await req.supabase
      .from('stores').select('is_verified').in('id', staffRows.map(row => row.store_id));
    if (staffStores?.some(store => store.is_verified === true)) {
      return res.json({ success: true, status: 'approved' });
    }
  }

  return res.json({ success: true, status: ownedStores.length || staffRows?.length ? 'pending' : 'onboarding' });
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

  const userSb = createClient(process.env.Project_URL, process.env.publishable_key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await userSb.auth.updateUser({ password: new_password });
  if (error) return res.status(500).json({ success: false, error: error.message });

  res.json({ success: true });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post('/refresh', authRateLimit, async (req, res) => {
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
