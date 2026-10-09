# CLAUDE.md — gezi (Gezi Planlayıcı)

Önce oku: `docs/01-prd-v1.md` (kabul kriterleri = teslimat ölçütü), `docs/02-teknik-tasarim.md` (mimari kararlar), `docs/03-inceleme-teknik-tasarim.md` (ürün kararları). Expo kuralları: @AGENTS.md

## Değişmez kurallar
- **Tasarım kaynağı kanvas.** Görünen her ikon, renk, boyut, çizgi stili ve ekran düzeni kanvastaki tasarımla birebir uygulanır (https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT; harita işaretleri için `docs/05-ikon-sistemi.md`). Kanvasta karşılığı olmayan bir görsel gerekiyorsa kendi tasarımını uygulama: issue'ya "tasarım bekliyor" yaz, ürün tarafı kanvasa ekleyince uygula.
- Google verisi: DB'de yalnızca `place_id`, `lat`/`lng` (`google_fetched_at`, ≤ 30 gün) ve `primary_type`. Ad, puan, saat, fotoğraf, yorum saklanmaz (PRD §7).
- Places/Routes çağrıları Supabase Edge Function'dan; istemcide yalnızca Maps SDK/JS ve Autocomplete.
- Harita her platformda Google (`PROVIDER_GOOGLE`); Expo Go değil, EAS development build.
- Kullanıcı metinleri `src/i18n/tr.json`'da; koda gömülmez.
- Seyahat zamanı `trips.tz` ile hesaplanır (`src/lib/zaman.ts`), cihaz saatiyle değil.
- Yetki kuralları veritabanında (RLS, `supabase/migrations`); her yeni kural `supabase/tests/rls_test.sql`'e test olarak girer.

## Komutlar
- `npm run typecheck` · `npm run lint` · `npm test`
- `npm run db:test` — migration'lar + RLS testleri (PGHOST/PGPORT/PGUSER ile bir Postgres 16 gerekir)
- Paket eklerken `npx expo install <paket>`

## Çalışma
Her iş ayrı dalda, PR ile `main`'e. PR açıklaması ilgili KK'leri listeler.
