import { randomBytes } from 'node:crypto';

const buckets = new Map();
const failedLoginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 5;

function loginAttemptKey(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return `${req.ip || req.socket?.remoteAddress || 'unknown'}:${email}`;
}

export function loginAttemptThrottle(req, res, next) {
  const key = loginAttemptKey(req);
  const state = failedLoginAttempts.get(key);
  const now = Date.now();
  if (state?.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.blockedUntil - now) / 1000));
    res.set('retry-after', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'ลองรหัสผ่านผิดหลายครั้ง ระบบพักการเข้าสู่ระบบชั่วคราว',
      code: 'LOGIN_TEMPORARILY_BLOCKED',
      retry_after_seconds: retryAfterSeconds,
      request_id: req.requestId,
    });
  }
  req.loginAttemptKey = key;
  next();
}

export function recordFailedLogin(req) {
  const now = Date.now();
  const previous = failedLoginAttempts.get(req.loginAttemptKey) || { failures: [], lockCount: 0 };
  previous.failures = previous.failures.filter(time => now - time < LOGIN_WINDOW_MS);
  previous.failures.push(now);
  if (previous.failures.length >= LOGIN_MAX_FAILURES) {
    const durationMs = Math.min(15 * 60_000, 2 * 60_000 * (2 ** previous.lockCount));
    previous.lockCount += 1;
    previous.failures = [];
    previous.blockedUntil = now + durationMs;
    failedLoginAttempts.set(req.loginAttemptKey, previous);
    return { blocked: true, retryAfterSeconds: Math.ceil(durationMs / 1000), attemptsRemaining: 0 };
  }
  failedLoginAttempts.set(req.loginAttemptKey, previous);
  return { blocked: false, attemptsRemaining: LOGIN_MAX_FAILURES - previous.failures.length };
}

export function clearFailedLoginAttempts(req) {
  failedLoginAttempts.delete(req.loginAttemptKey);
}

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
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('retry-after', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
        code: 'RATE_LIMITED',
        retry_after_seconds: retryAfterSeconds,
        request_id: req.requestId,
      });
    }
    next();
  };
}

export const authRateLimit = rateLimit({ scope: 'auth', windowMs: 15 * 60_000, max: 20 });
export const mutationRateLimit = rateLimit({ scope: 'mutation', windowMs: 60_000, max: 60 });

export function securityHeaders(req, res, next) {
  const nonce = randomBytes(18).toString('base64');
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    isDevelopment
      ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
      : `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Next.js reads these incoming headers while rendering so it can attach the
  // same per-request nonce to its hydration and framework scripts.
  req.headers['x-nonce'] = nonce;
  req.headers['content-security-policy'] = contentSecurityPolicy;
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': contentSecurityPolicy,
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
