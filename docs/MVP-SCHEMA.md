# MVP canonical data model

| Table | Owner / tenant key | Purpose |
|---|---|---|
| `profiles` | `id = auth.uid()` | Customer account profile |
| `pets` | `user_id` | Customer-owned pet profiles |
| `health_records` | `user_id`, `pet_id` | General health history |
| `vaccinations` | `user_id`, `pet_id` | Vaccination history and due dates |
| `stores` | `owner_id`; public verified read | Discoverable clinics |
| `appointments` | `user_id`, `store_id` | Shared customer/clinic appointment record |
| `scan_results` | `user_id`, `pet_id` | Preliminary-screening result |
| `account_deletion_requests` | `user_id` | Server-processed dพฑeletion queue |

UUID foreign keys use `ON DELETE CASCADE` for customer-owned records and `RESTRICT`
where deleting a clinic/pet would destroy appointment history. Timestamps are stored as
`timestamptz` (UTC); clients display them in Asia/Bangkok.

Migration order is authoritative. Files under `scripts/db_rebuild` and `docs/db.sql` are
legacy references and must not be used to mutate staging or production.

## Storage inventory

| Bucket | Read | Write | Limit |
|---|---|---|---:|
| `pet-avatars` | Public URL (temporary compatibility) | Owner UUID folder | 5 MB |
| `profile-avatars` | Public URL (temporary compatibility) | Owner UUID folder | 5 MB |
| `scan-images` | Owner signed URL | Owner UUID folder | 10 MB |

Allowed MIME types are JPEG, PNG and WebP. Avatar buckets should become private when
Phase 3 changes persisted URLs to storage object paths. Scan-image retention remains a
product-owner decision; no automated deletion policy is enabled yet.
