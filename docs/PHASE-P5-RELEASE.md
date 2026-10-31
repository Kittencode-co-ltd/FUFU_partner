# Phase P5 Release Checklist

- [ ] Owner approves privacy, consent, retention, lead-time, cancellation and no-show policies.
- [ ] Three pilot clinics and contacts are selected and trained.
- [ ] CI passes install, unit, DB, API integration, CSS build and secret scan.
- [ ] Staging uses test-only seed and no production credentials.
- [ ] Mobile request → Partner confirm/check-in → vet summary → Mobile summary passes.
- [ ] Tablet/desktop keyboard, focus, responsive and retry states are checked.
- [ ] No critical/high security findings remain.
- [ ] Backup/restore rehearsal is recorded.
- [ ] Logs contain request IDs and no token, phone or health payload.

Automated implementation is ready locally. External pilot selection, legal approvals and production/staging deployment remain owner-controlled and are intentionally not performed by Codex.
