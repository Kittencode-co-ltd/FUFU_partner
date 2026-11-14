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

// Requests rendered by Next.js (see server/index.js). Everything else is the static
// partner portal in public/ (login/register/dashboard .html + ES modules).
const NEXT_PAGES = new Set(['/', '/login', '/register', '/onboarding']);
export function isNextRequest(path) {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return NEXT_PAGES.has(clean) || path === '/_next' || path.startsWith('/_next/');
}

// Content-Security-Policy for the static partner portal pages (login / register / dashboard).
// Used by securityHeaders below and by next.config.mjs when deployed on Vercel.
export const PORTAL_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function securityHeaders(req, res, next) {
  const nonce = randomBytes(18).toString('base64');
  // The custom server is launched as `node server/index.js dev`; unlike the
  // Next CLI, that argument does not always set NODE_ENV before this middleware
  // runs. Keep the development CSP aligned with Next's actual dev mode.
  const isDevelopment = process.argv.includes('dev') || process.env.NODE_ENV !== 'production';
  const forNext = isNextRequest(req.path);
  const contentSecurityPolicy = [
    "default-src 'self'",
    forNext
      // Next.js attaches the nonce to its own scripts; strict-dynamic lets them load chunks.
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`
      // Static portal pages load /js/*.js from this origin and cannot carry a per-request
      // nonce, so 'strict-dynamic' (which ignores 'self') would block every portal script.
      // No inline scripts or inline event handlers are allowed here.
      : "script-src 'self'",
    forNext && !isDevelopment
      ? `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`
      // Portal modules inject <style> blocks at runtime, which a nonce cannot cover.
      : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // Brand theme-song players on the landing page (privacy-enhanced YouTube embed only)
    ...(forNext ? ["frame-src https://www.youtube-nocookie.com"] : []),
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
  // The public Partner portal is hosted on the apex domain; the Webapp may call
  // approved Partner endpoints from its app subdomain. Keep both allowed even
  // when a Vercel environment still has an older CORS_ORIGINS value.
  const productionDomains = ['https://fufupetcare.com', 'https://app.fufupetcare.com'];
  // Also allow Vercel's generated deployment URLs for previews and deployments.
  const vercel = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(Boolean).map(host => `https://${host}`);
  const allowed = new Set([
    ...configured,
    ...productionDomains,
    ...(env.NODE_ENV === 'production' ? [] : development),
    ...vercel,
  ]);
  return {
    credentials: false,
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
  };
}
