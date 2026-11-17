-- #262 (#205 KK3, Ece'nin kararı A): seyahat mekânlarının (`places`) Google koordinatı 30 günü geçmeden yenilenir.
-- Günlük iş (places-yenile Edge Function'ı, GitHub Actions) yenileme yaşına gelen place_id'leri sırayla alır ve Place
-- Details Essentials (yalnız `location`) ile yeniden çeker. Aynı place_id birden çok seyahatte olabilir: tek Google isteği,
-- bütün satırlar birlikte yazılır.
-- Sayaç: kullanıcıların günlük Places sınırından (`places_gunluk_sayac`, #238) AYRI, aylık (Türkiye saatiyle ay) tablo.
-- Ayda 8.000 isteğe gelince iş durur; ilk durmada masaya bir kez yazılır (`places_yenileme_durdu`).
-- Yalnız service_role çalıştırır; anon ve authenticated (yönetici dahil) tabloya ve fonksiyonlara erişemez.

-- Yenileme yaşı: 25 gün. 30 günden önce 5 günlük pay (iş birkaç gün çalışmazsa da sınır aşılmasın).
create function public.places_yenileme_esigi() returns timestamptz
language sql stable set search_path = ''
as $$ select now() - interval '25 days' $$;
revoke execute on function public.places_yenileme_esigi() from public, anon, authenticated;

create index places_google_fetched_at_idx on public.places (google_fetched_at);

create table public.places_yenileme_sayac (
  ay date primary key check (ay = date_trunc('month', ay)::date),
  adet integer not null default 0 check (adet >= 0),
  durma_bildirildi boolean not null default false
);
alter table public.places_yenileme_sayac enable row level security;
revoke all on public.places_yenileme_sayac from public, anon, authenticated;
-- Politika yok: RLS açık + yetki yok → anon / authenticated hiçbir satıra erişemez.

-- Yenileme yaşına gelmiş place_id'ler, en eski damga önce. p_adet 0–500.
create function public.places_yenilenecekler(p_adet integer)
returns table (place_id text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_adet is null or p_adet not between 0 and 500 then
    raise exception 'p_adet 0–500' using errcode = '22023';
  end if;
  return query
    select p.place_id from public.places p
    where p.google_fetched_at < public.places_yenileme_esigi()
    group by p.place_id
    order by min(p.google_fetched_at), p.place_id
    limit p_adet;
end;
$$;
revoke execute on function public.places_yenilenecekler(integer) from public, anon, authenticated;
grant execute on function public.places_yenilenecekler(integer) to service_role;

-- Atomik aylık artış: p_adet (gidecek Google isteği) p_sinir'e sığıyorsa sayacı artırır ve true döner; sığmıyorsa sayaç
-- değişmez, false döner.
create function public.places_yenileme_artir(p_adet integer, p_sinir integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_ay constant date := date_trunc('month', now() at time zone 'Europe/Istanbul')::date;
  v_adet integer;
begin
  if p_adet is null or p_adet not between 1 and 500 then
    raise exception 'p_adet 1–500' using errcode = '22023';
  end if;
  if p_sinir is null or p_adet > p_sinir then
    return false;
  end if;
  insert into public.places_yenileme_sayac as s (ay, adet) values (v_ay, p_adet)
  on conflict (ay) do update set adet = s.adet + excluded.adet where s.adet + excluded.adet <= p_sinir
  returning s.adet into v_adet;
  return v_adet is not null;
end;
$$;
revoke execute on function public.places_yenileme_artir(integer, integer) from public, anon, authenticated;
grant execute on function public.places_yenileme_artir(integer, integer) to service_role;

-- Bu ay sınır doldu: ilk çağrıda true (masaya bir kez yazılır), sonra false.
create function public.places_yenileme_durdu()
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_ay constant date := date_trunc('month', now() at time zone 'Europe/Istanbul')::date;
  v_ilk boolean;
begin
  insert into public.places_yenileme_sayac as s (ay, durma_bildirildi) values (v_ay, true)
  on conflict (ay) do update set durma_bildirildi = true where not s.durma_bildirildi
  returning true into v_ilk;
  return coalesce(v_ilk, false);
end;
$$;
revoke execute on function public.places_yenileme_durdu() from public, anon, authenticated;
grant execute on function public.places_yenileme_durdu() to service_role;

-- Yeni koordinatı o place_id'nin yenileme yaşındaki bütün satırlarına yazar, damgayı now() yapar; yazılan satır sayısını
-- döner. Bu arada kullanıcı mekânı yeniden eklediyse (damga taze) satıra dokunulmaz.
create function public.places_koordinat_yenile(p_place_id text, p_lat double precision, p_lng double precision)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_adet integer;
begin
  if p_place_id is null or p_place_id = '' or char_length(p_place_id) > 300 then
    raise exception 'place_id geçersiz' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'koordinat geçersiz' using errcode = '22023';
  end if;
  -- Sistem yenilemesi değişiklik akışına ("Son değişiklikler · Geri al") düşmez; işaret yalnız bu işlem için.
  perform set_config('tripmate.koordinat_yenileme', 'evet', true);
  update public.places set lat = p_lat, lng = p_lng, google_fetched_at = now()
  where place_id = p_place_id and google_fetched_at < public.places_yenileme_esigi();
  get diagnostics v_adet = row_count;
  perform set_config('tripmate.koordinat_yenileme', '', true);
  return v_adet;
end;
$$;
revoke execute on function public.places_koordinat_yenile(text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.places_koordinat_yenile(text, double precision, double precision) to service_role;

-- log_change (20261001000000 sürümü) + tek ek: places_koordinat_yenile'nin yazdığı koordinat ve damga akışa düşmez.
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
  sistem_koordinat boolean := tg_table_name = 'places'
    and coalesce(current_setting('tripmate.koordinat_yenileme', true), '') = 'evet';
  alan text;
begin
  -- Seyahat silinirken alt satırların silinmesini kaydetmeye gerek yok.
  if tg_op = 'DELETE' and not exists (select 1 from public.trips where id = seyahat) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    for alan in select jsonb_object_keys(yeni) loop
      if alan not in ('google_fetched_at', 'hotel_fetched_at')
         and not (sistem_koordinat and alan in ('lat', 'lng'))
         and (eski -> alan) is distinct from (yeni -> alan) then
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
