-- #132 (#129 incelemesi): yayınlayanın e-postası herkese açık okunmasın; ana sayfada mekan mozaiği yok.

-- KK1: `yayinlayan` sütunu anon'a ve admin olmayana kapalı (sütun izni). Uygulama ve panel yalnız id, bolumler,
-- yayinlandi_at okur; `ana_sayfa_gorunen` (security_invoker) da yalnız bunları kullanır. Panel "Yayınlandı · saat"
-- gösterir, kimi göstermez; RPC gerekmez. `ana_sayfa_yayinla()` dönüşü (`returning yayinlandi_at`) izinli sütunda.
revoke select on public.ana_sayfa_yayini from anon, authenticated;
grant select (id, bolumler, yayinlandi_at) on public.ana_sayfa_yayini to anon, authenticated;

-- KK2: ürün kararı — ana sayfada mekan mozaiği yok (seyahat seçilmemişken "+"nın hedefi belirsiz). Seed bölümü kapanır,
-- tür panelde kalır; yayın anlık görüntüsü yeniden alınır (uygulama yalnız son yayını görür).
update public.ana_sayfa_bolumleri set acik = false
  where tur = 'mozaik' and baslik = 'Gezilecek yerler' and kaynak = 'otomatik';

insert into public.ana_sayfa_yayini (bolumler, yayinlayan)
  select coalesce(jsonb_agg(to_jsonb(b) - 'updated_at' order by b.sira), '[]'::jsonb), 'migration' from public.ana_sayfa_bolumleri b;
