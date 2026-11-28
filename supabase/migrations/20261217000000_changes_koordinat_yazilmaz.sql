-- #330 (Ece kararı A, 26 Kasım; Ürün kararı (a), PR #636): değişiklik geçmişinde (`changes`) Google koordinatı 30 günü
-- geçmez (PRD §7).
-- 1. `log_change` güncellemede koordinat alanlarını (`lat`, `lng`, `hotel_lat`, `hotel_lng`) yazmaz: koordinat için alan
--    satırı (`field = 'lat'` vb.) artık oluşmaz. Ekleme ve silme satırı satırın tamamını, koordinatı damgasıyla birlikte
--    tutar (`google_fetched_at`; otelde `hotel_fetched_at`; konaklamada `stays.google_fetched_at`): "Sil → Geri al" mekanı
--    koordinatıyla geri getirir. Bu kopya da ana tablolar gibi damgasından 30 günde boşalır (2).
-- 2. `changes_koordinat_bosalt(p_gun)`: koordinatı boşaltır, satır silinmez.
--    - Alan satırı (yalnız eski tetikleyicinin yazdıkları): damgası yok → süresi geçmiş sayılır, old/new null.
--    - Ekleme/silme satırı: jsonb'deki damga `p_gun` günü geçmişse ya da damga yoksa koordinat anahtarları çıkar
--      (ana tablolardaki `places_koordinat_bosalt` gibi, 20261127000000). "Seyahatime al" kopyası eski damgayı taşır.
--    - Kullanıcının pini Google verisi değildir, kalır: `place_id`'siz konaklamanın `lat`/`lng`'si, `hotel_place_id`'siz
--      otelin `hotel_lat`/`hotel_lng`'si (ana tablolardaki istisna).
-- 3. Gece işine (#516 KK6) bağlama ve ilk çalıştırma 20261217100000'de: veri değiştiren her şey bekçinin durdurduğu o dosyada.
-- Google'a istek yok.

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
      if alan not in ('google_fetched_at', 'hotel_fetched_at', 'lat', 'lng', 'hotel_lat', 'hotel_lng')
         and (eski -> alan) is distinct from (yeni -> alan) then
        insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
        values (seyahat, kim, tg_table_name, varlik_id, alan, eski -> alan, yeni -> alan);
      end if;
    end loop;
  else
    -- Koordinat damgasıyla birlikte kalır; gece işi 30 günde boşaltır (changes_koordinat_bosalt).
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (seyahat, kim, tg_table_name, varlik_id, null, eski, yeni);
  end if;
  return coalesce(new, old);
end;
$$;

-- Bir ekleme/silme jsonb'sinden süresi geçen Google koordinatını çıkarır. Damga yoksa süresi geçmiş sayılır; pin kalır.
create function public.changes_koordinat_suz(p_entity text, p_j jsonb, p_sinir timestamptz)
returns jsonb
language sql stable set search_path = ''
as $$
  select case
    when p_j is null then null
    else p_j
      - case when (p_j ? 'lat' or p_j ? 'lng')
               and (p_entity <> 'stays' or p_j ->> 'place_id' is not null)
               and coalesce((p_j ->> 'google_fetched_at')::timestamptz < p_sinir, true)
             then array['lat', 'lng'] else array[]::text[] end
      - case when (p_j ? 'hotel_lat' or p_j ? 'hotel_lng')
               and p_j ->> 'hotel_place_id' is not null
               and coalesce((p_j ->> 'hotel_fetched_at')::timestamptz < p_sinir, true)
             then array['hotel_lat', 'hotel_lng'] else array[]::text[] end
  end;
$$;
revoke execute on function public.changes_koordinat_suz(text, jsonb, timestamptz) from public, anon, authenticated;

-- Boşaltılan satır sayısını döner (satır silinmez). `p_gun`: 30–60.
create function public.changes_koordinat_bosalt(p_gun integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  koordinat constant text[] := array['lat', 'lng', 'hotel_lat', 'hotel_lng'];
  v_sinir timestamptz;
  alanlar integer;
  satirlar integer;
begin
  if p_gun is null or p_gun < 30 or p_gun > 60 then
    raise exception 'p_gun 30–60 arası olmalı' using errcode = '22023';
  end if;
  v_sinir := now() - make_interval(days => p_gun);

  -- Alan satırı (`field = 'lat'` vb., yalnız eski tetikleyiciden): damgası yok, süresi geçmiş sayılır. Değer boşalır,
  -- satır kalır.
  update public.changes c set old = null, new = null
  where c.field = any (koordinat) and (c.old is not null or c.new is not null);
  get diagnostics alanlar = row_count;

  -- Ekleme/silme satırı: yalnız süresi geçen Google koordinatı çıkar.
  update public.changes c
  set old = public.changes_koordinat_suz(c.entity, c.old, v_sinir),
      new = public.changes_koordinat_suz(c.entity, c.new, v_sinir)
  where c.field is null
    and (coalesce(c.old ?| koordinat, false) or coalesce(c.new ?| koordinat, false))
    and (c.old is distinct from public.changes_koordinat_suz(c.entity, c.old, v_sinir)
         or c.new is distinct from public.changes_koordinat_suz(c.entity, c.new, v_sinir));
  get diagnostics satirlar = row_count;

  return alanlar + satirlar;
end;
$$;
revoke execute on function public.changes_koordinat_bosalt(integer) from public, anon, authenticated;
grant execute on function public.changes_koordinat_bosalt(integer) to service_role;
