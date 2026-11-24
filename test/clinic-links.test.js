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

test('B2B packages: user limits in the database, read-only Portal after expiry, owner-only ordering', async () => {
  const sql = await read('../supabase/migrations/20261124000100_clinic_plans_b2b.sql');
  assert.match(sql, /create trigger staff_plan_limit before insert or update of is_active, store_id on public\.staff/);
  assert.match(sql, /errcode = 'P0004'/);
  assert.match(sql, /owner_id = auth\.uid\(\)\) then\s+raise exception 'only the clinic owner can order a package'/);
  assert.match(sql, /create policy clinic_plans_public_read on public\.clinic_plans for select to anon using \(is_active\)/);
  assert.match(sql, /alter table public\.billing_settings enable row level security/);
  assert.doesNotMatch(sql, /on public\.billing_settings for/);
  const rbac = await read('../server/middleware/rbac.js');
  assert.match(rbac, /rpc\('clinic_plan_writable'/);
  assert.match(rbac, /'\/api\/clinic-links\/billing', '\/api\/clinic-links\/emergency'/);
  const route = await read('../server/routes/clinic-links.js');
  assert.match(route, /router\.post\('\/billing\/order', requireRole\('owner'\)/);
  const app = await read('../server/app.js');
  assert.match(app, /app\.use\('\/api\/public\/plans',\s+publicPlanRoutes\)/);
});

test('care reminders: daily job is not callable by users, sends once, and only the owner changes settings', async () => {
  const sql = await read('../supabase/migrations/20261124000200_care_reminders.sql');
  assert.match(sql, /revoke all on function public\.run_care_reminders\(\) from public, anon, authenticated/);
  assert.match(sql, /unique \(kind, ref_id, days_before\)/);
  assert.match(sql, /on conflict \(kind, ref_id, days_before\) do nothing/);
  assert.match(sql, /p\.user_id is not null/);
  assert.match(sql, /cron\.schedule\('care-reminders-daily', '0 1 \* \* \*'/);
  assert.match(sql, /owner_id = auth\.uid\(\)\) then\s+raise exception 'only the store owner can change reminders'/);
  for (const table of ['reminder_settings', 'care_reminders']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`));
  }
  const route = await read('../server/routes/reminders.js');
  assert.match(route, /router\.put\('\/settings', requireRole\('owner'\)/);
});

test('certificates: vet list needs a store member, licence edits are owner or the vet themself; labels escape drug text', async () => {
  const route = await read('../server/routes/certificates.js');
  assert.match(route, /router\.use\(requireAuth\)/);
  for (const line of route.match(/router\.(get|post|put|patch|delete)\([^\n]+/g) || []) assert.match(line, /requireRole\(/, line);
  assert.match(route, /req\.staffRole !== 'owner'/);
  assert.doesNotMatch(route, /service_role|supabaseAdmin|createAdminClient/i);
  const sql = await read('../supabase/migrations/20261124000300_staff_license.sql');
  assert.match(sql, /license_no/);
  assert.match(sql, /owner_license_no/);
  const app = await read('../server/app.js');
  assert.match(app, /app\.use\('\/api\/certificates',\s+\w+\)/);
  const docs = await read('../public/js/utils/print-docs.js');
  assert.match(docs, /export function printCertificate/);
  assert.match(docs, /size: 50mm 30mm/);
  assert.match(docs.slice(docs.indexOf('export function printDrugLabels')), /_esc\(rx\.drug/);
});

test('business reports and Excel import: signed-in, owner-level roles, user-scoped client only', async () => {
  const reports = await read('../server/routes/reports.js');
  assert.match(reports, /router\.use\(requireAuth\)/);
  assert.match(reports, /router\.get\('\/summary', requireRole\('owner', 'accountant'\)/);
  assert.match(reports, /MAX_DAYS = 366/);
  const imp = await read('../server/routes/import.js');
  assert.match(imp, /router\.use\(requireAuth\)/);
  assert.match(imp, /router\.post\('\/rows', requireRole\('owner'\)/);
  assert.match(imp, /req\.body\.dry_run !== false/, 'import checks first unless dry_run is explicitly false');
  assert.match(imp, /withVaccines && row\.vaccine_name/, 'only clinics import vaccine history');
  for (const src of [reports, imp]) assert.doesNotMatch(src, /service_role|supabaseAdmin|createAdminClient/i);
  const app = await read('../server/app.js');
  assert.match(app, /app\.use\('\/api\/reports',\s+reportRoutes\)/);
  assert.match(app, /app\.use\('\/api\/import',\s+importRoutes\)/);
});

test('clinic-only features are closed to shops, grooming and hotels on the server', async () => {
  const rbac = await read('../server/middleware/rbac.js');
  assert.match(rbac, /export async function requireClinicStore/);
  assert.match(rbac, /code: 'CLINIC_ONLY'/);
  const certs = await read('../server/routes/certificates.js');
  for (const line of certs.match(/router\.(get|put)\([^\n]+/g)) assert.match(line, /requireClinicStore/, line);
  const links = await read('../server/routes/clinic-links.js');
  for (const path of ["'/billing'", "'/billing/order'", "'/shared'", "'/emergency'", "'/emergency/:id'"]) {
    assert.match(links, new RegExp(`router\\.(get|post)\\(${path.replace(/[/:]/g, m => `\\${m}`)}, requireRole\\([^)]*\\), requireClinicStore`), path);
  }
  const billing = await read('../public/js/partner/clinic-billing.js');
  assert.doesNotMatch(billing, /grooming|โรงแรม/, 'clinic billing never mentions other businesses');
});

test('website pricing shows seller details, net prices (no VAT: not VAT-registered) and the terms page', async () => {
  const messages = await read('../app/i18n/messages.js');
  assert.match(messages, /taxId: '0655569001411'/);
  assert.doesNotMatch(messages, /grooming และโรงแรมสัตว์เลี้ยงใช้ฟรี|grooming and pet hotels are free/);
  const landing = await read('../app/components/landing.jsx');
  assert.doesNotMatch(landing, /bahtVat|vatIncl/);
  assert.doesNotMatch(messages, /vatIncl|VAT 7%/, 'FUFU is not VAT-registered: its own prices never mention VAT');
  assert.doesNotMatch(await read('../public/js/partner/clinic-billing.js'), /VAT/);
  assert.match(landing, /href="\/terms"/);
  const security = await read('../server/middleware/security.js');
  assert.match(security, /'\/terms'\]/, '/terms gets the CSP nonce like other Next pages');
});
