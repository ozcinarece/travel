-- #262 (#205 KK3, Ece'nin kararı A): kullanıcı tablolarındaki Google koordinatı 30 günü geçmeden yenilenir; yenilenemeyen
-- koordinat 30. günde boşaltılır.
-- Kaynaklar (place_id → koordinat, damga):
--   places.place_id        → places.lat/lng          (places.google_fetched_at)
--   trips.city_place_id    → trips.lat/lng           (trips.google_fetched_at)
--   trips.hotel_place_id   → trips.hotel_lat/lng     (trips.hotel_fetched_at)
--   stays.place_id         → stays.lat/lng           (stays.google_fetched_at; place_id'siz otel kullanıcının pini, kapsam dışı)
-- Günlük iş (places-yenile Edge Function'ı, GitHub Actions) yenileme yaşına gelen place_id'leri alır ve Place Details
-- Essentials (yalnız `location`) ile yeniden çeker. Aynı place_id birden çok tabloda ya da seyahatte olabilir: tek Google
-- isteği, bütün satırlar birlikte yazılır.
-- Boşaltma: Google 404 dönen place_id hemen; 30 günü geçen her koordinat turun sonunda. Satır silinmez; yalnız Google'dan
-- gelen koordinat null olur, place_id ve kullanıcının yazdığı her şey kalır (#205/#262 politikası).
-- Sayaç: kullanıcıların günlük Places sınırından (`places_gunluk_sayac`, #238) AYRI, aylık (Türkiye saatiyle ay) tablo.
-- Ayda 8.000 isteğe gelince iş durur; ilk durmada masaya bir kez yazılır (`places_yenileme_durdu`).
-- Yalnız service_role çalıştırır; anon ve authenticated (yönetici dahil) tablolara ve fonksiyonlara erişemez.

-- Koordinat boşalabilir; ikisi birlikte boş ya da birlikte dolu.
alter table public.places
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint places_konum_birlikte check ((lat is null) = (lng is null));
alter table public.trips
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint trips_konum_birlikte check ((lat is null) = (lng is null));
alter table public.stays
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint stays_konum_birlikte check ((lat is null) = (lng is null));

-- Yenileme yaşı: 25 gün. 30 günden önce 5 günlük pay (iş birkaç gün çalışmazsa da sınır aşılmasın).
create function public.places_yenileme_esigi() returns timestamptz
language sql stable set search_path = ''
as $$ select now() - interval '25 days' $$;
revoke execute on function public.places_yenileme_esigi() from public, anon, authenticated;

create index places_google_fetched_at_idx on public.places (google_fetched_at) where lat is not null;
create index trips_google_fetched_at_idx on public.trips (google_fetched_at) where lat is not null;
create index trips_hotel_fetched_at_idx on public.trips (hotel_fetched_at) where hotel_lat is not null;
create index stays_google_fetched_at_idx on public.stays (google_fetched_at) where lat is not null and place_id is not null;

create table public.places_yenileme_sayac (
  ay date primary key check (ay = date_trunc('month', ay)::date),
  adet integer not null default 0 check (adet >= 0),
  durma_bildirildi boolean not null default false
);
alter table public.places_yenileme_sayac enable row level security;
revoke all on public.places_yenileme_sayac from public, anon, authenticated;
-- Politika yok: RLS açık + yetki yok → anon / authenticated hiçbir satıra erişemez.

-- Son deneme (place_id başına): aynı gün ikinci kez denenmez; denenmiş place_id hiç denenmemişlerin arkasına geçer.
-- Böylece kalıcı hatalı birkaç place_id, arkadaki sağlam satırların sırasını kapatamaz.
create table public.places_yenileme_deneme (
  place_id text primary key check (char_length(place_id) between 1 and 300),
  son_deneme timestamptz not null default now()
);
alter table public.places_yenileme_deneme enable row level security;
revoke all on public.places_yenileme_deneme from public, anon, authenticated;

-- Dört kaynağın koordinatı dolu satırları tek görünümde (yalnız fonksiyonlar kullanır).
create view public.google_koordinatlari with (security_invoker = true) as
  select place_id, google_fetched_at as damga from public.places where lat is not null
  union all
  select city_place_id, google_fetched_at from public.trips where lat is not null
  union all
  select hotel_place_id, hotel_fetched_at from public.trips where hotel_lat is not null and hotel_place_id is not null
  union all
  select place_id, google_fetched_at from public.stays where lat is not null and place_id is not null;
revoke all on public.google_koordinatlari from public, anon, authenticated;

-- Yenileme yaşına gelmiş place_id'ler. Son 20 saatte denenen atlanır; hiç denenmemiş önce, sonra en eski damga.
-- Seçilenlerin son_deneme'si şimdi olur. p_adet 0–500.
create function public.places_yenilenecekler(p_adet integer)
returns table (place_id text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_adet is null or p_adet not between 0 and 500 then
    raise exception 'p_adet 0–500' using errcode = '22023';
  end if;
  return query
    with aday as (
      select k.place_id as pid, min(k.damga) as damga
      from public.google_koordinatlari k
      where k.damga is null or k.damga < public.places_yenileme_esigi()
      group by k.place_id
    ), secilen as (
      select a.pid, row_number() over (order by (d.son_deneme is not null), a.damga nulls first, a.pid) as sira
      from aday a
      left join public.places_yenileme_deneme d on d.place_id = a.pid
      where d.son_deneme is null or d.son_deneme < now() - interval '20 hours'
      order by sira
      limit p_adet
    ), isaret as (
      insert into public.places_yenileme_deneme as d (place_id, son_deneme)
      select s.pid, now() from secilen s
      on conflict (place_id) do update set son_deneme = excluded.son_deneme
    )
    select s.pid from secilen s order by s.sira;
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

-- Yeni koordinatı o place_id'nin yenileme yaşındaki bütün satırlarına (dört kaynak) yazar, damgayı now() yapar; yazılan
-- satır sayısını döner. Bu arada kullanıcı mekânı yeniden eklediyse (damga taze) ya da koordinat boşaltıldıysa satıra
-- dokunulmaz.
create function public.places_koordinat_yenile(p_place_id text, p_lat double precision, p_lng double precision)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_adet integer;
  v_toplam integer := 0;
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
  where place_id = p_place_id and lat is not null and google_fetched_at < public.places_yenileme_esigi();
  get diagnostics v_adet = row_count;
  v_toplam := v_toplam + v_adet;
  update public.trips set lat = p_lat, lng = p_lng, google_fetched_at = now()
  where city_place_id = p_place_id and lat is not null and google_fetched_at < public.places_yenileme_esigi();
  get diagnostics v_adet = row_count;
  v_toplam := v_toplam + v_adet;
  update public.trips set hotel_lat = p_lat, hotel_lng = p_lng, hotel_fetched_at = now()
  where hotel_place_id = p_place_id and hotel_lat is not null
    and (hotel_fetched_at is null or hotel_fetched_at < public.places_yenileme_esigi());
  get diagnostics v_adet = row_count;
  v_toplam := v_toplam + v_adet;
  update public.stays set lat = p_lat, lng = p_lng, google_fetched_at = now()
  where place_id = p_place_id and lat is not null
    and (google_fetched_at is null or google_fetched_at < public.places_yenileme_esigi());
  get diagnostics v_adet = row_count;
  v_toplam := v_toplam + v_adet;
  perform set_config('tripmate.koordinat_yenileme', '', true);
  return v_toplam;
end;
$$;
revoke execute on function public.places_koordinat_yenile(text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.places_koordinat_yenile(text, double precision, double precision) to service_role;

-- Koordinat boşaltma (satır silinmez). p_place_id verilirse (Google 404) o place_id'nin yenileme yaşındaki bütün
-- koordinatları; verilmezse 30 günü geçen her koordinat. Damga, place_id ve kullanıcı alanları değişmez.
-- Döner: kaynak başına boşaltılan satır sayısı (yer = places, seyahat = trips şehri, otel = trips oteli, konaklama = stays).
create function public.places_koordinat_bosalt(p_place_id text default null)
returns table (yer integer, seyahat integer, otel integer, konaklama integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_sinir timestamptz;
begin
  if p_place_id is not null and (p_place_id = '' or char_length(p_place_id) > 300) then
    raise exception 'place_id geçersiz' using errcode = '22023';
  end if;
  v_sinir := case when p_place_id is null then now() - interval '30 days' else public.places_yenileme_esigi() end;
  perform set_config('tripmate.koordinat_yenileme', 'evet', true);
  update public.places p set lat = null, lng = null
  where p.lat is not null and p.google_fetched_at < v_sinir and (p_place_id is null or p.place_id = p_place_id);
  get diagnostics yer = row_count;
  update public.trips t set lat = null, lng = null
  where t.lat is not null and t.google_fetched_at < v_sinir and (p_place_id is null or t.city_place_id = p_place_id);
  get diagnostics seyahat = row_count;
  -- Eski otel alanı: place_id'li ve damgasız otel de Google'dandır (damga yoksa süresi bilinmez → boşalt).
  update public.trips t set hotel_lat = null, hotel_lng = null
  where t.hotel_lat is not null and t.hotel_place_id is not null
    and (t.hotel_fetched_at is null or t.hotel_fetched_at < v_sinir)
    and (p_place_id is null or t.hotel_place_id = p_place_id);
  get diagnostics otel = row_count;
  update public.stays s set lat = null, lng = null
  where s.lat is not null and s.place_id is not null
    and (s.google_fetched_at is null or s.google_fetched_at < v_sinir)
    and (p_place_id is null or s.place_id = p_place_id);
  get diagnostics konaklama = row_count;
  perform set_config('tripmate.koordinat_yenileme', '', true);
  return next;
end;
$$;
revoke execute on function public.places_koordinat_bosalt(text) from public, anon, authenticated;
grant execute on function public.places_koordinat_bosalt(text) to service_role;

-- log_change (20261001000000 sürümü) + tek ek: sistem yenilemesi ve boşaltmasının yazdığı koordinat akışa düşmez.
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
  sistem_koordinat boolean := tg_table_name in ('places', 'trips', 'stays')
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
         and not (sistem_koordinat and alan in ('lat', 'lng', 'hotel_lat', 'hotel_lng'))
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
