-- #330 (Ece kararı A, 26 Kasım): değişiklik geçmişinde (`changes`) Google koordinatı tutulmaz (PRD §7).
-- 1. `log_change` koordinatı (`lat`, `lng`, `hotel_lat`, `hotel_lng`) artık yazmaz: güncellemede bu alanlar atlanır, ekleme ve
--    silmede satırın jsonb'sinden çıkarılır. Satırın geri kalanı (kim, neyi, ne zaman) aynı; Sohbet ve "Son değişiklikler"
--    aynı görünür.
-- 2. `changes_koordinat_bosalt`: daha önce yazılmış koordinatı boşaltır; satır silinmez. Alan satırında (`field` koordinat)
--    old/new null olur, ekleme/silme satırında old/new jsonb'sinden anahtarlar çıkar. 30 gün, jsonb'de damga
--    (`google_fetched_at` → lat/lng, `hotel_fetched_at` → hotel_lat/hotel_lng) varsa ondan, yoksa satırın `at`'ından sayılır
--    ("Seyahatime al" kopyası eski damgayı taşır, `at`'ı yenidir). `p_gun` null: yaşa bakmadan hepsi (tek seferlik temizlik,
--    20261217100000).
-- 3. Gece işine (#516 KK6) bağlama 20261217100000'de: veri değiştiren her şey bekçinin durdurduğu o dosyada.
-- Google'a istek yok.

create or replace function public.log_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  koordinat constant text[] := array['lat', 'lng', 'hotel_lat', 'hotel_lng'];
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
      if alan not in ('google_fetched_at', 'hotel_fetched_at')
         and alan <> all (koordinat)
         and (eski -> alan) is distinct from (yeni -> alan) then
        insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
        values (seyahat, kim, tg_table_name, varlik_id, alan, eski -> alan, yeni -> alan);
      end if;
    end loop;
  else
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (seyahat, kim, tg_table_name, varlik_id, null, eski - koordinat, yeni - koordinat);
  end if;
  return coalesce(new, old);
end;
$$;

-- Bir ekleme/silme jsonb'sinden süresi geçen koordinat anahtarlarını çıkarır. `p_sinir` null: hepsi.
create function public.changes_koordinat_suz(p_j jsonb, p_at timestamptz, p_sinir timestamptz)
returns jsonb
language sql stable set search_path = ''
as $$
  select case
    when p_j is null then null
    when p_sinir is null then p_j - array['lat', 'lng', 'hotel_lat', 'hotel_lng']
    else p_j
      - case when coalesce((p_j ->> 'google_fetched_at')::timestamptz, p_at) < p_sinir then array['lat', 'lng'] else array[]::text[] end
      - case when coalesce((p_j ->> 'hotel_fetched_at')::timestamptz, p_at) < p_sinir then array['hotel_lat', 'hotel_lng'] else array[]::text[] end
  end;
$$;
revoke execute on function public.changes_koordinat_suz(jsonb, timestamptz, timestamptz) from public, anon, authenticated;

-- Boşaltılan satır sayısını döner (satır silinmez). `p_gun`: 30–60 ya da null (yaşa bakmadan).
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
  if p_gun is not null and (p_gun < 30 or p_gun > 60) then
    raise exception 'p_gun 30–60 arası ya da boş olmalı' using errcode = '22023';
  end if;
  v_sinir := now() - make_interval(days => p_gun);

  -- Alan satırı (`field = 'lat'` vb.): değer boşalır, satır kalır. Satırda damga yok; `at`'tan sayılır.
  update public.changes c set old = null, new = null
  where c.field = any (koordinat) and (c.old is not null or c.new is not null)
    and (v_sinir is null or c.at < v_sinir);
  get diagnostics alanlar = row_count;

  -- Ekleme/silme satırı: yalnız koordinat anahtarları çıkar.
  update public.changes c
  set old = public.changes_koordinat_suz(c.old, c.at, v_sinir),
      new = public.changes_koordinat_suz(c.new, c.at, v_sinir)
  where c.field is null
    and (coalesce(c.old ?| koordinat, false) or coalesce(c.new ?| koordinat, false))
    and (c.old is distinct from public.changes_koordinat_suz(c.old, c.at, v_sinir)
         or c.new is distinct from public.changes_koordinat_suz(c.new, c.at, v_sinir));
  get diagnostics satirlar = row_count;

  return alanlar + satirlar;
end;
$$;
revoke execute on function public.changes_koordinat_bosalt(integer) from public, anon, authenticated;
grant execute on function public.changes_koordinat_bosalt(integer) to service_role;
