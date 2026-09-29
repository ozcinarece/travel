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

Tasarım (21 ekran, tıklanabilir): https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT

## Çalışma şekli

- Ürün sahibi: Ece. Belgeler `docs/` altında; kapsam ve PRD değişiklikleri PR ile, sürüm numarası belge başında.
- Geliştirme: PRD'deki kabul kriterleri (KK) teslimat ölçütüdür. Her ekran ilgili KK listesine göre kabul edilir.
- İlk teslimat: teknik tasarım notu (`docs/02-teknik-tasarim.md`, geliştirici yazar, ürün onaylar).

## Durum

- [x] Kapsam v0.1
- [x] PRD v1 v0.2
- [x] Teknik tasarım notu v0.1 (incelendi, değişiklik isteğiyle onay)
- [ ] Prototip testi (5 kişi)
- [ ] Sprint 1
