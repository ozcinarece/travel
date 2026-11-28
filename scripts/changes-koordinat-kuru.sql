-- #330 kuru çalıştırma: tek seferlik `changes` koordinat boşaltmasından (20261217100000) önce. Hiçbir şey değiştirmez,
-- yalnız sayı döner (içerik, koordinat, place_id yok); masaya bu sayılar yazılır.
-- Çalıştırma: node scripts/supabase-sql.mjs "$(cat scripts/changes-koordinat-kuru.sql)"
-- Satırlar:
-- - tablo/tür başına boşaltılacak satır (`alan`: field koordinat, old/new null olur; `ekleme_silme`: jsonb'den anahtar çıkar);
-- - `toplam / tum_satirlar` ve `toplam / sohbet_satirlari` (Sohbet süzgeci: src/features/sohbet/sorgular.ts): temizlikten
--   sonra aynı kalmalı, çünkü satır silinmez.
with k(a) as (select array['lat', 'lng', 'hotel_lat', 'hotel_lng'])
select c.entity as tablo,
       case when c.field is null then 'ekleme_silme' else 'alan' end as tur,
       count(*) as satir
from public.changes c, k
where (c.field = any (k.a) and (c.old is not null or c.new is not null))
   or (c.field is null and (coalesce(c.old ?| k.a, false) or coalesce(c.new ?| k.a, false)))
group by 1, 2
union all
select 'toplam', 'tum_satirlar', count(*) from public.changes
union all
select 'toplam', 'sohbet_satirlari', count(*) from public.changes c
where c.entity <> 'harcama_paylari'
  and (c.entity <> 'members' or c.field is null or c.field <> 'display_name')
  and c.grup is null
order by 1, 2;
