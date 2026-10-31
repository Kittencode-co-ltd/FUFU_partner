const buckets = new Map();

function clientKey(req, scope) {
  return `${scope}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

export function rateLimit({ scope, windowMs, max }) {
  return (req, res, next) => {
    const key = clientKey(req, scope);
    const now = Date.now();
    const previous = buckets.get(key);
    const bucket = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > max) {
      res.set('retry-after', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({
        success: false,
        error: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
        code: 'RATE_LIMITED',
        request_id: req.requestId,
      });
    }
    next();
  };
}

export const authRateLimit = rateLimit({ scope: 'auth', windowMs: 15 * 60_000, max: 20 });
export const mutationRateLimit = rateLimit({ scope: 'mutation', windowMs: 60_000, max: 60 });

export function securityHeaders(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
}

export function corsOptions(env = process.env) {
  const configured = String(env.CORS_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const development = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowed = new Set(configured.length ? configured : (env.NODE_ENV === 'production' ? [] : development));
  return {
    credentials: false,
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
  };
}
