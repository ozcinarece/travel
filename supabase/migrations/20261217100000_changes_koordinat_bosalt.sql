-- #330 tek seferlik temizlik (Ece kararı A): değişiklik geçmişinde (`changes`) önceden yazılmış bütün koordinatlar boşalır,
-- yaşına bakılmaz. Satır silinmez; Sohbet'teki ve "Son değişiklikler"deki satır sayısı değişmez.
-- - `field in ('lat','lng','hotel_lat','hotel_lng')` satırı: old/new null.
-- - Ekleme/silme satırı: old/new jsonb'sinden `lat`, `lng`, `hotel_lat`, `hotel_lng` çıkar.
-- VERİ DEĞİŞTİRİR, geri alınamaz: bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate`
-- elle (workflow_dispatch) çalıştırılır. Önce kuru çalıştırma: `scripts/changes-koordinat-kuru.sql` (yalnız sayı döner).
-- Fonksiyon: 20261217000000 (`changes_koordinat_bosalt`, null = yaşa bakmadan). Dönen değer: boşaltılan satır sayısı.

select public.changes_koordinat_bosalt(null) as bosaltilan_satir;
