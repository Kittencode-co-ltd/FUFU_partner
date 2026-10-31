import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const allowedParts = new Set(['Eyes', 'Ear', 'Skin', 'Dental']);
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

Deno.serve(async req => {
  const startedAt = Date.now();
  const metric = (outcome: string) => console.log(JSON.stringify({
    event: 'preliminary_screening',
    outcome,
    latency_ms: Date.now() - startedAt,
  }));
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const screeningUrl = Deno.env.get('SCREENING_API_URL');
  const screeningKey = Deno.env.get('SCREENING_API_KEY');
  if (!url || !anonKey || !serviceKey || !screeningUrl) {
    return json({ error: 'Screening service unavailable' }, 503);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const now = Date.now();
  const previous = rateLimits.get(user.id);
  const bucket = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + 60_000 }
    : previous;
  bucket.count += 1;
  rateLimits.set(user.id, bucket);
  if (bucket.count > 5) {
    metric('rate_limited');
    return json({ error: 'Too many requests' }, 429);
  }

  const body = await req.json().catch(() => null) as { storage_path?: string; body_part?: string } | null;
  const storagePath = body?.storage_path;
  const bodyPart = body?.body_part;
  if (!storagePath?.startsWith(`${user.id}/`) || !bodyPart || !allowedParts.has(bodyPart)) {
    metric('invalid_request');
    return json({ error: 'Invalid screening request' }, 400);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: image, error: downloadError } = await admin.storage
    .from('scan-images').download(storagePath);
  if (downloadError || !image) return json({ error: 'Image not found' }, 404);
  if (!allowedTypes.has(image.type) || image.size > 5 * 1024 * 1024) {
    metric('unsupported_image');
    return json({ error: 'Unsupported image' }, 415);
  }

  const form = new FormData();
  form.append('file', image, 'screening-image');
  form.append('body_part', bodyPart);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${screeningUrl.replace(/\/$/, '')}/predict`, {
      method: 'POST',
      headers: screeningKey ? { authorization: `Bearer ${screeningKey}` } : {},
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return json({ error: 'Screening failed' }, 502);
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    const confidence = typeof result?.confidence === 'number' ? result.confidence : 0;
    if (!result || result.is_animal === false || result.body_part_valid === false || confidence < 0.55) {
      metric('unable_to_assess');
      return json({
        status: 'unable_to_assess',
        confidence,
        model_version: result?.model_version ?? 'unknown',
        summary: 'The image could not be assessed reliably. Please retake it or contact a veterinarian.',
      });
    }
    const upstreamStatus = String(result.status ?? 'unable_to_assess');
    const status = ['normal', 'needs_vet', 'urgent'].includes(upstreamStatus)
      ? upstreamStatus
      : 'unable_to_assess';
    metric(status);
    return json({
      status,
      confidence,
      model_version: String(result.model_version ?? 'unknown'),
      summary: String(result.summary ?? 'Preliminary screening completed.'),
    });
  } catch (error) {
    metric(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'failure');
    return json({ error: error instanceof DOMException && error.name === 'AbortError' ? 'Screening timed out' : 'Screening failed' }, 504);
  } finally {
    clearTimeout(timer);
  }
});
