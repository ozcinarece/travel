# Pin ve ikon sistemi

Sürüm 1.0 · 9 Ekim 2026 · Sahip: Ece (ürün)

Kanvastaki **"Pin ve ikon sistemi"** panosu (`PinSystem6`), haritadaki her işaretin tek kaynağıdır: https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT

> **Kural:** Haritada ya da ekranda görünen her ikon, renk, boyut ve çizgi stili önce kanvasta tasarlanır. Yeni bir işaret, durum ya da renk gerekiyorsa issue'ya "tasarım bekliyor" yazılır ve ürün tarafına dönülür. Kanvasta tasarımı olmayan görsel değişiklik birleştirilmez.

## 1. Glifler (24×24, 2 px çizgi, yuvarlak uç ve köşe)

Yollar `src/components/ui/Ikon.tsx` ile birebir aynıdır. PNG'ler `scripts/pin-ikonlari.mjs` ile bu yollardan üretilir.

| Kategori | Renk | Glif (`Ikon` adı) | SVG |
|---|---|---|---|
| Gezilecek yer | `#3b6fe0` | `kamera` | `M4 8h3l1.5-2.5h7L17 8h3v11H4V8z` + daire (12, 13.5, r 3.5) |
| Müze | `#8a4fd6` | `muze` | `M3 9l9-5 9 5H3zM5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18` |
| İbadet yeri | `#6b7280` | `ibadet` | `M5 20v-6a5 5 0 0 1 10 0v6M3 20h18M10 9V7M19 20V8l-1.5-3L16 8v12` |
| Yemek | `#e8590c` | `catal` | `M7 3v6a2.5 2.5 0 0 0 5 0V3M9.5 3v18` · `M17 3c-1.7 1.2-2.5 3.5-2.5 6.5V13H17v8M17 3v10` |
| Kafe | `#9a5b2e` | `fincan` | `M4 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8z` · `M16 10h2a2.5 2.5 0 0 1 0 5h-2M7 4.5v2M10 4.5v2M13 4.5v2` |
| Park | `#1f8a4c` | `agac` | `M12 3l5 7h-3l4 5H6l4-5H7l5-7z` · `M12 15v6` |
| Manzara | `#0ea5e9` | `dag` | `M3 19l6.5-11 4 6.5 2-3L21 19H3z` + daire (17.5, 6, r 1.5) |
| Alışveriş | `#c2185b` | `canta` | `M5 8h14l-1 12H6L5 8z` · `M9 10V7a3 3 0 0 1 6 0v3` |

Diğer glifler: `tik` (`M5 12.5l4.5 4.5L19 7.5`, kalınlık +0,6) · `ev` · `taksi` · yön oku `M9 5l6 7-6 7`.

## 2. Pin durumları

| Durum | Boyut | Görünüm |
|---|---|---|
| Öneri (Keşfet) | 28 px | beyaz zemin, kategori renginde 2 px kenar, kategori renginde 14 px glif |
| Listede (Keşfet) | 28 px | kategori renginde dolu daire, 2 px beyaz kenar, beyaz 14 px glif |
| Seçili (her tür) | 34 px | aynı görünüm, 16 px glif, 2 px beyaz kenar + **2,5 px siyah dış halka** (kalın siyah çerçeve değil) |
| Durak (seçili gün) | 28 px | gün renginde dolu, 2 px beyaz kenar, beyaz sıra numarası 12 px / 800 |
| Diğer gün durağı | 20 px | gün renginde nokta, numarasız, %45 opak |
| Tamamlandı | 28 px | `#1f8a4c` dolu + beyaz ✓ |
| Otel | 28 px | siyah yuvarlatılmış kare (r 9) + beyaz ev 16 px |
| Ben (konum) | 22 px | `#4285f4` nokta, beyaz kenar, %25 halka |

Tüm pinlerde gölge: `0 2px 6px rgba(15,15,15,.22)`. Üst üste binme sırası: konum > seçili > otel > listede / durak > öneri > hap.

**Ad etiketi:** 11 px kalın, beyaz hale; 18–20 karakterde kesilir. Yakınlaşınca altında ★ puan · yorum. Çakışmada önce puan satırı düşer. Adı sığmayan öneri pini çizilmez; listede, durak ve otel her zaman çizilir.

## 3. Rota çizgileri

| Tür | Katmanlar |
|---|---|
| Yürüme (seçili gün) | gölge 11 dp `#0f0f0f` %12 · beyaz 9 dp · rota tonu 5,5 dp; yuvarlak uç ve köşe; ~45 px aralıkla beyaz yön oku |
| Taksi | siyah 10 dp · sarı `#FAC775` 6 dp · siyah şerit 6 dp, desen 10/14 dp, düz uç; ok yok |
| Diğer günler | rota tonu 3 dp, kenarsız, %32 |
| Rota gelene kadar | gün rengi 3 dp, kesikli (kuş uçuşu) |

Rota tonu = gün renginin ~%20 koyusu: 1 `#1f4fc2` · 2 `#cf5a22` · 3 `#0b7d5d` · 4 `#6e3fab` · 5 `#b83762` · 6 `#0b84ba`.
Gün renkleri (pinler): 1 `#2f6fed` · 2 `#f2783f` · 3 `#12a37a` · 4 `#8a4fd6` · 5 `#e0457b` · 6 `#0ea5e9`.

## 4. Haplar

- **Taksi süre hapı:** sarı `#FAC775` zemin, 1 px siyah kenar, metin `#412402` 10,5 px / 800, solda siyah taksi glifi 12 px. Yalnız taksi bacağında; yürüyüş süreleri haritada gösterilmez.
- **Yön oku:** beyaz 12 px "›", düz (`flat`) işaretçi, rota yönünde döner.
