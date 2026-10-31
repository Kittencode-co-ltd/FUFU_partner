# Backup and Restore Runbook

For local/staging validation, export with `supabase db dump --linked=false -f backup.sql` and store the encrypted artifact outside the repository. Restore only into an empty, approved target using `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backup.sql`. Before restore, record project ID, backup checksum and approver. After restore, run migrations, `supabase test db`, API integration tests and row-count/security spot checks. Never place credentials or production dumps in Git. Production backup/restore requires an owner-approved maintenance window and provider-native point-in-time recovery.

