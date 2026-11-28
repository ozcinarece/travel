-- #596 (#590 Maliyet-Güvenlik bulgusu): karşılama görselinde `"kaynak": null` (JSON null) ya da sayı gibi metin
-- olmayan bir kaynak kabul ediliyordu. `x -> 'kaynak'` JSON null için SQL NULL değil, `x ->> 'kaynak'` ise NULL döner;
-- `in (...)` NULL verir ve `bool_and` NULL'ı yok sayar. Kaynak artık ya hiç yok ya da listedeki bir metin.
-- Veri silmez; yalnız kural fonksiyonu yenilenir. Mevcut geçerli satırlar etkilenmez (kaynak yok ya da listede).
--
-- 20261213100000_ana_sayfa_karsilama.sql'deki kural aynen; yalnız `kaynak` koşulu değişti.
create or replace function public.ana_sayfa_icerik_gecerli(p_tur text, i jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when p_tur not in ('banner', 'raf', 'karsilama') then true
    when i is null or jsonb_typeof(i) <> 'object' then false
    when p_tur = 'karsilama' then coalesce(
      (select coalesce(bool_and(k = 'kapaklar'), true) from jsonb_object_keys(i) k)
      and jsonb_typeof(i -> 'kapaklar') = 'array'
      and jsonb_array_length(i -> 'kapaklar') <= 8
      and (select coalesce(bool_and(
            jsonb_typeof(x) = 'object'
            and (select coalesce(bool_and(k in ('url', 'atif', 'kaynak')), true) from jsonb_object_keys(x) k)
            and jsonb_typeof(x -> 'url') = 'string'
            and public.banner_gorsel_adresi_gecerli(x ->> 'url')
            and public.kapak_atfi_gecerli(x -> 'atif')
            and (x -> 'kaynak' is null
              or (jsonb_typeof(x -> 'kaynak') = 'string' and x ->> 'kaynak' in ('kendi', 'telifsiz', 'izinli')))
            -- Commons görseli atıfsız yayınlanmaz (#345).
            and (x ->> 'url' !~ '^https://upload\.wikimedia\.org/' or x -> 'atif' is not null)),
          true)
        from jsonb_array_elements(i -> 'kapaklar') x)
      -- Aynı görsel iki kez olmaz.
      and (select count(distinct x ->> 'url') = count(*) from jsonb_array_elements(i -> 'kapaklar') x),
      false)
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
