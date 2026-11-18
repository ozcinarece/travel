-- #300 KK4: Eskişehir'in 2 hazır gezisi ve 19 yerinin amaç etiketleri (Ürün'ün listesi, #300 yorumu 18 Kasım).
-- Kaynak tek: aynı etiketler icerik/geziler/eskisehirde-uc-gun.json ve odunpazarindan-sazovaya-uc-gun.json plan
-- dosyalarında (`gezi.amaclar`, durak `amaclar`). Yerler Eskişehir'in `sehir_id`'si ve place_id ile eşlenir; place_id'siz
-- eski tohum satırları ekibin verdiği adla (plan dosyasındaki Google adı migration'a yazılmaz).
-- Yalnız etiketi boş satır yazılır (BO'da elle seçilmiş etiket ezilmez); migration yeniden çalışsa da aynı sonuç.
-- Eşleşmeyen satır sessizce geçmez: sayısı `raise notice` ile yazılır. Satır silinmez, başka alan değişmez.
do $$
declare
  v_sehir uuid;
  v_yer integer;
  v_gezi integer;
begin
  select id into v_sehir from public.sehirler where slug = 'eskisehir';
  if v_sehir is null then
    raise notice '#300 KK4: eskisehir şehri yok; 19 yer ve 2 gezi eşleşmedi';
    return;
  end if;

  with etiket (place_id, amaclar) as (values
    ('ChIJX_hu8xwWzBQR3KoZJXH-OeU', array['kultur_tarih']::text[]),  -- atlihan-el-sanatlari-carsisi
    ('ChIJ9woTLQ9dtRQRSKrj9RbHHOQ', array['kultur_tarih', 'cocuklu']::text[]),  -- balmumu-heykeller-muzesi
    ('ChIJ56oigVgWzBQR5mIavg6kLfE', array['kultur_tarih']::text[]),  -- cagdas-cam-sanatlari-muzesi
    ('ChIJt9fDzhwWzBQReNandcQyMHI', array['kultur_tarih']::text[]),  -- cumhuriyet-tarihi-muzesi
    ('ChIJneuhWgsWzBQRUO2D4vdtEFE', array['kultur_tarih', 'cocuklu']::text[]),  -- devrim-arabalari-muzesi
    ('ChIJ7f8EZsQ9zBQRJrW_stpzEUI', array['kultur_tarih']::text[]),  -- eskisehir-hamam-muzesi
    ('ChIJ86a5IBEWzBQRXQcAK-e59qI', array['kultur_tarih']::text[]),  -- eti-arkeoloji-muzesi
    ('ChIJvzL9BfMWzBQRPK-ykqSVI8k', array['doga', 'yavas']::text[]),  -- japon-bahcesi
    ('ChIJn-_fx_AWzBQR6cf5uLU_oXs', array['cocuklu']::text[]),  -- kalyon-muze-gemi
    ('ChIJGXNXzRwWzBQRyFc0PtwS71o', array['lezzet']::text[]),  -- koftes-balaban-kebap
    ('ChIJFfXmpx0WzBQR6FaqjLXJt9k', array['kultur_tarih']::text[]),  -- kursunlu-kulliyesi
    ('ChIJcazEmRwWzBQR-tbTsGR6ea0', array['kultur_tarih']::text[]),  -- kurtulus-muzesi
    ('ChIJy9rjXvoWzBQRLx-2n9J03AM', array['cocuklu']::text[]),  -- masal-satosu
    ('ChIJ5_GtZRsWzBQRGTOXuJedBOI', array['kultur_tarih', 'yavas']::text[]),  -- odunpazari-evleri
    ('ChIJ1x9xnBwWzBQRTxacdVqN824', array['kultur_tarih']::text[]),  -- odunpazari-modern-muze
    ('ChIJadqPRbsXzBQRLSXY2m85QMg', array['lezzet']::text[]),  -- oz-kirim-tatar-ciborek
    ('ChIJh2k79QcWzBQR-eTFh4ssW6A', array['yavas', 'gece']::text[]),  -- porsuk-adalar
    ('ChIJ3c-F7JMWzBQRDvSlXyik1dQ', array['cocuklu', 'doga']::text[]),  -- sazova-hayvanat-bahcesi
    ('ChIJy-jen94VzBQRJ5aVdaAqHpA', array['cocuklu']::text[])  -- vecihi-hurkus-havacilik-parki
  ),
  eslesen as (
    update public.yerler y set amaclar = e.amaclar
    from etiket e
    where y.sehir_id = v_sehir and y.amaclar = '{}'
      and y.place_id = e.place_id
    returning y.id
  )
  select count(*) into v_yer from eslesen;

  -- place_id'siz eski tohum satırları (20261012/20261013; adlar ekibin yazdığı adlar, Google verisi değil) adla eşlenir.
  with etiket (ad, amaclar) as (values
    ('Kurşunlu Külliyesi', array['kultur_tarih']::text[]),
    ('Odunpazarı Evleri', array['kultur_tarih', 'yavas']::text[]),
    ('Odunpazarı Modern Müze', array['kultur_tarih']::text[]),
    ('Çağdaş Cam Sanatları Müzesi', array['kultur_tarih']::text[]),
    ('Eti Arkeoloji Müzesi', array['kultur_tarih']::text[]),
    ('Porsuk Çayı Adalar', array['yavas', 'gece']::text[])
  ),
  eslesen as (
    update public.yerler y set amaclar = e.amaclar
    from etiket e
    where y.sehir_id = v_sehir and y.amaclar = '{}' and y.place_id is null and y.ad = e.ad
    returning y.id
  )
  select v_yer + count(*) into v_yer from eslesen;

  update public.geziler g set amaclar = array['kultur_tarih', 'cocuklu', 'yavas']::text[]
  where g.slug in ('eskisehirde-uc-gun', 'odunpazarindan-sazovaya-uc-gun') and g.sehir_id = v_sehir and g.amaclar = '{}';
  get diagnostics v_gezi = row_count;

  raise notice '#300 KK4: yer % / 19 yazıldı, gezi % / 2 yazıldı (etiketi dolu ya da eşleşmeyen: yer %, gezi %)',
    v_yer, v_gezi, greatest(19 - v_yer, 0), greatest(2 - v_gezi, 0);
  -- Aynı yerin hem tohum hem yükleme satırı varsa toplam 19'u geçebilir; sayı yine doğru (yazılan satır).
end $$;
