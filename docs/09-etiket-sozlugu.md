# Etiket sözlüğü: bugünden toplanacak veri

Sürüm 0.1 · 14 Ekim 2026 · Sahip: Ece (ürün) · Durum: **taslak, onay bekliyor** · Eş belge: [`08-vizyon-paket.md`](08-vizyon-paket.md) · İlgili: [`07-icerik-hatti.md`](07-icerik-hatti.md)

> **Bu belge ne işe yarar:** Onaylandığı gün BO ve AI editör her yeni yere, geziye ve güne bu etiketleri girmeye başlar. Paket motoru (`08` §4) gelecekte yalnız bunlarla çalışır; bugün girilmeyen etiket yarın elle geri doldurulur. Bu yüzden sözlük **küçük, kapalı ve sıkı** tutuldu.
>
> **Onaylandığında:** §8'deki Faz 0 maddeleri issue'ya dönüşür.

---

## 1. Kurallar (etiket patlamasını önlemek için)

1. **Kapalı liste.** Her alanın değerleri §4'teki listedir. Serbest metin etiket yoktur. Yeni değer yalnız bu belgeye PR ile girer (ve `sozluk` tablosuna migration ile).
2. **Bir kez, yerinde.** Bir yerin özelliği (iç mekan mı, bebek arabasına uygun mu) **yer** satırında tutulur; geziler ve duraklar onu miras alır. Gezi ve durak yalnız **bağlama özel** alanları taşır (bu gezide süre, bu gezide rolü).
3. **Türetilebilen etiketlenmez.** Gezinin ilgi profili, günün yürüme km'si, günün hava bağımlılığı, bölgenin terminale uzaklığı hesaplanır, girilmez.
4. **Üst sınırlar.** Çok değerli alanlarda sınır var: ilgi ≤ 3, kime uygun ≤ 3, tarz ≤ 2, en iyi zaman ≤ 2, kaçın zaman ≤ 1, bölge karakteri ≤ 2. Sınır, editörü **seçmeye** zorlar; her şey işaretliyse hiçbir şey işaretli değildir.
5. **Boş = bilinmiyor.** "Hayır" ile "bilmiyorum" karıştırılmaz. Uygunluk alanlarında `null` bilinmiyor demektir; motor bilinmeyeni, istenen kısıtta "uygun" saymaz (elenir); `kismen` uyarıyla kalır.
6. **Her etiketin kaynağı ve tarihi var.** Kim girdi (AI editör / Ece / BO), neye dayanarak (resmî site, OSM, yerinde gözlem, AI çıkarımı), ne zaman. Maliyette kaynak ve tarih **zorunlu**.
7. **Google'dan kopyalanmaz, türetilmez.** Google'ın puanı, yorum sayısı, fiyat seviyesi (`priceLevel`), açılış saatleri ve koordinatı etiket olarak ya da etiket formülüne girdi olarak saklanmaz. `onem`, `kalabalik` ve `fiyat_seviyesi` bizim değerlendirmemizdir (§7.1 kural 6).
8. **Kodlar sabit, adlar Türkçe.** Kod ASCII küçük harf (`yeme_icme`); ekrandaki ad `sozluk.ad_tr`'den gelir.

---

## 2. Önerilen boyutlara yanıt

Ürün tarafının ilk listesi ve kararım:

| Önerilen boyut | Karar | Gerekçe |
|---|---|---|
| İlgi alanları | **Kalır, liste değişti** (§4.1) | "Fotoğraf" çıktı: her yer fotojenik, ayırt etmiyor; ihtiyaç `manzara` ilgisi ve `gun_batimi` zamanıyla karşılanır. "Aile" çıktı: ilgi değil, kitle → `kime_uygun` ve uygunluk alanlarına. `yerel_yasam` ve `aktivite` eklendi. |
| Tempo yükü | **Kalır** (1–3) | Tempo uyarlamasının temeli. |
| Yürüme yoğunluğu | **Yer düzeyinden çıktı** | Duraklar arası yürüme rotadan hesaplanır (gün/gezi km). Yerin kendi içindeki yürüme (ören yeri, büyük park) `tempo_yuku`'na girer. |
| İç/dış mekan ve yağmurda uygunluk | **Tek alan: `ortam`** | Yağmur uygunluğu `ortam`'dan türer (`ic` uygun, `karma` kısmen, `dis` değil). Aşırı sıcak da `ortam=dis` + mevsim + saatten hesaplanır. İki alan çelişme fırsatı yaratır. |
| Günün uygun saatleri | **İki alan:** `en_iyi_zaman` (≤ 2), `kacin_zaman` (≤ 1) | "Gün batımında git" ile "öğlen kalabalık, gitme" farklı bilgiler. |
| Mevsim | **`mevsim_kisit`, boş = her mevsim** | Çoğu yer her mevsim uygun; yalnız istisna işaretlenir. |
| Çocuk / bebek arabası / erişilebilirlik | **Üç ayrı alan**, `null` = bilinmiyor | Erişilebilirlik yalnız resmî kaynak ya da yerinde doğrulamayla "evet" olabilir (yanlış "evet" bir kullanıcıyı kapıda bırakır). |
| Rezervasyon / bilet gerekliliği | **İki alan:** `giris` (ücretsiz/ücretli), `rezervasyon` (gerekmez/önerilir/zorunlu) + `muzekart` bayrağı | Müze Kart Türkiye'de bilet maliyetini sıfırlıyor (`08` fikir 5). |
| Bizim maliyet tahminimiz | **Ayrı tablo** (`maliyet_tahminleri`, §6.2); yeme-içmede `fiyat_seviyesi` sütunu | Fiyat yaşlanır, kaynağı ve geçmişi olur; sütunda tutulursa tarihi ve kaynağı kaybolur. |
| Kalabalık | **Kalır, isteğe bağlı** | Zirve saati `kacin_zaman`'a girer. |
| "Mutlaka görülmeli" puanı | **`onem` 1–3** | 5'li ölçek ayırt etmiyor; 3 seviyeyle şehir başına "ikon" sayısı denetlenebilir (≤ 8). |

**Eksik bulup eklediklerim:**

| Alan | Nesne | Neden |
|---|---|---|
| `sure_min`, `sure_max` | Yer | Tempo uyarlaması (hızlı/derin ziyaret). Bugünkü `sure_dk` gezide kalır. |
| `kapali_gunler`, `mevsimsel_kapanis` | Yer | Bugün yalnız plan dosyasında; DB'de yok. Motor ve B planı için gerekli. |
| `ogun` | Yer (yeme-içme), durak | Motor öğün yuvalarını doldurur ve yemek maliyetini hesaplar. |
| `pin_kategori` | Yer | Kendi kategorimiz (bugünkü 8 pin kategorisiyle aynı kodlar); Keşfet'in Google'dan bağımsızlaşması için. |
| `bolge_id` | Yer, gün | Konaklama bölgesi seçimi ve gün kümelenmesi. |
| `konum_kaynagi`, `osm_id` | Yer, bölge | Google koşulları (§6.5). |
| `rol` | Gün, durak | Gün düşürme/birleştirme ve tempo (`08` §4.4). |
| `kisa_anlati` | Gün | Uyarlanmış pakette gün kartı (blog yazısı tek parça). |
| `yarim_gun_uygun`, `arac_gerekli` | Gün | Yarım gün mühendisliği ve ulaşım şekli. |
| `gun_min`, `gun_max` | Gezi | Esneklik aralığı. |
| `bebek_bakim` | Yer | Alt değiştirme imkânı (`08` fikir 8). İsteğe bağlı. |

---

## 3. Nesne nesne alanlar

Sütun açıklamaları: **Zor.** = paket için zorunlu (yayından önce dolu olmalı) · **İst.** = isteğe bağlı · **T** = türetilir. **Kim:** AI = AI editör önerir, Ece onaylar · BO = Ece/BO'da elle · S = sistem hesaplar · K = kullanıcı.

### 3.1 Şehir (`sehirler`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden |
|---|---|---|---|---|---|
| `ideal_gun_min`, `ideal_gun_max` | tam sayı | 1–7 | Zor. | AI | "Nereye?" önerisi ve gün uyarlaması |
| `en_iyi_aylar` | ay dizisi | 1–12 | Zor. | AI | Takvim radarı (`08` fikir 4) |
| `sezon_carpani` | 12 sayı | 0,5–2,0 (ay başına) | Zor. | AI + BO | Konaklama fiyat bandının aya göre kayması |
| `arac_ihtiyaci` | tekli | `yok` · `yararli` · `gerekli` | Zor. | AI | Ulaşım şekli önerisi (gündeki `arac_gerekli` bool'undan ayrı alan) |
| `toplu_tasima_karti` | metin ≤ 60 + bayrak | kart adı; `gerekli` evet/hayır | İst. | AI | İlk gün bilgisi, maliyet |
| Ulaşım noktaları | ayrı tablo (§6.2) | havalimanı, otogar, gar, iskele: konum, merkeze süre, emanet | Zor. | AI + BO | Varış/dönüş, yarım gün, transfer maliyeti |
| Rotalar | ayrı tablo (§6.2) | çıkış noktası × mod: süre aralığı, aktarma, sıklık | Zor. | AI + BO | Ulaşım seçimi |
| Maliyet tabloları | `maliyet_tahminleri` (§6.2) | yemek (seviye × öğün), toplu taşıma binişi, taksi açılış/km, otopark/gün, transfer, rota bileti | Zor. | AI + BO | Maliyet modeli (`08` §5) |

### 3.2 Bölge / konaklama bölgesi (yeni: `bolgeler`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden |
|---|---|---|---|---|---|
| `ad` | metin ≤ 60 | "Odunpazarı", "Bağlar" | Zor. | AI | — |
| `merkez` (lat, lng) + `yaricap_m` | konum + tam sayı | bizim/OSM konumu; 200–3000 m | Zor. | AI + BO | Yerleri bölgeye bağlama; çokgen sonra |
| `karakter` | çoklu ≤ 2 | §4.10 | Zor. | AI | Semt kartı, kime uygun eşleşmesi |
| `aksam_karakteri` | tekli | `sakin` · `orta` · `canli` | Zor. | AI | Tek gezen, aile, gece hayatı istekleri |
| `aile_uygun` | tekli | `evet` · `kismen` · `hayir` | İst. | AI | Aile personası |
| `otopark` | tekli | `kolay` · `zor` · `bilinmiyor` | İst. | AI | Arabalı paket |
| `onerilen_kime` | çoklu ≤ 2 | §4.13 `kime_uygun` | İst. | AI | Gerekçe metni |
| Otel fiyat bandı | `maliyet_tahminleri` | seviye × gece × oda, sezonsuz baz | Zor. | AI + BO | Konaklama maliyeti |
| Terminallere süre | T | kendi süre matrisimizden | — | S | Yarım gün, ulaşım |

**Şehir başına:** paket için en az 2, ideal 3–5 bölge.

### 3.3 Yer (`yerler`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden (motor kullanımı) |
|---|---|---|---|---|---|
| `pin_kategori` | tekli | §4.11 (bugünkü 8 kategori) | Zor. | AI | Keşfet ve harita kendi verimizle |
| `ilgi` | çoklu ≤ 3, ilk = birincil | §4.1 | Zor. | AI | İlgi uyumu puanı |
| `onem` | 1–3 | §4.8 | Zor. | AI + **Ece** | Gün düşürmede korunacak yerler; önem kapsamı |
| `tempo_yuku` | 1–3 | §4.2 | Zor. | AI | Tempo uyarlaması |
| `ortam` | tekli | `ic` · `dis` · `karma` | Zor. | AI | B planı, mevsim, sıcak |
| `sure_min`, `sure_max` | dakika | 15–480, min ≤ max | Zor. | AI | Hızlı/derin ziyaret |
| `kapali_gunler` | gün dizisi | `pazartesi` … `pazar` (boş = her gün açık) | Zor. | AI | Sert kısıt; kapalı müze B planı konusu olmamalı |
| `mevsimsel_kapanis` | ay dizisi | 1–12 | İst. | AI | Kışın kapalı yerler |
| `en_iyi_zaman` | çoklu ≤ 2 | §4.3 | İst. | AI | Sıra ipucu (gün batımı akşama) |
| `kacin_zaman` | çoklu ≤ 1 | §4.3 | İst. | AI | Kalabalık/sıcak cezası |
| `mevsim_kisit` | çoklu | §4.4: **yalnız bu mevsimlerde uygun** (boş = her mevsim) | İst. | AI | Uygunluk tercihi (yumuşak); kesin kapanış `mevsimsel_kapanis`'tadır (sert) |
| `cocuk_uygun` | tekli / null | §4.5 | İst. | AI | Aile personası |
| `bebek_arabasi` | tekli / null | §4.5 | İst. | AI (yalnız kaynaklı) | Bebekli kısıtı |
| `erisilebilir` | tekli / null | §4.5 | İst. | **Yalnız resmî kaynak ya da yerinde** | Erişilebilirlik kısıtı |
| `bebek_bakim` | evet / null | — | İst. | AI (kaynaklı) | Bebek ritmi |
| `giris` | tekli | `ucretsiz` · `ucretli` (yeme-içmede boş) | Zor.* | AI | Bilet kalemi |
| `rezervasyon` | tekli | §4.6 | Zor.* | AI | Rezervasyon listesi |
| `muzekart` | bool | — | Zor.* | AI (resmî liste) | İndirim cüzdanı |
| `fiyat_seviyesi` | 1–4 | §4.7 (yalnız yeme-içme, alışveriş) | Zor.** | AI | Yemek maliyeti, bütçe seviyesi |
| `ogun` | çoklu ≤ 3 | §4.9 (yalnız yeme-içme) | Zor.** | AI | Öğün yuvaları |
| `kalabalik` | tekli | `dusuk` · `orta` · `yuksek` | İst. | AI | Ceza puanı |
| `bolge_id` | FK | `bolgeler` | T | S (merkez + yarıçaptan; BO düzeltir) | Bölge seçimi |
| `konum_kaynagi` | tekli | `osm` · `elle` · `google_30g` | Zor. | S | Google koşulları |
| `osm_id` | metin | `node/123`, `way/456` | İst. | S | OSM bağı ve atıf |
| `etiket_meta` | jsonb | §6.1 | Zor. | S | Kaynak, tarih, onay |
| Bilet aralığı | `maliyet_tahminleri` | min–maks ₺, kaynak, tarih | Zor.* | AI + BO | Bilet kalemi |

\* `pin_kategori` `yemek` ya da `kafe` değilse. \*\* `pin_kategori` = `yemek` ya da `kafe` ise.

### 3.4 Gezi (`geziler`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden |
|---|---|---|---|---|---|
| `tarz` | çoklu ≤ 2 | §4.12 | Zor. | AI | İskelet seçimi |
| `kime_uygun` | çoklu ≤ 3 | §4.13 | Zor. | AI | Persona eşleşmesi |
| `tempo` | tekli | `rahat` · `normal` · `yogun` | Zor. | S önerir, AI/Ece onaylar | İskelet seçimi; uyarlamanın başlangıç noktası |
| `ulasim_sekli` | tekli | `yuruyus` (toplu taşıma dahil) · `araba` · `karma` | Zor. | AI | İskelet seçimi |
| `butce_seviyesi` | tekli | `ekonomik` · `orta` · `konforlu` | Zor. | AI | Uyarlamanın başlangıç noktası |
| `gun_min`, `gun_max` | tam sayı | 1 ≤ min ≤ `gun_sayisi` ≤ max ≤ 7 | Zor. | AI + Ece | Esneklik aralığı |
| `en_iyi_mevsim` | çoklu | §4.4 (boş = her mevsim) | İst. | AI | Takvim radarı |
| `onerilen_bolge_id` | FK | `bolgeler` | İst. | AI | Konaklama varsayılanı |
| İlgi profili, yürüme km, `onem` kapsamı | T | — | — | S | Puanlama |

### 3.5 Gezi günü (`gezi_gunleri`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden |
|---|---|---|---|---|---|
| `rol` | tekli | `cekirdek` · `secmeli` | Zor. | AI + **Ece** | Gün düşürme |
| `birlesebilir_ile` | gün sırası | aynı gezideki başka bir günün `sira`'sı | İst. | AI | Gün birleştirme |
| `yarim_gun_uygun` | bool | — | Zor. | AI | İlk/son gün |
| `arac_gerekli` | bool | — | Zor. | AI | Ulaşım şekli |
| `bolge_id` | FK | `bolgeler` | İst. | S önerir | Bölge seçimi |
| `kisa_anlati` | metin ≤ 240 | — | Zor. | AI | Uyarlanmış pakette gün kartı |
| Hava bağımlılığı, tempo doluluğu, yürüme km | T | — | — | S | B planı, tempo |

### 3.6 Gezi durağı (`gezi_duraklari`)

| Alan | Tür | İzin verilen değerler | Zor. | Kim | Neden |
|---|---|---|---|---|---|
| `yer_id` | FK | `yerler` | Zor. | S (yükleme) | Etiket yerden gelir (§6.4) |
| `rol` | tekli | `zorunlu` · `secmeli` · `yedek` | Zor. | AI | Tempo; B planı (`yedek` gün akışında yok, B planında aday) |
| `sure_dk` | dakika | mevcut kural (15–480) | Zor. | AI (bugünkü gibi) | Bu gezideki süre |
| `ogun` | tekli | §4.9 (yalnız yeme-içme durağında) | Zor.** | AI | Öğün yuvası |
| `yagmur_yedegi_yer_id` | FK | `yerler`, `ortam` ≠ `dis` | İst. | AI | Editörün seçtiği B planı (motorunkinden önce gelir) |

### 3.7 Kullanıcının isteği (bilgi amaçlı, Faz 1)

Editör doldurmaz; motorun girdisidir (`08` §4.1). Sözlükle aynı kodları kullandığı için burada: `ilgi` (≤ 3), `tempo`, `ulasim_sekli`, `butce_seviyesi`, `kime_uygun` (tekli: `kimle`), oda düzeni, indirimler (§4.14). Gizli bütçe tavanı üye başına ayrı tutulur, yalnız sahibi ve motor okur.

### 3.8 Paket için hazır şehir (asgari set)

Bir şehir aşağıdakiler tamamlanınca paket motoruna açılır (BO'da "Paket hazır" rozeti):

- En az **25 yayında yer**, zorunlu etiketleri dolu; bunların en az **6'sı `ortam=ic`** (B planı havuzu) ve en az **6'sı yeme-içme** (`ogun` dolu).
- En az **1 gezi**, gezi/gün/durak zorunlu etiketleri dolu; `gun_min < gun_max`.
- En az **2 bölge**, otel fiyat bandı (3 seviye) dolu.
- Şehir maliyet tabloları dolu ve **≤ 90 gün** eski.
- En az bir çıkış noktasından (İstanbul, Ankara, İzmir) rota satırı.
- `onem=3` sayısı ≤ 8.

---

## 4. Değer listeleri

Ekrandaki ad parantez içinde. Tanım, editörün tereddüt ettiği yerde karar kuralıdır.

### 4.1 `ilgi` (≤ 3, ilk birincil)

| Kod | Ad | Ne zaman |
|---|---|---|
| `tarih` | Tarih | Tarihî yapı, ören yeri, tarihî doku (müze değilse) |
| `mimari` | Mimari | Mimarisi için gidilen yapı ya da sokak (modern dahil) |
| `muze` | Müze | Koleksiyonu olan müze |
| `sanat_kultur` | Sanat ve kültür | Galeri, sergi, sahne, sokak sanatı, kültür merkezi |
| `inanc` | İnanç yerleri | Cami, kilise, sinagog, türbe, tekke |
| `doga` | Doğa | Park, orman, göl, nehir kıyısı, bahçe |
| `manzara` | Manzara | Seyir noktası, panorama; "fotoğraf" ihtiyacı buradan |
| `yeme_icme` | Yeme-içme | Restoran, meyhane, kafe, yöresel lezzet, pastane |
| `alisveris` | Alışveriş | Çarşı, dükkan, el sanatı satışı, AVM |
| `yerel_yasam` | Yerel yaşam | Pazar, mahalle, esnaf, gündelik ritim |
| `gece_hayati` | Gece hayatı | Bar, canlı müzik, geç saate açık |
| `aktivite` | Aktivite | Atölye, tadım, tekne, bisiklet, spor, macera |

### 4.2 `tempo_yuku`

| Kod | Ad | Ne zaman |
|---|---|---|
| `1` | Hafif | Oturarak ya da kısa yürüyüşle; ≤ 1 km iç yürüme, merdiven yok denecek kadar az |
| `2` | Orta | Ayakta 1–2 saat, düz zeminde dolaşma |
| `3` | Yorucu | Uzun yürüme (ören yeri, büyük park), yokuş/merdiven, 2 saatten uzun ayakta |

### 4.3 Zaman dilimleri (`en_iyi_zaman`, `kacin_zaman`)

| Kod | Ad | Aralık |
|---|---|---|
| `sabah` | Sabah | 08–11 |
| `oglen` | Öğlen | 11–14 |
| `ikindi` | İkindi | 14–17 |
| `gun_batimi` | Gün batımı | Gün batımının ±1 saati (tarihe göre hesaplanır) |
| `aksamustu` | Akşamüstü | 17–19 |
| `aksam` | Akşam | 19–22 |
| `gece` | Gece | 22 sonrası |

### 4.4 Mevsim (`mevsim_kisit`, `en_iyi_mevsim`)

`ilkbahar` (Mar–May) · `yaz` (Haz–Ağu) · `sonbahar` (Eyl–Kas) · `kis` (Ara–Şub).

### 4.5 Uygunluk (`cocuk_uygun`, `bebek_arabasi`, `erisilebilir`)

| Kod | Ad | Ne zaman |
|---|---|---|
| `evet` | Uygun | Kaynakla doğrulanmış |
| `kismen` | Kısmen | Bir bölümü uygun (giriş katı, rampa var ama üst kat merdiven) |
| `hayir` | Uygun değil | Kaynakla doğrulanmış |
| *(boş)* | Bilinmiyor | Kaynak yoksa her zaman boş |

### 4.6 `rezervasyon`

`gerekmez` · `onerilir` (hafta sonu/sezonda dolabiliyor) · `zorunlu` (randevusuz girilmiyor).

### 4.7 `fiyat_seviyesi` (yalnız yeme-içme ve alışveriş; **bizim**, Google'ınki değil)

| Kod | Ad | Tanım |
|---|---|---|
| `1` | Ekonomik | Şehrin `yemek × ekonomik` bandında ya da altında |
| `2` | Orta | `orta` bandında |
| `3` | Üst | `konforlu` bandında |
| `4` | Özel | Bandın belirgin üstünde (fine dining, özel gün) |

Bantlar şehrin maliyet tablosundan gelir; seviye mutlak tutar değil, şehre göredir.

### 4.8 `onem`

| Kod | Ad | Tanım | Sınır |
|---|---|---|---|
| `3` | İkon | Şehre gelip görmeden dönülmez | Şehir başına ≤ 8 |
| `2` | Güçlü | Çoğu ziyaretçiye önerilir | — |
| `1` | İlgiye göre | İlgisi olana değer | — |

### 4.9 `ogun`

`kahvalti` · `ogle` · `aksam` · `ara` (kahve, tatlı, atıştırma) · `gece`.

### 4.10 Bölge `karakter` (≤ 2)

`tarihi_doku` · `canli_merkez` · `sakin_yerlesim` · `sahil` · `is_merkezi` · `ogrenci_canli` · `doga_kenari`.

### 4.11 `pin_kategori`

Bugünkü harita kategorileriyle aynı (`src/lib/pinIkonu.ts`): `gezilecek` · `muze` · `ibadet` · `yemek` · `kafe` · `park` · `manzara` · `alisveris`.

### 4.12 Gezi `tarz` (≤ 2)

| Kod | Ad | Tanım |
|---|---|---|
| `ilk_kez` | İlk kez gidene | Şehrin klasikleri, `onem=3` yoğun |
| `tekrar_gelen` | Tekrar gidene | Klasikler dışı, mahalle ve yerel |
| `kultur_tarih` | Kültür ve tarih | Müze, tarih, mimari ağırlıklı |
| `lezzet` | Lezzet | Omurgası yeme-içme |
| `doga_kacamak` | Doğa kaçamağı | Doğa ve manzara ağırlıklı |
| `yavas_keyif` | Yavaş ve keyifli | Rahat tempo, uzun oturmalar |
| `aktif_kesif` | Aktif keşif | Yoğun tempo, aktivite |
| `gece_eglence` | Gece ve eğlence | Akşam ve gece programı ağırlıklı |

### 4.13 `kime_uygun` (≤ 3)

`arkadas` · `cift` · `aile_cocuk` · `bebekli` · `tek`.

### 4.14 Kullanıcı indirimleri (profil)

`muzekart` · `ogrenci` · `ileri_yas` (65+) · `sehir_karti` (şehre özel ulaşım kartı).

### 4.15 Kaynak türleri (`etiket_meta.kaynak`, `maliyet_tahminleri.kaynak`)

| Kod | Ad | Etiket için | Maliyet (₺) için |
|---|---|---|---|
| `resmi` | Resmî kaynak (kurumun sitesi, belediye, Bakanlık) | ✓ | ✓ |
| `osm` | OpenStreetMap | ✓ (konum, `opening_hours`, erişilebilirlik etiketi) | — |
| `yerinde` | Ece/ekip gözlemi | ✓ | ✓ |
| `tedarikci_ornegi` | Tedarikçide görülen örnek fiyatlar (tarih + örnek sayısı) | — | ✓ (otel bandı, rota) |
| `kullanici_toplu` | Uygulamadaki gerçekleşen harcamaların anonim toplamı | — | ✓ (Faz 1+) |
| `ai_cikarim` | AI'ın metinden/kaynaktan çıkarımı, doğrulanmamış | ✓ (işaretli) | **✗ yasak** |

---

## 5. Kaynak, güven ve yaşlanma

- Her etiketin `etiket_meta` kaydı: `{ "alan": { "kaynak": "resmi", "tarih": "2026-10-14", "onay": "ece" } }`.
- `ai_cikarim` kaynaklı etiket BO'da **"tahmin"** rozetiyle görünür; Ece onaylayınca rozet kalkmaz, `onay` alanı dolar (kaynak dürüstlüğü korunur).
- **Yaşlanma:** `kapali_gunler` ve bilet aralığı 12 ay; şehir maliyet tabloları 90 gün; otel bandı 90 gün (sezon çarpanıyla). Süresi dolan satır BO'da uyarı verir; motor güvenini bir seviye düşürür.
- **Güvenin motora etkisi:** `ai_cikarim` + onaysız etiket motorda yalnız yumuşak puanlamada kullanılır, sert kısıtta kullanılmaz (bebek arabası "evet" diye AI tahmini, bebekli kullanıcıyı merdivene göndermemeli).

---

## 6. Veri modeli önerisi (migration değil)

### 6.1 Etiketler nerede: sütun mu, ayrı tablo mu, jsonb mi?

| Seçenek | Artı | Eksi | Karar |
|---|---|---|---|
| **Tipli sütun + check** | Doğrulama veritabanında; BO formu basit; motor tek sorguda okur; indeks kolay | Yeni boyut migration ister | **Tekli kapalı alanlar için** (`tempo_yuku`, `ortam`, `onem`, `rol` …) |
| **`text[]` sütun + uzunluk sınırı + sözlük denetimi** | Çok değerli kısa listeler; GIN indeksiyle `&&` (örtüşme) sorgusu | Değer denetimi tetikleyici ister | **Çok değerli alanlar için** (`ilgi`, `en_iyi_zaman`, `mevsim_kisit`, `kime_uygun`, `tarz`, `kapali_gunler`) |
| Ayrı tablo (EAV: nesne, boyut, değer) | Esnek; yeni boyut migration'sız | Motor her yer için pivot yapar; tip zayıf; BO formu karmaşık; **etiket patlamasını kolaylaştırır** | Hayır |
| jsonb değer | Esnek | Doğrulama yok; AI editörün serbest değer kaçırması kolay; indeks zayıf | **Yalnız meta için** (`etiket_meta`) |

**Gerekçe:** Bu sözlük bilerek kapalı. Yeni boyut eklemenin migration gerektirmesi bir eksi değil, istenen frendir: boyut ancak bu belgeye PR'la girer. Değerler ise `sozluk` tablosunda yaşar; BO etiket adlarını oradan okur, tetikleyici sütundaki değerleri oradan denetler.

**`sozluk` tablosu:** `boyut` · `kod` · `ad_tr` · `aciklama` · `sira` · `aktif`. Kod silinmez, `aktif=false` olur (eski satırlar bozulmaz). Aynı sütun adı farklı nesnelerde farklı anlam taşıyorsa boyut adı nesne önekiyle tutulur: gündeki `rol` → `gun_rol`, duraktaki `rol` → `durak_rol`.

### 6.2 Yeni tablolar

| Tablo | Alanlar (özet) | Neden ayrı |
|---|---|---|
| `bolgeler` | `sehir_id`, `ad`, `merkez_lat/lng`, `yaricap_m`, `karakter[]`, `aksam_karakteri`, `aile_uygun`, `otopark`, `onerilen_kime[]`, `konum_kaynagi`, `osm_id`, `yayin`, `etiket_meta` | Şehir ile yer arasındaki yeni nesne; otel seçiminin birimi |
| `ulasim_noktalari` | `sehir_id`, `tur` (`havalimani` · `otogar` · `gar` · `iskele`), `ad`, konum, `kod` (IATA vb.), `emanet`, `merkeze_dk` (T) | Varış/dönüş ve yarım gün |
| `rotalar` | `cikis` (çıkış noktası kodu), `varis_sehir_id`, `mod` (`otobus` · `tren` · `ucak` · `araba`), `sure_dk_min/max`, `mesafe_km` (araba), `aktarma`, `siklik` (`sik` · `orta` · `seyrek`), `etiket_meta` | Şehirlerarası ulaşım seçimi |
| `maliyet_tahminleri` | `konu_tur`, `konu_id`, `seviye`, `ogun`, `min_kurus`, `max_kurus`, `birim`, `kaynak`, `kaynak_notu`, `dogrulama_tarihi`, `gecerlilik_gun`, `onay` | Aşağıda |
| `etiket_onerileri` | `hedef_tur`, `hedef_id`, `alan`, `deger` (jsonb), `kaynak`, `gerekce` (≤ 200), `durum` (`bekliyor` · `onaylandi` · `reddedildi`), `olusturan`, tarih | AI editörün yayındaki satırlara dokunmadan öneri bırakması (§7.6) |
| `sozluk` | §6.1 | Kapalı listeler |

**`maliyet_tahminleri.konu_tur` değerleri:** `yer_bilet` (kişi) · `bolge_otel` (oda-gece; seviye) · `sehir_yemek` (kişi-öğün; seviye × öğün) · `sehir_toplu_binis` · `sehir_taksi_acilis` · `sehir_taksi_km` · `sehir_otopark` (gün) · `nokta_transfer` (ulaşım noktası → merkez, mod başına) · `rota_bilet` (kişi; mod) · `rota_kopru_otoyol` (araç) · `ulke_yakit` (litre).

**Neden ayrı tablo:** fiyat bir özellik değil gözlemdir: yaşlanır, kaynağı ve tarihi vardır, geçmişi kalibrasyon için gerekir (eski satır silinmez, yenisi eklenir). Sütunda tutulsa her güncelleme geçmişi siler. Tutarlar bugünkü `harcamalar` gibi **kuruş** (bigint).

### 6.3 Mevcut tablolara eklenecekler

| Tablo | Eklenecek |
|---|---|
| `sehirler` | `ideal_gun_min/max`, `en_iyi_aylar[]`, `sezon_carpani` (12 sayı), `arac_ihtiyaci`, `toplu_tasima_karti`, `etiket_meta` |
| `yerler` | §3.3'teki sütunlar; `bolge_id`; `konum_kaynagi`, `osm_id` |
| `geziler` | `tarz[]`, `kime_uygun[]`, `tempo`, `ulasim_sekli`, `butce_seviyesi`, `gun_min/max`, `en_iyi_mevsim[]`, `onerilen_bolge_id`, `etiket_meta` |
| `gezi_gunleri` | `rol`, `birlesebilir_ile`, `yarim_gun_uygun`, `arac_gerekli`, `bolge_id`, `kisa_anlati` |
| `gezi_duraklari` | `yer_id`, `rol`, `ogun`, `yagmur_yedegi_yer_id` |
| `harcamalar` | (karar bekliyor, `08` §11 S7) `kategori`'ye `ulasim_sehirlerarasi` |

### 6.4 `gezi_duraklari` → `yerler` bağı

**Öneriye katılıyorum; Faz 0'ın en değerli adımı.** Bugün durak ad, place_id, kategori ve konumu kopyalıyor; bir yerin etiketi değişince her gezide ayrı güncellemek gerekir ve gezi parçalardan kurulamaz.

1. `gezi_duraklari.yer_id` eklenir (önce boş bırakılabilir).
2. Mevcut satırlar `place_id` eşleşmesiyle doldurulur. Dikkat: içerik hattı yalnız **rehberi olan** duraklar için `yerler`'de taslak satır açıyor; seed gezisi `eskisehir-iki-gun`'ün duraklarında ve seed `yerler` satırlarında `place_id` boş. Bu yüzden ikinci adım ad + konum yakınlığıyla eşleştirme (≤ 100 m, aynı şehir); kalanlar BO'da elle bağlanmak üzere listelenir, gerekirse taslak yer satırı açılır.
3. İçerik hattının yükleme işlevi `yer_id`'yi yazar; BO gezi editörü durağı yer seçerek ekler.
4. Uygulama durak adını ve kategorisini yerden okur hale gelince kopyalanan sütunlar bir sürüm sonra kaldırılır (bugünkü `hotel_*` kaldırma pratiği gibi).
5. Taslak yer satırı yayında bir gezinin durağı olamaz: gezi yayınlanırken bağlı yerlerin yayında olması denetlenir.

### 6.5 Google koşulları ve konum (Faz 0'da düzeltilmeli)

- Google'ın hizmet koşullarına göre place_id süresiz, **enlem/boylam en çok 30 ardışık gün** saklanabilir ([koşullar §B.14.3](https://cloud.google.com/maps-platform/terms/maps-service-terms)).
- Bugün `yerler.lat/lng`, `gezi_duraklari.lat/lng` ve `sehirler.lat/lng` yükleme anında Google'dan alınıp **süresiz** tutuluyor (`07` §1 ve §4; tablolar `20261012000000_icerik_sehirler_yerler`, `20261013000000_geziler_kaydedilenler`). `icerik_mekan_bilgileri` işlevinin başlık yorumu konumu "saklanmasına izin verilen alan" sayıyor; bu yorum da düzeltilmeli.
- **Öneri:** Konum kaynağı **OSM** olur. İçerik hattı OSM adayını zaten konumuyla alıyor (`07` araştırma akışı 1–3); bu konum ODbL'le saklanabilir (atıf zorunlu). `konum_kaynagi = osm` ve `osm_id` yazılır. OSM'de olmayan yer için `elle` (Ece haritadan işaretler) ya da `google_30g` (30 günde bir yenilenir) kullanılır.
- `kategori` (Google birincil tipi) kalabilir; motor ve Keşfet **`pin_kategori`**'yi (bizim) kullanır.
- Kendi süre matrisimiz (`08` §4.10) de OSM konumuna dayanır.

---

## 7. AI editör talimatı

### 7.1 Kurallar

1. **Yalnız listedeki değer.** Listede yoksa alan boş kalır ve DOĞRULANACAKLAR'a satır girer. Yeni değer önermek gerekiyorsa teslim notuna "sözlük önerisi" yazılır; dosyaya girmez.
2. **Emin değilsen boş bırak.** Zorunlu bir alanı boş bırakmak yanlış doldurmaktan iyidir. Her boş zorunlu alan için DOĞRULANACAKLAR'a bir satır: `[Alan] · neden boş · nereden kontrol edilir`.
3. **Uygunluk alanları kaynaksız doldurulmaz.** `bebek_arabasi`, `cocuk_uygun`, `bebek_bakim` için kaynak (resmî site, OSM `wheelchair`/`stroller` etiketleri, resmî erişilebilirlik sayfası) gerekir. **`erisilebilir=evet` yalnız `resmi` ya da `yerinde` kaynakla** girilir; `ai_cikarim` ile asla.
4. **Kaynaksız maliyet yok.** ₺ tutar yalnız `resmi`, `yerinde`, `tedarikci_ornegi` kaynağıyla ve tarihle girilir. `ai_cikarim` ile ₺ tutar girilemez. Yeme-içmede `fiyat_seviyesi` menü ya da resmî sayfadan çıkarımla girilebilir, kaynağı `ai_cikarim` işaretlenir.
5. **Tahmini işaretle.** Kaynaktan doğrudan okunmayan her etiket `ai_cikarim`dır. "Gün batımında güzel" gibi yargılar da çıkarımdır.
6. **Google'dan türetme yok.** Araştırma akışındaki Google puanı ve yorum sayısı (`07` `arastir puan`) yalnız kısa liste seçiminde kullanılır; `onem`, `kalabalik` ya da `fiyat_seviyesi` bu sayılardan formülle türetilmez, saklanmaz. `onem` için dayanak: Wikipedia/Wikidata varlığı, resmî ziyaretçi istatistikleri, resmî tanıtım materyalinde öne çıkma ve editörün değerlendirmesi. Açılış saati ve kapalı gün Google'dan değil, resmî siteden ya da OSM `opening_hours`'tan.
7. **Sınırlara uy.** ilgi ≤ 3 (ilki birincil), en iyi zaman ≤ 2, kaçın ≤ 1, tarz ≤ 2, kime uygun ≤ 3, şehirde `onem=3` ≤ 8.
8. **Gezi esnekliğini editör belirler.** Her güne `rol` verilir; en az bir `cekirdek` gün. `gun_min` ile `gun_max` "bu gezi kaç güne inip kaç güne çıkabilir" sorusunun cevabıdır; inince hangi günlerin düşeceği `rol`'den okunabilmelidir. Birleşebilir gün çiftleri yalnız toplam süre 8 saati aşmıyorsa işaretlenir.
9. **Kaynak URL'leri dosyaya değil PR'a.** (`07` kuralı.) Dosyada yalnız kaynak türü ve tarih.

### 7.2 Plan dosyası: `surum: 2`

`icerik/geziler/<slug>.json`'a eklenenler (geri kalanı `07` §2 ile aynı):

```json
{
  "surum": 2,
  "gezi": {
    "slug": "eskisehir-hafta-sonu",
    "etiketler": {
      "tarz": ["ilk_kez", "kultur_tarih"],
      "kime_uygun": ["arkadas", "cift"],
      "tempo": "normal",
      "ulasim_sekli": "yuruyus",
      "butce_seviyesi": "orta",
      "gun_min": 2, "gun_max": 4,
      "en_iyi_mevsim": [],
      "onerilen_bolge": "odunpazari"
    }
  },
  "gunler": [
    {
      "baslik": "Odunpazarı",
      "etiketler": {
        "rol": "cekirdek",
        "birlesebilir_ile": null,
        "yarim_gun_uygun": true,
        "arac_gerekli": false,
        "kisa_anlati": "Eski evler, cam ve modern sanat; öğleden sonra Porsuk kıyısı."
      },
      "duraklar": [
        {
          "place_id": "ChIJ…", "ad": "…", "sure_dk": 75, "kapali_gunler": ["pazartesi"],
          "rehber": "odunpazari-modern-muze",
          "rol": "zorunlu", "ogun": null, "yagmur_yedegi": null
        }
      ]
    }
  ],
  "etiket_kaynaklari": {
    "g1.d1.kapali_gunler": "resmi"
  }
}
```

- `onerilen_bolge` ve `yagmur_yedegi` bölge slug'ı ve rehber adıyla anılır; yükleme kimliğe çevirir.
- Durağın `kapali_gunler` alanı bugünkü biçimden (`07`) geçiş için kalır; yükleme onu **yerin** alanına yazar (yayındaki yerde öneri açar). Veritabanında kapalı gün yalnız yerde tutulur (kural 2). Rehberi olan durakta doğruluk kaynağı `.etiket.json`'dur; ikisi çelişirse doğrulayıcı HATA verir.
- Varsayılan kaynak `ai_cikarim`'dır. `etiket_kaynaklari` yalnız kaynaktan doğrudan okunan alanları listeler (`resmi`, `osm`, `yerinde`); duraklar `g1.d1` biçimiyle anılır (`07` doğrulayıcı dili).

### 7.3 Yer etiketleri: rehberin yanında ayrı dosya

`icerik/yerler/<şehir>/<rehber>.etiket.json` (rehber `.md` dosyasına dokunulmaz; md doğrulayıcısı aynı kalır):

```json
{
  "place_id": "ChIJ…",
  "osm_id": "way/123456",
  "pin_kategori": "muze",
  "ilgi": ["sanat_kultur", "mimari"],
  "onem": 3,
  "tempo_yuku": 2,
  "ortam": "ic",
  "sure_min": 45, "sure_max": 120,
  "kapali_gunler": ["pazartesi"],
  "en_iyi_zaman": ["sabah"],
  "kacin_zaman": [],
  "mevsim_kisit": [],
  "cocuk_uygun": "evet",
  "bebek_arabasi": null,
  "erisilebilir": null,
  "giris": "ucretli",
  "rezervasyon": "gerekmez",
  "muzekart": false,
  "kalabalik": "orta",
  "bilet": { "min_tl": null, "max_tl": null, "kaynak": null, "tarih": null },
  "kaynaklar": {
    "kapali_gunler": "resmi",
    "giris": "resmi",
    "cocuk_uygun": "resmi"
  }
}
```

Bilet tutarı bilinmiyorsa `null` ve DOĞRULANACAKLAR'a satır; uydurulmaz.

### 7.4 Şehir dosyası (yeni)

`icerik/sehirler/<slug>.json`: şehir alanları (§3.1), bölgeler (§3.2), ulaşım noktaları, rotalar ve maliyet tabloları. Her maliyet satırı `{konu, seviye, ogun, min_tl, max_tl, birim, kaynak, tarih}`. Yeni iş akışı işlemi `sehir_yukle` (varsayılan kuru).

### 7.5 Doğrulayıcıya eklenecekler

| HATA | UYARI |
|---|---|
| Değer sözlükte yok | Zorunlu alan boş (DOĞRULANACAKLAR'da satırı olsa bile raporlanır) |
| Sınır aşımı (ilgi > 3 vb.) | Şehirde `onem=3` > 8 |
| ₺ tutar var ama `kaynak` ya da `tarih` yok | Maliyet tarihi 90 günden (bilet 12 aydan) eski |
| ₺ tutar kaynağı `ai_cikarim` | Yeme-içme durağında `ogun` yok |
| `erisilebilir=evet` ve kaynak `resmi`/`yerinde` değil | Gezide `cekirdek` gün yok |
| `sure_min > sure_max` · `gun_min > gun_sayisi` · `gun_max < gun_sayisi` | `birlesebilir_ile` çiftinin toplamı > 8 saat |
| Google alan adı (`rating`, `price_level`, `opening_hours`, `user_ratings_total`) etiket dosyasında | `ortam=dis` yerlerin oranı gezide > %80 ve iç mekan yedeği yok |
| `yagmur_yedegi` `ortam=dis` bir yer | Gün `kisa_anlati` > 240 karakter |

### 7.6 Yükleme davranışı

`07`'deki güvenlik kuralları aynen geçerli; eklenenler:

- **Taslak** yer/gezi satırına etiketler doğrudan yazılır.
- **Yayındaki** satıra etiket yazılmaz; her farklı alan için `etiket_onerileri`'ne `bekliyor` satırı açılır. Ece BO'da tek tek ya da toplu onaylar. Bu, bugünkü "yayındaki satıra dokunmaz" kuralının etiket karşılığıdır.
- Dönüş özetine eklenir: `etiket_yazilan`, `etiket_onerilen`, `zorunlu_bos`.

---

## 8. Faz 0 listesi (2–3 hafta, issue'ya dönüşecek)

Sıra bağımlılık sırasıdır. Boyut: S ≤ 1 gün · M 2–3 gün · L ≥ 4 gün.

| # | İş | Boyut | Bağımlı | Kabul ölçütü |
|---|---|---|---|---|
| F0-1 | **Sözlüğü onayla**; `00-kapsam` ilke #1'i `08` §0 K2'ye göre güncelle | S (Ece) | — | Bu belge `onaylandı`; değişiklikler PR'da |
| F0-2 | **`sozluk` tablosu + yerler/geziler/gezi_gunleri/gezi_duraklari etiket sütunları** (§6.3), değer denetimi tetikleyicisi, RLS testi | M | F0-1 | Sözlük dışı değer ve sınır aşımı veritabanında reddediliyor; `rls_test.sql` güncel |
| F0-3 | **`gezi_duraklari.yer_id`** + `place_id` ve ad + konumla geri doldurma + eşleşmeyenler listesi (§6.4) | M | F0-2 | Mevcut üç Eskişehir gezisinde (`eskisehir-iki-gun`, `eskisehirde-uc-gun`, `odunpazarindan-sazovaya-uc-gun`) tüm duraklar bağlı |
| F0-4 | **`bolgeler`, `ulasim_noktalari`, `rotalar`, `maliyet_tahminleri`, `etiket_onerileri`** tabloları + `sehirler`'in yeni sütunları (§6.3) | M–L | F0-2 | Admin yazar, uygulama yalnız yayındakini okur |
| F0-5 | **BO etiket paneli**: yer, gezi, gün, durak editörlerinde sözlükten çipler, "tahmin" rozeti, eksik zorunlu alan rozeti; etiket önerileri onay kutusu | L | F0-2, F0-4 | Ece bir yeri 2 dakikada etiketleyebiliyor; öneri tek dokunuşla onaylanıyor (kanvasta tasarım gerekir: BO1) |
| F0-6 | **BO bölge ve maliyet tablosu editörü** (basit form: merkez + yarıçap, karakter, fiyat bantları, kaynak, tarih) | M | F0-4 | Eskişehir için 2–3 bölge girilebiliyor (kanvas: BO2, BO3) |
| F0-7 | **İçerik hattı v1.2**: plan dosyası `surum: 2`, `.etiket.json`, şehir dosyası, doğrulayıcı kuralları (§7.5), yükleme davranışı (§7.6), `07` belgesinin güncellenmesi | L | F0-2, F0-4 | Kuru yükleme yeni kuralları raporluyor; yayındaki satıra yalnız öneri düşüyor |
| F0-8 | **Konum kaynağı**: yeni yerlerde OSM konumu + `osm_id`; mevcut satırların OSM'ye taşınması ya da 30 günlük yenileme; OSM atfı; `icerik_mekan_bilgileri` yorumunun düzeltilmesi | M | F0-2 | Süresiz tutulan Google koordinatı kalmıyor (§6.5) |
| F0-9 | **Eskişehir pilotu**: mevcut 2 gezi + yerleri + 2–3 bölge + şehir maliyet tabloları AI editörle etiketlenir, Ece onaylar | M (içerik) | F0-5, F0-7 | §3.8 asgari setin Eskişehir'de durumu raporlanıyor; yer başı etiketleme süresi ve AI önerisi onay oranı ölçülmüş |
| F0-10 | **Harcamadan anonim maliyet toplama**: şehir × kategori × kişi başı × gün, yalnız toplu; gizlilik metni güncellemesi | S–M | — | BO'da şehir bazında toplu tablo; **10 seyahatten az hücre gösterilmez** (tek bir grup tanınmasın) (`08` §5.6) |
| F0-11 | **Avukata soru listesi** (`08` §6.5) | — (Ece) | — | Görüşme tarihi belli |

**Süre notu:** Boyutların toplamı yaklaşık 25 geliştirici günü; kritik yol F0-2 → F0-4 → F0-5 / F0-7 → F0-9 yaklaşık 13 iş günü. 2–3 hafta, bugünkü gibi iki paralel geliştirici oturumuyla (uygulama/veri + BO) gerçekçi; tek oturumla 4–5 hafta. Sıkışırsa ilk kesilecek: F0-6 (bölge ve maliyet tabloları geçici olarak `supabase-sql` yerine şehir dosyasıyla yüklenir) ve F0-10.

**Faz 0'ın kapsamı dışında kalanlar** (bilinçli): uygulama ekranları, paket motoru, kendi süre matrisi (Faz 1 başı; karar `08` §11 S9), canlı fiyat.

**Faz 0 sonunda ölçülecekler:** zorunlu etiket doluluk oranı (Eskişehir), yer başına etiketleme süresi (AI + onay), AI önerilerinin değiştirilmeden onaylanma oranı, şehir başına içerik maliyeti (Google isteği + Ece'nin süresi). Bu dört sayı Faz 1'in takvimini belirler.
