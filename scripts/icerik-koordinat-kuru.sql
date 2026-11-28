-- #205 Parça 1 KK4 kuru çalıştırma: içerik tablolarındaki ilk koordinat boşaltmasından (20261218100000) önce. Hiçbir şey
-- değiştirmez, yalnız sayı döner (ad, place_id, koordinat yok); tablo başına sayılar PR'a yazılır.
-- Çalıştırma: node scripts/supabase-sql.mjs "$(cat scripts/icerik-koordinat-kuru.sql)"
-- Sütunlar (tablo başına):
-- - `bosalacak`: konum_kaynagi = google_30g, koordinatı dolu ve 30 günü geçmiş (gün `google_fetched_at`'tan, yoksa
--   `created_at`'tan; durakta gezinin `created_at`'i) — `icerik_koordinat_bosalt(30)` ile aynı koşul;
-- - `bosalacak_yayinda`: bunlardan yayındaki satır (durakta gezisi yayında) — uygulamada konumsuz görünecekler;
-- - `google_30g`, `toplam`: karşılaştırma için.
with k as (select now() - interval '30 days' as sinir)
select 'sehirler' as tablo,
       count(*) filter (where s.konum_kaynagi = 'google_30g' and s.lat is not null and coalesce(s.google_fetched_at, s.created_at) < k.sinir) as bosalacak,
       count(*) filter (where s.konum_kaynagi = 'google_30g' and s.lat is not null and coalesce(s.google_fetched_at, s.created_at) < k.sinir and s.yayin) as bosalacak_yayinda,
       count(*) filter (where s.konum_kaynagi = 'google_30g') as google_30g,
       count(*) as toplam
from public.sehirler s, k
group by k.sinir
union all
select 'yerler',
       count(*) filter (where y.konum_kaynagi = 'google_30g' and y.lat is not null and coalesce(y.google_fetched_at, y.created_at) < k.sinir),
       count(*) filter (where y.konum_kaynagi = 'google_30g' and y.lat is not null and coalesce(y.google_fetched_at, y.created_at) < k.sinir and y.yayin),
       count(*) filter (where y.konum_kaynagi = 'google_30g'),
       count(*)
from public.yerler y, k
group by k.sinir
union all
select 'gezi_duraklari',
       count(*) filter (where d.konum_kaynagi = 'google_30g' and d.lat is not null and coalesce(d.google_fetched_at, g.created_at) < k.sinir),
       count(*) filter (where d.konum_kaynagi = 'google_30g' and d.lat is not null and coalesce(d.google_fetched_at, g.created_at) < k.sinir and g.yayin),
       count(*) filter (where d.konum_kaynagi = 'google_30g'),
       count(*)
from public.gezi_duraklari d
join public.gezi_gunleri gg on gg.id = d.gezi_gun_id
join public.geziler g on g.id = gg.gezi_id, k
group by k.sinir
order by 1;
