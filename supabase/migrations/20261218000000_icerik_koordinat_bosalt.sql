-- #205 Parça 1 (Ece kararı B, #220): içerik tablolarında (`sehirler`, `yerler`, `gezi_duraklari`) 30 günü geçen Google
-- koordinatı boşalır; satır silinmez (ad, place_id, damga, rehber, sıra kalır). Google ile yenileme yok; kalıcı konum OSM ya da
-- BO'da elle işaretlenendir (Parça 2). Google'a istek yok.
--
-- Bu dosya YALNIZ TANIM: veri değiştirmez. Veri değiştiren her şey (ilk boşaltma ve gece işine bağlama) 20261218100000'de;
-- bekçi (`scripts/veri-silen.mjs`) o dosyayı durdurur. Bekçi bekleyen dosyalardan biri eşleşince hiçbirini uygulamadığı için
-- bu dosya da 20261218100000 ile birlikte, Ece onayıyla elle (`workflow_dispatch`) gider.
--
-- 1. `lat`/`lng` boş olabilir (ikisi birlikte), `places`/`trips`/`stays` ile aynı (#318, 20261127000000).
-- 2. `konum_kaynagi_yaz()`: koordinat BOŞALINCA damga yenilenmez (yalnız yeni bir koordinat yeni 30 gün kazanır). Yoksa
--    boşaltma damgayı now() yapardı ve satır taze görünürdü.
-- 3. `icerik_koordinat_bosalt(p_gun)`: `konum_kaynagi = 'google_30g'` ve koordinatı dolu satırda gün `google_fetched_at`'tan,
--    o yoksa `created_at`'tan (durakta gezinin `created_at`'i; durağın kendi sütunu yok) sayılır (#330'daki kural); süresi
--    geçenin lat/lng'si null olur. Döner: tablo başına boşaltılan satır sayısı. Yalnız postgres çağırır (gece işi security
--    definer); anon, authenticated ve service_role çağıramaz.
-- 4. `konum_kaynagi_kontrol()` (#205 KK6): `suresi_gecen` yalnız koordinatı DOLU satırı sayar (boşalmış koordinat Google verisi
--    değil); yeni sayı `konumsuz`: koordinatı boşalmış google_30g satırı (Parça 2'de BO'da işaretlenecekler). Yalnız sayı.
-- 5. Gece kaydına (`gece_temizligi_kayit`, #516) içerik sayıları: boşaltılan satır (tablo başına) ve `konum_kontrol`
--    (`konum_kaynagi_kontrol()` çıktısı, yalnız sayı). Gece işine bağlantı bir BEFORE INSERT tetikleyicisi
--    (`gece_temizligi_icerik`, 20261218100000'de kurulur): `gece_temizligi()` kaydını yazarken içerik adımı çalışır ve sayıları
--    aynı satıra koyar. Neden `gece_temizligi()`'ni yeniden tanımlamıyoruz: #330 (`changes`) de onu yeniden tanımlıyor; tetikleyici
--    hangi sürümü olursa olsun (bugünkü ya da #330'unki) ve hangi sırayla birleşirse birleşsin çalışır, adımlar birbirini ezmez.
--    Kayıt satırını yalnız `gece_temizligi()` yazar (tabloya anon/authenticated yetkisi yok).

-- 1
alter table public.sehirler
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint sehirler_konum_birlikte check ((lat is null) = (lng is null));
alter table public.yerler
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint yerler_konum_birlikte check ((lat is null) = (lng is null));
alter table public.gezi_duraklari
  alter column lat drop not null,
  alter column lng drop not null,
  add constraint gezi_duraklari_konum_birlikte check ((lat is null) = (lng is null));

-- 2 (20261115000000 sürümü + boşalan koordinatta damga korunur)
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
    -- #205 Parça 1: koordinat boşalınca (gece temizliği) damga yenilenmez; yalnız yeni koordinat yeni damga alır.
    if tg_op = 'UPDATE'
       and new.lat is not null
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

-- 3
create function public.icerik_koordinat_bosalt(p_gun integer default 30)
returns table (sehir integer, yer integer, durak integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_sinir timestamptz;
begin
  if p_gun is null or p_gun < 30 or p_gun > 60 then
    raise exception 'p_gun 30–60 arası olmalı' using errcode = '22023';
  end if;
  v_sinir := now() - make_interval(days => p_gun);

  update public.sehirler s set lat = null, lng = null
  where s.konum_kaynagi = 'google_30g' and s.lat is not null
    and coalesce(s.google_fetched_at, s.created_at) < v_sinir;
  get diagnostics sehir = row_count;

  update public.yerler y set lat = null, lng = null
  where y.konum_kaynagi = 'google_30g' and y.lat is not null
    and coalesce(y.google_fetched_at, y.created_at) < v_sinir;
  get diagnostics yer = row_count;

  update public.gezi_duraklari d set lat = null, lng = null
  from public.gezi_gunleri gg join public.geziler g on g.id = gg.gezi_id
  where gg.id = d.gezi_gun_id
    and d.konum_kaynagi = 'google_30g' and d.lat is not null
    and coalesce(d.google_fetched_at, g.created_at) < v_sinir;
  get diagnostics durak = row_count;

  return next;
end;
$$;
revoke execute on function public.icerik_koordinat_bosalt(integer) from public, anon, authenticated, service_role;

-- 4 (20261114000000 sürümü + `suresi_gecen` yalnız dolu koordinat, `konumsuz`)
create or replace function public.konum_kaynagi_kontrol() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_object_agg(t.tablo, jsonb_build_object(
      'toplam', t.toplam, 'osm', t.osm, 'elle', t.elle, 'google_30g', t.google, 'suresi_gecen', t.suresi_gecen,
      'konumsuz', t.konumsuz))
  from (
    select 'sehirler' as tablo, count(*) as toplam,
      count(*) filter (where konum_kaynagi = 'osm') as osm,
      count(*) filter (where konum_kaynagi = 'elle') as elle,
      count(*) filter (where konum_kaynagi = 'google_30g') as google,
      count(*) filter (where konum_kaynagi = 'google_30g' and lat is not null
        and coalesce(google_fetched_at, created_at) < now() - interval '30 days') as suresi_gecen,
      count(*) filter (where konum_kaynagi = 'google_30g' and lat is null) as konumsuz
    from public.sehirler
    union all
    select 'yerler', count(*),
      count(*) filter (where konum_kaynagi = 'osm'),
      count(*) filter (where konum_kaynagi = 'elle'),
      count(*) filter (where konum_kaynagi = 'google_30g'),
      count(*) filter (where konum_kaynagi = 'google_30g' and lat is not null
        and coalesce(google_fetched_at, created_at) < now() - interval '30 days'),
      count(*) filter (where konum_kaynagi = 'google_30g' and lat is null)
    from public.yerler
    union all
    select 'gezi_duraklari', count(*),
      count(*) filter (where d.konum_kaynagi = 'osm'),
      count(*) filter (where d.konum_kaynagi = 'elle'),
      count(*) filter (where d.konum_kaynagi = 'google_30g'),
      count(*) filter (where d.konum_kaynagi = 'google_30g' and d.lat is not null
        and coalesce(d.google_fetched_at, g.created_at) < now() - interval '30 days'),
      count(*) filter (where d.konum_kaynagi = 'google_30g' and d.lat is null)
    from public.gezi_duraklari d
    join public.gezi_gunleri gg on gg.id = d.gezi_gun_id
    join public.geziler g on g.id = gg.gezi_id
  ) t;
$$;
revoke execute on function public.konum_kaynagi_kontrol() from public, anon, authenticated, service_role;

-- 5
alter table public.gece_temizligi_kayit
  add column icerik_sehir integer not null default 0 check (icerik_sehir >= 0),
  add column icerik_yer integer not null default 0 check (icerik_yer >= 0),
  add column icerik_durak integer not null default 0 check (icerik_durak >= 0),
  -- konum_kaynagi_kontrol() çıktısı: {tablo: {sayaç: sayı}}; yalnız sayı (ad, place_id, koordinat yok).
  add column konum_kontrol jsonb;

create function public.gece_temizligi_icerik() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  b record;
begin
  -- İçerik adımı hata verirse gece işinin öbür adımları (places, #330 changes) geri alınmasın: adım kendi alt işleminde
  -- geri alınır, sayılar 0 ve `konum_kontrol` null kalır (null = içerik adımı çalışmadı; masada görünür). Loga yalnız hata kodu.
  begin
    select * into b from public.icerik_koordinat_bosalt(30);
    new.icerik_sehir := b.sehir;
    new.icerik_yer := b.yer;
    new.icerik_durak := b.durak;
    -- Boşaltmadan sonra: suresi_gecen her tabloda 0 olmalı (#205 KK6).
    new.konum_kontrol := public.konum_kaynagi_kontrol();
  exception when others then
    raise warning 'gece_temizligi_icerik başarısız: %', sqlstate;
    new.icerik_sehir := 0;
    new.icerik_yer := 0;
    new.icerik_durak := 0;
    new.konum_kontrol := null;
  end;
  return new;
end;
$$;
revoke execute on function public.gece_temizligi_icerik() from public, anon, authenticated, service_role;
