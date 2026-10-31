import { randomUUID } from 'node:crypto';

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.requestId = /^[a-zA-Z0-9_-]{8,80}$/.test(incoming || '') ? incoming : randomUUID();
  res.set('x-request-id', req.requestId);
  const startedAt = Date.now();
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info', event: 'http_request', request_id: req.requestId,
    method: req.method, path: req.path, status: res.statusCode,
    duration_ms: Date.now() - startedAt,
  })));

  const key = req.ip || 'unknown';
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS) {
    res.set('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests', request_id: req.requestId });
  }
  next();
}

export function sanitizedErrorHandler(err, req, res, _next) {
  console.error(JSON.stringify({
    level: 'error', request_id: req.requestId, method: req.method,
    path: req.path, error: err?.name || 'Error',
  }));
  if (process.env.ERROR_MONITOR_URL) {
    fetch(process.env.ERROR_MONITOR_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'server_error', request_id: req.requestId, error: err?.name || 'Error' }),
    }).catch(() => {});
  }
  res.status(500).json({ error: 'Internal server error', request_id: req.requestId });
}
