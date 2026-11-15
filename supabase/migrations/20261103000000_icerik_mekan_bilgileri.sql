-- #172 KK7–KK8: kendi içeriğimizdeki (rehber, gezi yazısı, yer rehberi) mekanların adı, kategorisi, konumu ve bizim
-- fotoğrafımız DB'den — ekranlar bunun için places-light çağırmaz. Yazının açtığı yer satırları taslaktır (yayin=false;
-- yerler_select göstermez), bu yüzden okuma bu fonksiyonla: yalnız yayınlı yerler ve yayınlı içerikte geçen kimlikler döner.
-- Ad editörün metni; kategori ve konum Google'ın saklanmasına izin verilen alanları (icerik_mekanlari_yaz notu, PRD §7).
create function public.icerik_mekan_bilgileri(p_place_ids text[])
returns table (place_id text, ad text, kategori text, lat double precision, lng double precision, kapak_url text, foto_yol text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (y.place_id)
    y.place_id, y.ad, y.kategori, y.lat, y.lng, y.kapak_url,
    (select f.yol from public.icerik_fotolari f
      where f.sahip_tur = 'yer' and f.sahip_id = y.id order by f.sira, f.created_at limit 1) as foto_yol
  from public.yerler y
  where y.place_id = any (p_place_ids[1:200])
    and (
      (y.yayin and exists (select 1 from public.sehirler s where s.id = y.sehir_id and s.yayin))
      or exists (
        select 1 from public.icerik_mekanlari m
        where m.place_id = y.place_id
          and case m.sahip_tur
            when 'rehber' then exists (
              select 1 from public.sehir_rehberi r join public.sehirler s on s.id = r.sehir_id where r.id = m.sahip_id and s.yayin)
            when 'gezi' then exists (
              select 1 from public.geziler g where g.id = m.sahip_id and g.yayin and (g.yayin_at is null or g.yayin_at <= now()))
            when 'yer' then exists (select 1 from public.yerler y2 where y2.id = m.sahip_id and y2.yayin)
            else false
          end
      )
    )
  order by y.place_id, y.yayin desc, y.created_at;
$$;
revoke execute on function public.icerik_mekan_bilgileri(text[]) from public;
grant execute on function public.icerik_mekan_bilgileri(text[]) to anon, authenticated;
