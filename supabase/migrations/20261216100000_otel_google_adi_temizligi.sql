-- #584 KK3 (#250, Ece'nin kararı A): place_id'li otellerin Google'dan gelip saklanmış adları silinir. GERİ DÖNÜŞSÜZ.
-- VERİ SİLER: `scripts/veri-silen.mjs` bekçisi bu dosyayı durdurur; otomatik (push) gitmez. Sıra (#250):
--   1) Kuru çalıştırma (PR'daki salt-okunur sayım sorgusu), yalnız sayılar masaya. 2) Ürün sayıyı onaylar.
--   3) `main`'den elle (workflow_dispatch) `supabase-migrate`; ardından `web-yayin` ve `yonetim-yayin` elle.
-- Önce 20261216000000_otel_takma_ad.sql canlıda olmalı (yeni yazımlar zaten adsız; istemci eski label'ı okumaz).
-- Satır silinmez; yalnız ad alanı null olur. Kullanıcının takma adı (stays.takma_ad) ve place_id'siz noktanın adı kalır.
-- Bilinen kayıp (#250, kabul edildi): place_id'li bir otelin adını elle değiştirmiş kullanıcının metni de gider.
-- Tekrar çalıştırmak güvenli (yalnız hâlâ dolu olanlara dokunur). Google'a istek yok.

-- Temizlik kullanıcı eylemi değil: değişiklik akışına yazılmaz (yazılsa eski ad `changes.old`'a kopyalanırdı).
alter table public.stays disable trigger stays_log;
alter table public.trips disable trigger trips_log;

-- 1) stays.label (#56 sonrası asıl kayıt).
update public.stays set label = null
where place_id is not null and label is not null;

-- 2) trips.hotel_label (#56 öncesi alan; eski derlemeler okur, #268'den beri yazılmaz).
update public.trips set hotel_label = null
where hotel_place_id is not null and hotel_label is not null;

alter table public.stays enable trigger stays_log;
alter table public.trips enable trigger trips_log;

-- 3) Değişiklik akışındaki kopyalar (`log_change` satırın tamamını ya da değişen alanı jsonb olarak tutar; üyeler okur).
-- 3a) Otel ekleme / silme kayıtları: aynı jsonb'de place_id doluysa label null.
update public.changes c
set old = case when c.old ->> 'place_id' is not null and c.old ->> 'label' is not null
               then jsonb_set(c.old, '{label}', 'null'::jsonb) else c.old end,
    new = case when c.new ->> 'place_id' is not null and c.new ->> 'label' is not null
               then jsonb_set(c.new, '{label}', 'null'::jsonb) else c.new end
where c.entity = 'stays' and c.field is null
  and ((c.old ->> 'place_id' is not null and c.old ->> 'label' is not null)
    or (c.new ->> 'place_id' is not null and c.new ->> 'label' is not null));

-- 3b) Otelin label alanı değişikliği: otelin place_id'si (uygulama place_id'yi değiştirmez) satırdan ya da, otel
-- silinmişse, ekleme kaydından.
update public.changes c
set old = case when c.old is null then null else 'null'::jsonb end,
    new = case when c.new is null then null else 'null'::jsonb end
where c.entity = 'stays' and c.field = 'label'
  and (coalesce(c.old, 'null') <> 'null' or coalesce(c.new, 'null') <> 'null')
  and coalesce(
        (select s.place_id from public.stays s where s.id::text = c.entity_id),
        (select e.new ->> 'place_id' from public.changes e
         where e.entity = 'stays' and e.field is null and e.entity_id = c.entity_id and e.new is not null limit 1)
      ) is not null;

-- 3c) trips.hotel_label değişikliği: o anki place_id aynı güncellemenin hotel_place_id kaydından (aynı seyahat, aynı
-- zaman); öyle bir kayıt yoksa place_id değişmemiştir, seyahatin bugünkü hotel_place_id'si geçerlidir.
with k as (
  select c.id,
    case when p.id is not null then p.old #>> '{}' else t.hotel_place_id end as yer_eski,
    case when p.id is not null then p.new #>> '{}' else t.hotel_place_id end as yer_yeni
  from public.changes c
  left join lateral (
    select x.id, x.old, x.new from public.changes x
    where x.entity = 'trips' and x.field = 'hotel_place_id' and x.trip_id = c.trip_id and x.at = c.at
    limit 1
  ) p on true
  left join public.trips t on t.id = c.trip_id
  where c.entity = 'trips' and c.field = 'hotel_label'
)
update public.changes c
set old = case when k.yer_eski is not null and c.old is not null then 'null'::jsonb else c.old end,
    new = case when k.yer_yeni is not null and c.new is not null then 'null'::jsonb else c.new end
from k
where k.id = c.id
  and ((k.yer_eski is not null and coalesce(c.old, 'null') <> 'null')
    or (k.yer_yeni is not null and coalesce(c.new, 'null') <> 'null'));
