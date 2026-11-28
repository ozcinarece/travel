-- #205 Parça 1 KK4: içerik tablolarında (`sehirler`, `yerler`, `gezi_duraklari`) ilk boşaltma ve gece işine bağlama (Ece kararı
-- B, #220). VERİ DEĞİŞTİRİR, geri alınamaz: 30 günü geçen `google_30g` satırların lat/lng'si null olur; satır silinmez.
-- Bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate` `main`'den elle
-- (workflow_dispatch) çalıştırılır. Önce kuru çalıştırma: `scripts/icerik-koordinat-kuru.sql` (yalnız sayı döner; tablo başına
-- sayılar PR'a yazılır). Tanımlar: 20261218000000.
--
-- Sonraki geceler kendiliğinden: `gece_temizligi()` (#516) kaydını yazarken BEFORE INSERT tetikleyicisi içerik adımını çalıştırır
-- (`gece_temizligi_icerik`: `icerik_koordinat_bosalt(30)` + `konum_kaynagi_kontrol()`) ve sayıları aynı kayda koyar. Gece işi
-- yeniden tanımlanmaz (#330 da onu yeniden tanımlıyor; tetikleyici iki sürümle de çalışır).
-- Google'a istek yok.

select * from public.icerik_koordinat_bosalt(30);

create trigger gece_temizligi_icerik before insert on public.gece_temizligi_kayit
  for each row execute function public.gece_temizligi_icerik();
