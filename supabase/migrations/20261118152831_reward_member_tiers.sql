-- Member tiers and server-side earning rules for FUFU Coins.
-- Coins are only ever credited here, from facts the customer cannot forge:
--   * services: appointments marked completed by store staff (appointment_status_history)
--   * orders:   commerce_orders with status 'completed' (no customer write access)
--   * pets, health records, reviews, AI scans, profile: capped by when the credit is made,
--     so back-dated rows cannot be farmed.
-- Tier points = coins earned in the last 365 days (redemptions do not lower them).
-- A reached tier is kept for at least 365 days after the last time it was qualified for.
begin;

alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check check (type in (
 'checkin','weekly_spin','ad_spin','redeem',
 'service','order','pet','health','review','scan','profile','tier_gift'));

-- Each source event (or month, for the tier gift) is credited at most once.
create unique index if not exists coin_transactions_earn_once_idx
 on public.coin_transactions(user_id, type, ref_id)
 where type in ('service','order','pet','health','review','scan','profile','tier_gift');

create table if not exists public.user_tiers (
 user_id    uuid primary key references auth.users(id) on delete cascade,
 tier       text not null default 'friend' check (tier in ('friend','silver','gold','platinum')),
 keep_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.user_tiers enable row level security;
revoke all on public.user_tiers from public, anon, authenticated;
grant select on public.user_tiers to authenticated;
drop policy if exists reward_owner_read on public.user_tiers;
create policy reward_owner_read on public.user_tiers for select to authenticated
 using ((select auth.uid()) = user_id);

-- Single source of truth for tiers and earning rules; clients render these numbers.
create or replace function rewards_private.tier_config()
returns jsonb language sql immutable set search_path = '' as $$
 select '[
  {"key":"friend","rank":0,"min_points":0,"min_uses":0,"multiplier":1.0,"monthly_gift":0,"redeem_discount_pct":0},
  {"key":"silver","rank":1,"min_points":300,"min_uses":0,"multiplier":1.2,"monthly_gift":20,"redeem_discount_pct":0},
  {"key":"gold","rank":2,"min_points":1000,"min_uses":1,"multiplier":1.5,"monthly_gift":50,"redeem_discount_pct":0},
  {"key":"platinum","rank":3,"min_points":3000,"min_uses":3,"multiplier":2.0,"monthly_gift":100,"redeem_discount_pct":10}
 ]'::jsonb
$$;

create or replace function rewards_private.earn_rules()
returns jsonb language sql immutable set search_path = '' as $$
 select '[
  {"key":"service","coins":50,"limit":null,"per":null},
  {"key":"order","coins":1,"per_baht":10,"max_per_order":500,"limit":null,"per":null},
  {"key":"checkin","coins":5,"limit":1,"per":"day"},
  {"key":"pet","coins":20,"limit":3,"per":"total"},
  {"key":"health","coins":10,"limit":5,"per":"month"},
  {"key":"review","coins":20,"limit":4,"per":"month"},
  {"key":"scan","coins":5,"limit":1,"per":"day"},
  {"key":"profile","coins":30,"limit":1,"per":"total"}
 ]'::jsonb
$$;

-- Recompute the tier from the ledger. Caller must hold the user_coins row lock.
create or replace function rewards_private.refresh_tier(uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 cfg jsonb := rewards_private.tier_config();
 pts integer; uses integer;
 q jsonb; cur jsonb; nxt jsonb;
 t public.user_tiers%rowtype;
begin
 select coalesce(sum(amount),0)::integer into pts from public.coin_transactions
  where user_id=uid and amount>0 and type not in ('tier_gift','redeem')
    and created_at > now()-interval '365 days';
 select count(*)::integer into uses from public.coin_transactions
  where user_id=uid and type in ('service','order') and created_at > now()-interval '365 days';
 select x.e into q from jsonb_array_elements(cfg) as x(e)
  where pts >= (x.e->>'min_points')::integer and uses >= (x.e->>'min_uses')::integer
  order by (x.e->>'rank')::integer desc limit 1;
 insert into public.user_tiers(user_id) values(uid) on conflict(user_id) do nothing;
 select * into t from public.user_tiers where user_id=uid for update;
 select x.e into cur from jsonb_array_elements(cfg) as x(e) where x.e->>'key'=t.tier;
 if (q->>'rank')::integer >= (cur->>'rank')::integer then
  -- Qualified for the held tier or higher: (re)start the 365-day hold, at most once a day.
  if (q->>'rank')::integer > 0 and (t.tier <> q->>'key' or t.keep_until is null
      or t.keep_until < now()+interval '364 days') then
   update public.user_tiers set tier=q->>'key', keep_until=now()+interval '365 days', updated_at=now()
    where user_id=uid returning * into t;
  end if;
 elsif t.keep_until is null or t.keep_until <= now() then
  -- Hold expired: step down to what the last 12 months qualify for.
  update public.user_tiers set tier=q->>'key',
    keep_until=case when (q->>'rank')::integer>0 then now()+interval '365 days' end, updated_at=now()
   where user_id=uid returning * into t;
 end if;
 select x.e into cur from jsonb_array_elements(cfg) as x(e) where x.e->>'key'=t.tier;
 select x.e into nxt from jsonb_array_elements(cfg) as x(e)
  where (x.e->>'rank')::integer = (cur->>'rank')::integer + 1;
 return cur || jsonb_build_object(
  'points',pts,'uses',uses,'keep_until',t.keep_until,
  'next',case when nxt is null then null else jsonb_build_object(
    'key',nxt->>'key','min_points',(nxt->>'min_points')::integer,'min_uses',(nxt->>'min_uses')::integer,
    'points_needed',greatest(0,(nxt->>'min_points')::integer-pts),
    'uses_needed',greatest(0,(nxt->>'min_uses')::integer-uses)) end);
end $$;

-- Credit everything the customer has earned but not yet received, then the monthly tier gift.
-- Takes the user_coins row lock that every reward mutation shares.
create or replace function rewards_private.sync_rewards(uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 b integer;
 tinfo jsonb;
 mult numeric;
 gained integer := 0;
 amt integer;
 n integer;
 r record;
 today date := (now() at time zone 'Asia/Bangkok')::date;
 day_start timestamptz := (now() at time zone 'Asia/Bangkok')::date::timestamp at time zone 'Asia/Bangkok';
 month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
begin
 insert into public.user_coins(user_id,balance) values(uid,0) on conflict(user_id) do nothing;
 select balance into b from public.user_coins where user_id=uid for update;
 tinfo := rewards_private.refresh_tier(uid);
 mult := (tinfo->>'multiplier')::numeric;

 -- Completed services: only store staff can mark an appointment completed.
 for r in select a.id::text as ref from public.appointments a
  where a.user_id=uid and lower(a.status)='completed'
    and exists (select 1 from public.appointment_status_history h
      where h.appointment_id=a.id and h.to_status='completed' and h.changed_by is distinct from uid)
    and not exists (select 1 from public.coin_transactions c
      where c.user_id=uid and c.type='service' and c.ref_id=a.id::text)
 loop
  amt := round(50*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'service',amt,r.ref) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end loop;

 -- Completed shop orders: 1 coin per 10 baht, at most 500 per order before the multiplier.
 for r in select o.id::text as ref, least(500, floor(o.total_amount/10))::integer as base from public.commerce_orders o
  where o.user_id=uid and o.status='completed' and o.total_amount >= 10
    and not exists (select 1 from public.coin_transactions c
      where c.user_id=uid and c.type='order' and c.ref_id=o.id::text)
 loop
  amt := round(r.base*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'order',amt,r.ref) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end loop;

 -- Pet profiles: first 3 ever.
 select count(*) into n from public.coin_transactions where user_id=uid and type='pet';
 for r in select p.id::text as ref from public.pets p
  where p.user_id=uid
    and not exists (select 1 from public.coin_transactions c where c.user_id=uid and c.type='pet' and c.ref_id=p.id::text)
  order by p.created_at limit greatest(0,3-n)
 loop
  amt := round(20*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'pet',amt,r.ref) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end loop;

 -- Health records: 5 credits per month (counted by credit time, not by the row's own date).
 select count(*) into n from public.coin_transactions where user_id=uid and type='health' and created_at>=month_start;
 for r in select h.id::text as ref from public.health_records h
  where h.user_id=uid and h.created_at > now()-interval '30 days'
    and not exists (select 1 from public.coin_transactions c where c.user_id=uid and c.type='health' and c.ref_id=h.id::text)
  order by h.created_at limit greatest(0,5-n)
 loop
  amt := round(10*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'health',amt,r.ref) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end loop;

 -- Published reviews: 4 credits per month.
 select count(*) into n from public.coin_transactions where user_id=uid and type='review' and created_at>=month_start;
 for r in select v.id::text as ref from public.store_reviews v
  where v.user_id=uid and v.status='published' and v.created_at > now()-interval '30 days'
    and not exists (select 1 from public.coin_transactions c where c.user_id=uid and c.type='review' and c.ref_id=v.id::text)
  order by v.created_at limit greatest(0,4-n)
 loop
  amt := round(20*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'review',amt,r.ref) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end loop;

 -- AI scans: one credit per day.
 if not exists (select 1 from public.coin_transactions where user_id=uid and type='scan' and created_at>=day_start) then
  for r in select s.id::text as ref from public.scan_results s
   where s.user_id=uid and s.created_at > now()-interval '2 days'
     and not exists (select 1 from public.coin_transactions c where c.user_id=uid and c.type='scan' and c.ref_id=s.id::text)
   order by s.created_at desc limit 1
  loop
   amt := round(5*mult);
   insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'scan',amt,r.ref) on conflict do nothing;
   if found then gained := gained+amt; end if;
  end loop;
 end if;

 -- Complete profile (name and phone), once.
 if exists (select 1 from public.profiles p where p.id=uid
     and nullif(trim(p.full_name),'') is not null and nullif(trim(p.phone),'') is not null) then
  amt := round(30*mult);
  insert into public.coin_transactions(user_id,type,amount,ref_id) values(uid,'profile',amt,'profile') on conflict do nothing;
  if found then gained := gained+amt; end if;
 end if;

 if gained > 0 then tinfo := rewards_private.refresh_tier(uid); end if;

 -- Monthly tier gift, credited automatically once per Bangkok month.
 amt := coalesce((tinfo->>'monthly_gift')::integer,0);
 if amt > 0 then
  insert into public.coin_transactions(user_id,type,amount,ref_id)
   values(uid,'tier_gift',amt,to_char(today,'YYYY-MM')) on conflict do nothing;
  if found then gained := gained+amt; end if;
 end if;

 if gained > 0 then
  update public.user_coins set balance=b+gained, updated_at=now() where user_id=uid;
 end if;
 return tinfo;
end $$;

create or replace function rewards_private.reward_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 today date := (now() at time zone 'Asia/Bangkok')::date;
 s public.user_streaks%rowtype;
 b integer;
 tinfo jsonb;
begin
 if uid is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 tinfo := rewards_private.sync_rewards(uid);
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
  'checkin_coins',round(5*(tinfo->>'multiplier')::numeric)::integer,
  'tier',tinfo,
  'tiers',rewards_private.tier_config(),
  'earn_rules',rewards_private.earn_rules(),
  'gift_received_this_month',exists(select 1 from public.coin_transactions
    where user_id=uid and type='tier_gift' and ref_id=to_char(today,'YYYY-MM')),
  'activity',coalesce((select jsonb_agg(to_jsonb(x)) from
    (select type,amount,created_at from public.coin_transactions
     where user_id=uid order by created_at desc limit 10) x),'[]'::jsonb),
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
 tinfo jsonb;
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
 perform 1 from public.user_coins where user_id=uid for update;
 select * into previous from public.reward_requests where user_id=uid and request_id=p_request_id;
 if found then
  if previous.action is distinct from p_action or previous.reward_type is distinct from p_reward_type then
   raise exception 'Request ID reused for a different action' using errcode='22023';
  end if;
  return previous.result;
 end if;
 tinfo := rewards_private.sync_rewards(uid);
 select balance into b from public.user_coins where user_id=uid;
 insert into public.user_streaks(user_id) values(uid) on conflict(user_id) do nothing;
 select * into s from public.user_streaks where user_id=uid for update;
 if p_action='checkin' then
  if s.last_checkin_date=today then raise exception 'Already checked in today' using errcode='22023'; end if;
  s.current_streak := case when s.last_checkin_date=today-1 then least(s.current_streak+1,7) else 1 end;
  s.weekly_spin_ready := coalesce(s.weekly_spin_ready,false) or s.current_streak>=7;
  update public.user_streaks set current_streak=s.current_streak,last_checkin_date=today,
    weekly_spin_ready=s.weekly_spin_ready where user_id=uid;
  delta := round(5*(tinfo->>'multiplier')::numeric);
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
  if p_reward_type='priority_booking' and (tinfo->>'rank')::integer < 2 then
   raise exception 'Reach Gold tier to unlock this reward' using errcode='22023';
  end if;
  price := price - price*coalesce((tinfo->>'redeem_discount_pct')::integer,0)/100;
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

-- Internal helpers take a user id, so nobody but the definer functions may call them.
revoke all on function rewards_private.tier_config() from public, anon, authenticated;
revoke all on function rewards_private.earn_rules() from public, anon, authenticated;
revoke all on function rewards_private.refresh_tier(uuid) from public, anon, authenticated;
revoke all on function rewards_private.sync_rewards(uuid) from public, anon, authenticated;
revoke all on function rewards_private.reward_status() from public, anon, authenticated;
revoke all on function rewards_private.reward_action(text,uuid,text) from public, anon, authenticated;
grant execute on function rewards_private.reward_status() to authenticated;
grant execute on function rewards_private.reward_action(text,uuid,text) to authenticated;
commit;
