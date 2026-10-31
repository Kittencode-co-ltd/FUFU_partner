import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('P2 exposes safe public clinic profile and availability',async()=>{const s=await read('server/routes/public-clinics.js');assert.match(s,/available-slots/);assert.match(s,/ETag/);});
test('P3 uses canonical states, locking and idempotency',async()=>{const s=await read('supabase/migrations/20260922000300_appointment_state_machine.sql');assert.match(s,/pg_advisory_xact_lock/);assert.match(s,/idempotency_key/);assert.match(s,/checked_in/);});
test('P3 MVP UI has inbox retry and calendar states',async()=>{const s=await read('public/js/partner/appointments-mvp.js');assert.match(s,/ลองอีกครั้ง/);assert.match(s,/calendar/);assert.match(s,/history/);});
test('P4 consent and finalized summary are enforced in schema',async()=>{const s=await read('supabase/migrations/20260922000400_consent_visit_summary.sql');assert.match(s,/appointment_data_consents/);assert.match(s,/prevent_finalized_summary_edit/);assert.match(s,/finalize_visit_summary/);});
test('P5 CI runs every phase integration suite',async()=>{const s=await read('.github/workflows/partner-ci.yml');for(const name of ['test:security-integration','test:p2-integration','test:p3-p4-integration'])assert.match(s,new RegExp(name));});
