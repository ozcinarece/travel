# Tripmate marka temeli

Sürüm 1.0 · 13 Ekim 2026 (#136) · Kaynak: kanvas **Marka kimliği** → panolar **Temel** ve **Tur 4** (logo 1 "bugünkü a"): https://claude.ai/artifact/T3cPDHpXYkyii3QcKMoQeY · Sahip: Ece (ürün)

> Kural: ekranlar buradaki jetonlarla kurulur (`src/theme.ts`); ekrana özel renk/yazı/köşe değeri koda gömülmez. Yeni bir değer gerekiyorsa önce kanvasa, sonra buraya girer. Görünen ad çalışma adı **Tripmate** (mağaza adı sonra).

## 1. Renkler (`renk`)

| Jeton | Hex | Kullanım |
|---|---|---|
| `ana` Gece | `#152A6B` | birincil düğme, koyu kart, seçili sekme / çip, pin kenarı, logo ikinci nokta |
| `vurgu` Mandalina | `#FF7A1A` | Yeni düğmesi, rozet, sıradaki / seçili durak, Listeye ekle; **üstünde yazı Lacivert** |
| `metin` Lacivert | `#0E1430` | metin |
| `ikincil` Gri mavi | `#4A5274` | ikincil metin, açıklama |
| `soluk` | `#6A7290` | yer tutucu, pasif sekme |
| `yuzey` Buz | `#EEF2FF` | arama kutusu, ikincil düğme, alıntı, kart zemini |
| `ayrac` Çizgi | `#DDE3F6` | kenar ve ayraç |
| `anaAcik` | `#C9D2F2` | koyu kart üstünde ikincil metin, açık avatar |
| `basari` / `basariMetin` / `basariZemin` | `#16A06E` / `#0E7A52` / `#E3F5EE` | Listede ✓, tamamlandı, "Katıldın ✓" rozeti |
| `uyari` / `uyariZemin` | `#D93A2B` / `#FBE7E4` | hata ve silme |
| `zemin` | `#FFFFFF` | ekran |
| `haritaZemin` | `#F1F3F8` | harita arkası |

Kontrast: Lacivert / Gri mavi beyaz üstünde ≥ 4,5:1; Mandalina üstünde beyaz yazı **yok** (Lacivert). Koyu zeminde ikincil metin `anaAcik`.

**Gün renkleri** (`gunRenkleri`): 1 `#2C64F5` · 2 `#F5A524` (üstünde Lacivert, `gunUstuMetin`) · 3 `#16A06E` · 4 `#7B4FE0` · 5 `#E0457B` · 6 `#0EA5E9`; rota tonu ≈ %20 koyu (`rotaRenkleri`). **Kategori:** 8 kategori aynı glif (`docs/05 §1`); Yemek `#D9480F` (markayla karışmasın).

## 2. Yazı (`yazi`, `olcek`)

- Başlık **Archivo** genişlik 115 / kalınlık 850 → `yazi.baslik` (`assets/fonts/ArchivoSemiExpanded-ExtraBold.ttf`; Google Fonts değişken dosyasından `fontTools` ile üretilmiş statik örnek, 118 KB). Metin **Figtree** 400 / 500 / 600 / 700 / 800 → `normal · orta · yari · kalin · ekstra` (`@expo-google-fonts/figtree`). İkisi de JS varlığıdır, OTA ile gider. Plus Jakarta Sans kalktı.
- Ölçek: ekran **32** · kart **24** · bölüm **19–20** · metin **16** · alt **14** · etiket **12** (büyük harf, 800, `Rozet buyukHarf`). Başlıklarda harf aralığı −0,03em; satır 1,05–1,1.

## 3. Köşe, gölge, boşluk

- `kose`: düğme / giriş **14** · kart **22** · rozet **8** · çip **tam yuvarlak** · segment kabı 12.
- **Gölge yok**; katmanı zemin rengi ve çizgi ayırır. Yalnız harita üstündeki kart / panel / çekmece `haritaGolgesi` (0 6 18 %12).
- Kenar boşluğu 20; dokunma hedefi ≥ 44.

## 4. Bileşenler (`src/components/ui`)

| Bileşen | Kural |
|---|---|
| `Buton` | `birincil` Gece/beyaz · `vurgu` Mandalina/Lacivert · `ikincil` Buz/Gece · `cerceveli` beyaz + 1,5 Çizgi · `tehlike`; köşe 14; boy 54 (`buyuk`) / 52 / 46 (`kucuk`); yazı Figtree 800 16 |
| `Cip` | 36 px tam yuvarlak; seçili Gece dolu beyaz yazı, diğerleri beyaz + 1,5 Çizgi; `kucuk` 30 |
| `Rozet` | 26 px, köşe 8, 12 / 800; `vurgu` · `buz` · `basari` · `gece`; `buyukHarf` etiket dili ("2 GÜNLÜK GEZİ") |
| `AramaKutusu` | Buz, köşe 14, 52 px, solda Gece büyüteç 2,4 |
| `SegmentSecici` | Buz kap köşe 12 / 3 px dolgu; seçili beyaz dilim + Gece yazı |
| `AltPencere` | tutamaçlı alt sayfa: beyaz, üst köşe 30, perde Lacivert %45, `kaydirilir` ile en çok %88 |
| **`EkleDugmesi`** | **her ekranda tek bileşen**: 38 px kare (köşe 11) — turuncu **+** (Mandalina, Lacivert çizgi 3) ↔ açık yeşil **✓** (`basariZemin`, `basariMetin` 3,2; dokununca çıkar). 32 / 34 px küçük yerlerde |
| `Avatar` | köşeli yuvarlak kare (köşe ≈ %32), Archivo baş harf; Gece varsayılan, Mandalina / açık zeminde Lacivert harf |
| `MetinAlani` | Buz kutu, köşe 14, odakta Gece kenar |
| `Logo` / `LogoYazi` | iki nokta (Mandalina + Gece; koyu zeminde beyaz) + kesik çizgili gülümseme; < 24 px kesiksiz; yazı Archivo Gece |

İkonlar: 2,2 çizgi, yuvarlak uç; seçili sekme ikonu dolu Gece (`Ikon`).

## 5. Harita dili (özet; ayrıntı `docs/05-ikon-sistemi.md` v2.0)

Durak pini **köşeli kare** (gün rengi, 3 px beyaz kenar, numara). Seçili / sıradaki durak **38 px Mandalina kare + Gece kenar**. Keşfet önerisi beyaz daire + kategori glifi; **listedeki mekan Mandalina kare, Gece kenar, köşede ✓**. Yürüme gerçek yol **düz** çizgi; araba kuş uçuşu **kesik** çizgi (logodaki gibi).

## 6. Logo, uygulama ikonu, splash

- Logo: kanvas Tur 4 · 1 — noktalar (24,14) ve (56,14) r 7, gülümseme `M20 30 Q40 48 60 30` kalınlık 7, kesik 7 / 4,5 (80 × 48 görünüm alanı).
- `scripts/marka-gorselleri.py` (Pillow) üretir: `icon.png` 1024 Gece zemin · Android adaptive ön/arka/monokrom · `splash-icon.png` 240 × 144 (zemin Gece, `app.config` eklentisi) · `favicon.png` 48 (kesiksiz).
- **İkon ve splash yereldir → EAS build.** Uygulama içi logo (`Logo`) OTA ile gider.
