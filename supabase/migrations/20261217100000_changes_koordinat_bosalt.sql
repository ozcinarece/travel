-- #330 ilk temizlik ve gece işi (Ece kararı A; Ürün kararı (a), PR #636). Satır silinmez; Sohbet'teki ve
-- "Son değişiklikler"deki satır sayısı değişmez. Kural `changes_koordinat_bosalt(30)` (20261217000000):
-- - `field in ('lat','lng','hotel_lat','hotel_lng')` satırı (eski tetikleyiciden): damgası yok → old/new null.
-- - Ekleme/silme satırı: damgası 30 günü geçmiş ya da damgasız Google koordinatı old/new jsonb'sinden çıkar; daha tazesi
--   damgasıyla kalır ("Geri al" koordinatıyla getirir). `place_id`'siz konaklamanın ve `hotel_place_id`'siz otelin pini kalır.
-- VERİ DEĞİŞTİRİR, geri alınamaz: bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate`
-- elle (workflow_dispatch) çalıştırılır. Önce kuru çalıştırma: `scripts/changes-koordinat-kuru.sql` (yalnız sayı döner).
-- Gece işi (#516 KK6) de burada bağlanır: `gece_temizligi()` ikinci adım olarak `changes_koordinat_bosalt(30)`'u çağırır.
-- Veri değiştiren her şey bu dosyada; ilk dosya yalnız tanım.

select public.changes_koordinat_bosalt(30) as bosaltilan_satir;

-- Gece işi kaydına `changes` sayısı (yalnız sayı). Boş: o gece `changes` adımı hata verdi (1. adım yine de kalır).
alter table public.gece_temizligi_kayit add column degisiklik integer check (degisiklik >= 0);

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
  -- 2. #330: değişiklik geçmişindeki 30 günü geçen koordinat boşalır (satır kalır). Bu adım düşerse yalnız o geri alınır,
  --    1. adım kalır; kayıtta `degisiklik` boş olur (hata kodu uyarıda; içerik yazılmaz).
  begin
    d := public.changes_koordinat_bosalt(30);
  exception when others then
    d := null;
    raise warning 'gece_temizligi: changes adımı düştü (%)', sqlstate;
  end;
  -- (Sonraki adımlar buraya.)
  insert into public.gece_temizligi_kayit (yer, seyahat, otel, konaklama, degisiklik)
  values (b.yer, b.seyahat, b.otel, b.konaklama, d)
  returning * into k;
  return k;
end;
$$;
revoke execute on function public.gece_temizligi() from public, anon, authenticated;
grant execute on function public.gece_temizligi() to service_role;
