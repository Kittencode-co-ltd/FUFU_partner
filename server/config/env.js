const allowedEnvironments = new Set(['development', 'staging', 'production', 'test']);

export function validateEnvironment(env = process.env) {
  const name = env.NODE_ENV || 'development';
  if (!allowedEnvironments.has(name)) throw new Error(`Unsupported NODE_ENV: ${name}`);
  if (!env.Project_URL || !env.publishable_key) {
    throw new Error('Project_URL and publishable_key are required');
  }
  const hosted = Boolean(env.RAILWAY_ENVIRONMENT || env.VERCEL || env.RENDER || env.FLY_APP_NAME);
  if ((name === 'production' || hosted) && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(env.Project_URL)) {
    throw new Error('Hosted deployments must use the remote Supabase project URL, not a local Supabase URL');
  }
  return name;
}
