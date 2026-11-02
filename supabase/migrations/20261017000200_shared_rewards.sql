-- Reward contract shared by customer Web and Mobile. No balance reset.
begin;
CREATE TABLE IF NOT EXISTS public.user_coins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('checkin','weekly_spin','ad_spin','redeem')),
  amount     INT         NOT NULL,   -- positive = earned, negative = spent
  ref_id     TEXT,                   -- reward_type or redemption id
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id             UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak      INT     NOT NULL DEFAULT 0,
  last_checkin_date   DATE,
  weekly_spin_ready   BOOLEAN DEFAULT FALSE,
  ad_spins_today      INT     NOT NULL DEFAULT 0,
  ad_spins_reset_at   DATE
);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT        NOT NULL,
  coins_spent INT         NOT NULL,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','applied','expired')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
create table if not exists public.reward_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 action text not null,
 reward_type text,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id, request_id)
);
-- Remove legacy owner-write policies and revoke table writes, including column grants.
do $$
declare t text; p record; c record;
begin
 foreach t in array array['user_coins','user_streaks','coin_transactions','reward_redemptions','reward_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  for c in select column_name from information_schema.columns where table_schema='public' and table_name=t loop
   execute format('revoke insert (%I), update (%I), references (%I) on public.%I from public, anon, authenticated',c.column_name,c.column_name,c.column_name,t);
  end loop;
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy reward_owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
 end loop;
end $$;

create schema if not exists rewards_private;
revoke all on schema rewards_private from public, anon, authenticated;
grant usage on schema rewards_private to authenticated;
create index if not exists reward_redemptions_user_created_idx on public.reward_redemptions(user_id,created_at desc);
create index if not exists coin_transactions_user_created_idx on public.coin_transactions(user_id,created_at desc);

create or replace function rewards_private.reward_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 today date := (now() at time zone 'Asia/Bangkok')::date;
 s public.user_streaks%rowtype;
 b integer;
begin
 if uid is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into s from public.user_streaks where user_id=uid;
 select balance into b from public.user_coins where user_id=uid;
 return jsonb_build_object(
  'balance',coalesce(b,0),
  'streak',case when s.last_checkin_date >= today-1 then coalesce(s.current_streak,0) else 0 end,
  'last_checkin',s.last_checkin_date,
  'already_checked_in',coalesce(s.last_checkin_date=today,false),
  'weekly_spin_ready',coalesce(s.weekly_spin_ready,false),
  'ad_spins_remaining',0,
  'ad_enabled',false,
  'redemptions',coalesce((select jsonb_agg(to_jsonb(r)) from
    (select id,reward_type,coins_spent,
      case when status='pending' and expires_at < now() then 'expired' else status end as status,
      expires_at,created_at
     from public.reward_redemptions where user_id=uid order by created_at desc limit 30) r),'[]'::jsonb)
 );
end $$;

create or replace function rewards_private.reward_action(p_action text, p_request_id uuid, p_reward_type text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 today date := (now() at time zone 'Asia/Bangkok')::date;
 s public.user_streaks%rowtype;
 previous public.reward_requests%rowtype;
 b integer;
 delta integer;
 price integer;
 roll integer;
 result jsonb;
 redemption_id uuid;
begin
 if uid is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_request_id is null or p_action is null or p_action not in ('checkin','weekly','redeem') then
  raise exception 'Reward action unavailable' using errcode='22023';
 end if;
 -- Every mutation for a user takes the same row lock, including first use.
 insert into public.user_coins(user_id,balance) values(uid,0) on conflict(user_id) do nothing;
 select balance into b from public.user_coins where user_id=uid for update;
 select * into previous from public.reward_requests where user_id=uid and request_id=p_request_id;
 if found then
  if previous.action is distinct from p_action or previous.reward_type is distinct from p_reward_type then
   raise exception 'Request ID reused for a different action' using errcode='22023';
  end if;
  return previous.result;
 end if;
 insert into public.user_streaks(user_id) values(uid) on conflict(user_id) do nothing;
 select * into s from public.user_streaks where user_id=uid for update;
 if p_action='checkin' then
  if s.last_checkin_date=today then raise exception 'Already checked in today' using errcode='22023'; end if;
  s.current_streak := case when s.last_checkin_date=today-1 then least(s.current_streak+1,7) else 1 end;
  s.weekly_spin_ready := coalesce(s.weekly_spin_ready,false) or s.current_streak>=7;
  update public.user_streaks set current_streak=s.current_streak,last_checkin_date=today,
    weekly_spin_ready=s.weekly_spin_ready where user_id=uid;
  delta := 5;
 elsif p_action='weekly' then
  if not coalesce(s.weekly_spin_ready,false) then raise exception 'Weekly spin not ready' using errcode='22023'; end if;
  roll := floor(random()*100)::integer;
  delta := case when roll<35 then 20 when roll<63 then 30 when roll<83 then 50
                when roll<93 then 80 when roll<98 then 150 else 300 end;
  update public.user_streaks set weekly_spin_ready=false,current_streak=0 where user_id=uid;
 else
  price := case p_reward_type
   when 'chat_history_30d' then 200 when 'scan_plus_1' then 300
   when 'discount_10pct' then 500 when 'free_delivery' then 500
   when 'priority_booking' then 800 when 'vip_trial_7d' then 1500 else null end;
  if price is null then raise exception 'Unknown reward' using errcode='22023'; end if;
  if b<price then raise exception 'Insufficient coins' using errcode='22023'; end if;
  delta := -price;
  insert into public.reward_redemptions(user_id,reward_type,coins_spent,status,expires_at)
   values(uid,p_reward_type,price,'pending',now()+interval '30 days') returning id into redemption_id;
 end if;
 update public.user_coins set balance=b+delta,updated_at=now() where user_id=uid;
 insert into public.coin_transactions(user_id,type,amount,ref_id)
  values(uid,case p_action when 'weekly' then 'weekly_spin' else p_action end,delta,p_reward_type);
 result := rewards_private.reward_status() || jsonb_build_object(
  'new_balance',b+delta,'coins_earned',greatest(delta,0),'coins_spent',greatest(-delta,0),
  'redemption_id',redemption_id,'redemption_status',case when p_action='redeem' then 'pending' else null end
 );
 insert into public.reward_requests(user_id,request_id,action,reward_type,result)
  values(uid,p_request_id,p_action,p_reward_type,result);
 return result;
end $$;
revoke all on function rewards_private.reward_status() from public,anon,authenticated;
revoke all on function rewards_private.reward_action(text,uuid,text) from public,anon,authenticated;
grant execute on function rewards_private.reward_status() to authenticated;
grant execute on function rewards_private.reward_action(text,uuid,text) to authenticated;
create or replace function public.reward_status()
returns jsonb language sql security invoker set search_path = '' as $$
 select rewards_private.reward_status();
$$;
create or replace function public.reward_action(p_action text, p_request_id uuid, p_reward_type text default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select rewards_private.reward_action(p_action,p_request_id,p_reward_type);
$$;
revoke all on function public.reward_status() from public,anon;
revoke all on function public.reward_action(text,uuid,text) from public,anon;
grant execute on function public.reward_status() to authenticated;
grant execute on function public.reward_action(text,uuid,text) to authenticated;
commit;

