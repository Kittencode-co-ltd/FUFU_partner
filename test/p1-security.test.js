import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('every non-auth route installs requireAuth', async () => {
  const directory = new URL('../server/routes/', import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith('.js') && !['auth.js','public-clinics.js'].includes(name));
  for (const file of files) {
    const source = await read(`../server/routes/${file}`);
    assert.match(source, /router\.use\(requireAuth\)/, `${file} must require authentication`);
  }
});

test('security foundation limits auth/mutations, restricts CORS and sets headers', async () => {
  const index = await read('../server/index.js');
  const security = await read('../server/middleware/security.js');
  const auth = await read('../server/routes/auth.js');
  assert.match(index, /mutationRateLimit/);
  assert.match(index, /express\.json\(\{ limit: '100kb' \}\)/);
  assert.match(index, /cors\(corsOptions\(\)\)/);
  assert.match(security, /Content-Security-Policy/);
  assert.match(security, /CORS_ORIGINS/);
  assert.match(auth, /router\.post\('\/login', loginAttemptThrottle, authRateLimit/);
  assert.match(auth, /router\.post\('\/refresh', authRateLimit/);
});

test('MVP exposes only owner, reception and vet roles', async () => {
  const roles = await read('../server/config/roles.js');
  const object = roles.slice(roles.indexOf('export const FIXED_ROLES'), roles.indexOf('export const ASSIGNABLE_ROLES'));
  const keys = [...object.matchAll(/^  ([a-z_]+): \{/gm)].map(match => match[1]);
  assert.deepEqual(keys, ['owner', 'vet', 'reception']);
  assert.match(roles, /ASSIGNABLE_ROLES = \[FIXED_ROLES\.reception, FIXED_ROLES\.vet\]/);
});

test('staff database reads and writes remain user-scoped', async () => {
  const staff = await read('../server/routes/staff.js');
  assert.match(staff, /req\.supabase/);
  assert.doesNotMatch(staff, /admin(?:Sb)?\s*\.from\('staff'\)/);
  assert.match(staff, /role must be reception or vet/);
});

test('store settings require resolved owner authorization', async () => {
  const stores = await read('../server/routes/stores.js');
  assert.match(stores, /router\.patch\('\/:id', useStoreIdParam\('id'\), requireRole\('owner'\)/);
});

test('client refreshes once and clears expired sessions globally', async () => {
  const client = await read('../public/js/utils/api-client.js');
  assert.match(client, /let _refreshing = null/);
  assert.match(client, /if \(res\.status === 401\)/);
  assert.match(client, /storage\.clearSession\(\)/);
});

test('local review login is deterministic and explicitly non-production', async () => {
  const seed = await read('../supabase/seed.sql');
  assert.match(seed, /Staging\/development only\. Never run this file against production/);
  assert.match(seed, /review@fufu\.local/);
  assert.match(seed, /crypt\('Fufu2026!', gen_salt\('bf'\)\)/);
  assert.match(seed, /90000000-0000-4000-8000-000000000001/);
});
