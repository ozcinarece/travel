# V1 PRD — Gezi Planlayıcı

Sürüm: 0.1 · Tarih: 29 Eylül 2026 · Sahip: Ece · Geliştirici: (atanacak)
Kapsam: `00-kapsam.md` §5 v1 · Tasarım: https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT

Bu belge geliştiriciye teslim belgesidir. Her ekranın **kabul kriterleri** (KK) test edilebilir cümlelerdir; teslimat bu kriterlere göre kontrol edilir. "Olmalı" = zorunlu, "olabilir" = geliştirici takdiri.

---

## 1. Ürün özeti

Kullanıcı bir şehir ve tarih seçer, otelini işaretler, haritada mekan seçer, mekanları günlere dağıtır. Sistem her gün için saat saat program üretir (otelden başlar, yürüme süreleri dahil, otele döner). Arkadaşlar linkle katılır, aynı planı düzenler. Gezi sırasında "Vardık" ile ilerleme işaretlenir, gecikmede program tek dokunuşla kaydırılır.

## 2. Roller

- **Sahip:** seyahati oluşturan. Seyahati silebilir, üyeyi çıkarabilir.
- **Üye:** linkle katılan. Mekan ekler/çıkarır, gün ve sıra değiştirir, süre ayarlar. Uygulamalı veya tarayıcılı olabilir.
- **Misafir (tarayıcı):** hesap açmadan ad girerek katılan üye. Yaptıkları adıyla kaydedilir; sonradan hesap açarsa birleştirilir.

## 3. Ekranlar ve kabul kriterleri

### 3.0 Giriş

**0.1 Karşılama + hesap**
- KK1 Apple, Google ve telefon (SMS OTP) ile giriş çalışır.
- KK2 Davet linkiyle gelen kullanıcı giriş yapmadan da 3.10'a ulaşır.

**0.2 Profilini kur**
- KK1 Ad zorunlu, kullanıcı adı zorunlu ve benzersiz; müsaitlik yazarken kontrol edilir (debounce 300 ms).
- KK2 Harita gizliliği seçimi kaydedilir (`arkadaşlarım` varsayılan). v1'de yalnızca saklanır, kullanılmaz.
- KK3 Fotoğraf isteğe bağlı.

**0.3 İlk seyahat yönlendirmesi**
- KK1 İki kapı: "Yeni seyahat planla" → 3.2, "Davet linkim var" → link yapıştırma alanı → 3.10. ("Haritayı doldur" kapısı v1'de gösterilmez.)
- KK2 "Sonraki seyahatin ne zaman?" cevabı kaydedilir; `bu ay` seçilirse 3.1'de "Yeni seyahat" kartı boş durumda daha büyük gösterilir.
- KK3 Atlanabilir.

**0.5 Boş durum**
- KK1 Seyahati olmayan kullanıcı 3.1 yerine bu ekranı görür.
- KK2 "İlk seyahatini planla" → 3.2; "Davet linkin mi var?" → link alanı.

### 3.1 Seyahatler

- KK1 Aktif seyahat (bugün ∈ [gidiş, dönüş]) varsa üstte kart: şehir, gün ilerleme noktaları (toplam gün / geçen gün), "Sıradaki" durak adı ve saati, play tuşu → 3.7.
- KK2 Aktif yoksa "Yaklaşan" listesi en üstte; gelecek seyahatler tarihe göre artan.
- KK3 "Geçmiş" yatay kartlar: şehir, ay-yıl, mekan sayısı.
- KK4 Gezi sırasında mini-çubuk (bkz. §5.4) bu ekranda görünür.

### 3.2 Nereye?

- KK1 Şehir araması Google Places Autocomplete (types: `(cities)`, oturum token'ı ile). İlk 3 sonuç gösterilir.
- KK2 Gidiş ve dönüş tarihleri isteğe bağlı; girilmezse seyahat "tarihsiz", gün sayısı 1 ile başlar ve 3.5'te artırılabilir.
- KK3 Devam → 3.3.

### 3.3 Otel

- KK1 Otel araması Places Autocomplete (types: `lodging`). Google Maps / Booking linki yapıştırılırsa URL'den `place_id` ya da koordinat çözülür; çözülemezse hata mesajı ve manuel arama.
- KK2 Harita üstünde otel pini sürüklenerek taşınabilir.
- KK3 Otel etrafında 20 dk yürüme yarıçapı (yaklaşık 1,5 km) kesikli daire ile gösterilir.
- KK4 "Atla" → otel `null`; §5.2'deki bölge önerisi v1'de yalnızca metin olarak ("Seçtiğin mekanların ağırlık merkezi: Centro Storico") gösterilir, harita katmanı v2.
- KK5 Otel sonradan 3.7 üst menüsünden değiştirilebilir; değişince tüm günler yeniden hesaplanır.

### 3.4 Keşfet

- KK1 Harita tam ekran; üstte arama, çipler; altta yatay öneri kartları; en altta "Listede N mekan · Günlere dağıt" çubuğu.
- KK2 Arama: Places Autocomplete, şehir merkezine `locationBias` (yarıçap 15 km). Sonuç seçilince harita o noktaya kayar ve kart açılır.
- KK3 Link yapıştırma: Google Maps paylaşım linki (`maps.app.goo.gl`, `google.com/maps/place/...`) çözülür → `place_id`. Instagram linki v1'de desteklenmez; "Bu link türü henüz desteklenmiyor" mesajı.
- KK4 Öneri çipleri v1: **Popüler** (Places Nearby Search, `rankPreference: POPULARITY`, kategori: `tourist_attraction`), **Yemek** (`restaurant`), **Sanat** (`museum`, `art_gallery`), **Manzara** (`park`, `viewpoint`). "Arkadaşların gitti" çipi v2.
- KK5 Öneri pini üzerindeki "+" ya da karttaki "+" mekanı listeye ekler; listeye eklenen pin numaralanmaz, "?" (güne atanmamış) olarak görünür.
- KK6 Her kartta: ad, kategori, varsayılan kalınacak süre (§6), Google puanı, yorum sayısı, açık/kapalı, "Google" atfı. Fotoğraf isteğe bağlı (Places Photo, 400 px).
- KK7 Listeye eklenen mekan ekleyen kullanıcının `user_id`'siyle kaydedilir; kartta ekleyenin baş harfi görünür.
- KK8 Bir üye mekan eklediğinde diğer üyelerin ekranı 2 sn içinde güncellenir (Realtime).

### 3.5 Günlere dağıt

- KK1 Harita tam ekran; üstte gün çipleri (1..N, her biri durak sayısıyla), "N boşta" sayacı; altta tempo paneli.
- KK2 Etkileşim: bir gün çipi seçilir (varsayılan 1. gün), ardından pine dokununca pin o güne atanır ve gün rengine boyanır. Aynı pine tekrar dokununca atama kalkar ("?").
- KK3 Gün renkleri sabit: 1 siyah `#0f0f0f`, 2 turuncu `#ff5a1f`, 3 mavi `#4c6ef5`, 4+ için palet devam eder (`#1f8a4c`, `#8a5cf6`, `#0ea5a5`).
- KK4 Otel pini ve 20 dk dairesi haritada sabittir.
- KK5 Tempo paneli her gün için: gün adı, etiket (Rahat / Normal / Yoğun, §5.3), ilerleme çubuğu, "N durak · X sa gezi + Y dk yürüyüş", "başlangıç → bitiş" saati, bir satır öneri metni (§5.3).
- KK6 Boşta pin varsa panelde en yakın günün adıyla "Boştaki *X* 1. güne yakın" önerisi gösterilir; öneri bağlayıcı değildir.
- KK7 Gün ekle / gün sil çipler satırının sonunda; gün silinirse durakları boşa düşer.
- KK8 "Programa geç" → 3.7. Boşta mekan varsa uyarı: "2 mekan hiçbir günde değil, devam edilsin mi?"

### 3.7 Program

- KK1 Üstte gün seçici (1..N). Her gün için: başlangıç saati (varsayılan 09:00, düzenlenebilir), duraklar sırayla, aralarda yürüme süresi ve mesafe, gün bitişi.
- KK2 Varsayılan sıra §5.1'e göre hesaplanır. Kullanıcı durakları uzun basıp sürükleyerek yeniden sıralar; sıra değişince saatler anında yeniden hesaplanır.
- KK3 Her durakta süre −/+ (15 dk adım, min 15 dk, maks 8 sa).
- KK4 Durak kartına uzun basınca menü: *Başka güne al (gün listesi)* · *Atla* · *Plandan çıkar*.
- KK5 Açılış saati çakışması: durağın hesaplanan varış saati o günün açılış saatleri dışındaysa kart turuncu bantla işaretlenir: "Bugün kapalı" veya "Bu saatte kapalı, 14:00'te açılır". Bant üzerinde "Başka güne al" kısayolu.
- KK6 Gezi sırasında (bugün = seçili gün): geçilen duraklar üstü çizili, sıradaki durak siyah kart, kartta "Yol tarifi" (Google Maps'i yürüyüş moduyla açar) ve "Vardık".
- KK7 "Vardık": durağa `arrived_at = now` yazar. Sonraki durakların varış saatleri `now + kalınacak süre + yürüyüş` ile yeniden hesaplanır. Plan bitişi değiştiyse mini-çubuk (§5.4) görünür.
- KK8 Bir durak planlanan bitiş saatini 10 dk geçtiyse (arrived_at + süre < now) mini-çubuk "X'te N dk uzun kaldınız" gösterir; seçenekler: **Kaydır** (sonrakiler kayar), **Atla** (sıradaki durak çıkar, gerisi kayar), **Planı koru** (dokunma).
- KK9 Sağ üstte üye avatarları; dokununca basit liste: üyeler, davet linki kopyala, son 10 değişiklik (kim, ne, ne zaman).
- KK10 Hesaplama süresi 20 duraklı günde 500 ms altında; yürüyüş süreleri önbellekten gelmiyorsa iskelet gösterilir, hesaplanınca dolar.

### 3.8 Mekan detayı

- KK1 Üstte Google fotoğrafı (varsa), ad, kategori, gün ve saat.
- KK2 Google puanı, yorum sayısı, açık/kapalı ve kapanış saati, "Google'da aç" linki. Yorumlar: en fazla 5, Places Details'ten canlı; yorumcu adı ve zaman; **saklanmaz**.
- KK3 "Kim ekledi" ve ekleyenin notu (varsa). Not ekleme/düzenleme yalnızca ekleyen ve sahip.
- KK4 Süre −/+; değişiklik programı anında etkiler.
- KK5 Alt aksiyonlar: "Yol tarifi al", "···" menüsü: Başka güne al / Atla / Plandan çıkar.
- KK6 Places Details çağrısı yalnızca bu ekran açılınca yapılır; `fields` maskesi: `id,displayName,rating,userRatingCount,currentOpeningHours,regularOpeningHours,photos,reviews,googleMapsUri,primaryType`.

### 3.10 Davetle katılım (tarayıcı)

- KK1 Link biçimi `https://{domain}/r/{token}`; token 8 karakter, seyahate özel, sahip iptal edebilir.
- KK2 Sayfa: seyahat özeti (şehir, tarih, üye sayısı, mekan sayısı), ad alanı, "Plana katıl". Uygulama indirme zorunluluğu yok.
- KK3 Katılınca misafir üye oluşur (`guest=true`), tarayıcı `localStorage`'a misafir kimliği yazılır; aynı tarayıcıdan tekrar açınca ad sorulmaz.
- KK4 Tarayıcıda Program (3.7) ve Keşfet (3.4) tam işlevli; Günlere dağıt (3.5) v1'de tarayıcıda salt okunur.
- KK5 Uygulama yüklüyse link doğrudan uygulamayı açar (universal link / app link).

## 4. Seyahat içi navigasyon

- Seyahat açıkken alt menü: **Keşfet · Günler · Program · Grup** (v1'de Grup = 3.7 KK9'daki panel; sekme ona açılır).
- Sol üst "‹ Roma" → 3.1.
- Uygulama seviyesi alt menü v1: **Seyahatler · Yeni · Profil**. Haritam sekmesi v1'de gizli; Profil v1'de yalnızca ad, kullanıcı adı, çıkış, hesap silme.

## 5. Hesaplama kuralları

### 5.1 Varsayılan sıra ve yürüyüş süreleri
- Bir günün varsayılan sırası: otelden başlayarak **en yakın komşu** sezgisel yöntemi (nearest neighbour), sonra 2-opt iyileştirme (≤ 20 durak). Otel yoksa başlangıç günün ilk eklenen durağıdır.
- Yürüyüş süreleri Routes API `computeRouteMatrix`, `travelMode: WALK`. Bir seyahat için tüm durak çiftleri (+ otel) tek matris çağrısında alınır ve seyahat süresince önbelleklenir; yeni durak eklenince yalnızca yeni satır/sütun istenir.
- İki durak arası yürüyüş 40 dk'yı aşarsa program satırında "40+ dk · toplu taşıma önerilir" yazar; toplu taşıma hesabı v2.

### 5.2 Otel bölge önerisi (otel yoksa)
- Seçili mekanların yürüme-süresi ağırlıklı merkezi; en yakın mahalle/semt adı Geocoding (reverse) ile. v1'de yalnızca metin.

### 5.3 Tempo
- `doluluk = (Σ kalınacak süre + Σ yürüyüş) / (gün bitişi − gün başlangıcı)`; gün bitişi varsayılan 19:00 (düzenlenebilir), son gün için dönüş saati.
- `< 0,60` Rahat · `0,60–0,85` Normal · `> 0,85` Yoğun.
- Öneri metni: Rahat → "N durak daha sığar" (N = kalan süre / 75 dk, aşağı yuvarla); Yoğun → süresi en uzun durağın adıyla "X tek başına H sa; bir durağı başka güne al"; Normal → boş.

### 5.4 Mini-çubuk
- Koşul: aktif seyahat ve (a) sıradaki durağa yürüyüş başlamış ya da (b) bir durakta 10+ dk uzun kalınmış.
- İçerik: (a) "X'e N dk" + gecikme varsa "· N dk geç"; (b) "X'te N dk uzun kaldınız · gün bitişi HH:MM → HH:MM". Aksiyonlar: Kaydır / Atla / Planı koru.
- Görünürlük: 3.1 ve 3.7'de, alt menünün hemen üstünde.

### 5.5 Eşzamanlı düzenleme
- Tüm yazma işlemleri satır bazlı; **son yazan kazanır**. Her yazma `changes` tablosuna kayıt düşer (kim, ne, eski → yeni, zaman).
- Realtime aboneliği: seyahat açıkken `places`, `stops`, `members` tablolarına.

## 6. Kalınacak süre varsayılanları

Google birincil kategori → dakika: `museum` 90 · `art_gallery` 60 · `tourist_attraction` 60 · `historical_landmark` 45 · `church`/`place_of_worship` 30 · `park` 45 · `viewpoint`/`scenic_point` 20 · `restaurant` 75 · `cafe` 45 · `bar` 90 · `bakery` 20 · `shopping_mall` 90 · `market` 45 · `zoo`/`aquarium` 120 · `amusement_park` 240 · diğer 45.

## 7. Google Places kısıtları (uyulması zorunlu)

- Yorumlar en fazla 5, canlı gösterilir, veritabanına yazılmaz.
- `place_id` dışında Google verisi (ad, puan, saat) en fazla 30 gün önbelleklenebilir; sonra tazelenir.
- Google atfı ("Google" logosu/ibaresi) Google verisi içeren her kartta görünür.
- Autocomplete oturum token'ı kullanılır; detay çağrısı yalnızca 3.8 açılınca.
- Tahmini maliyet (100 kullanıcı, kişi başı 2 seyahat, 15 mekan): Autocomplete ~600 oturum, Details ~3.000, Nearby ~800, Route Matrix ~200 çağrı → aylık ≈ 40 $ (ücretsiz kota dahil değil).

## 8. Veri modeli (Postgres)

```
users        id, name, username(unique), photo_url, map_visibility(enum: friends|everyone|me), next_trip_window(enum), created_at
trips        id, owner_id, city_place_id, city_name, country, lat, lng, start_date, end_date, day_start(time, 09:00), day_end(time, 19:00), hotel_place_id, hotel_lat, hotel_lng, hotel_name, invite_token, created_at
members      trip_id, user_id, guest(bool), display_name, joined_at, role(enum: owner|member)
places       id, trip_id, place_id(google), name, primary_type, lat, lng, default_minutes, added_by, note, created_at
days         id, trip_id, index, date, start_time, end_time
stops        id, day_id, place_id(fk places), order, minutes, arrived_at, skipped(bool)
walk_cache   trip_id, from_key, to_key, seconds, meters, fetched_at   (key = place_id | 'hotel')
changes      id, trip_id, user_id, entity, entity_id, field, old, new, at
```

Kural: `places` bir seyahatin havuzu, `stops` günlere atanmış hali. Güne atanmamış mekan = `places` var, `stops` yok.

## 9. Bildirimler (v1 minimum)

- Üye katıldı, mekan eklendi (günde en fazla 1 özet), seyahat günü sabahı 08:00 "Bugünün programı hazır" (yalnızca uygulama).

## 10. Analitik olayları

`signup`, `trip_created`, `hotel_set`, `hotel_skipped`, `place_added{source: search|link|suggest}`, `stop_assigned`, `program_viewed`, `arrived`, `shift_applied{kaydir|atla|koru}`, `invite_sent`, `invite_joined{guest}`.

## 11. Erişilebilirlik ve platform

- iOS 16+, Android 10+. Dinamik yazı boyutu desteklenir; dokunma hedefleri ≥ 44 pt.
- Tarayıcı istemci: son 2 sürüm Safari / Chrome, mobil öncelikli.
- Dil v1: Türkçe. Metinler `tr.json` dosyasında, ileride İngilizce eklenecek.

## 12. Teslimat ve kabul

1. Geliştirici teknik tasarım notu yazar (1 sayfa: stack, klasör yapısı, API çağrı planı) → ürün onayı.
2. Sprint 1: 0.1, 0.2, 0.5, 3.1, 3.2, 3.3 · Sprint 2: 3.4, 3.8 · Sprint 3: 3.5, 3.7 · Sprint 4: 3.10, §5.4, §9.
3. Her ekran bu belgedeki KK listesiyle kabul edilir; eksik KK varsa ekran "tamamlanmadı" sayılır.
4. Tasarım kanvasındaki ekranlar referanstır; piksel farkları ürün onayıyla kabul edilir, akış farkları edilmez.

## 13. Açık sorular

1. Telefon ile giriş v1'de şart mı? (Rehber eşleşmesi v2 olduğu için Apple + Google yeterli olabilir.)
2. Misafirin sonradan hesap açınca birleştirme: aynı cihaz + aynı ad yeterli mi?
3. Gün bitişi varsayılanı 19:00 mu, 21:00 mi? Yemek durakları akşama sarkıyor.
