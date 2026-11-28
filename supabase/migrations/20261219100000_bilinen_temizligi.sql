-- #642 KK4: var olan `sehir_rehberi_taslak.bilinen` kayıtlarının temizliği. VERİ DEĞİŞTİRİR, geri alınamaz: her öğeden Google'dan
-- gelen `ad` atılır; damgası olmayan koordinat boşalır (`lat`/`lng` null; öğe, kategori ve place_id kalır). Bundan sonra yayında bu
-- öğelerden açılan yer koordinatsız açılır (KK2). Taslağın `updated_at`'i değişmez (editörde "Taslak değişiklik var" oynamaz).
-- Bekçi (`scripts/veri-silen.mjs`) bu dosyayı durdurur; Ece onayından sonra `supabase-migrate` `main`'den elle (workflow_dispatch)
-- çalıştırılır. Önce kuru sayım: `scripts/bilinen-kuru.sql` (yalnız sayı döner; #217'ye yazılır). Tanımlar: 20261219000000.
-- Google'a istek yok.
update public.sehir_rehberi_taslak
  set bilinen = public.bilinen_temizle(bilinen, null)
  where bilinen <> public.bilinen_temizle(bilinen, null);
