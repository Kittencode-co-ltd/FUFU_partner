# Phase 1 security report

## Implemented

- Ordered canonical migrations for the eight MVP tables
- Foreign keys, validation constraints, partial uniqueness and query indexes
- Owner and clinic RLS with `FORCE ROW LEVEL SECURITY`
- Cross-user/cross-clinic pgTAP test suite in `supabase/tests/rls_mvp.test.sql`
- Private scan-image bucket and owner-folder write policies
- Staging-only clinic seed data clearly marked `[TEST]`
- User-scoped Partner appointment/RBAC queries; appointment routes no longer create a service-role client
- Request IDs, sanitized error logging, bounded request rate and appointment input validation
- Authenticated account-deletion Edge Function removes owned Storage objects and Auth user
- Separate development, staging and production configuration templates

## Local verification (2026-09-21)

- Supabase CLI `2.117.0` initialized with isolated ports `55320–55329` so it
  does not interfere with another local Supabase project.
- `supabase start` applied every migration and `supabase/seed.sql` to a clean
  local PostgreSQL 17 instance.
- `supabase db reset` recreated the database and applied all six migrations
  from zero successfully.
- `supabase test db` passed the pgTAP/RLS suite: 1 file, 10 tests, 0 failures.
- `supabase migration list --local` confirmed all six migration versions are
  recorded in the local database.

## Deferred / requires owner input

- Repeat migrations and pgTAP tests against a Supabase staging project
- Choose scan-image retention period (30/90/365 days)
- Approve when clinic may view customer scan images or health history
- Supply verified pilot-clinic data and usage rights
- Move avatar reads to signed URLs before making avatar buckets private

No production environment was accessed or changed.
