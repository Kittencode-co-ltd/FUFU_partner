-- Run only against disposable/local Supabase after migrations. Always rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reward-a@test.invalid','',now(),now()),
 ('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reward-b@test.invalid','',now(),now());
insert into public.user_coins(user_id,balance) values('91000000-0000-4000-8000-000000000002',2000);
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is((public.reward_action('checkin','92000000-0000-4000-8000-000000000001')->>'new_balance')::int,5,'daily reward is five coins');
select is((public.reward_action('checkin','92000000-0000-4000-8000-000000000001')->>'new_balance')::int,5,'retry replays same result');
select is((select count(*)::int from public.coin_transactions),1,'retry adds no transaction');
select throws_ok($$select public.reward_action('checkin','92000000-0000-4000-8000-000000000002')$$,'22023','Already checked in today','daily limit');
select throws_ok($$select public.reward_action('weekly','92000000-0000-4000-8000-000000000003')$$,'22023','Weekly spin not ready','weekly gate');
select throws_ok($$select public.reward_action('ad','92000000-0000-4000-8000-000000000004')$$,'22023','Reward action unavailable','unverified ad denied');
select throws_ok($$select public.reward_action('redeem','92000000-0000-4000-8000-000000000005','fake')$$,'22023','Unknown reward','unknown catalog denied');
select throws_ok($$select public.reward_action('redeem','92000000-0000-4000-8000-000000000006','scan_plus_1')$$,'22023','Insufficient coins','no overdraft');
select ok(not has_table_privilege('authenticated','public.user_coins','UPDATE'),'client cannot set balance');
select ok(not has_table_privilege('authenticated','public.reward_redemptions','INSERT'),'client cannot forge redemption');
select is((select count(*)::int from public.user_coins),1,'balances isolated by user');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select is((public.reward_action('redeem','92000000-0000-4000-8000-000000000007','scan_plus_1')->>'new_balance')::int,1700,'server sets catalog price');
select is((public.reward_action('redeem','92000000-0000-4000-8000-000000000007','scan_plus_1')->>'new_balance')::int,1700,'redeem retry does not charge twice');
select is((select count(*)::int from public.reward_redemptions where status='pending'),1,'one pending redemption');
select * from finish();
rollback;
