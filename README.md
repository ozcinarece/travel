# travel — Gezi Planlayıcı (çalışma adı)

Arkadaşlarınla haritada plan kur, saat saat gez.

Ortak seyahat planı: mekanlar haritada seçilir, günlere haritada dağıtılır, program (saat saat çizelge) otelden başlayıp otele dönecek şekilde otomatik hesaplanır. Herkes linkle katılır, kimse uygulama indirmek zorunda değil.

## Belgeler

| Belge | İçerik |
|---|---|
| [docs/00-kapsam.md](docs/00-kapsam.md) | Vizyon, ürün ilkeleri, bilgi mimarisi, v1/v2 kesimi, başarı ölçütleri, riskler |
| [docs/01-prd-v1.md](docs/01-prd-v1.md) | V1 gereksinimleri: ekran ekran kabul kriterleri, hesaplama kuralları, Google Places kısıtları, veri modeli, sprint planı |
| [docs/02-teknik-tasarim.md](docs/02-teknik-tasarim.md) | Teknik tasarım notu (geliştirici) |
| [docs/03-inceleme-teknik-tasarim.md](docs/03-inceleme-teknik-tasarim.md) | Teknik tasarım notunun ürün incelemesi ve kararlar |
| [docs/04-proje-plani.md](docs/04-proje-plani.md) | Tarihli proje planı: kilometre taşları M1–M7, haftalık plan, Ece'nin işleri |

Tasarım (21 ekran, tıklanabilir): https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT

## Çalışma şekli

- Ürün sahibi: Ece. Belgeler `docs/` altında; kapsam ve PRD değişiklikleri PR ile, sürüm numarası belge başında.
- Geliştirme: PRD'deki kabul kriterleri (KK) teslimat ölçütüdür. Her ekran ilgili KK listesine göre kabul edilir.
- İlk teslimat: teknik tasarım notu (`docs/02-teknik-tasarim.md`, geliştirici yazar, ürün onaylar).

## Durum

- [x] Kapsam v0.1
- [x] PRD v1 v0.2
- [x] Teknik tasarım notu v0.2 (onaylandı)
- [ ] Prototip testi (5 kişi)
- [ ] Sprint 1 — kurulum birleşti; 0.1 / 0.2 / 0.5 PR'ı açık

## Geliştirme

```bash
npm install
cp .env.example .env.local   # anahtarları doldur
npx expo start               # web: w · native: EAS development build gerekir (Expo Go değil)
npm run typecheck && npm run lint && npm test
npm run db:test              # Postgres 16 ile migration + RLS testleri
```

Supabase tarafında bir kez: `supabase/migrations/*.sql` dosyaları sırayla SQL Editor'den çalıştırılır; Auth → Providers'ta Google ve **Anonymous sign-ins** açılır; Auth → URL Configuration → Redirect URLs'e `gezi://giris` ve web kökü + `/giris` eklenir.

Edge Function'lar (`supabase/functions/`): Google sunucu anahtarı yalnızca burada yaşar, istemciye girmez.

```sh
supabase secrets set GOOGLE_SERVER_KEY=...      # bir kez (Places New, Routes, Geocoding etkin anahtar)
supabase functions deploy places-autocomplete
supabase functions deploy places-light
# yerelde: supabase functions serve --env-file supabase/functions/.env.local
```

## Telefon derlemesi (EAS)

EAS projesi `@eceoz1/gezi`. Derleme GitHub Actions'tan alınır: **Actions → eas-build → Run workflow** (varsayılan Android `preview`, internal dağıtım APK). İş bitince özet sayfasında kurulum linki ve Android imza **SHA-1**'i yazar; SHA-1 Google Cloud'daki Android anahtar kısıtına eklenir.

Gerekli GitHub secret'ları: `EXPO_TOKEN` (expo.dev → hesap ayarları → Access tokens), `GOOGLE_MAPS_ANDROID_KEY`. Supabase URL ve publishable anahtar `eas.json` içinde (herkese açık değerler); Google sunucu anahtarı yalnızca Supabase secret'ıdır, derlemeye girmez.

### Expo Go ile test (APK indirmeden)

**Actions → eas-update → Run workflow** (hedef `expo-go`). Play Store'dan Expo Go kurulur, eceoz1 ile giriş yapılır; Projects → gezi → `expo-go` dalındaki son güncelleme dokunarak açılır. Google girişi için Supabase Redirect URLs'e `exp://**` eklenir. Yerel derlemeye JS güncellemesi göndermek için hedef `native` (preview kanalı).

