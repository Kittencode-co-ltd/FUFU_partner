# Phase P3 Report

Appointments use canonical lowercase states, UTC timestamps and database-enforced transitions. Creation uses transaction-scoped advisory locks and service capacity. Create/status mutations require idempotency keys. Inbox buckets, weekly calendar, pagination, search, status history and notification records are implemented.

