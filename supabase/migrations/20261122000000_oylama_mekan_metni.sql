-- #248 KK2: Google'dan gelen işletme adı oylama_secenekleri.metin'e yazılmaz (PRD §7, T1). Seçenek bir mekansa ve kullanıcı
-- metin yazmadıysa metin boş kaydedilir; ad ekranda place_id'den canlı gösterilir. Mekansız seçenekte metin yine zorunlu.
-- Veri değiştirmez; yalnız kısıt gevşer.
alter table public.oylama_secenekleri drop constraint if exists oylama_secenekleri_metin_check;
alter table public.oylama_secenekleri
  add constraint oylama_secenekleri_metin_check
  check (char_length(trim(metin)) between 1 and 80 or (place_id is not null and metin = ''));
