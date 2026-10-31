const allowedEnvironments = new Set(['development', 'staging', 'production', 'test']);

export function validateEnvironment(env = process.env) {
  const name = env.NODE_ENV || 'development';
  if (!allowedEnvironments.has(name)) throw new Error(`Unsupported NODE_ENV: ${name}`);
  if (!env.Project_URL || !env.publishable_key) {
    throw new Error('Project_URL and publishable_key are required');
  }
  if (name === 'production' && /localhost|127\.0\.0\.1/.test(env.Project_URL)) {
    throw new Error('Production cannot use a local Supabase URL');
  }
  return name;
}
