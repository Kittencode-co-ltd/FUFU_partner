import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const buckets = new Map<string, { count: number; resetAt: number }>();
const json = (body: unknown, status: number, requestId: string) => new Response(
  JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json', 'x-request-id': requestId } },
);

Deno.serve(async req => {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, requestId);

  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401, requestId);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server configuration error' }, 500, requestId);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401, requestId);

  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!signedInAt || Date.now() - signedInAt > 10 * 60_000) {
    return json({ error: 'Recent authentication required' }, 401, requestId);
  }

  const now = Date.now();
  const current = buckets.get(user.id);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
  bucket.count += 1;
  buckets.set(user.id, bucket);
  if (bucket.count > 3) return json({ error: 'Too many requests' }, 429, requestId);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: deletionRequest, error: requestError } = await admin
    .from('account_deletion_requests')
    .insert({ user_id: user.id, status: 'processing' })
    .select('id,request_id').single();
  if (requestError) return json({ error: 'Unable to start deletion' }, 500, requestId);

  try {
    for (const bucketName of ['pet-avatars', 'profile-avatars', 'scan-images']) {
      const { data: objects, error: listError } = await admin.storage.from(bucketName).list(user.id, { limit: 1000 });
      if (listError) throw listError;
      const paths = (objects || []).filter(object => object.name).map(object => `${user.id}/${object.name}`);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from(bucketName).remove(paths);
        if (removeError) throw removeError;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    await admin.from('account_deletion_requests').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', deletionRequest.id);
    return json({ success: true, request_id: deletionRequest.request_id }, 200, requestId);
  } catch (error) {
    await admin.from('account_deletion_requests').update({ status: 'rejected', processed_at: new Date().toISOString(), failure_code: 'deletion_failed' }).eq('id', deletionRequest.id);
    console.error(JSON.stringify({ level: 'error', request_id: requestId, operation: 'delete_account', error: error instanceof Error ? error.name : 'Error' }));
    return json({ error: 'Account deletion failed' }, 500, requestId);
  }
});
