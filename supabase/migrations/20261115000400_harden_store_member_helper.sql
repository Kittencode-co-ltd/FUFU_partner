-- The shared tenant helper is required by review RLS; constrain its definer context and remove anon RPC access.
alter function public.is_store_member(uuid) set search_path=public,auth;
revoke all on function public.is_store_member(uuid) from public,anon;
grant execute on function public.is_store_member(uuid) to authenticated;
