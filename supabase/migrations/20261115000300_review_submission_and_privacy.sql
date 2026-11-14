-- Only publish review-safe columns. Customer identity is never readable through the Data API.
revoke all on public.store_reviews from public, anon, authenticated;
grant select(id,store_id,rating,comment,status,partner_reply,partner_replied_at,created_at,updated_at) on public.store_reviews to anon, authenticated;
grant update(partner_reply) on public.store_reviews to authenticated;

create or replace function public.submit_store_review(p_store_id uuid, p_rating integer, p_comment text default '')
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid := auth.uid(); v_review public.store_reviews;
begin
  if v_user_id is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  if char_length(coalesce(p_comment,'')) > 1200 then raise exception 'comment_too_long' using errcode='22023'; end if;
  if not exists(select 1 from public.stores s where s.id=p_store_id and s.is_active and s.is_verified) then raise exception 'store_unavailable' using errcode='42501'; end if;
  insert into public.store_reviews(store_id,user_id,rating,comment)
    values(p_store_id,v_user_id,p_rating,coalesce(p_comment,''))
    on conflict(store_id,user_id) do update set rating=excluded.rating,comment=excluded.comment,updated_at=now()
      where public.store_reviews.status='published'
    returning * into v_review;
  if not found then raise exception 'review_hidden' using errcode='42501'; end if;
  return jsonb_build_object('id',v_review.id,'rating',v_review.rating,'comment',v_review.comment,'created_at',v_review.created_at,'updated_at',v_review.updated_at);
end; $$;
revoke all on function public.submit_store_review(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_store_review(uuid,integer,text) to authenticated;

create or replace function public.get_my_store_review(p_store_id uuid)
returns jsonb language sql stable security definer set search_path=public,auth as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('rating',r.rating,'comment',r.comment)
    from public.store_reviews r where r.store_id=p_store_id and r.user_id=auth.uid()
  ) end;
$$;
revoke all on function public.get_my_store_review(uuid) from public,anon,authenticated;
grant execute on function public.get_my_store_review(uuid) to authenticated;
