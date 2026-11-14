-- #193 KK3 (kanvas 19b): "Seyahatime al" → Yeni seyahat — seyahat, günleri, mekanları ve gün planı TEK işlemde. Herhangi bir
-- adım hata verirse hiçbiri yazılmaz (yarım seyahat kalmaz). Çağıranın yetkisiyle (RLS): seyahati yalnız hesaplı kullanıcı açar
-- (trips_insert), sahip tetikleyiciyle üye olur ve günler tetikleyiciyle kurulur; mekan ve durak yazımı üyelik politikalarıyla.
-- Google kimlikleri istemcide çözülür (gezi durağının place_id'si boş olabilir; adıyla) — bu fonksiyon Google'a gitmez.
--   p_seyahat:    {name, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date}
--   p_gun_sayisi: 1–30; tarihli seyahatte end − start + 1'e eşit; tarihsizde günler tarihsiz kurulur ("Tarih sonra").
--   p_mekanlar:   [{place_id, primary_type, lat, lng, dk}] — Listem'e girer.
--   p_duraklar:   [{gun, place_id, order_key, dk}] — gün (1..p_gun_sayisi) içinde order_key sırasıyla; boşsa mekanlar atanmamış
--                 kalır ("Yalnız mekanlar", KK10).
create function public.geziden_seyahat_ac(p_seyahat jsonb, p_gun_sayisi integer, p_mekanlar jsonb, p_duraklar jsonb)
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

  insert into public.places (trip_id, place_id, primary_type, lat, lng, default_minutes, added_by)
  select v_trip, m ->> 'place_id', nullif(m ->> 'primary_type', ''), (m ->> 'lat')::double precision, (m ->> 'lng')::double precision,
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

revoke all on function public.geziden_seyahat_ac(jsonb, integer, jsonb, jsonb) from public, anon;
grant execute on function public.geziden_seyahat_ac(jsonb, integer, jsonb, jsonb) to authenticated;
