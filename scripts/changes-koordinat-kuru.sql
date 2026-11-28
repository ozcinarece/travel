-- #330 kuru çalıştırma: `changes` koordinat boşaltmasının ilk çalışmasından (20261217100000) önce. Hiçbir şey değiştirmez,
-- yalnız sayı döner (içerik, koordinat, place_id yok); masaya bu sayılar yazılır. Kural `changes_koordinat_bosalt(30)` ile
-- aynı (20261217000000), fonksiyon canlıda henüz olmadığı için burada açık yazılı.
-- Çalıştırma: node scripts/supabase-sql.mjs "$(cat scripts/changes-koordinat-kuru.sql)"
-- Satırlar:
-- - tablo/tür başına boşaltılacak satır (`alan`: field koordinat, old/new null olur; `ekleme_silme`: süresi geçen ya da
--   damgasız Google koordinatı jsonb'den çıkar; pin ve 30 günden taze damgalı koordinat kalır);
-- - `toplam / tum_satirlar` ve `toplam / sohbet_satirlari` (Sohbet süzgeci: src/features/sohbet/sorgular.ts): temizlikten
--   sonra aynı kalmalı, çünkü satır silinmez.
with s(sinir) as (select now() - interval '30 days'),
gecmis(id, entity, field) as (
  select c.id, c.entity, c.field
  from public.changes c, s,
       lateral (values (c.old), (c.new)) j(v)
  where (c.field in ('lat', 'lng', 'hotel_lat', 'hotel_lng') and (c.old is not null or c.new is not null))
     or (c.field is null and j.v is not null and (
          ((j.v ? 'lat' or j.v ? 'lng') and (c.entity <> 'stays' or j.v ->> 'place_id' is not null)
            and coalesce((j.v ->> 'google_fetched_at')::timestamptz < s.sinir, true))
          or ((j.v ? 'hotel_lat' or j.v ? 'hotel_lng') and j.v ->> 'hotel_place_id' is not null
            and coalesce((j.v ->> 'hotel_fetched_at')::timestamptz < s.sinir, true))))
)
select g.entity as tablo,
       case when g.field is null then 'ekleme_silme' else 'alan' end as tur,
       count(distinct g.id) as satir
from gecmis g
group by 1, 2
union all
select 'toplam', 'tum_satirlar', count(*) from public.changes
union all
select 'toplam', 'sohbet_satirlari', count(*) from public.changes c
where c.entity <> 'harcama_paylari'
  and (c.entity <> 'members' or c.field is null or c.field <> 'display_name')
  and c.grup is null
order by 1, 2;
