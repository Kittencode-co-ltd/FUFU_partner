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
const STORE_FIELDS = 'id, name, category, verification_status, is_verified, is_active';
const LEGACY_STORE_FIELDS = 'id, name, category, is_verified, is_active';
const missingVerificationStatus = error => String(error?.message || '').includes('verification_status');

async function queryStores(makeQuery) {
  let result = await makeQuery(STORE_FIELDS);
  if (missingVerificationStatus(result.error)) result = await makeQuery(LEGACY_STORE_FIELDS);
  return result;
}

function createStoreLookupClient() {
  const serviceKey = process.env.service_role_key || process.env.SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(process.env.Project_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createUserStoreLookupClient(token) {
  return createClient(process.env.Project_URL, process.env.publishable_key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listAccessibleStores(client, user) {
  if (!client) return { error: new Error('Store lookup service key is not configured') };

  const [byId, byEmail, staffResult] = await Promise.all([
    queryStores(fields => client.from('stores').select(fields).eq('owner_id', user.id)),
    queryStores(fields => client.from('stores').select(fields).eq('owner_email', user.email)),
    client.from('staff').select('store_id, role, full_name').eq('email', user.email).eq('is_active', true),
  ]);
  const error = byId.error || byEmail.error || staffResult.error;
  if (error) return { error };

  const storesById = new Map();
  for (const store of [...(byId.data || []), ...(byEmail.data || [])]) storesById.set(store.id, store);

  const staffRows = staffResult.data || [];
  if (staffRows.length) {
    const storeIds = [...new Set(staffRows.map(row => row.store_id))];
    const { data: staffStores, error: staffStoresError } = await queryStores(fields => client
      .from('stores').select(fields).in('id', storeIds));
    if (staffStoresError) return { error: staffStoresError };
    for (const store of staffStores || []) {
      const staffRow = staffRows.find(row => row.store_id === store.id);
      if (!storesById.has(store.id)) {
        storesById.set(store.id, {
          ...store,
          staff_roles: staffRow?.role ? [staffRow.role] : ['staff'],
          staff_role: staffRow?.role,
          is_staff: true,
        });
      }
    }
  }

  return { stores: [...storesById.values()], isStaffMember: staffRows.length > 0 };
}

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

  const lookup = await listAccessibleStores(
    createStoreLookupClient() || createUserStoreLookupClient(data.session.access_token),
    data.user,
  );
  if (lookup.error) {
    console.error('[Partner login] Store lookup failed:', lookup.error.code || lookup.error.message);
    return res.status(503).json({ success: false, code: 'PARTNER_STORE_LOOKUP_FAILED', error: 'ตรวจสอบข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
  const stores = lookup.stores;
  const isStaffMember = lookup.isStaffMember;

  // No store and not staff → a mobile-only account can create its first store.
  const needs_onboarding = !stores.length && !isStaffMember;

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
    stores,
  });
});

// Refresh the current user's complete store list when revisiting the picker from
// the dashboard. The server lookup includes inactive stores that RLS discovery
// policies intentionally hide from public/user-scoped queries.
router.get('/stores', requireAuth, async (req, res) => {
  const lookup = await listAccessibleStores(createStoreLookupClient() || req.supabase, req.user);
  if (lookup.error) {
    console.error('[Partner store picker] Store lookup failed:', lookup.error.code || lookup.error.message);
    return res.status(503).json({ success: false, code: 'PARTNER_STORE_LOOKUP_FAILED', error: 'โหลดรายชื่อร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
  res.json({ success: true, stores: lookup.stores, is_staff: lookup.isStaffMember });
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
  let { data: owned, error: ownedError } = await queryStores(fields => req.supabase
    .from('stores').select(fields).eq('owner_id', req.user.id));
  if (!owned?.length) {
    const { data: byEmail, error: emailError } = await queryStores(fields => req.supabase
      .from('stores').select(fields).eq('owner_email', req.user.email));
    owned = byEmail;
    ownedError = emailError;
  }
  if (ownedError) return res.status(503).json({ success: false, code: 'PARTNER_STORE_LOOKUP_FAILED', error: 'ตรวจสอบข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  const ownedStores = owned || [];
  const acceptedOwned = ownedStores.filter(store => (store.verification_status || (store.is_verified ? 'accept' : 'pending')) === 'accept');
  if (acceptedOwned.length) return res.json({ success: true, status: 'approved', stores: acceptedOwned });

  const { data: staffRows } = await req.supabase
    .from('staff').select('store_id').eq('email', req.user.email).eq('is_active', true);
  if (staffRows?.length) {
    const { data: staffStores, error: staffStoresError } = await queryStores(fields => req.supabase
      .from('stores').select(fields).in('id', staffRows.map(row => row.store_id)));
    if (staffStoresError) return res.status(503).json({ success: false, code: 'PARTNER_STORE_LOOKUP_FAILED', error: 'ตรวจสอบข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
    const acceptedStaffStores = (staffStores || []).filter(store => (store.verification_status || (store.is_verified ? 'accept' : 'pending')) === 'accept');
    if (acceptedStaffStores.length) {
      return res.json({ success: true, status: 'approved', stores: acceptedStaffStores });
    }
  }

  const rejected = ownedStores.some(store => store.verification_status === 'reject');
  return res.json({ success: true, status: rejected ? 'rejected' : ownedStores.length || staffRows?.length ? 'pending' : 'onboarding' });
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
