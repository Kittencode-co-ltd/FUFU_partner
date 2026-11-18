import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('hotel and grooming never write the raw request body', async () => {
  for (const file of ['hotel.js', 'grooming.js']) {
    const source = await read(`../server/routes/${file}`);
    assert.doesNotMatch(source, /\.update\(\s*req\.body\s*\)/, `${file} must whitelist updatable fields`);
    assert.doesNotMatch(source, /\.update\(\s*\{\s*\.\.\.req\.body/, `${file} must whitelist updatable fields`);
    assert.doesNotMatch(source, /'staff'/, `${file}: "staff" is not a real RBAC role (owner, reception, vet)`);
  }
});

test('every hotel and grooming route checks the store role', async () => {
  for (const file of ['hotel.js', 'grooming.js']) {
    const source = await read(`../server/routes/${file}`);
    const routes = source.match(/router\.(get|post|patch|delete)\([^\n]+/g) || [];
    assert.ok(routes.length > 3, `${file} has routes`);
    for (const line of routes) assert.match(line, /requireRole\(/, `${file}: ${line.slice(0, 80)} must use requireRole`);
  }
});

test('hotel reservations go through the double-booking guard', async () => {
  const source = await read('../server/routes/hotel.js');
  assert.match(source, /rpc\('reserve_hotel_room'/);
  assert.doesNotMatch(source, /from\('hotel_bookings'\)\.insert/, 'bookings must be created by reserve_hotel_room()');
  const migration = await read('../supabase/migrations/20261118000100_hotel_grooming_bookings.sql');
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.reserve_hotel_room[^;]+from public, anon/);
});

test('availability uses a real overlap (start before range end AND end after range start)', async () => {
  const source = await read('../server/routes/hotel.js');
  assert.doesNotMatch(source, /\.or\(`check_in_date\.lte/, 'OR-based overlap returns every booking');
  assert.match(source, /\.lte\('check_in_date', to\)\.gt\('check_out_date', from\)/);
});
