-- Phase 6: normalized preliminary-screening metadata and minimal feedback.

alter table public.scan_results
  add column if not exists screening_status text,
  add column if not exists model_version text;

alter table public.scan_results
  drop constraint if exists scan_results_screening_status_check;
alter table public.scan_results
  add constraint scan_results_screening_status_check
  check (screening_status is null or screening_status in (
    'normal', 'needs_vet', 'urgent', 'unable_to_assess'
  ));

create table if not exists public.screening_feedback (
  id bigint generated always as identity primary key,
  scan_result_id uuid not null references public.scan_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  unique (scan_result_id, user_id)
);

alter table public.screening_feedback enable row level security;
alter table public.screening_feedback force row level security;
drop policy if exists screening_feedback_owner_all on public.screening_feedback;
create policy screening_feedback_owner_all on public.screening_feedback
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.scan_results s
      where s.id = scan_result_id and s.user_id = auth.uid()
    )
  );
grant select, insert, update, delete on public.screening_feedback to authenticated;
