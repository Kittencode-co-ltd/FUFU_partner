-- Some earlier suspension attempts created a notification with the reason,
-- even though the audit insert and store update could not persist it.
with latest_suspension_notification as (
  select distinct on (s.id)
    s.id as store_id,
    btrim(substring(
      n.body
      from char_length(s.name) + 3
      for char_length(n.body) - char_length(s.name) - 3
        - char_length(' — ติดต่อทีม FUFU เพื่อเปิดใช้งานอีกครั้ง')
    )) as reason
  from public.stores as s
  join public.notifications as n on n.user_id = s.owner_id
  where s.is_active = false
    and n.title = 'ร้านของคุณถูกระงับชั่วคราว'
    and left(n.body, char_length(s.name) + 2) = s.name || ': '
    and right(n.body, char_length(' — ติดต่อทีม FUFU เพื่อเปิดใช้งานอีกครั้ง'))
      = ' — ติดต่อทีม FUFU เพื่อเปิดใช้งานอีกครั้ง'
  order by s.id, n.created_at desc
)
update public.stores as s
set suspension_reason = n.reason
from latest_suspension_notification as n
where s.id = n.store_id
  and s.is_active = false
  and s.suspension_reason is null
  and n.reason <> '';
