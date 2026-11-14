-- Align the database transition RPC with the partner portal's existing lifecycle.
alter table public.appointments
  add column if not exists proposed_starts_at timestamptz,
  add column if not exists proposed_ends_at timestamptz;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('Pending','Confirmed','Cancelled','Completed','scheduled',
    'requested','confirmed','rejected','cancelled','completed','checked_in','reschedule_proposed','no_show'));

create or replace function public.transition_appointment(
  p_appointment_id uuid,p_to_status text,p_reason text,p_idempotency_key text,p_proposed_starts_at timestamptz default null
) returns public.appointments
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.appointments; v_from text; v_store_member boolean; v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_to_status not in ('confirmed','rejected','cancelled','completed','checked_in','reschedule_proposed','no_show') then
    raise exception 'invalid status' using errcode='22023'; end if;
  if p_to_status='rejected' and nullif(trim(p_reason),'') is null then raise exception 'rejection reason required' using errcode='22023'; end if;
  if p_to_status='reschedule_proposed' and (p_proposed_starts_at is null or p_proposed_starts_at<=now()) then
    raise exception 'valid proposed time required' using errcode='22023'; end if;
  select * into v from public.appointments where id=p_appointment_id for update;
  if v.id is null then raise exception 'appointment not found' using errcode='P0002'; end if;
  v_store_member:=public.is_store_member(v.store_id);
  if not v_store_member and auth.uid() is distinct from v.user_id then raise exception 'appointment access denied' using errcode='42501'; end if;
  if exists(select 1 from public.appointment_status_history where appointment_id=v.id and idempotency_key=p_idempotency_key) then return v; end if;
  v_from:=case v.status when 'Pending' then 'requested' when 'Confirmed' then 'confirmed' when 'Cancelled' then 'cancelled' when 'Completed' then 'completed' when 'scheduled' then 'confirmed' else v.status end;
  v_allowed:=case v_from
    when 'requested' then p_to_status in ('confirmed','rejected','cancelled','reschedule_proposed')
    when 'reschedule_proposed' then p_to_status in ('confirmed','rejected','cancelled')
    when 'confirmed' then p_to_status in ('checked_in','cancelled','no_show','completed')
    when 'checked_in' then p_to_status in ('completed','cancelled')
    else false end;
  if not v_allowed then raise exception 'invalid appointment transition' using errcode='23514'; end if;
  if p_to_status in ('confirmed','rejected','reschedule_proposed','checked_in','completed','no_show') and not v_store_member then
    raise exception 'only store staff can perform this transition' using errcode='42501'; end if;
  update public.appointments set status=p_to_status,
    rejection_reason=case when p_to_status='rejected' then trim(p_reason) else rejection_reason end,
    clinic_notes=case when v_store_member and p_reason is not null then p_reason else clinic_notes end,
    proposed_starts_at=case when p_to_status='reschedule_proposed' then p_proposed_starts_at else proposed_starts_at end,
    proposed_ends_at=case when p_to_status='reschedule_proposed' then p_proposed_starts_at+(ends_at-starts_at) else proposed_ends_at end,
    starts_at=case when v_from='reschedule_proposed' and p_to_status='confirmed' and proposed_starts_at is not null then proposed_starts_at else starts_at end,
    ends_at=case when v_from='reschedule_proposed' and p_to_status='confirmed' and proposed_ends_at is not null then proposed_ends_at else ends_at end,
    cancelled_at=case when p_to_status='cancelled' then now() else cancelled_at end,
    cancelled_by=case when p_to_status='cancelled' then auth.uid() else cancelled_by end,
    cancellation_reason=case when p_to_status='cancelled' then p_reason else cancellation_reason end,
    updated_at=now()
    where id=v.id returning * into v;
  insert into public.appointment_status_history(appointment_id,from_status,to_status,changed_by,reason,idempotency_key)
    values(v.id,v_from,p_to_status,auth.uid(),p_reason,p_idempotency_key);
  if v.user_id is not null then
    insert into public.notifications(user_id,store_id,appointment_id,event_type,title,body,category,icon)
    values(v.user_id,v.store_id,v.id,'appointment_'||p_to_status,
      case p_to_status when 'confirmed' then 'ยืนยันการจองแล้ว' when 'rejected' then 'ร้านปฏิเสธการจอง' else 'อัปเดตสถานะการจอง' end,
      case when p_to_status='rejected' then 'เหตุผล: '||trim(p_reason) else coalesce(nullif(trim(p_reason),''),'สถานะการจองของคุณมีการเปลี่ยนแปลง') end,'Health','calendar');
  end if;
  return v;
end $$;

revoke all on function public.transition_appointment(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.transition_appointment(uuid,text,text,text,timestamptz) to authenticated;
