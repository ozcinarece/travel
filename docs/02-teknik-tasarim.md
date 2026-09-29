# Teknik Tasarım Notu — Gezi Planlayıcı v1

Sürüm: 0.2 · Tarih: 29 Eylül 2026 · Yazan: geliştirici · Onay: Ece (ürün) · Durum: onaylandı (değişiklik isteğiyle, `03-inceleme-teknik-tasarim.md`)
Dayanak: `00-kapsam.md` v0.2, `01-prd-v1.md` v0.2
Değişiklik: v0.2'de incelemedeki T1, T2, T5, T7, T8 ve T11 kararları işlendi, Sprint 1 tahmini 14 güne çekildi.

---

## 1. Stack ve gerekçe

Önerilen stack'e katılıyorum. Değiştirdiğim tek şey harita katmanının seçimi.

| Katman | Seçim | Gerekçe |
|---|---|---|
| İstemci | **Expo (SDK güncel) + Expo Router + TypeScript** | iOS, Android ve web tek kod tabanından çıkar. Davet linki (3.10) aynı rotaları tarayıcıda açar. |
| Harita (native) | `react-native-maps`, **iOS'ta da `PROVIDER_GOOGLE`** | Google Places verisini Google dışı bir haritada göstermek şartlara aykırı. iOS varsayılanı Apple Maps olduğu için bu seçim zorunlu. Bu yüzden Expo Go kullanılamaz, **EAS development build** gerekir. |
| Harita (web) | `@vis.gl/react-google-maps` (Maps JS API) | Aynı `<Harita>` arayüzü `.native.tsx` / `.web.tsx` olarak iki uygulamayla sağlanır. |
| Arka uç | **Supabase**: Postgres, Auth, Realtime, Edge Functions, pg_cron | Kapsamdaki gerekçe geçerli. Ayrıca misafir kullanıcı için **anonim oturum** desteği var (§4). |
| Veri erişimi | `@supabase/supabase-js` + TanStack Query | Ekranlar önbellekten açılır. Realtime olayları sorgu önbelleğini günceller. |
| Hesaplama | Saf TS modülü `src/schedule/` (istemcide) | Sıralama (NN + 2-opt), tempo ve kaydırma hesapları ağ kullanmaz. 20 durakta ≪ 500 ms. Birim testlidir. |
| Analitik | PostHog (AB bölgesi) | §10 olayları. KVKK açısından veri AB'de kalır. |
| CI/CD | GitHub Actions | Her PR'da `tsc` + ESLint + Jest çalışır. `main`'e her birleştirmede EAS Update (preview kanalı) ve web dağıtımı yapılır. Mağaza derlemeleri elle tetiklenen EAS Build ile alınır. |

**Sprint 1 öncesi hazır olması gerekenler:** Apple Developer hesabı, Google Play Console, faturalı GCP projesi, Supabase projesi, alan adı (`/r/` linkleri ve universal link dosyaları için).

## 2. Klasör yapısı

```
src/
  app/                        Expo Router (SDK 57 şablonu rotaları src/app'te tutar): dosya = rota
    (auth)/giris.tsx, profil-kur.tsx, ilk-seyahat.tsx
    (tabs)/index.tsx          3.1 Seyahatler / 0.5 boş durum
    (tabs)/yeni.tsx, profil.tsx
    yeni/nereye.tsx, otel.tsx 3.2, 3.3
    trip/[id]/_layout.tsx     seyahat içi alt menü + mini-çubuk
    trip/[id]/kesfet.tsx, gunler.tsx, program.tsx, mekan/[placeId].tsx
    r/[token].tsx             3.10 davet (web + universal link hedefi)
  components/harita/          Harita.native.tsx · Harita.web.tsx · tipler.ts
  features/                   trips · places · days · members (sorgu + mutasyon hook'ları)
  schedule/                   siralama.ts · tempo.ts · kaydir.ts · acilis.ts  (+ __tests__)
  google/                     autocomplete.ts (oturum token'ı) · alanMaskeleri.ts
  lib/                        supabase.ts · analytics.ts · zaman.ts (seyahat saat dilimi)
  i18n/tr.json
supabase/
  migrations/                 tablolar, RLS politikaları, changes tetikleyicisi, RPC'ler
  functions/                  places-* · route-matrix · resolve-link · invite-preview · gunluk-bildirim · hesap-sil
.github/workflows/            ci.yml · eas-update.yml · web-deploy.yml
docs/
```

## 3. Google Places / Routes çağrı planı ve önbellek

İlke: **anahtarlar ve alan maskeleri sunucuda**. İstemci doğrudan yalnızca iki şeyi kullanır: Maps SDK / Maps JS (uygulama kimliğine ya da referrer'a kısıtlı anahtarla) ve Autocomplete (tuş başına gecikme olmasın diye, oturum token'ıyla). Diğer bütün Places ve Routes çağrıları Supabase Edge Function üzerinden gider. Bu sayede maske sabit kalır, kota ve maliyet tek yerden izlenir, kısa linkler sunucuda çözülür.

İki Details maskesi var (T2):
- **Hafif:** `id,location,displayName,primaryType,timeZone,rating,userRatingCount,currentOpeningHours.openNow`. Seçimde ve listelerde kullanılır.
- **Tam:** PRD 3.8 KK6 maskesi (yorumlar, fotoğraflar, tüm saatler). Yalnızca 3.8'de kullanılır.

| Nerede | Çağrı | Alan maskesi / not | Önbellek |
|---|---|---|---|
| 3.2 şehir, 3.3 otel, 3.4 arama | Autocomplete (New) + seçimde **hafif Details** | Seçim oturumu kapatır. `timeZone` → `trips.tz`. | DB: `place_id`, `lat`/`lng`, `primary_type` (§3.1) |
| 3.1, 3.4 liste, 3.7 program | `places-light` fonksiyonu: **toplu hafif Details** | Bir istekte N `place_id` alır. Ekranda ad, puan ve açık/kapalı bilgisini canlı gösterir. | İstemci belleği 24 sa + Edge Function 24 sa |
| 3.4 öneri çipleri | Nearby Search (New), `maxResultCount` 20 | Hafif maskenin karşılığı | Bellekte, (çip, harita hücresi) anahtarıyla, 24 sa |
| 3.4 kart fotoğrafı | Place Photo (400 px) | Yalnızca ekranda görünen kart için, tembel yükleme | Görsel önbelleği, oturum boyunca |
| 3.4 link yapıştırma | `resolve-link` fonksiyonu | Yalnızca Google Maps linkleri: `maps.app.goo.gl`, `google.com/maps/...`. Kısa link sunucuda takip edilir; `place_id`, `ftid` ya da koordinat+ad ayrıştırılır; gerekirse Text Search (New). Booking ve Instagram linkleri v2 (T8). | — |
| 3.7 açılış saati kontrolü | `places-light` + `regularOpeningHours` | Bkz. §7 açık nokta | İstemci belleği 24 sa + Edge Function 24 sa |
| 3.8 mekan detayı | **Tam** Details | Yorumlar hiçbir yerde saklanmaz | Yok |
| 3.5 tempo paneli (canlı) | **Çağrı yok** | Kuş uçuşu mesafe × 1,3 dolambaç ÷ 4,5 km/sa (PRD 3.5 KK5) | — |
| 3.7 program | Routes `computeRouteMatrix` WALK | **Gün bazlı**: o günün durakları + otel. Yeni durakta yalnızca eksik satır ve sütun istenir. | `walk_cache`, `fetched_at` ile ≤ 30 gün |
| 3.3 otel yoksa (§5.2) | Geocoding reverse | Ağırlık merkezi → semt adı | Bellekte |

**3.1 Saklama kuralı (T1).** Veritabanında Google'dan gelen yalnızca şunlar tutulur:
- `place_id` (süresiz)
- `lat`, `lng` (≤ 30 gün, `google_fetched_at` ile)
- `primary_type` (kalınacak süre varsayılanı için)

Ad, puan, saat ve fotoğraf **saklanmaz**, ekranda canlı çekilir. Otel için kullanıcının girdiği `hotel_label` tutulur. Konumu 30 günü geçen satır, o satır bir sonraki kez ekranda açıldığında hafif Details ile tazelenir. Toplu gece işi gerekmez.

**3.2 Neden gün bazlı matris.** Route Matrix **eleman başına** faturalanıyor. Seyahat genelinde 25 mekan + otel 676 eleman eder. Günde 6 durak + otel ise 49 eleman. 3.5 bu yüzden kestirimle çalışır: kullanıcı pinlere dokundukça API çağrısı yapılmaz. Gerçek süreler 3.7 açılınca gelir, gelene kadar iskelet gösterilir (KK10).

**3.3 Öneri çipleri (T8).** Ürün kararı şöyle:
- Popüler: `tourist_attraction`
- Yemek: `restaurant`
- Sanat: `museum`, `art_gallery`
- Manzara: `park`, `tourist_attraction`

Google'ın tip sayfasına bu ortamdan erişemedim. Tip adları Sprint 2 başında `places-nearby` fonksiyonunun testiyle gerçek API'ye karşı doğrulanacak; geçersiz tip `INVALID_ARGUMENT` döndürür. Tabloda `observation_deck` gibi manzaraya daha uygun bir tip varsa Manzara'ya eklemeyi önereceğim. PRD 3.4 KK4 o testin sonucuyla kesinleşir.

## 4. Davet linki: web istemci (PRD 3.10)

- **Aynı Expo Router kodu web'e derlenir.** `/r/[token]`, `trip/[id]/program` ve `trip/[id]/kesfet` tarayıcıda çalışır. 3.5 tarayıcıda salt okunur. Diğer rotalar web'de "uygulamayı al" sayfasına yönlenir.
- **Hafif ilk açılış.** `/r/{token}` sayfası harita yüklemez. `invite-preview` fonksiyonundan yalnızca özet gelir: şehir, tarih, üye ve mekan sayısı, otel adı. Maps JS "Plana katıl"dan sonra tembel yüklenir.
- **Link önizlemesi.** `/r/{token}` sunucu tarafında OG meta etiketleriyle döner, böylece WhatsApp önizlemesinde "Roma · 12–15 Ekim" görünür. Barındırma EAS Hosting (API rotası) üzerinde. Olmazsa aynı işi Vercel fonksiyonu görür.
- **Misafir kimliği.** Supabase **anonim oturum** açılır, oturum `localStorage`'da kalır (KK3). Ardından `join_trip(token, ad)` RPC'si (security definer) `members` satırını `guest=true` ile yazar. RLS her tabloda `is_member(trip_id)` ile korunur, misafir de gerçek bir `auth.uid()` taşır.
- **Sonradan hesap açma.** Anonim kullanıcıya Apple ya da Google kimliği bağlanır (`linkIdentity`). `user_id` değişmediği için aynı cihazda birleştirme gerekmez. Farklı cihazda birleştirme v2'ye kalır.
- **Universal link / App Link.** `apple-app-site-association` ve `assetlinks.json` aynı alan adından servis edilir. Uygulama yüklüyse `/r/{token}` doğrudan uygulamayı açar (KK5).
- **Token.** 8 karakter base62 (~47 bit). `join_trip` IP başına hız sınırlıdır. İptal etmek token'ı yeniler. İsteğe bağlı olarak anonim oturum açarken Cloudflare Turnstile kullanılabilir.

## 5. Veri modeli ve hesaplama kuralları (PRD v0.2 §5, §8 ile uyumlu)

- PRD §8'deki `users` tablosu `profiles` adıyla açıldı (Supabase'in `auth.users`'ıyla karışmasın diye). `trips.city_name`/`country` yerine kullanıcının düzenleyebildiği `city_label` tutulur (T1, `hotel_label` ile aynı mantık).
- `trips.tz`: IANA saat dilimi. "Bugün", mini-çubuk ve 08:00 bildirimi seyahat şehrinin saatiyle hesaplanır.
- `stops.trip_id`: Realtime filtresi `trip_id=eq.X` ile çalışsın diye.
- `stops.order_key`: **kesirli sıra anahtarı** (metin). Sürükle-bırak tek satır yazar, eşzamanlı sıralama çakışmaz.
- **Otomatik ve elle sıra (T7).** `days.order_manual=false` iken her durak eklemede §5.1 (NN + 2-opt) yeniden çalışır. Kullanıcı bir kez sürükledi mi `order_manual=true` olur ve yeni durak en ucuz ekleme noktasına girer; mevcut sıra korunur. "En kısa rotaya diz" düğmesi `order_manual`'ı sıfırlar ve §5.1'i çalıştırır. Otel değişince yalnızca saatler yeniden hesaplanır.
- **Tempo (T5).** `doluluk = (Σ kalınacak süre + Σ yürüyüş) / (gün bitişi − gün başlangıcı)`. Yürüyüş otel → ilk durak ve son durak → otel bacaklarını içerir (otel yoksa ilk duraktan son durağa kadar). Gün bitişi varsayılanı `trips.day_end` = 20:00. Son gün için kullanıcı `days.end_time`'ı dönüş saatine göre düşürür, ayrı alan yok. Hesap `src/schedule/tempo.ts`'te; 3.5 kestirim, 3.7 gerçek matris süresiyle aynı fonksiyonu çağırır.
- **"Vardık" (T11).** Seyahat düzeyindedir: herhangi bir üye işaretler, herkeste görünür. `stops.arrived_at` + `stops.arrived_by` yazılır, `changes` akışında "Mert: Forum Romanum'a vardık" olarak görünür. Kaydır / Atla / Planı koru seçimi de herkese uygulanır. Kişi bazlı ilerleme v2.
- `changes` tablosu istemciden değil **Postgres tetikleyicisinden** yazılır. Hiçbir yazma işlemi kayıtsız kalmaz.

## 6. Sprint 1 tahmini

Kapsam PRD v0.2 §12'deki gibi: 0.1, 0.2, 0.3, 0.5, 3.1, 3.2, 3.3 ve v1 Profil. Tek geliştirici için tahmin:

| İş | Gün |
|---|---|
| Proje kurulumu: Expo + dev build, Supabase şeması + RLS, CI, i18n, harita bileşeni | 3 |
| 0.1 Apple + Google giriş | 2 |
| 0.2 Profil kur (kullanıcı adı kontrolü, fotoğraf yükleme) | 1 |
| 0.3 İlk seyahat yönlendirmesi (iki kapı, "sonraki seyahat" cevabı) | 0,5 |
| 0.5 + 3.1 (liste, boş durum; aktif kart iskeleti) | 1,5 |
| 3.2 Nereye? (Autocomplete, tarih, `tz`) | 1 |
| 3.3 Otel (arama, sürüklenebilir pin, 20 dk daire, Google Maps link çözme) | 2,5 |
| v1 Profil (ad, kullanıcı adı, çıkış, hesap silme + `hesap-sil` fonksiyonu) | 1 |
| Test, düzeltme, mağaza iç test dağıtımı | 1,5 |
| **Toplam** | **≈ 14 iş günü** |

Bağımlı KK'ler PRD v0.2 §12.2'deki kurala göre işler: 3.1 KK1 ve KK4, 3.3 KK5 Sprint 1'de iskelet olarak gelir, bağlı oldukları sprintte kabul edilir.

## 7. Kararlar ve açık nokta

T1–T11 kararları `03-inceleme-teknik-tasarim.md`'de ve PRD v0.2'de. Bu belgeye işlenenler: T1 §3.1, T2 §3, T5 ve T7 ve T11 §5, T8 §3 ve §3.3, T9 §6.

**Açık nokta (T2'den doğan).** Hafif maske yalnızca `openNow` içeriyor, tüm saatler ise yalnızca 3.8'de çekiliyor. Oysa 3.7 KK5'teki "Bu saatte kapalı, 14:00'te açılır" ve tarihsiz seyahatteki "Pzt kapalı" bilgisi için `regularOpeningHours` gerekiyor. Önerim: 3.7'de toplu hafif Details'e yalnızca `regularOpeningHours` eklensin; yorumlar ve fotoğraflar yine yalnızca 3.8'de kalsın. Ürün onayı bekleniyor. Onaylanmazsa 3.7 KK5 yalnızca "şu an kapalı" gösterebilir.
