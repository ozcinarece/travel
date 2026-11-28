-- #330 tek seferlik temizlik (Ece kararı A): değişiklik geçmişinde (`changes`) önceden yazılmış bütün koordinatlar boşalır,
-- yaşına bakılmaz. Satır silinmez; Sohbet'teki ve "Son değişiklikler"deki satır sayısı değişmez.
-- - `field in ('lat','lng','hotel_lat','hotel_lng')` satırı: old/new null.
-- - Ekleme/silme satırı: old/new jsonb'sinden `lat`, `lng`, `hotel_lat`, `hotel_lng` çıkar.
-- VERİ DEĞİŞTİRİR, geri alınamaz: bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate`
-- elle (workflow_dispatch) çalıştırılır. Önce kuru çalıştırma: `scripts/changes-koordinat-kuru.sql` (yalnız sayı döner).
-- Fonksiyon: 20261217000000 (`changes_koordinat_bosalt`, null = yaşa bakmadan). Dönen değer: boşaltılan satır sayısı.
-- Gece işi (#516 KK6) de burada bağlanır: `gece_temizligi()` ikinci adım olarak `changes_koordinat_bosalt(30)`'u çağırır
-- (30 gün: jsonb'deki damgadan, yoksa `at`'tan). Veri değiştiren her şey bu dosyada; ilk dosya yalnız tanım.

select public.changes_koordinat_bosalt(null) as bosaltilan_satir;

-- Gece işi kaydına `changes` sayısı (yalnız sayı).
alter table public.gece_temizligi_kayit add column degisiklik integer not null default 0 check (degisiklik >= 0);

-- 20261210000000 sürümü + 2. adım.
create or replace function public.gece_temizligi()
returns public.gece_temizligi_kayit
language plpgsql security definer set search_path = ''
as $$
declare
  b record;
  d integer;
  k public.gece_temizligi_kayit;
begin
  -- 1. Google koordinatı: 30 günü geçen her koordinat boşalır.
  select * into b from public.places_koordinat_bosalt(null, 30);
  -- 2. #330: değişiklik geçmişindeki 30 günü geçen koordinat boşalır (satır kalır).
  d := public.changes_koordinat_bosalt(30);
  -- (Sonraki adımlar buraya.)
  insert into public.gece_temizligi_kayit (yer, seyahat, otel, konaklama, degisiklik)
  values (b.yer, b.seyahat, b.otel, b.konaklama, d)
  returning * into k;
  return k;
end;
$$;
revoke execute on function public.gece_temizligi() from public, anon, authenticated;
grant execute on function public.gece_temizligi() to service_role;
