-- #205 KK3 (PR 2b-2b): mevcut içerik satırlarının konumu OSM eşleşmesiyle taşınır.
-- Hat (`ISLEM=osm-esle`) google_30g satırları için OSM adayını bulur (ad + en çok 150 m) ve eşleşmeleri buraya verir. Fonksiyon
-- her eşleşmeyi yeniden denetler: satır hâlâ google_30g olmalı, OSM konumu satırın bugünkü konumuna en çok 150 m uzak olmalı.
-- Geçen satırda lat/lng, osm_id ve konum_kaynagi = 'osm' aynı UPDATE'te yazılır (KK9 tetikleyicisi kaynağın açıkça yazıldığını
-- görür); konum_kaynagi_yaz() damgayı boşaltır. Geçmeyen satır olduğu gibi kalır ve sayılır.
-- Dönüş yalnız sayı: tablo başına yazılan ve atlanan (log herkese açık). Çağıran yalnız postgres rolü (hat, Yönetim API'si);
-- anon, authenticated ve service_role'e kapalı. KURU çalıştırmada hat çağrıyı bir hatayla geri alır (yazanCagri).

create function public.icerik_konum_osm_esle(p_eslesmeler jsonb) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  e record;
  v_tablo text;
  v_id uuid;
  v_osm text;
  v_lat double precision;
  v_lng double precision;
  v_eski record;
  v_m double precision;
  v_yazilan jsonb := '{"sehirler": 0, "yerler": 0, "gezi_duraklari": 0}'::jsonb;
  v_atlanan jsonb := '{"sehirler": 0, "yerler": 0, "gezi_duraklari": 0}'::jsonb;
begin
  if jsonb_typeof(p_eslesmeler) is distinct from 'array' then
    raise exception 'eşleşmeler bir dizi olmalı' using errcode = '22023';
  end if;
  if jsonb_array_length(p_eslesmeler) > 5000 then
    raise exception 'tek çağrıda en çok 5000 eşleşme' using errcode = '22023';
  end if;

  for e in select x.value as v, x.ordinality as i from jsonb_array_elements(p_eslesmeler) with ordinality x loop
    v_tablo := e.v ->> 'tablo';
    if v_tablo is null or v_tablo not in ('sehirler', 'yerler', 'gezi_duraklari') then
      raise exception '%. eşleşme: tablo sehirler, yerler ya da gezi_duraklari olmalı', e.i using errcode = '22023';
    end if;
    begin
      v_id := (e.v ->> 'id')::uuid;
      v_lat := (e.v ->> 'lat')::double precision;
      v_lng := (e.v ->> 'lng')::double precision;
    exception when others then
      raise exception '%. eşleşme: id, lat ve lng geçerli olmalı', e.i using errcode = '22023';
    end;
    v_osm := e.v ->> 'osm_id';
    if v_id is null or v_osm is null or v_osm !~ '^(node|way|relation)/[0-9]{1,19}$'
       or v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception '%. eşleşme: id, osm_id ("node/123") ve konum geçerli olmalı', e.i using errcode = '22023';
    end if;

    -- Satırın bugünkü hali (kilitli): yalnız google_30g satır taşınır.
    if v_tablo = 'sehirler' then
      select lat, lng, konum_kaynagi into v_eski from public.sehirler where id = v_id for update;
    elsif v_tablo = 'yerler' then
      select lat, lng, konum_kaynagi into v_eski from public.yerler where id = v_id for update;
    else
      select lat, lng, konum_kaynagi into v_eski from public.gezi_duraklari where id = v_id for update;
    end if;
    if not found or v_eski.konum_kaynagi <> 'google_30g' then
      v_atlanan := jsonb_set(v_atlanan, array[v_tablo], to_jsonb((v_atlanan ->> v_tablo)::int + 1));
      continue;
    end if;

    -- Eşleşme kuralı (KK3): en çok 150 m (kuş uçuşu, haversine).
    v_m := 2 * 6371000 * asin(sqrt(
      power(sin(radians(v_lat - v_eski.lat) / 2), 2)
      + cos(radians(v_eski.lat)) * cos(radians(v_lat)) * power(sin(radians(v_lng - v_eski.lng) / 2), 2)));
    if v_m > 150 then
      v_atlanan := jsonb_set(v_atlanan, array[v_tablo], to_jsonb((v_atlanan ->> v_tablo)::int + 1));
      continue;
    end if;

    if v_tablo = 'sehirler' then
      update public.sehirler set lat = v_lat, lng = v_lng, osm_id = v_osm, konum_kaynagi = 'osm' where id = v_id;
    elsif v_tablo = 'yerler' then
      update public.yerler set lat = v_lat, lng = v_lng, osm_id = v_osm, konum_kaynagi = 'osm' where id = v_id;
    else
      update public.gezi_duraklari set lat = v_lat, lng = v_lng, osm_id = v_osm, konum_kaynagi = 'osm' where id = v_id;
    end if;
    v_yazilan := jsonb_set(v_yazilan, array[v_tablo], to_jsonb((v_yazilan ->> v_tablo)::int + 1));
  end loop;

  return jsonb_build_object('yazilan', v_yazilan, 'atlanan', v_atlanan);
end $$;

revoke execute on function public.icerik_konum_osm_esle(jsonb) from public, anon, authenticated, service_role;
