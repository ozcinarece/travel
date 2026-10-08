# V1 PRD — Gezi Planlayıcı

Sürüm: 0.3 · Tarih: 8 Ekim 2026 · Sahip: Ece · Geliştirici: Claude Code
Kapsam: `00-kapsam.md` §5 · Tasarım: https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT · Plan: `04-proje-plani.md`

Değişiklik v0.3 — 29 Eylül–8 Ekim cihaz testleri ve mockup turlarının kararları işlendi (issue #17–#56, PR #18–#58). Başlıca değişiklikler: Günler ve Program tek ekran oldu (3.5); seyahat içi alt menü kalktı; "Vardık" yerine Tamamlandı + otomatik tamamlanma; tamamlanan durak puanlama v1'e girdi; otel gün bazında (başlangıç/bitiş, taşınma günü); yeni pin dili, harita stili ve gün paleti; tempo etiketleri arayüzden kaldırıldı. Ayrıntılı geçmiş §14'te.

Bu belge geliştiriciye teslim belgesidir. Her ekranın **kabul kriterleri** (KK) test edilebilir cümlelerdir; teslimat bu kriterlere göre kontrol edilir. "Olmalı" = zorunlu, "olabilir" = geliştirici takdiri. Kanvas ile belge çelişirse **belge** geçerlidir.

---

## 1. Ürün özeti

Kullanıcı bir şehir ve tarih seçer, isterse otelini işaretler, haritada mekan seçer ve mekanları haritada günlere dağıtır. Sistem her gün için saat saat program üretir: günün başlangıç noktasından (otel) başlar, gerçek yürüme süreleriyle ilerler, bitiş noktasına (otel) döner. Arkadaşlar linkle katılır, aynı planı düzenler. Gezi günü konum, tamamlanan duraklar ve gecikmeler programı canlı tutar; biten durak tek dokunuşla puanlanır.

## 2. Roller

- **Sahip:** seyahati oluşturan. Seyahati silebilir, üyeyi çıkarabilir. Hesabını silerse sahiplik en eski hesaplı üyeye devredilir; hesaplı üye yoksa seyahat silinir. Hesap silme ekranı hangi seyahatin kime devredileceğini ya da silineceğini **silmeden önce** gösterir.
- **Üye:** linkle katılan. Mekan ekler/çıkarır, gün ve sıra değiştirir, süre ve otel ayarlar, durak tamamlar, puan verir.
- **Misafir (tarayıcı):** hesap açmadan ad girerek katılan üye (Supabase anonim oturum). Sonradan hesap açarsa aynı cihazda `linkIdentity` ile birleşir; farklı cihaz v2.

## 3. Ekranlar ve kabul kriterleri

### 3.0 Giriş

**0.1 Karşılama + hesap**
- KK1 Google ile giriş. **Apple ile giriş kodda hazır, kapalı**; Apple Developer hesabı açılınca (mağaza öncesi, M4) etkinleşir. Telefon OTP v2.
- KK2 Davet linkiyle gelen kullanıcı giriş yapmadan 3.10'a ulaşır.

**0.2 Profilini kur** — KK1 ad ve benzersiz kullanıcı adı zorunlu (müsaitlik 300 ms debounce). KK2 harita gizliliği seçimi saklanır (`arkadaşlarım` varsayılan; v1'de kullanılmaz). KK3 fotoğraf isteğe bağlı.

**0.3 İlk seyahat yönlendirmesi** — KK1 iki kapı: Yeni seyahat → 3.2; Davet linkim var → 3.10. KK2 "Sonraki seyahatin ne zaman?" saklanır. KK3 atlanabilir.

**0.5 Boş durum** — seyahati olmayan kullanıcı 3.1 yerine görür; "İlk seyahatini planla" → 3.2.

### 3.1 Seyahatler

- KK1 Aktif seyahat (bugün ∈ [gidiş, dönüş], `trips.tz`) üstte kart: şehir, gün ilerlemesi, sıradaki durak ve saati → 3.5. Program oluşmamışsa "Program yakında hazır".
- KK2 Yaklaşan seyahatler tarihe göre artan; tarihsizler listenin sonunda.
- KK3 Geçmiş: yatay kartlar, şehir · ay-yıl · mekan sayısı.
- KK4 Gezi günü canlı satırı (§5.4) bu ekranda da görünür.

### 3.2 Nereye?

- KK1 Şehir araması Autocomplete (`(cities)`, oturum token'ı), Edge Function üzerinden. Seçimde `city_label`, `country_code` (ISO alpha-2), `tz` yazılır.
- KK2 Tarihler isteğe bağlı; tarihsiz seyahat 1 günle başlar.
- KK3 Devam → 3.3.

### 3.3 Otel (ilk kurulum)

- KK1 Tam ekran **açık tema** harita (cihaz temasından bağımsız, §5.7 stili). Üstte yüzen başlık ve arama; altta yüzen panel.
- KK2 Arama: Autocomplete `lodging`, şehir çevresi. Google Maps linki çözülür (`resolve-link`); Booking/Instagram linki "Yalnızca Google Maps linkleri" mesajıyla reddedilir. Yalnız koordinat dönen link haritayı oraya götürür ve "mekanı adıyla ara" önerir.
- KK3 "Bu bölgedeki otelleri göster": görünür alan için Nearby `lodging`, en fazla 12 pin; harita %30 kayınca / %40 ölçek değişince "Bu bölgede ara" hapı çıkar, otomatik yenileme yok.
- KK4 Seçilen otel pini sürüklenebilir; çevresinde 20 dk (≈1,5 km) kesikli daire.
- KK5 "Atla" → otel yok. Otel **her an** sonradan eklenebilir (3.5 KK13).
- KK6 Burada seçilen otel `stays`'e yazılır ve **tüm günlere** başlangıç = bitiş olarak uygulanır.

### 3.4 Keşfet

- KK1 Harita tam ekran (§5.7). Üstte geri (→ 3.1), arama/link kutusu, çipler; altta `Listede N mekan · Programa geç` çubuğu (→ 3.5).
- KK2 Arama Autocomplete, `locationBias` = görünür alan merkezi.
- KK3 Çipler: **Popüler** (varsayılan, `tourist_attraction`), Yemek (`restaurant`), Sanat (`museum`, `art_gallery`), Manzara. Öneriler **görünür alan** için Nearby; "Bu bölgede ara" kuralı 3.3 KK3 ile aynı; çip değişince yeniden arar.
- KK4 Pin dili §5.8: öneri = kategori pini; listede = siyah ✓.
- KK5 Pine dokunma = **seçim**, ekleme değil: altta tek satır önizleme kartı — 60 px foto · ad · `tür · süre · ★ puan · yorum sayısı` · siyah **+** (listeye ekle). Listedeyse + yerine ✓ (dokununca listeden çıkar). Karta dokununca 3.8.
- KK6 Eklenen mekan ekleyenin `user_id`'siyle kaydedilir; diğer üyelerde 2 sn içinde görünür (Realtime).
- KK7 Haritada Google'ın mekan etiketleri kapalı; etiket çakışması ve küme §5.8.

### 3.5 Program (eski 3.5 Günlere dağıt + 3.7 Program birleşti)

Tek ekran: harita + üç durumlu alt panel. Ayrı "Çizelge" sekmesi ya da route yoktur.

**Başlık ve gün seçici**
- KK1 Üst satır: 36 px yuvarlak geri düğmesi (→ 3.4), büyük şehir adı, altında **seçili günün özeti**: tarihliyse `Cuma, 16 Ekim · 4 durak · 09:00 → 13:36`, tarihsizse `1. gün · …`. Sağda üye avatarları (→ Grup paneli, KK19). Arkada 250 px açık geçiş.
- KK2 Gün seçici: tek beyaz şerit, eşit hücreler, 44–46 px. Tarihli: `Cum 16` / `Eki`; tarihsiz: `1. gün`. Renk noktası §5.9 paleti. **Seçili hücre** `#f1f1ef` zemin + gün renginde alt çizgi (siyah değil). Sonda `+` (gün ekle); hücreye uzun bas → Günü sil (durakları boşa düşer). Metin asla `…` ile kesilmez; 4+ gün kayar.

**Harita**
- KK3 Seçili günün pinleri gün renginde numaralı; diğer günler kendi renginde %40; atanmamış mekanlar kategori pini. Ev pinleri: günlerin başlangıç/bitiş otelleri (aynı otel tek pin; seçili gün dışı %40).
- KK4 Seçili günün rotası gerçek yol (§5.1), gün renginde; diğer günler %35. Bacak hapları (`🚶 12 dk` yerine SVG yürüyen kişi ikonu) bacak ortasında; başlık alanına düşen hap gizlenir.
- KK5 Gün seçilince ve panel durum değiştirince harita günün otel + duraklarını sığdırır (üst/alt boşluk = başlık ve panel).
- KK6 Pine dokunmak haritayı **kaydırmaz**.
- KK7 **Atanmamış pine dokunma** (bir gün seçiliyken): mekan doğrudan o güne eklenir — gün otomatik sıralıysa en uygun noktaya, elle sıralıysa en ucuz ekleme noktasına (`order_manual` değişmez). Altta kart: küçük foto · ad · `✓ 1. güne eklendi · N. sıra · bitiş HH:MM` · Geri al; altında `Taşı: [gün hapları]`. 6 sn sonra ya da haritaya dokununca kapanır.
- KK8 **Atanmış pine dokunma:** pin paneli — ad, kategori · süre · açık/kapalı; ★ puan · yorum sayısı · kim ekledi; küçük foto; tek satır `Gün ① ② ③` (dokununca taşır) + süre −/+; **Bilmen gerekenler** kutusu (Google `editorialSummary`, 2 satır + Devamı; özet yoksa kutu gizli); Detay · Yol tarifi · `···` (Listeden çıkar, onaylı).
- KK9 Sağ altta 48 px siyah **+** → 3.4.

**Alt panel** (snap noktaları: katlı 52 px · yarı açık %45 · tam ekran; yaylı, fling bir sonraki noktaya, liste en üstteyken listeden aşağı çekince iner; tutamak/oka dokunma katlı ↔ yarı açık)
- KK10 **Katlı:** tek satır `Sırayı gör ve düzenle ˄`; üst kenarda 3 px ilerleme çizgisi (tamamlanan/toplam). Gezi günü canlı satır (§5.4) bu satırın yerini alır.
- KK11 **Yarı açık:** başlık `Cum 16 Eki · bitiş 13:44` (sıra değişince fark `−22 dk`); sığarsa `≡ tutup sürükle` ipucu; `⤢` → tam ekran. Liste: Başlangıç satırı, duraklar, Bitiş satırı.
  - Durak satırı (min 44 px): numara (gün renginde) · kategori ikonu · **ad (en fazla 2 satır, kesilmez)** · altında `09:00 – 09:45 · 45 dk` · sağda **≡**. Aralarda 16 px yürüyüş/taksi satırı.
  - Kapalı mekan uyarısı adın altında ikinci satır: `Cum kapalı · Başka güne al` (§5.6).
- KK12 **Sürükle-sırala:** yalnız ≡'den. Satır kalkar (turuncu kenar), bırakılacak yer turuncu çizgi; bırakınca numaralar, rota, saatler ve bitiş anında güncellenir, `order_manual = true`. Uzun listede otomatik kaydırma. `···` → `Kısa rota` (`order_manual` sıfırlar).
- KK13 **Başlangıç/Bitiş satırları (otel):** otel varsa ev ikonu · ad · `Başlangıç · 09:00` · Değiştir; yoksa kesikli `Başlangıç: otel yok` + **+ Otel ekle**. Bitiş başlangıçla aynıysa tek satır `Otele dönüş · 13:44`. Dokununca **otel alt sayfası**: arama/link/`Haritadan` (3.3 haritası seçim modunda), seyahatin otelleri (radyo, gece sayısı, mesafe), `Otel yok`; `Yalnız bu gün` / `Bu gün ve sonrası` (varsayılan); `Gün sonunda başka otele geçiyorum` (taşınma günü: Sabah/Akşam seçimi); Kaydet'e kadar yazılmaz. Aynı sayfa `···` → `Oteli değiştir` ve ev pinine dokunarak da açılır. Kurallar §5.10.
- KK14 **Tam ekran:** panel gün seçicinin altından başlar (harita şeridi kalmaz, köşe 0); aynı kompakt liste + `Haritada gör` (altta ortada) ve sağ üstte harita düğmesi; `⤡` yarı açığa döner.
- KK15 **Uzun bas** (≡ dışında satıra ya da haritada pine), planlama aşamasındaki durakta: `Başka güne al ›` · `Günden çıkar` (havuzda kalır) · `Listeden sil` (onaylı, kırmızı). Tamamlanmış durakta: `Geri al` · `Puanla`.

**Gezi günü (bugün = seçili gün, `trips.tz`)**
- KK16 Kullanıcı konumu mavi nokta (`expo-location`, ön plan izni; yalnız seyahat günlerinde istenir, konum saklanmaz). Tamamlanan durak pini yeşil ✓, geçilen rota parçası soluk.
- KK17 Sıradaki durak satırı gri kart: 52 px Google fotoğrafı (atıflı) · ad · `süre · bitiş HH:MM` · turuncu **Bitti**. Kurallar §5.4.
- KK18 Tamamlanan durak: üstü çizili değil, yeşil ✓, adın yanında küçük gri `☆ puanla` → **puanlama sayfası**: küçük foto, ad, `✓ Tamamlandı · 09:00–09:52 · 52 dk kaldınız`, 5 yıldız, kısa not (üyeler görür), `Google'da da yorumla` (derin link), Sonra / Kaydet. Puan verilince `☆ puanla` yerine küçük yıldızlar. Gün bitince canlı satır `✓ Bugünün programı bitti · 6/6 · ☆ İlkini puanla`. Hızlı etiketler ve fotoğraf yükleme v1'de yok.

**Grup**
- KK19 Avatarlara dokununca panel: üyeler, davet linki kopyala/paylaş, son değişiklikler (kim, ne, ne zaman; tamamlama ve otel değişikliği dahil).

### 3.8 Mekan detayı

- KK1 Üstte kaydırmalı galeri, **en fazla 10** Google fotoğrafı (tembel yükleme, `3/10`, her fotoğrafta atıf).
- KK2 Ad, kategori, ★ puan, yorum sayısı, açık/kapalı + kapanış, `Google'da aç`; Google yorumları en fazla 5, canlı.
- KK3 Kim ekledi + not (ekleyen ve sahip düzenler). Süre −/+.
- KK4 Aksiyonlar: Yol tarifi; mekan listede değilse `Listeye ekle`; `···` → Başka güne al · Günden çıkar · Listeden sil (onaylı).
- KK5 Tam Details yalnız bu ekranda (§7).

### 3.10 Davetle katılım (tarayıcı) — **ertelendi, M2**

v0.2 KK1–KK5 aynen geçerli. Ek: `join_trip` ve `invite_preview` için IP başına hız sınırı (API katmanı) yayından önce zorunlu; web'de harita stili Cloud Console `mapId` ile. Alan adı ürün tarafında.

## 4. Navigasyon

- **Tek alt menü, her ekranda:** Seyahatler · Yeni · Profil. (Haritam v2'de eklenince 4 sekme.) Seyahat içi alt menü yoktur.
- Akış: 3.1 → seyahat → 3.4 Keşfet ⇄ 3.5 Program (Keşfet'ten `Programa geç`, Program'dan geri düğmesi ya da +). Grup = Program'daki avatarlar.
- v1 Profil: ad, kullanıcı adı, çıkış, hesap silme (devir önizlemeli).

## 5. Kurallar

### 5.1 Sıra, yürüyüş ve rota
- Tek sıra kaynağı `stops.order_key`; liste, pin numaraları ve çizgiler aynı sırayı okur.
- Otomatik sıra: günün başlangıcından en yakın komşu + 2-opt (≤ 20 durak); `order_manual=true` iken yeni durak en ucuz ekleme noktasına.
- Süreler: Routes `computeRouteMatrix` `WALK`, **gün bazlı**; önbellek `walk_cache` (çift bazlı, 30 gün).
- Çizgi: seçili gün için her bacak `computeRoutes` polyline. Yürüyüş > 40 dk ise aynı bacak `DRIVE`, kesikli çizgi, `🚕 N dk` (çizelgede ayrı satır, Yol tarifi araç modunda). Diğer günler kuş uçuşu. Sıra değişince yalnız değişen bacaklar istenir; gelene kadar kesikli kuş uçuşu.
- Matris anahtarları `place:<id>` / `stay:<id>`.

### 5.2 Otel bölge önerisi
Otel yoksa seçili mekanların ağırlık merkezi + reverse geocoding; v1'de yalnız metin.

### 5.3 Tempo
Doluluk hesabı (`(Σ süre + Σ yürüyüş) / (bitiş − başlangıç)`, eşikler 0,60/0,85) motorda kalır ama **Rahat/Normal/Yoğun etiketi ve öneri metni arayüzde gösterilmez** (ürün kararı, 5 Ekim). Arayüzde yalnız süreler. Gün bitişi varsayılan 20:00.

### 5.4 Tamamlama ve canlı satır
- **Bitti/Tamamlandı:** `stops.completed_at = now`, `completed_by`; sonrakiler `max(planlanan başlangıç, önceki tamamlanma + yürüyüş)` ile yeniden hesaplanır; liste her zaman artan saatli.
- **Otomatik tamamlanma:** planlanan bitiş + 10 dk geçince `completed_at = planlanan bitiş`, `auto_completed = true`; bildirim yok; uzun bas → Geri al.
- Konum: durağın 60 m içine girince `arrived_at` sessizce yazılır (istatistik); `Şu an X'te` gösterilir.
- **Canlı satır** (3.1 ve 3.5 katlı panel): yoldaysa `X'e N dk · sıradaki k/N` (+ gecikme); uzun kalındıysa `X'te N dk uzun kaldınız · bitiş HH:MM → HH:MM` + Kaydır / Atla / Planı koru. Konum yoksa yalnız yol durumu.
- "Vardık" düğmesi yoktur.

### 5.5 Eşzamanlı düzenleme
Satır bazlı, son yazan kazanır; `changes` tetikleyiciyle (otel değişikliği, tamamlama, sahiplik devri dahil). Realtime: `places`, `stops`, `days`, `stays`, `members`, `stop_ratings`.

### 5.6 Açılış saatleri
- Kontrol `trips.tz`'de, tarihli seyahatte. Tarihsizde yalnız haftalık bilgi.
- **7/24:** tek `open {day:0, hour:0, minute:0}` ve `close` yok → her zaman açık (önbellekteki eski biçim dahil). Gece yarısını geçen dönemler ertesi güne taşır. Saat bilgisi yoksa kontrol yok.

### 5.7 Harita stili (tüm haritalar)
Açık tema zorunlu. Bina blokları kapalı, `poi` tümü kapalı, şehir etiketi kapalı, mahalle adları açık gri, yollar ince beyaz; zemin `#f6f6f4`, park `#e6efe3`, su `#e3edf2`. Stil JSON'unda renkler 6 haneli. Pusula ve araç çubuğu kapalı.

### 5.8 Pin ve etiket dili
- Pin 32 px (seçili 38), ikon 16 px, numara 13 px; beyaz 2–2,5 px kenar.
- Kategoriler (`primaryType` → kategori · renk · ikon): gezilecek yer `#3b6fe0` kamera · müze/sanat `#8a4fd6` sütunlu bina · ibadet `#6b7280` kubbeli yapı + kule · yemek `#e8590c` çatal-bıçak · kafe `#9a5b2e` fincan · park `#1f8a4c` ağaç · manzara `#0ea5e9` dağ · alışveriş `#c2185b` çanta · diğer → gezilecek yer. Tek tablo `KATEGORI_PIN`.
- Durumlar: listede siyah ✓ · güne atanmış gün renginde numara · seçili **siyah halka** · seçili gün dışı %40.
- Etiket: pin altında ad (11 px, beyaz hale); puan satırı zoom ≥ 14 ya da seçiliyken. Etiket kutuları ve pin daireleri ekranda ölçülür; çakışmada öncelik seçili > seçili günün durakları (küçük sıra önce) > listede > diğer günler > atanmamış > öneri > rota hapı; önce puan, sonra ad düşer. Üst üste pinler `+N` kümesi; dokununca yakınlaşır.

### 5.9 Gün paleti
`1 #2f6fed · 2 #f2783f · 3 #12a37a · 4 #8a4fd6 · 5 #e0457b · 6 #0ea5e9`, 7+ döngü. Gün seçici noktası/çizgisi, numaralı pinler, liste numaraları ve rota aynı palet. Siyah = seçim/eylem rengi.

### 5.10 Gün bazlı otel
- Her günün `start_stay_id`, `end_stay_id`'si (null = otel yok). Varsayılan: günün başlangıcı = önceki günün bitişi; bitiş = başlangıç. Yeni gün son günün bitiş otelinden başlar.
- `Bu gün ve sonrası` seçili günden itibaren tüm günlere uygular; taşınma günü bitişi farklıdır ve ertesi gün oradan başlar.
- Otelsiz gün ilk duraktan başlar, son durakta biter.
- Tempo, rota, ilk/son bacak ve saatler günün kendi uçlarıyla (`otelPlani` saf fonksiyon).

### 5.11 Süre biçimi
Her yerde `X sa Y dk` / `Y dk`; ondalık saat yok. Yorum sayısı `1,2K`, `312K`.

## 6. Kalınacak süre varsayılanları
v0.2 tablosu aynen. Kullanıcı −/+ ile 15 dk adımlarla değiştirir (min 15 dk, maks 8 sa).

## 7. Google Places ve Routes kısıtları
- Veritabanında yalnız `place_id` ve enlem/boylam (≤ 30 gün); ad, puan, saat, fotoğraf saklanmaz. `stays.label` kullanıcı metnidir.
- Hafif Details (seçim, listeler, pin paneli); **tam** Details yalnız 3.8. `editorialSummary` daha pahalı SKU: yalnız pin paneli açılınca, 24 sa önbellek.
- Fotoğraflar: önizleme/sıradaki kart 1 adet, 3.8'de en fazla 10, tembel; atıf zorunlu.
- Nearby: Keşfet önerileri ve 3.3 oteller, yalnız "Bu bölgede ara" ile.
- Routes: matris gün bazlı; polyline yalnız seçili gün; önbellek çift bazlı.
- Tüm çağrılar Edge Function'dan; anahtarlar sunucuda; istemcide yalnız Maps SDK.
- Hedef maliyet kullanıcı başına ayda ≤ 0,50 $; M3 sonrası gerçek ölçümle güncellenir.

## 8. Veri modeli (Postgres, güncel)

```
profiles     id, name, username(unique), photo_url, map_visibility, next_trip_window, created_at
trips        id, owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date, day_start, day_end(20:00), invite_token, created_at
             (hotel_* sütunları okunmuyor; bir sürüm sonra kaldırılacak)
members      trip_id, user_id, guest, display_name, joined_at, role(owner|member)
places       id, trip_id, place_id, primary_type, lat, lng, google_fetched_at, default_minutes, added_by, note, created_at
stays        id, trip_id, place_id, lat, lng, label(≤80), google_fetched_at, created_by, created_at
days         id, trip_id, index, date, start_time, end_time, order_manual, start_stay_id→stays, end_stay_id→stays
stops        id, trip_id, day_id, place_ref→places(unique), order_key, minutes, arrived_at, arrived_by,
             completed_at, completed_by, auto_completed, skipped
stop_ratings id, trip_id, place_ref, user_id, stars(1–5), note, created_at   (üye başına mekan başına tek; tags sütunu kullanılmıyor)
walk_cache   trip_id, from_key, to_key, walk_seconds, walk_meters, drive_seconds, polyline, mode, fetched_at
changes      id, trip_id, user_id, entity, entity_id, field, old, new, at   (tetikleyici)
```
RLS her tabloda `is_member(trip_id)`; `stays`'in aynı seyahate ait olduğu tetikleyiciyle denetlenir.

## 9. Bildirimler (v1)
Üye katıldı · mekan eklendi (günlük özet) · seyahat günü 08:00 "Bugünün programı hazır". Tamamlama ve otomatik tamamlama bildirim üretmez.

## 10. Analitik olayları
`signup`, `trip_created`, `hotel_set{scope}`, `hotel_skipped`, `place_added{source: search|link|suggest|map_tap}`, `stop_assigned{source: tap|move}`, `stop_reordered{source: drag|short_route}`, `program_viewed{sheet}`, `stop_completed{auto}`, `stop_rated{stars}`, `shift_applied{kaydir|atla|koru}`, `invite_sent`, `invite_joined{guest}`.

## 11. Platform ve kalite
- iOS 16+, Android 10+; dokunma hedefleri ≥ 44 pt; dinamik yazı.
- EAS development build (Google harita sağlayıcısı); native modül eklenince tam derleme.
- Çökme raporlama **Sentry** (PII yok, performans izleme kapalı; DSN ürün tarafında). Kaynak haritası yüklemesi M4.
- Dil v1: Türkçe (`tr.json`).

## 12. Teslimat ve kabul
1. Her ekran KK listesiyle kabul edilir; görsel değişiklikler ürünün cihaz turuyla kabul edilir (PR'da cihaz görüntüsü yoksa koşullu onay).
2. Durum (8 Ekim): 0.x, 3.1–3.5, 3.8 kodda; #57/#58 birleşme aşamasında. Kalan v1: 3.10 (M2), §9, mağaza hazırlığı (M4). Takvim `04-proje-plani.md`.
3. Kanvas referanstır; akış farkları kabul edilmez, piksel farkları ürün onayıyla.

## 13. Kapanan sorular (v0.3)
1. Giriş v1 testte Google; Apple mağaza öncesi.
2. "Vardık" kalktı → Bitti + otomatik tamamlanma (#43).
3. Günler + Program tek ekran, Harita|Çizelge anahtarı yok (#34, #42).
4. Seyahat içi alt menü yok, tek alt menü (#45).
5. Tempo etiketleri arayüzde yok (5 Ekim).
6. Tamamlanan durak puanlama v1'de; etiketler ve ipucu hapları yok (#45, #47).
7. Boştakine dokun = seçili güne ekle, sıralama otomatikse en uygun yere (#53, PR #54).
8. Otel her an ve gün bazında, taşınma günü (#56).
9. Gün paleti ve tarihli gün seçici (#55).

## 14. Geçmiş
- v0.1 · 29 Eyl — ilk sürüm.
- v0.2 · 29 Eyl — teknik tasarım incelemesi T1–T11.
- v0.3 · 8 Eki — cihaz testleri ve mockup turları (#17–#56).
