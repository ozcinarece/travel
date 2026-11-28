-- #642: 30 gün kuralının iki açığı (#640 incelemesi, M-G). Google'a yeni istek yok.
--
-- Bu dosya YALNIZ TANIM: var olan satırlara dokunmaz. Var olan `bilinen` kayıtlarının temizliği 20261219100000'de; bekçi
-- (`scripts/veri-silen.mjs`) o dosyayı durdurur. Bekçi bekleyen dosyalardan biri eşleşince hiçbirini uygulamadığı için bu dosya
-- da 20261219100000 ile (ve önceki bekleyenlerle, #644) birlikte, Ece onayıyla elle (`workflow_dispatch`) gider.
--
-- KK2 (`sehir_rehberi_taslak.bilinen`): öğe `{kategori, lat, lng, google_fetched_at}`; Google'dan gelen ad saklanmaz (PRD §7),
--   yayında mekan yalnız place_id ile eşleşir. Koordinatın damgası öğeyle saklanır ve yayında (`rehber_yayinla` →
--   `icerik_mekanlari_yaz`) `yerler.google_fetched_at`'e taşınır; damga yoksa ya da 30 günü geçtiyse yer koordinatsız açılır.
--   Yayında yeni yerin adı: editörün bu oturumda seçtiği mekanın adı (`p_adlar`, saklanmaz) ya da satır içi bağlantı metni.
-- KK3: içerik şehrinden kurulan seyahatte `trips.google_fetched_at` şehrin kendi damgasıdır (`geziden_seyahat_ac`); 30 günü
--   geçtiyse şehir koordinatı boş yazılır (emsal: `seyahat_paylasimdan_kopyala`).

-- ---------------------------------------------------------------- yardımcı
-- İstemciden gelen damga metni: boş ya da geçersizse null (geçersiz metin bütün işlemi düşürmesin). plpgsql: SQL fonksiyonu
-- satır içine alınıp sabit katlamada cast'i erken çalıştırabilir.
create function public.damga_oku(p_metin text) returns timestamptz
language plpgsql stable set search_path = ''
as $$
begin
  if nullif(p_metin, '') is null or not pg_input_is_valid(p_metin, 'timestamptz') then
    return null;
  end if;
  return p_metin::timestamptz;
end;
$$;
revoke execute on function public.damga_oku(text) from public, anon;
grant execute on function public.damga_oku(text) to authenticated;

-- `bilinen` öğelerini saklanabilir biçime getirir: `ad` atılır; koordinatlı öğe damga taşır. `p_varsayilan`: damgası olmayan
-- koordinatlı öğenin damgası (yeni seçim: now()); null ise damgasız koordinat boşaltılır (eski kayıt). Gelecek tarihli damga
-- now()'a iner (istemci bir koordinata süresiz ömür veremez). Tanınmayan biçimdeki öğe atılır.
create function public.bilinen_temizle(p_bilinen jsonb, p_varsayilan timestamptz) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.key, case
      when d.damga is not null then o.oge || jsonb_build_object('google_fetched_at', d.damga)
      else o.oge || jsonb_build_object('lat', null, 'lng', null, 'google_fetched_at', null)
    end), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p_bilinen) = 'object' then p_bilinen else '{}'::jsonb end) e
  cross join lateral (
    select jsonb_build_object('kategori', e.value -> 'kategori', 'lat', e.value -> 'lat', 'lng', e.value -> 'lng') as oge,
           jsonb_typeof(e.value -> 'lat') = 'number' and jsonb_typeof(e.value -> 'lng') = 'number' as konumlu
  ) o
  cross join lateral (
    -- least() null'ı atlar: damgasız ve varsayılansız öğe burada null kalmalı (now() olmamalı).
    select case when o.konumlu and v.damga is not null then least(v.damga, now()) end as damga
    from (select coalesce(public.damga_oku(e.value ->> 'google_fetched_at'), p_varsayilan) as damga) v
  ) d
  where jsonb_typeof(e.value) = 'object';
$$;
revoke execute on function public.bilinen_temizle(jsonb, timestamptz) from public, anon;
grant execute on function public.bilinen_temizle(jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------- taslak kaydı (20261030000000 sürümü + KK2)
-- Gelen `p_bilinen` öğesi saklanabilir biçimde yazılır (ad atılır); damgasızsa kayıt anı damgadır (editör seçtiği mekanı 2 sn
-- içinde yazar). Taslakta zaten duran eski öğelere burada dokunulmaz (KK4: temizlikleri 20261219100000'de, Ece onayıyla); yayın
-- onları yeni kuralla okur.
create or replace function public.rehber_taslak_kaydet(
  p_sehir uuid, p_bolumler jsonb, p_bilinen jsonb default '{}'::jsonb, p_neden text default 'kayit', p_onceki timestamptz default null
)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  v_eski public.sehir_rehberi_taslak;
  v_zaman timestamptz;
  v_bilinen jsonb := public.bilinen_temizle(coalesce(p_bilinen, '{}'::jsonb), now());
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  select * into v_eski from public.sehir_rehberi_taslak where sehir_id = p_sehir for update;
  if v_eski.sehir_id is null then
    if p_onceki is not null then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
    insert into public.sehir_rehberi_taslak (sehir_id, bolumler, bilinen)
      values (p_sehir, p_bolumler, v_bilinen)
    on conflict (sehir_id) do nothing
    returning updated_at into v_zaman;
    if v_zaman is null then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
  else
    if p_onceki is distinct from v_eski.updated_at then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
    -- Aynı işlemde iki kayıt aynı now()'ı alır; damga her yazışta ilerlesin.
    update public.sehir_rehberi_taslak
      set bolumler = p_bolumler, bilinen = bilinen || v_bilinen,
          updated_at = greatest(now(), v_eski.updated_at + interval '1 microsecond')
      where sehir_id = p_sehir
      returning updated_at into v_zaman;
    if p_neden <> 'kayit' or not exists (
      select 1 from public.sehir_rehberi_surum where sehir_id = p_sehir and created_at > now() - interval '2 minutes'
    ) then
      insert into public.sehir_rehberi_surum (sehir_id, bolumler, neden) values (p_sehir, v_eski.bolumler, p_neden);
      delete from public.sehir_rehberi_surum
        where sehir_id = p_sehir
          and id not in (select id from public.sehir_rehberi_surum where sehir_id = p_sehir order by created_at desc, id desc limit 20);
    end if;
  end if;
  return v_zaman;
end;
$$;

-- ---------------------------------------------------------------- mekan listesi (20261021000000 sürümü + KK2)
-- p_mekanlar: [{place_id, bicim, ad?, kategori?, lat?, lng?, google_fetched_at?}]. Yeni yer koordinatı yalnız damgası 30 günden
-- tazeyse alır (damga yerle saklanır); damgasız ya da eski damgalı koordinat yazılmaz, yer koordinatsız açılır (Parça 2'de
-- BO'da işaretlenir). Gelecek tarihli damga now()'a iner.
create or replace function public.icerik_mekanlari_yaz(p_sahip_tur text, p_sahip_id uuid, p_mekanlar jsonb) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sehir uuid;
  v_acilan integer;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  v_sehir := case p_sahip_tur
    when 'rehber' then (select sehir_id from public.sehir_rehberi where id = p_sahip_id)
    when 'gezi' then (select sehir_id from public.geziler where id = p_sahip_id)
    when 'yer' then (select sehir_id from public.yerler where id = p_sahip_id)
  end;
  if v_sehir is null then
    raise exception 'sahip bulunamadı' using errcode = '23503';
  end if;
  delete from public.icerik_mekanlari where sahip_tur = p_sahip_tur and sahip_id = p_sahip_id;
  insert into public.icerik_mekanlari (sahip_tur, sahip_id, place_id, bicim, sira)
    select p_sahip_tur, p_sahip_id, m ->> 'place_id', m ->> 'bicim', i::integer
    from jsonb_array_elements(coalesce(p_mekanlar, '[]'::jsonb)) with ordinality as e(m, i);
  with yeni as (
    select distinct on (m ->> 'place_id') m,
      -- least() null'ı atlar: damgasız (ya da geçersiz damgalı) öğe null kalır (now() olmaz).
      case when public.damga_oku(m ->> 'google_fetched_at') is not null
        then least(public.damga_oku(m ->> 'google_fetched_at'), now()) end as damga,
      (m ->> 'lat')::double precision as lat,
      (m ->> 'lng')::double precision as lng
    from jsonb_array_elements(coalesce(p_mekanlar, '[]'::jsonb)) m
    where nullif(trim(m ->> 'ad'), '') is not null and m ? 'lat' and m ? 'lng'
      and not exists (select 1 from public.yerler y where y.place_id = m ->> 'place_id')
  ), taze as (
    select y.*, y.lat is not null and y.lng is not null and y.damga > now() - interval '30 days' as konumlu from yeni y
  )
  insert into public.yerler (sehir_id, place_id, ad, kategori, lat, lng, google_fetched_at, yayin)
    select v_sehir, m ->> 'place_id', left(trim(m ->> 'ad'), 120), m ->> 'kategori',
      case when konumlu then lat end, case when konumlu then lng end, damga, false
    from taze;
  get diagnostics v_acilan = row_count;
  return v_acilan;
end;
$$;

-- ---------------------------------------------------------------- yayın (20261030000000 sürümü + KK2)
-- Yeni imza: `p_adlar` {place_id: ad} — editörün bu oturumda seçtiği mekanların adı (yeni yerin adı için; saklanmaz). Varsayılanı
-- boş: eski editör (iki argümanla çağıran) aynı fonksiyona düşer. Adın önceliği eskisi gibi: seçilen ad, sonra bağlantı metni.
drop function public.rehber_yayinla(uuid, timestamptz);
create function public.rehber_yayinla(p_sehir uuid, p_beklenen timestamptz, p_adlar jsonb default '{}'::jsonb) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_taslak public.sehir_rehberi_taslak;
  v_adlar jsonb := case when jsonb_typeof(p_adlar) = 'object' then p_adlar else '{}'::jsonb end;
  b record;
  v_md text;
  v_satir integer;
  v_mekanlar jsonb;
  v_acilan integer := 0;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  select * into v_taslak from public.sehir_rehberi_taslak where sehir_id = p_sehir for update;
  if v_taslak.sehir_id is null then
    raise exception 'taslak yok' using errcode = 'P0002';
  end if;
  if p_beklenen is distinct from v_taslak.updated_at then
    raise exception 'taslak değişti' using errcode = '40001';
  end if;
  -- Eski biçimdeki öğe (ad, damgasız koordinat) yayında da yeni kuralla okunur.
  v_taslak.bilinen := public.bilinen_temizle(v_taslak.bilinen, null);
  set constraints public.sehir_rehberi_sira_tekil deferred;

  delete from public.icerik_mekanlari m
    where m.sahip_tur = 'rehber'
      and m.sahip_id in (select r.id from public.sehir_rehberi r where r.sehir_id = p_sehir)
      and m.sahip_id::text not in (select e ->> 'id' from jsonb_array_elements(v_taslak.bolumler) e);
  delete from public.sehir_rehberi r
    where r.sehir_id = p_sehir and r.id::text not in (select e ->> 'id' from jsonb_array_elements(v_taslak.bolumler) e);

  for b in select e, i from jsonb_array_elements(v_taslak.bolumler) with ordinality as x(e, i) loop
    v_md := '# ' || regexp_replace(trim(b.e ->> 'baslik'), '\s*\n\s*', ' ', 'g')
      || case when nullif(trim(coalesce(b.e ->> 'govde', '')), '') is null then '' else E'\n\n' || trim(b.e ->> 'govde') end;
    insert into public.sehir_rehberi (id, sehir_id, bolum, baslik, ozet, yazi_md, sira, gizli)
      values ((b.e ->> 'id')::uuid, p_sehir, nullif(b.e ->> 'bolum', ''), trim(b.e ->> 'baslik'), nullif(trim(coalesce(b.e ->> 'ozet', '')), ''),
              v_md, b.i::integer, coalesce((b.e ->> 'gizli')::boolean, false))
    on conflict (id) do update
      set bolum = excluded.bolum, baslik = excluded.baslik, ozet = excluded.ozet, yazi_md = excluded.yazi_md,
          sira = excluded.sira, gizli = excluded.gizli
      where public.sehir_rehberi.sehir_id = p_sehir;
    get diagnostics v_satir = row_count;
    if v_satir = 0 then
      raise exception 'bölüm başka şehrin: %', b.e ->> 'id' using errcode = '42501';
    end if;

    -- Yazıdaki mekanlar (satır içi `[ad](mekan:id)` ve satır başında `::mekan[id]`); bilinen öğeden kategori, konum ve damgası.
    select coalesce(jsonb_agg(
      jsonb_build_object('place_id', p.place_id, 'bicim', p.bicim)
        || case when v_taslak.bilinen ? p.place_id
             then (v_taslak.bilinen -> p.place_id)
                  || jsonb_build_object('ad', coalesce(nullif(trim(v_adlar ->> p.place_id), ''), nullif(p.ad, '')))
             else '{}'::jsonb end
      order by p.sira), '[]'::jsonb)
    into v_mekanlar
    from (
      select k.sira,
        coalesce(k.m[2], k.m[3]) as place_id,
        case when k.m[3] is not null then 'kart' else 'satir' end as bicim,
        trim(k.m[1]) as ad
      from regexp_matches(v_md, '\[([^\]]+)\]\(mekan:([A-Za-z0-9_-]{10,255})\)|^::mekan\[([A-Za-z0-9_-]{10,255})\][ \t]*$', 'gn')
        with ordinality as k(m, sira)
    ) p;
    v_acilan := v_acilan + public.icerik_mekanlari_yaz('rehber', (b.e ->> 'id')::uuid, v_mekanlar);
  end loop;

  -- Yayın damgası taslağınkinden önce olamaz ("Taslak değişiklik var" = updated_at > yayinlandi_at).
  update public.sehir_rehberi_taslak set yayinlandi_at = greatest(now(), updated_at) where sehir_id = p_sehir;
  insert into public.sehir_rehberi_surum (sehir_id, bolumler, neden) values (p_sehir, v_taslak.bolumler, 'yayin');
  delete from public.sehir_rehberi_surum
    where sehir_id = p_sehir
      and id not in (select id from public.sehir_rehberi_surum where sehir_id = p_sehir order by created_at desc, id desc limit 20);
  return v_acilan;
end;
$$;
revoke execute on function public.rehber_yayinla(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.rehber_yayinla(uuid, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------- KK3: içerik şehrinden seyahat (20261115000000 sürümü + KK3)
-- Şehir koordinatının damgası: istemcinin gönderdiği (`p_seyahat.google_fetched_at`; içerik şehrinin damgası) ile aynı Google
-- kimlikli içerik şehrinin (`sehirler`, google_30g) damgasından eski olanı; ikisi de yoksa now() (yeni Google seçimi). Eski
-- istemci damga göndermese de şehir damgası sunucuda bulunur. 30 günü geçtiyse koordinat boş yazılır.
create or replace function public.geziden_seyahat_ac(p_seyahat jsonb, p_gun_sayisi integer, p_mekanlar jsonb, p_duraklar jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_trip uuid;
  v_bas date;
  v_son date;
  v_damga timestamptz;
  v_konumlu boolean;
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

  -- KK3: least() null'ı atlar; eşleşen içerik şehri yoksa istemcinin damgası, o da yoksa now().
  v_damga := least(
    coalesce(public.damga_oku(p_seyahat ->> 'google_fetched_at'), now()),
    now(),
    (select min(s.google_fetched_at) from public.sehirler s
      where s.place_id = p_seyahat ->> 'city_place_id' and s.konum_kaynagi = 'google_30g'));
  v_konumlu := v_damga > now() - interval '30 days';

  insert into public.trips (owner_id, name, city_place_id, city_label, country_code, lat, lng, tz, google_fetched_at, start_date, end_date)
  values (
    auth.uid(),
    nullif(left(btrim(coalesce(p_seyahat ->> 'name', '')), 80), ''),
    p_seyahat ->> 'city_place_id',
    left(p_seyahat ->> 'city_label', 80),
    nullif(p_seyahat ->> 'country_code', ''),
    case when v_konumlu then (p_seyahat ->> 'lat')::double precision end,
    case when v_konumlu then (p_seyahat ->> 'lng')::double precision end,
    p_seyahat ->> 'tz',
    v_damga,
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
         least(coalesce(public.damga_oku(m ->> 'google_fetched_at'), now()), now()),
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
