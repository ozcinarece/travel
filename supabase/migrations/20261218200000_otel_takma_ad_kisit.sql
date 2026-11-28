-- #630 KK1 (#627 takibi): `stays.takma_ad` kısıtı ham değere de bakar. Eski kısıt yalnız kırpılmış uzunluğu
-- ölçüyordu (`char_length(btrim(takma_ad)) between 1 and 80`), bu yüzden 80 karakter + baştaki/sondaki boşluklar
-- geçiyordu. Yeni kısıt: ham uzunluk ≤ 80 ve kırpılınca boş değil. İstemci zaten kırpıp yazar (`takmaAdDegeri`).
-- Veri silmez (yalnız kısıt değişir); Google'a yeni istek yok.
alter table public.stays
  drop constraint stays_takma_ad_check,
  add constraint stays_takma_ad_check
    check (takma_ad is null or (char_length(takma_ad) <= 80 and btrim(takma_ad) <> ''));
