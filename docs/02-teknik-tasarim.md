# Teknik Tasarım Notu — Gezi Planlayıcı v1

Sürüm: 0.1 · Tarih: 29 Eylül 2026 · Yazan: geliştirici · Onay: Ece (ürün) · Durum: taslak, PR'da tartışılıyor
Dayanak: `00-kapsam.md` v0.1, `01-prd-v1.md` v0.1

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
app/                          Expo Router: dosya = rota (native + web)
  (auth)/giris.tsx, profil-kur.tsx, ilk-seyahat.tsx
  (tabs)/index.tsx            3.1 Seyahatler / 0.5 boş durum
  (tabs)/yeni.tsx, profil.tsx
  yeni/nereye.tsx, otel.tsx   3.2, 3.3
  trip/[id]/_layout.tsx       seyahat içi alt menü + mini-çubuk
  trip/[id]/kesfet.tsx, gunler.tsx, program.tsx, mekan/[placeId].tsx
  r/[token].tsx               3.10 davet (web + universal link hedefi)
src/
  components/harita/          Harita.native.tsx · Harita.web.tsx · Pin · YurumeDairesi
  features/                   trips · places · days · members (sorgu + mutasyon hook'ları)
  schedule/                   siralama.ts · tempo.ts · kaydir.ts · acilis.ts  (+ __tests__)
  google/                     autocomplete.ts (oturum token'ı) · alanMaskeleri.ts
  lib/                        supabase.ts · analytics.ts · zaman.ts (seyahat saat dilimi)
  i18n/tr.json
supabase/
  migrations/                 tablolar, RLS politikaları, changes tetikleyicisi, RPC'ler
  functions/                  places-* · route-matrix · resolve-link · invite-preview · gunluk-bildirim
.github/workflows/            ci.yml · eas-update.yml · web-deploy.yml
docs/
```

## 3. Google Places / Routes çağrı planı ve önbellek

İlke: **anahtarlar ve alan maskeleri sunucuda**. İstemci doğrudan yalnızca iki şeyi kullanır: Maps SDK / Maps JS (uygulama kimliğine ya da referrer'a kısıtlı anahtarla) ve Autocomplete (tuş başına gecikme olmasın diye, oturum token'ıyla). Diğer bütün Places ve Routes çağrıları Supabase Edge Function üzerinden gider. Bu sayede maske sabit kalır, kota ve maliyet tek yerden izlenir, kısa linkler sunucuda çözülür.

| Nerede | Çağrı | Alan maskesi / not | Önbellek |
|---|---|---|---|
| 3.2 şehir, 3.3 otel, 3.4 arama | Autocomplete (New) + seçimde **hafif Place Details** | `id,location,displayName,primaryType,timeZone`. Seçim oturumu kapatır. | `place_id` kalıcı; konum ≤ 30 gün (§3.1) |
| 3.4 öneri çipleri | Nearby Search (New), `maxResultCount` 20 | `id,displayName,location,primaryType,rating,userRatingCount,currentOpeningHours.openNow` | Bellekte, (çip, harita hücresi) anahtarıyla, oturum boyunca |
| 3.4 kart fotoğrafı | Place Photo (400 px) | Yalnızca ekranda görünen kart için, tembel yükleme | Görsel önbelleği, oturum boyunca |
| 3.3 / 3.4 link yapıştırma | `resolve-link` fonksiyonu | Kısa link sunucuda takip edilir. `place_id`, `ftid` ya da koordinat+ad ayrıştırılır. Gerekirse Text Search (New) ile `place_id` bulunur. | — |
| 3.7 açılış saati kontrolü | Place Details, yalnızca saatler | `id,regularOpeningHours,currentOpeningHours` | Bellekte 24 saat (§3.1 netleşince DB'ye taşınabilir) |
| 3.8 mekan detayı | **Tam** Place Details | PRD 3.8 KK6 maskesi, yorumlar dahil | Yok, yorumlar yazılmaz |
| 3.5 tempo paneli (canlı) | **Çağrı yok** | Kuş uçuşu mesafe × 1,3 dolambaç ÷ 4,5 km/sa | — |
| 3.7 program | Routes `computeRouteMatrix` WALK | **Gün bazlı**: o günün durakları + otel. Yeni durakta yalnızca eksik satır ve sütun istenir. | `walk_cache`, `fetched_at` ile ≤ 30 gün |
| 3.3 otel yoksa (§5.2) | Geocoding reverse | Ağırlık merkezi → semt adı | Bellekte |

**3.1 Saklama kuralı.** Bildiğim kadarıyla şartlar `place_id`'nin süresiz, enlem ve boylamın 30 güne kadar önbelleklenmesine izin veriyor. Ad, puan ve saat için PRD'deki "30 gün" iznini şartlarda göremedim (PR yorumu T1). Bu yüzden Google'dan gelen her kolon `google_fetched_at` taşır. Gece çalışan bir pg_cron işi 30 günü geçen satırları hafif Details ile tazeler. T1 netleşince ad ve tip kolonları ya kalır ya da kaldırılıp ekranda canlı çekilir.

**3.2 Neden gün bazlı matris.** Route Matrix **eleman başına** faturalanıyor. Seyahat genelinde 25 mekan + otel 676 eleman eder. Günde 6 durak + otel ise 49 eleman. 3.5 bu yüzden kestirimle çalışır: kullanıcı pinlere dokundukça API çağrısı yapılmaz. Gerçek süreler 3.7 açılınca gelir, gelene kadar iskelet gösterilir (KK10).

## 4. Davet linki: web istemci (PRD 3.10)

- **Aynı Expo Router kodu web'e derlenir.** `/r/[token]`, `trip/[id]/program` ve `trip/[id]/kesfet` tarayıcıda çalışır. 3.5 tarayıcıda salt okunur. Diğer rotalar web'de "uygulamayı al" sayfasına yönlenir.
- **Hafif ilk açılış.** `/r/{token}` sayfası harita yüklemez. `invite-preview` fonksiyonundan yalnızca özet gelir: şehir, tarih, üye ve mekan sayısı, otel adı. Maps JS "Plana katıl"dan sonra tembel yüklenir.
- **Link önizlemesi.** `/r/{token}` sunucu tarafında OG meta etiketleriyle döner, böylece WhatsApp önizlemesinde "Roma · 12–15 Ekim" görünür. Barındırma EAS Hosting (API rotası) üzerinde. Olmazsa aynı işi Vercel fonksiyonu görür.
- **Misafir kimliği.** Supabase **anonim oturum** açılır, oturum `localStorage`'da kalır (KK3). Ardından `join_trip(token, ad)` RPC'si (security definer) `members` satırını `guest=true` ile yazar. RLS her tabloda `is_member(trip_id)` ile korunur, misafir de gerçek bir `auth.uid()` taşır.
- **Sonradan hesap açma.** Anonim kullanıcıya Apple ya da Google kimliği bağlanır (`linkIdentity`). `user_id` değişmediği için aynı cihazda birleştirme gerekmez. Farklı cihazda birleştirme v2'ye kalır (PRD açık soru 2).
- **Universal link / App Link.** `apple-app-site-association` ve `assetlinks.json` aynı alan adından servis edilir. Uygulama yüklüyse `/r/{token}` doğrudan uygulamayı açar (KK5).
- **Token.** 8 karakter base62 (~47 bit). `join_trip` IP başına hız sınırlıdır. İptal etmek token'ı yeniler. İsteğe bağlı olarak anonim oturum açarken Cloudflare Turnstile kullanılabilir.

## 5. Veri modeline eklemeler (PRD §8 üzerine)

- `trips.tz`: IANA saat dilimi. "Bugün", mini-çubuk ve 08:00 bildirimi seyahat şehrinin saatiyle hesaplanır.
- `stops.trip_id`: Realtime filtresi `trip_id=eq.X` ile çalışsın diye. `stops` şu an yalnızca `day_id` taşıyor.
- `stops.order`: sayı yerine **kesirli sıra anahtarı** (metin). Sürükle-bırak tek satır yazar, eşzamanlı sıralama çakışmaz.
- `days.order_manual bool`: kullanıcı elle sıraladıysa otomatik sıralama (§5.1) o günde bir daha çalışmaz. Yeni durak en ucuz ekleme noktasına girer.
- `changes` tablosu istemciden değil **Postgres tetikleyicisinden** yazılır. Hiçbir yazma işlemi kayıtsız kalmaz.

## 6. Sprint 1 tahmini

Kapsam PRD §12'deki gibi: 0.1, 0.2, 0.5, 3.1, 3.2, 3.3. Tek geliştirici için tahmin:

| İş | Gün |
|---|---|
| Proje kurulumu: Expo + dev build, Supabase şeması + RLS, CI, i18n, harita bileşeni | 3 |
| 0.1 Apple + Google giriş (telefon OTP eklenirse +1,5) | 2 |
| 0.2 Profil (kullanıcı adı kontrolü, fotoğraf yükleme) | 1 |
| 0.5 + 3.1 (liste, boş durum; aktif kart iskeleti) | 1,5 |
| 3.2 Nereye? (Autocomplete, tarih) | 1 |
| 3.3 Otel (arama, sürüklenebilir pin, 20 dk daire, link çözme) | 2,5 |
| Test, düzeltme, mağaza iç test dağıtımı | 1,5 |
| **Toplam** | **≈ 12,5 iş günü (~2,5 hafta)** |

Sprint 1'de tam kabul edilemeyecek KK'ler var, çünkü sonraki sprintlere bağlılar: 3.1 KK1 ("Sıradaki" durak) ve KK4 (mini-çubuk), 3.3 KK5 (yeniden hesaplama). Bunlar Sprint 1'de iskelet olarak gelir, bağlı olduğu sprintte kabul edilir (PR yorumu T9).

## 7. PRD'ye notlar

Her maddenin gerekçesi PR'da ayrı yorum olarak var. Netleşenler PRD'ye işlenir ve bu listeden silinir.

- T1 Google önbellek kuralı (§7) ve veri modelindeki Google kolonları
- T2 "Detay çağrısı yalnızca 3.8'de" kuralı ile 3.2, 3.3, 3.4 ve 3.7'nin ihtiyacı çelişiyor
- T3 Maliyet: hedef 0,05 $, tahmin ≈ 0,40 $/kullanıcı; matris eleman bazlı faturalanıyor
- T4 Saat dilimi ve tarihsiz seyahatte açılış saati kontrolü
- T5 Tempo: "son gün dönüş saati" alanı yok, otele dönüş yürüyüşü formülde belirsiz
- T6 Mini-çubuk: "yürüyüş başladı" tanımı, KK8 formülü, görünürlük (PRD mi kanvas mı?)
- T7 Otomatik sıra ile elle sıralama ilişkisi
- T8 Link çözme (Booking) ve öneri çipi tipleri (`viewpoint`, `scenic_point`)
- T9 Sprint planı: 0.3, §4 Profil (hesap silme), §10 analitik atanmamış; sprint süresi
- T10 Açık sorular 1–3 için önerilerim
- T11 "Vardık" herkes için mi, kişiye mi?
