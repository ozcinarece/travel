-- 0.3 İlk seyahat yönlendirmesi ve v1 Profil hesap silme
-- (PRD 0.3 KK2–KK3, §4 Profil; PR #2 incelemesi madde 3: devir/silme silmeden önce gösterilir)

-- 0.3 bir kez gösterilir; atlansa da damgalanır (KK3). Cevap next_trip_window'da (KK2).
alter table public.profiles add column onboarding_done_at timestamptz;

-- Hesap silme önizlemesi: sahibi olunan her seyahat için kime devredileceği ya da silineceği.
-- Sıra prepare_account_deletion ile aynı: misafir olmayan en eski üye.
create or replace function public.account_deletion_preview()
returns table (trip_id uuid, city_label text, outcome text, new_owner_name text)
language sql stable security definer set search_path = ''
as $$
  select t.id,
         t.city_label,
         case when v.user_id is null then 'delete' else 'transfer' end,
         v.display_name
  from public.trips t
  join public.members me on me.trip_id = t.id and me.user_id = auth.uid() and me.role = 'owner'
  left join lateral (
    select m.user_id, m.display_name
    from public.members m
    where m.trip_id = t.id and m.user_id <> auth.uid()
    order by m.guest, m.joined_at
    limit 1
  ) v on true
  order by t.created_at;
$$;

-- Hesabı siler: önce sahiplik devri / seyahat silme, sonra auth kaydı.
-- profiles ve members cascade ile gider; places.added_by, stops.arrived_by, changes.user_id null olur.
-- Avatar dosyasını istemci silmeden önce kaldırır (storage.remove).
create or replace function public.delete_account()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.prepare_account_deletion();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.account_deletion_preview(), public.delete_account() from public, anon;
grant execute on function public.account_deletion_preview(), public.delete_account() to authenticated;

-- log_change: silinmekte olan kullanıcının cascade etkileri (places.added_by → null vb.)
-- kaydedilirken changes.user_id o kullanıcıya bağlanamaz; kullanıcı yoksa null yazılır.
create or replace function public.log_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  eski jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  yeni jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  satir jsonb := coalesce(yeni, eski);
  seyahat uuid := case when tg_table_name = 'trips' then (satir ->> 'id')::uuid else (satir ->> 'trip_id')::uuid end;
  varlik_id text := coalesce(satir ->> 'id', satir ->> 'user_id');
  kim uuid := (select u.id from auth.users u where u.id = auth.uid());
  alan text;
begin
  -- Seyahat silinirken alt satırların silinmesini kaydetmeye gerek yok.
  if tg_op = 'DELETE' and not exists (select 1 from public.trips where id = seyahat) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    for alan in select jsonb_object_keys(yeni) loop
      if alan not in ('google_fetched_at', 'hotel_fetched_at') and (eski -> alan) is distinct from (yeni -> alan) then
        insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
        values (seyahat, kim, tg_table_name, varlik_id, alan, eski -> alan, yeni -> alan);
      end if;
    end loop;
  else
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (seyahat, kim, tg_table_name, varlik_id, null, eski, yeni);
  end if;
  return coalesce(new, old);
end;
$$;
