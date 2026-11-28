-- #205 Parça 1 KK4: içerik tablolarında (`sehirler`, `yerler`, `gezi_duraklari`) ilk boşaltma ve gece işine bağlama (Ece kararı
-- B, #220). VERİ DEĞİŞTİRİR, geri alınamaz: 30 günü geçen `google_30g` satırların lat/lng'si null olur; satır silinmez.
-- Bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate` `main`'den elle
-- (workflow_dispatch) çalıştırılır. Önce kuru çalıştırma: `scripts/icerik-koordinat-kuru.sql` (yalnız sayı döner; tablo başına
-- sayılar PR'a yazılır). Tanımlar: 20261218000000. Yayın sırası: önce yeni `gezi-rota` canlıda olmalı (PR #640).
--
-- Sonraki geceler kendiliğinden: `gece_temizligi()` (#516) kaydını yazarken BEFORE INSERT tetikleyicisi içerik adımını çalıştırır
-- (`gece_temizligi_icerik`: `icerik_koordinat_bosalt(30)` + `konum_kaynagi_kontrol()`) ve sayıları aynı kayda koyar. Gece işi
-- yeniden tanımlanmaz (#330 da onu yeniden tanımlıyor; tetikleyici iki sürümle de çalışır).
-- Google'a istek yok.

create trigger gece_temizligi_icerik before insert on public.gece_temizligi_kayit
  for each row execute function public.gece_temizligi_icerik();

-- İlk boşaltma bir gece işi çalışması olarak yapılır: sayılar (tablo başına boşaltılan satır + `konum_kontrol`) sonraki gecelerle
-- aynı yerde, `gece_temizligi_kayit`'ta durur (okumak: supabase-sql ile `select calisti, icerik_sehir, icerik_yer, icerik_durak,
-- konum_kontrol from public.gece_temizligi_kayit order by calisti desc limit 1`; yalnız sayı). Gecenin öbür adımları (places,
-- #330 changes) da aynı kurallarla bir kez erken çalışır. Tetikleyici içerik adımının hatasını yutar (gece işi düşmesin); ilk
-- çalışmada yutulmaz: adım çalışmadıysa (`konum_kontrol` boş) migration geri alınır, iş kırmızı biter.
do $$
declare
  k public.gece_temizligi_kayit;
begin
  k := public.gece_temizligi();
  if k.konum_kontrol is null then
    raise exception 'ilk içerik koordinat boşaltması çalışmadı';
  end if;
end $$;
