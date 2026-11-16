-- #205 PR 2a: konum kaynağı korumaları (#219 incelemesinden KK7 · KK9 · KK10).
--
-- KK9: osm / elle satırda koordinat, kaynağı (konum_kaynagi ya da osm_id) aynı UPDATE'te açıkça yazılmadan değişirse satır
--   google_30g'ye düşer ve damga alır. Neden reddetmek değil: bugünkü ve bilinen bütün kaynaksız yazıcılar (hat, BO
--   Autocomplete) Google konumu yazar; sütun varsayılanı da bu yüzden google_30g. Kaynak yazılınca (değeri aynı kalsa da,
--   ör. elle bir yeri haritada yeniden işaretlemek) satır kaynağını korur.
--   "Açıkça yazıldı" bir tetikleyicide değerden anlaşılamaz (aynı değer yazılabilir). Bu yüzden ikinci, yalnız
--   `update of konum_kaynagi, osm_id`'de çalışan bir tetikleyici satır için işlem-yerel bir işaret koyar; ad sırası
--   (…_konum_0_… < …_konum_kaynagi) onu ana tetikleyiciden önce çalıştırır, ana tetikleyici işareti okur ve hemen siler.
-- KK10: google_fetched_at gelecekte olamaz (now() + 1 gün payı; saat farkı). CHECK yerine tetikleyicide: CHECK'te now()
--   yalnız yazım anında anlamlı ve geri yüklemede (pg_restore) eski satırları da yeniden sınar.
-- KK7: "Seyahatime al" (yeni seyahat) damgayı gezi durağından taşır; aşağıda geziden_seyahat_ac.
-- konum_kaynagi_kontrol(): çağıran postgres rolüdür (hat ve supabase-sql iş akışı, Yönetim API'si); anon, authenticated ve
--   service_role'e kapalı (#219).

create function public.konum_kaynagi_yazildi() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform set_config('tripmate.konum_kaynagi_yazildi', 'evet', true);
  return new;
end;
$$;

create or replace function public.konum_kaynagi_yaz() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_kaynak_yazildi boolean := coalesce(current_setting('tripmate.konum_kaynagi_yazildi', true), '') = 'evet';
begin
  perform set_config('tripmate.konum_kaynagi_yazildi', '', true);
  -- KK9: osm/elle satırda koordinat kaynaksız değişti → Google konumu sayılır.
  if tg_op = 'UPDATE' and new.konum_kaynagi <> 'google_30g' and not v_kaynak_yazildi
     and (new.lat, new.lng) is distinct from (old.lat, old.lng) then
    new.konum_kaynagi := 'google_30g';
    new.osm_id := null;
    new.google_fetched_at := now();
  end if;
  if new.konum_kaynagi = 'google_30g' then
    if tg_op = 'UPDATE'
       and (new.lat, new.lng) is distinct from (old.lat, old.lng)
       and new.google_fetched_at is not distinct from old.google_fetched_at then
      new.google_fetched_at := now();
    elsif new.google_fetched_at is null then
      new.google_fetched_at := now();
    end if;
    -- KK10
    if new.google_fetched_at > now() + interval '1 day' then
      raise exception 'google_fetched_at gelecekte olamaz' using errcode = '23514';
    end if;
  else
    new.google_fetched_at := null;
  end if;
  return new;
end;
$$;

create trigger sehirler_konum_0_kaynak_yazildi before update of konum_kaynagi, osm_id on public.sehirler
  for each row execute function public.konum_kaynagi_yazildi();
create trigger yerler_konum_0_kaynak_yazildi before update of konum_kaynagi, osm_id on public.yerler
  for each row execute function public.konum_kaynagi_yazildi();
create trigger gezi_duraklari_konum_0_kaynak_yazildi before update of konum_kaynagi, osm_id on public.gezi_duraklari
  for each row execute function public.konum_kaynagi_yazildi();

-- KK7
create or replace function public.geziden_seyahat_ac(p_seyahat jsonb, p_gun_sayisi integer, p_mekanlar jsonb, p_duraklar jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_trip uuid;
  v_bas date;
  v_son date;
begin
  if auth.uid() is null then
    raise exception 'oturum yok' using errcode = '42501';
  end if;
  if jsonb_typeof(p_seyahat) is distinct from 'object'
     or jsonb_typeof(coalesce(p_mekanlar, '[]')) <> 'array' or jsonb_typeof(coalesce(p_duraklar, '[]')) <> 'array' then
    raise exception 'geçersiz istek' using errcode = '22023';
  end if;
  if p_gun_sayisi is null or p_gun_sayisi < 1 or p_gun_sayisi > 30 then
    raise exception 'gün sayısı 1–30 olmalı' using errcode = '22023';
  end if;
  v_bas := nullif(p_seyahat ->> 'start_date', '')::date;
  v_son := nullif(p_seyahat ->> 'end_date', '')::date;
  if (v_bas is null) <> (v_son is null) or (v_bas is not null and v_son - v_bas + 1 <> p_gun_sayisi) then
    raise exception 'tarih aralığı gün sayısıyla uyuşmuyor' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_duraklar, '[]')) x
    where coalesce((x ->> 'gun')::integer, 0) not between 1 and p_gun_sayisi
  ) then
    raise exception 'durağın günü seyahatte yok' using errcode = '22023';
  end if;

  insert into public.trips (owner_id, name, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
  values (
    auth.uid(),
    nullif(left(btrim(coalesce(p_seyahat ->> 'name', '')), 80), ''),
    p_seyahat ->> 'city_place_id',
    left(p_seyahat ->> 'city_label', 80),
    nullif(p_seyahat ->> 'country_code', ''),
    (p_seyahat ->> 'lat')::double precision,
    (p_seyahat ->> 'lng')::double precision,
    p_seyahat ->> 'tz',
    v_bas,
    v_son
  )
  returning id into v_trip;

  -- Tarihli seyahatte tetikleyici bütün günleri kurar; tarihsizde tek gün kurar, kalanlar burada (tarihsiz) eklenir.
  if v_bas is null and p_gun_sayisi > 1 then
    insert into public.days (trip_id, index, date)
    select v_trip, g, null from generate_series(2, p_gun_sayisi) g;
  end if;

  -- #205 KK7: koordinatın tazelik damgası gezi durağından taşınır (emsal seyahati_kopyala). Damga yoksa (durak osm/elle ya da
  -- eski istemci) now(); gelecek tarihli damga now()'a indirilir — istemci bir koordinata süresiz ömür veremez.
  insert into public.places (trip_id, place_id, primary_type, lat, lng, google_fetched_at, default_minutes, added_by)
  select v_trip, m ->> 'place_id', nullif(m ->> 'primary_type', ''), (m ->> 'lat')::double precision, (m ->> 'lng')::double precision,
         least(coalesce(nullif(m ->> 'google_fetched_at', '')::timestamptz, now()), now()),
         least(480, greatest(15, coalesce((m ->> 'dk')::integer, 45))), auth.uid()
  from jsonb_array_elements(coalesce(p_mekanlar, '[]')) m
  on conflict (trip_id, place_id) do nothing;

  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select v_trip, d.id, p.id, x ->> 'order_key', least(480, greatest(15, coalesce((x ->> 'dk')::integer, p.default_minutes)))
  from jsonb_array_elements(coalesce(p_duraklar, '[]')) x
  join public.days d on d.trip_id = v_trip and d.index = (x ->> 'gun')::integer
  join public.places p on p.trip_id = v_trip and p.place_id = x ->> 'place_id'
  on conflict (place_ref) do nothing;

  return v_trip;
end;
$$;
