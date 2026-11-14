-- Store the active suspension reason where the Partner portal can read it.
alter table public.stores
  add column if not exists suspension_reason text;

-- audit_logs already has reason/old_data/new_data/user_agent in the live schema.
-- Keep these IF NOT EXISTS clauses for clean installs and older environments.
alter table public.audit_logs
  add column if not exists reason text,
  add column if not exists old_data jsonb,
  add column if not exists new_data jsonb,
  add column if not exists user_agent text;

-- Recover reasons from prior audit records when available.
update public.stores as s
set suspension_reason = coalesce(
  (select a.reason
   from public.audit_logs as a
   where a.store_id = s.id
     and a.action = 'PARTNER_SUSPEND'
     and a.reason is not null
   order by a.created_at desc
   limit 1),
  (select coalesce(a.new_data ->> 'reason', a.new_data ->> 'suspension_reason')
   from public.audit_logs as a
   where a.store_id = s.id
     and a.action = 'PARTNER_SUSPEND'
     and coalesce(a.new_data ->> 'reason', a.new_data ->> 'suspension_reason') is not null
   order by a.created_at desc
   limit 1)
)
where s.is_active = false
  and s.suspension_reason is null;
