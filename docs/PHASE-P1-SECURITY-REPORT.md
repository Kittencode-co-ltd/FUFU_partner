# Phase P1 Security Report

วันที่: 2026-09-22

## Implemented

- Bearer JWT verification and user-scoped Supabase clients remain mandatory on every protected route
- global 401 handling performs one refresh attempt, rotates refresh token and clears expired sessions
- store settings mutations resolve the target store from the database and require `owner`
- staff list/mutations require owner where applicable; ordinary staff table access uses `req.supabase`
- service-role usage in staff routes is limited to trusted Auth user creation/password operations after owner authorization
- active MVP roles are limited to `owner`, `reception`, `vet`; unsupported historical staff are deactivated by a forward-only migration
- login/register/refresh and all API mutations have bounded in-memory rate limits
- request bodies are limited to 100 KB
- CORS uses an environment allowlist; production has no implicit allowed origin
- CSP, frame, MIME, referrer, permissions and opener security headers are enabled
- CI runs static security tests and a repository secret scan
- local/staging seed contains one deterministic review owner account

## Review account (local/staging only)

- Email: `review@fufu.local`
- Password: `Fufu2026!`
- Store: `[TEST] FUFU Clinic Bangkok`
- Provision with `supabase db reset`; never run the seed against production

## Verification

- `npm test`: 21 tests passed
- `npm run security:secrets`: passed
- JavaScript syntax checks: passed
- runtime smoke: protected route returned 401 with CSP, frame protection and request ID
- runtime smoke: unknown API route returned structured 404
- `supabase db reset`: all seven migrations and local review seed applied successfully
- `supabase test db`: pgTAP/RLS passed 10/10
- API integration passed with real local JWTs: unauthenticated 401, cross-store 403,
  vet store mutation 403, reception medical write 403, tampered record ID 403 and refresh success
- browser smoke passed for owner, vet and reception login; role labels and role-filtered MVP navigation were verified

## Development environment resolution

The retired remote development hostname returned DNS `ENOTFOUND`. Development was moved to
the repository's isolated local Supabase stack at `127.0.0.1:55321`; no remote or production
database was changed. Supabase CLI 2.117.0 applied all migrations and the seed successfully.
The review account login, refresh-token response and authenticated appointment inbox were
verified through the Partner API on `localhost:3000`.

## Remaining acceptance work

- decide whether rate limiting must move from process memory to a shared store before multi-instance deployment
