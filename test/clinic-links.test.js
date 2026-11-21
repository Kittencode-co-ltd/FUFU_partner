import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('clinic link routes need a signed-in store member; rotating the code is owner-only', async () => {
  const source = await read('../server/routes/clinic-links.js');
  assert.match(source, /router\.use\(requireAuth\)/);
  for (const line of source.match(/router\.(get|post|patch|delete)\([^\n]+/g) || []) assert.match(line, /requireRole\(/, line);
  assert.match(source, /router\.post\('\/code\/rotate', requireRole\('owner'\)/);
  const app = await read('../server/app.js');
  assert.match(app, /app\.use\('\/api\/clinic-links',\s+clinicLinksRoutes\)/);
});

test('clinic link tables are read-only to clients and functions are not callable anonymously', async () => {
  const sql = await read('../supabase/migrations/20261121000100_clinic_links.sql');
  for (const table of ['clinic_links', 'clinic_link_codes', 'clinic_link_attempts']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`), `${table} has no client write policy`);
  }
  for (const fn of ['clinic_store_code', 'clinic_invite_code', 'clinic_linked_customers', 'link_clinic_by_code', 'link_clinic', 'set_primary_clinic', 'unlink_clinic', 'merge_clinic_pet'])
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`), `${fn} revoked from anon`);
  assert.match(sql, /revoke all on function public\._link_upsert\([^)]*\) from public, anon, authenticated/);
  // Guessing codes is rate limited and invites are single-use
  assert.match(sql, /clinic_link_attempts where user_id = v_uid and not ok and created_at > now\(\) - interval '15 minutes'\) >= 10/);
  assert.match(sql, /kind = 'store' or used_at is null/);
});

test('phase 3: clinics read App data only through the consent-checked function, and every view is logged', async () => {
  const sql = await read('../supabase/migrations/20261121000200_clinic_consent.sql');
  assert.match(sql, /alter table public\.clinic_data_views enable row level security/);
  assert.doesNotMatch(sql, /on public\.clinic_data_views for (insert|update|delete|all)/);
  for (const fn of ['set_clinic_consent', 'clinic_shared_data', 'clinic_linked_customers', 'unlink_clinic'])
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`), `${fn} revoked from anon`);
  // Membership is checked, another clinic's pets are never included, unlinking stops sharing
  assert.match(sql, /not public\.is_store_member\(p_store_id\)/);
  assert.match(sql, /store_id is null or store_id = p_store_id/);
  assert.match(sql, /consent = '\{\}'::jsonb/);
  const route = await read('../server/routes/clinic-links.js');
  assert.match(route, /router\.get\('\/shared', requireRole\(/);
  assert.match(route, /rpc\('clinic_shared_data'/);
});

test('phase 4: emergency codes expire, are claimed by the first clinic, are rate limited, and only expose App data', async () => {
  const sql = await read('../supabase/migrations/20261121000300_emergency_shares.sql');
  for (const table of ['emergency_shares', 'emergency_share_attempts']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`));
  }
  assert.match(sql, /interval '72 hours'/);
  assert.match(sql, /store_id is null or store_id = p_store_id/);
  assert.match(sql, /emergency_share_attempts where user_id = v_uid and not ok and created_at > now\(\) - interval '15 minutes'\) >= 10/);
  for (const fn of ['create_emergency_share', 'revoke_emergency_share', 'open_emergency_share'])
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`), `${fn} revoked from anon`);
  assert.match(sql, /revoke all on function public\._shared_payload\([^)]*\) from public, anon, authenticated/);
  // App data only: the payload never reads the clinics' own medical tables
  const payload = sql.slice(sql.indexOf('function public._shared_payload'), sql.indexOf('function public._log_data_view'));
  assert.doesNotMatch(payload, /medical_records|pet_vaccinations|ipd_admissions/);
  const route = await read('../server/routes/clinic-links.js');
  assert.match(route, /router\.post\('\/emergency', requireRole\(/);
});

test('phase 5: clinic packages are written only by the Admin server, and app features pause after the grace period', async () => {
  const sql = await read('../supabase/migrations/20261121000400_clinic_billing.sql');
  for (const table of ['clinic_plans', 'clinic_subscriptions', 'clinic_billing_invoices']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`));
  }
  for (const fn of ['admin_clinic_billing_overview', 'admin_issue_clinic_invoice', 'admin_mark_clinic_invoice_paid', 'admin_void_clinic_invoice', 'admin_update_clinic_subscription'])
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`), `${fn} is service-role only`);
  assert.match(sql, /interval '14 days'/);
  assert.match(sql, /interval '3 months'/);
  // Linking, invites and shared data follow the package; emergency sharing does not
  for (const fn of ['link_clinic_by_code', 'link_clinic', 'clinic_invite_code', 'clinic_shared_data']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}(`), sql.indexOf('end $$;', sql.indexOf(`function public.${fn}(`)));
    assert.match(body, /_clinic_app_enabled/, `${fn} checks the package`);
  }
  assert.doesNotMatch(sql, /function public\.open_emergency_share/);
  const route = await read('../server/routes/clinic-links.js');
  assert.match(route, /router\.get\('\/billing', requireRole\(/);
  assert.match(route, /req\.staffRole === 'owner' \? data : \{ \.\.\.data, invoices: undefined \}/);
});

test('phase 6: chat is readable only by the customer and the store, and writes go through checked functions', async () => {
  const sql = await read('../supabase/migrations/20261121000600_store_chat.sql');
  for (const table of ['chat_threads', 'chat_messages']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`));
  }
  assert.match(sql, /'chat-images', 'chat-images', false/);
  assert.match(sql, /bucket_id = 'chat-images' and public\._chat_member\(\(storage\.foldername\(name\)\)\[1\]\)/);
  for (const fn of ['start_chat', 'send_chat_message', 'mark_chat_read', 'store_chat_threads'])
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`), `${fn} revoked from anon`);
  assert.match(sql, /split_part\(p_image_path, '\/', 1\) <> t\.id::text/);
  assert.match(sql, /interval '1 minute'\) >= 30/);
  const route = await read('../server/routes/chat.js');
  assert.match(route, /router\.use\(requireAuth\)/);
  for (const line of route.match(/router\.(get|post)\([^\n]+/g) || []) assert.match(line, /requireRole\(/, line);
  assert.match(route, /data\.store_id === req\.query\.store_id/);
  const app = await read('../server/app.js');
  assert.match(app, /app\.use\('\/api\/chat',\s+chatRoutes\)/);
});
