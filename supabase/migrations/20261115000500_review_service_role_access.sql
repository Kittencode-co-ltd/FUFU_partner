-- Admin review moderation uses a server-only service-role client.
grant select, insert, update on public.store_reviews to service_role;
grant select, insert on public.store_review_audit_logs to service_role;
