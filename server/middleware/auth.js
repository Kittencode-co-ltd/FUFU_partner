import { createClient } from '@supabase/supabase-js';

const _anonClient = createClient(
  process.env.Project_URL,
  process.env.publishable_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Express middleware — verifies Bearer JWT from Supabase Auth.
 * Attaches req.user and req.supabase (user-scoped, respects RLS).
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.split(' ')[1];
  const { data: { user }, error } = await _anonClient.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Create user-scoped client so RLS policies work correctly
  req.user = user;
  req.supabase = createClient(
    process.env.Project_URL,
    process.env.publishable_key,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    },
  );
  next();
}
