-- #642 KK1 kuru sayım: `sehir_rehberi_taslak.bilinen` (rehber editörünün bildiği mekanlar). Hiçbir şey değiştirmez, yalnız sayı
-- döner (ad, place_id, koordinat yok); sayılar #217'ye yazılır. Temizlikten (20261219100000) önce çalıştırılır.
-- Çalıştırma: node scripts/supabase-sql.mjs "$(cat scripts/bilinen-kuru.sql)"
-- Sütunlar:
-- - `taslak`: bilinen'i dolu taslak (şehir) sayısı; `oge`: bütün öğeler;
-- - `koordinatli`: lat ve lng'si sayı olan öğe;
-- - `adli`: boş olmayan `ad` taşıyan öğe — editör bu adı yalnız Google seçiminden (`mekanSecildi`, Google adı) yazar, yani
--   hepsi Google'dan gelmiş ad;
-- - `adli_koordinatli`: ikisi birden;
-- - `damgali`: `google_fetched_at` taşıyan öğe (bugün 0 beklenir);
-- - `koordinatli_yerlerde_yok`: koordinatlı ve place_id'si `yerler`'de olmayan öğe (bir sonraki yayında taslak yer açacak olan).
select count(distinct t.sehir_id) as taslak,
       count(e.key) as oge,
       count(e.key) filter (where jsonb_typeof(e.value -> 'lat') = 'number' and jsonb_typeof(e.value -> 'lng') = 'number') as koordinatli,
       count(e.key) filter (where nullif(trim(e.value ->> 'ad'), '') is not null) as adli,
       count(e.key) filter (where nullif(trim(e.value ->> 'ad'), '') is not null
         and jsonb_typeof(e.value -> 'lat') = 'number' and jsonb_typeof(e.value -> 'lng') = 'number') as adli_koordinatli,
       count(e.key) filter (where e.value ? 'google_fetched_at') as damgali,
       count(e.key) filter (where jsonb_typeof(e.value -> 'lat') = 'number' and jsonb_typeof(e.value -> 'lng') = 'number'
         and not exists (select 1 from public.yerler y where y.place_id = e.key)) as koordinatli_yerlerde_yok
from public.sehir_rehberi_taslak t
cross join lateral jsonb_each(t.bilinen) e;
