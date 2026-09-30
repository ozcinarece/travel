-- PR #4 incelemesi: sahiplik devri, değişiklik akışında (3.7 KK9) adıyla görünsün.
-- trips.owner_id güncellemesi zaten kayıt düşer, ama hesap silinince changes.user_id null olur
-- ve "kim" kaybolur. Bu satır eski ve yeni sahibin görünen adını old/new'de saklar.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s record;
  varis uuid;
  varis_ad text;
  eski_ad text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  for s in select m.trip_id, m.display_name from public.members m where m.user_id = auth.uid() and m.role = 'owner' loop
    eski_ad := s.display_name;
    select m.user_id, m.display_name into varis, varis_ad from public.members m
    where m.trip_id = s.trip_id and m.user_id <> auth.uid()
    order by m.guest, m.joined_at
    limit 1;
    if varis is null then
      delete from public.trips where id = s.trip_id;
    else
      update public.members set role = 'owner' where trip_id = s.trip_id and user_id = varis;
      update public.trips set owner_id = varis where id = s.trip_id;
      insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
      values (s.trip_id, auth.uid(), 'trips', s.trip_id::text, 'ownership_transferred', to_jsonb(eski_ad), to_jsonb(varis_ad));
      -- Silinen hesap üyelikten çıkar; seyahatte tek sahip kalır.
      delete from public.members where trip_id = s.trip_id and user_id = auth.uid();
    end if;
  end loop;
end;
$$;
