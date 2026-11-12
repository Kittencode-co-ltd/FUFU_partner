import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('appointment API never creates a service-role client', async () => {
  const source = await read('../server/routes/appointments.js');
  assert.doesNotMatch(source, /service_role|adminSb|createClient/);
  assert.match(source, /req\.supabase/);
});

test('RBAC lookups remain user scoped', async () => {
  const source = await read('../server/middleware/rbac.js');
  assert.doesNotMatch(source, /service_role|SERVICE_ROLE|createClient|_admin/);
  assert.match(source, /req\.supabase/);
});

test('partner auth never bypasses verification with service role', async () => {
  const source = await read('../server/routes/auth.js');
  assert.doesNotMatch(source, /service_role|SERVICE_ROLE|auth\.admin|email_confirm/);
  assert.match(source, /needs_email_verification/);
  assert.match(source, /is_verified: false/);
  assert.match(source, /PARTNER_PENDING_APPROVAL/);
  assert.match(source, /router\.get\('\/partner-access', requireAuth/);
  const rbac = await read('../server/middleware/rbac.js');
  assert.match(rbac, /store\.is_verified !== true/);
  const approvalMigration = await read('../supabase/migrations/20261112000100_partner_approval_gate.sql');
  assert.match(approvalMigration, /auth\.uid\(\) is not null/);
  assert.match(approvalMigration, /before insert or update of is_verified on public\.stores/i);
});

test('core RLS has explicit owner and clinic policies', async () => {
  const source = await read('../supabase/migrations/20260921000100_mvp_rls.sql');
  for (const policy of [
    'pets_owner_all',
    'health_records_owner_all',
    'vaccinations_owner_all',
    'appointments_owner_select',
    'appointments_clinic_select',
  ]) assert.match(source, new RegExp(`create policy ${policy}`));
  assert.doesNotMatch(source, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(source, /with check\s*\(\s*true\s*\)/i);
  assert.match(source, /enforce_appointment_update/);
  assert.match(source, /appointment identity and slot are immutable/);
});

test('scan storage is private and all writes are owner-folder scoped', async () => {
  const source = await read('../supabase/migrations/20260921000200_mvp_storage.sql');
  assert.match(source, /'scan-images', 'scan-images', false/);
  assert.match(source, /storage\.foldername\(name\)/);
  assert.match(source, /auth\.uid\(\)::text/);
});

test('account deletion rejects missing, revoked, and stale sessions', async () => {
  const source = await read('../supabase/functions/delete-account/index.ts');
  assert.match(source, /authorization\?\.startsWith\('Bearer '\)/);
  assert.match(source, /userClient\.auth\.getUser\(\)/);
  assert.match(source, /Recent authentication required/);
  assert.match(source, /10 \* 60_000/);
});

test('account deletion removes owned storage before deleting the Auth user', async () => {
  const source = await read('../supabase/functions/delete-account/index.ts');
  for (const bucket of ['pet-avatars', 'profile-avatars', 'scan-images']) {
    assert.match(source, new RegExp(`'${bucket}'`));
  }
  const storageRemoval = source.indexOf('.remove(paths)');
  const authDeletion = source.indexOf('admin.auth.admin.deleteUser');
  assert.ok(storageRemoval >= 0 && authDeletion > storageRemoval);
  assert.match(source, /status: 'completed'/);
  assert.match(source, /status: 'rejected'/);
});

test('appointment workflow enforces one active slot and writes audit history', async () => {
  const source = await read('../supabase/migrations/20260921000300_appointment_workflow.sql');
  assert.match(source, /create unique index if not exists appointments_one_active_slot/);
  assert.match(source, /where status in \('Pending', 'Confirmed'\)/);
  assert.match(source, /create table if not exists public\.appointment_status_audit/);
  assert.match(source, /create trigger audit_appointment_status/);
  assert.match(source, /appointment date cannot be in the past/);
  assert.match(source, /60 minutes lead time/);
  assert.match(source, /pet_id is null/);
});

test('mobile cancellation changes status instead of deleting the appointment', async () => {
  const source = await read('../../FUFU-App-Mobile/lib/services/supabase_service.dart');
  assert.match(source, /return updateAppointmentStatus\(id, 'Cancelled'\)/);
  assert.match(source, /idempotency_key/);
});

test('preliminary screening runs behind an authenticated bounded proxy', async () => {
  const edge = await read('../supabase/functions/preliminary-screening/index.ts');
  assert.match(edge, /userClient\.auth\.getUser\(\)/);
  assert.match(edge, /storagePath\?\.startsWith\(`\$\{user\.id\}\//);
  assert.match(edge, /5 \* 1024 \* 1024/);
  assert.match(edge, /20_000/);
  assert.match(edge, /unable_to_assess/);

  const mobile = await read('../../FUFU-App-Mobile/lib/screens/scan_screen.dart');
  assert.doesNotMatch(mobile, /YOLO_API_URL|MultipartRequest|\/predict/);
  const nlp = await read('../../FUFU-App-Mobile/lib/services/nlp_service.dart');
  assert.doesNotMatch(nlp, /String\.fromEnvironment\('GEMINI_API_KEY'\)|ngrok-free\.app/);
});
