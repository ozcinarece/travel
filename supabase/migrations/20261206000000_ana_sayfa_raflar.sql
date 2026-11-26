-- #406 (kanvas `Ana_v6_Kesfet`): raflı ana sayfa + banner. Mevcut bölüm tablosu (#109) iki yeni türle genişler; taslak,
-- yayın anlık görüntüsü ve `ana_sayfa_gorunen` görünümü aynen çalışır (yetki kuralları değişmez: taslak yalnız admin,
-- yayın herkes okur). Google verisi yok: banner görseli Commons ya da Ece'nin yüklediği dosya (`kapak_url` + `kapak_atif`).
--
-- banner: {ust_yazi?, kapak_url?, kapak_atif?, hedef?: {tur: gezi|sehir|raf, id}}  (başlık = bölümün `baslik`)
-- raf:    {raf_turu: amac|sehir|elle|arkadaslardan, amac?, sehir_id?, gezi_idler?}
--         KK5: `arkadaslardan` 26 Kasım paylaşımından sonra dolacak; şimdilik uygulama bu rafı çizmez.

alter table public.ana_sayfa_bolumleri drop constraint ana_sayfa_bolumleri_tur_check;
alter table public.ana_sayfa_bolumleri add constraint ana_sayfa_bolumleri_tur_check
  check (tur in ('tek_kart', 'serit', 'mozaik', 'sehir_seckisi', 'banner', 'raf'));

-- uuid metni mi (jsonb alanları için).
create function public.uuid_metni_mi(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select p is not null and p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' $$;

-- Banner görseli yalnız Commons (`upload.wikimedia.org`) ya da kendi Storage alanımız (`icerik` kovası) olabilir: Google
-- Places foto adresi yapıştırılıp herkese yayınlanamasın (PRD §7, #428 inceleme 5). Yol hilesi de kapalı: `..`, kodlanmış
-- nokta/bölü (`%2e`, `%2f`, `%5c`) ve ters bölü reddedilir; yoksa `…/icerik/../avatars/…` ile public avatar kovası
-- banner'da yayınlanabilirdi (#428 2. inceleme 3). Çift kodlama (`%252e`) için `%25` de reddedilir (3. inceleme).
create function public.banner_gorsel_adresi_gecerli(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select p is not null
    and char_length(p) <= 500
    and p ~ '^https://(upload\.wikimedia\.org/|xwqeobelyeuzoxyuvauw\.supabase\.co/storage/v1/object/public/icerik/)'
    and p !~* '(\.\.|%2e|%2f|%5c|%25|\\)'
$$;

-- Banner ve raf içeriğinin biçimi. Eski türler (#109) burada denetlenmez (önceki davranış). Eksik alan null üretip
-- CHECK'ten "geçmesin" diye coalesce(…, false). Nesne olmayan içerik her dalın başında `case` ile reddedilir; böylece
-- `jsonb_object_keys` hata (22023) vermez, CHECK ihlali (23514) olur.
create function public.ana_sayfa_icerik_gecerli(p_tur text, i jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when p_tur not in ('banner', 'raf') then true
    when i is null or jsonb_typeof(i) <> 'object' then false
    when p_tur = 'banner' then coalesce(
      (select coalesce(bool_and(k in ('ust_yazi', 'kapak_url', 'kapak_atif', 'hedef')), true) from jsonb_object_keys(i) k)
      and (i -> 'ust_yazi' is null or (jsonb_typeof(i -> 'ust_yazi') = 'string' and char_length(btrim(i ->> 'ust_yazi')) between 1 and 40))
      and (i -> 'kapak_url' is null
        or (jsonb_typeof(i -> 'kapak_url') = 'string' and public.banner_gorsel_adresi_gecerli(i ->> 'kapak_url')))
      and public.kapak_atfi_gecerli(i -> 'kapak_atif')
      -- Atıf ile görsel birlikte: görselsiz atıf olmaz, atıfsız görsel de yayınlanmaz (#345, #428 inceleme 4).
      and ((i -> 'kapak_url' is null) = (i -> 'kapak_atif' is null))
      and (i -> 'hedef' is null or (
        jsonb_typeof(i -> 'hedef') = 'object'
        and (select bool_and(k in ('tur', 'id')) from jsonb_object_keys(i -> 'hedef') k)
        and i -> 'hedef' ->> 'tur' in ('gezi', 'sehir', 'raf')
        and public.uuid_metni_mi(i -> 'hedef' ->> 'id'))),
      false)
    else coalesce(
      (select coalesce(bool_and(k in ('raf_turu', 'amac', 'sehir_id', 'gezi_idler')), true) from jsonb_object_keys(i) k)
      and i ->> 'raf_turu' in ('amac', 'sehir', 'elle', 'arkadaslardan')
      and (i -> 'amac' is null or (jsonb_typeof(i -> 'amac') = 'string' and (i ->> 'amac') = any (public.amac_listesi())))
      and (i -> 'sehir_id' is null or (jsonb_typeof(i -> 'sehir_id') = 'string' and public.uuid_metni_mi(i ->> 'sehir_id')))
      and (i -> 'gezi_idler' is null or (
        jsonb_typeof(i -> 'gezi_idler') = 'array'
        and jsonb_array_length(i -> 'gezi_idler') <= 30
        and (select coalesce(bool_and(jsonb_typeof(x) = 'string' and public.uuid_metni_mi(x #>> '{}')), true) from jsonb_array_elements(i -> 'gezi_idler') x))),
      false)
  end
$$;

alter table public.ana_sayfa_bolumleri add constraint ana_sayfa_bolumleri_icerik_gecerli
  check (public.ana_sayfa_icerik_gecerli(tur, icerik));

-- KK6: ölçüm — banner_acildi (hedef_id: bölüm; meta: hedef türü), raf_kart_acildi (hedef_id: gezi; meta: raf). Yalnız
-- olay türü eklenir; olaylar tablosunun yetki kuralları değişmez.
alter table public.olaylar drop constraint if exists olaylar_tur_check;
alter table public.olaylar add constraint olaylar_tur_check
  check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi', 'davet_katildi', 'sihirbaz_bitti', 'plan_kuruldu',
                 'ana_kart_acildi', 'ana_ara', 'planlamaya_devam', 'plan_hazir_davet', 'sekme_acildi', 'banner_acildi', 'raf_kart_acildi'));
