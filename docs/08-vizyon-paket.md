# Vizyon: uçtan uca gezi paketi

Sürüm 0.1 · 14 Ekim 2026 · Sahip: Ece (ürün) · Durum: **taslak, ürün incelemesinde** · Eş belge: [`09-etiket-sozlugu.md`](09-etiket-sozlugu.md)

> **Bir cümlede:** Kullanıcı "ne zaman, nereden, kaç kişi, nasıl bir gezi, ne kadar" der; uygulama ona gidiş-dönüşü, kalacağı semti, saat saat programı ve **dürüst bir kişi başı toplamı** (aralık + güven + kaynak) olan bir paket önerir. Paket kabul edilince bugünkü seyahat nesnesine dönüşür: plan, harita, sohbet ve bütçe hazır gelir. Gezi bitince tahminimizin ne kadar tuttuğunu kullanıcıya ve kendimize söyleriz.

Bu belge ideal ürünü tarif eder. Fizibilite ve hukuk ayrı bölümlerdedir (§4.9, §6); ideal ürünü kısıtlamaz, yalnız hangi sırayla yapılabileceğini söyler (§10). Kod, migration ve ekran tasarımı içermez.

---

## 0. Kararlar, varsayımlar, terimler

**Ece'nin 14 Ekim kararları (bu belgenin temeli):**

| # | Konu | Karar | Sonucu |
|---|---|---|---|
| K1 | Coğrafya | Önce yurt içi, sonra yurt dışı | Ulaşım: otobüs, YHT/tren, uçak, kendi arabası. Para birimi ₺. Faz 1–3'te yalnız Türk hukuku; AB hukuku Faz 4'te (§6.4). |
| K2 | Yapay zeka ilkesi | **Motor önerir, kullanıcı onaylar** | `00-kapsam` ilke #1 güncellenmeli. Önerilen yeni metin: *"Sistem önerir, kullanıcı karar verir. Motor paketi yalnız onaylı içeriğimizden kurar, her seçimini gerekçesiyle gösterir; kullanıcı her parçayı değiştirebilir ve kabul etmeden hiçbir şey seyahate yazılmaz."* |
| K3 | Tedarikçiler | Türk OTA'lar diğer adaylarla aynı ölçütle değerlendirilir | §6.1 tablosu |
| K4 | Grup çıkışı | Gruptaki herkes **aynı yerden** çıkar | Motor tek gidiş-dönüş grubu kurar. Kişi başı fark yalnız oda düzeninden ve kişiye özel isteğe bağlı kalemlerden doğar (§3.5). |

> **K2'nin dokunduğu diğer yerler:** `00-kapsam` §5 "Kapsam dışı" (yapay zekayla plan üretimi, ödeme/premium, rezervasyon ve komisyon), §7 ("Yapay zeka: v1'de yok") ve ilke #5 de bu belgeyle birlikte güncellenmeli. Ayrıca PRD §5.3 tempo etiketini (Rahat/Normal/Yoğun) 5 Ekim'de arayüzden kaldırmıştı; paket akışı tempoyu kullanıcıya **seçim** olarak geri getiriyor (§3.2). Kodlar PRD'yle aynı: `rahat` · `normal` · `yogun`.

**Varsayımlar** (ürün tarafı onaylamadıkça geçerli):

- **V1** Kullanıcının söylediği bütçe **kişi başı toplamdır, ulaşım dahil**. Kullanıcı rakam bilmiyorsa üç seviyeden birini seçer: ekonomik · orta · konforlu.
- **V2** "Yürüyerek mi, arabayla mı" sorusu **şehir içi** hareketi anlatır. Şehirlerarası ulaşım ayrı seçilir. Kendi arabasıyla giden, şehir içinde de arabalı sayılır (otopark maliyeti girer).
- **V3** Paket yalnız **kapsadığımız şehirler** için kurulur: onaylı yerleri, bölgeleri ve maliyet tabloları olan şehirler. Kapsanmayan şehir için "henüz yok, haber verelim" denir ve talep sayılır.
- **V4** Faz 1'in çıkış şehirleri İstanbul, Ankara, İzmir'dir. Diğer çıkışlar "kendi arabam" seçeneğiyle her yerden çalışır.
- **V5** Gece konaklamalı, 1–5 gecelik şehir gezisi. Tur, kruvaziyer, yayla evi gibi biçimler kapsam dışı.

**Terimler:**

| Terim | Anlamı |
|---|---|
| **Paket** | Bir isteğe verilen öneri: ulaşım + konaklama bölgesi (Faz 2'de otel) + program + maliyet. Kabul edilmeden önce geçicidir. |
| **Bileşen** | Paketin dört parçası: ulaşım, konaklama, program, maliyet. |
| **İskelet** | Paketin dayandığı hazır gezi (ya da gün modülleri birleşimi). |
| **Gün modülü** | Bir hazır gezinin tek günü; başka paketlerde de kullanılabilen birim. |
| **Takas** | Paketin tek bir boyutta değiştirilmiş hali ve bedeli ("oteli merkeze al: +X ₺, günde −50 dk yol"). |
| **Güven** | Bir rakamın ne kadar sağlam olduğu: canlı fiyat > güncel tahmin > eski tahmin. Üç seviye: yüksek · orta · düşük. |

---

## 1. Rakip ve boşluk taraması

**Bu bölüm neye karar verdiriyor:** Hangi işte yarışmadığımızı (uçak/otel fiyatı, genel AI sohbeti) ve hangi boşluğa yerleştiğimizi.

Tarama 14 Ekim 2026'da yapıldı. Her satırın kaynağı tabloda. Doğrulanamayan noktalar en sonda.

### 1.1 AI gezi planlayıcıları

| Ürün | Bugün ne yapıyor | Eksik bıraktığı |
|---|---|---|
| [Mindtrip](https://mindtrip.ai/) | Haritalı sohbet planlayıcı; uçak, konaklama ve restoran rezervasyonu; grup sohbetinde herkesin tercihini tek plana birleştiriyor ([fon + grup sohbeti](https://www.phocuswire.com/mindtrip-secures-12m-funding-launches-group-chat)). Haziran 2026'da Avrupa'ya açıldı, turizm kurullarına beyaz etiket satıyor ([duyuru](https://mindtrip.ai/press/mindtrip-expands-to-europe)). | Kişi başı toplam gezi maliyeti yok, harcama bölüşme yok, Türkiye içeriği yok. |
| [Layla](https://layla.ai/) | AI taslak + insan danışman + rezervasyon; gece başı yüksek bütçe hedefliyor. **31 Temmuz 2026'da Expedia satın aldı** ([Expedia](https://ir.expediagroup.com/news-and-events/news/news-details/2026/Expedia-Group-acquires-Layla-accelerating-its-AI-powered-trip-planning-and-booking-strategy/default.aspx)). | Danışman ağırlıklı, pahalı; grup kararı ve bölüşme yok. |
| [Trip Planner AI](https://tripplanner.ai/) | Uçak + otel + etkinlikli plan, plana göre yeniden hesaplanan bütçe tahmini, gerçek zamanlı grup planlama; rezervasyon Skyscanner / Booking / GetYourGuide bağlantısıyla. | Bütçe tek rakam (aralık ve güven yok); planlanan ile harcanan izlenmiyor. |
| [Wonderplan](https://wonderplan.ai/) | Ücretsiz gün gün AI planı, konaklama önerisi, PDF. | Rezervasyon yok; bütçe yalnız girdi. |
| [GuideGeek](https://en.wikipedia.org/wiki/GuideGeek) | Messenger/Instagram'da AI seyahat sohbeti; turizm kurullarına beyaz etiket. | Plan nesnesi, grup, maliyet yok. |
| Google Gemini / AI Mode | Gemini, Maps verisiyle plan kuruyor ([Google](https://blog.google/products-and-platforms/products/gemini/how-gemini-plans-trips/)); ABD'de AI Mode içinde otel rezervasyonu 10 ortakla ([PhocusWire](https://www.phocuswire.com/news/technology/google-ai-mode-hotel-booking-agentic-flights-loyalty)). AI Mode **18 Şubat 2026'da Türkiye'de açıldı**, seyahat rezervasyon özellikleri burada yok ([Webrazzi](https://webrazzi.com/2026/02/18/google-ai-modu-ve-ai-bakisi-ozelliklerini-turkiye-de-de-kullanima-sunmaya-basladi/)). | Toplam gezi maliyeti, ortak seyahat nesnesi, bölüşme yok. En büyük tehdit: dağıtımı ve verisi var. |
| ChatGPT uygulamaları | Ekim 2025'ten beri Expedia ve Booking.com uygulamaları sohbet içinde canlı fiyat gösteriyor, ödeme ortağın sitesinde ([PhocusWire](https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor)); sohbet içi ödemeden geri adım atıldı ([AltexSoft](https://www.altexsoft.com/travel-industry-news/chatgpt-can-inspire-the-trip-but-otas-still-close-the-sale/)). | Plan bir sohbet dökümü, nesne değil; grup ve maliyet yok. |
| Booking.com / Expedia / Trip.com | Booking'in AI planlayıcısı konaklama merkezli ([Hospitality Net](https://www.hospitalitynet.org/news/4124415.html)); Expedia Romie grup SMS'inde plan öneriyordu ([TMR](https://travelmarketreport.com/RetailStrategies/articles/Expedia-Unveils-Romie-an-AI-Powered-Travel-Planner)); Trip.com TripGenie açılış saatlerini ve duraklar arası süreyi hesaba katıyor ([Gulf Business](https://gulfbusiness.com/en/2026/travel/trip-coms-siddharth-sudhakar-on-the-rise-of-agentic-travel/)). | Hepsi kendi envanterini satmak için planlıyor; şehirdeki toplam maliyet ve grup kararı yok. |
| [Wanderlog](https://wanderlog.com/trip-planner-mobile-app) | Ortak plan, renkli gün haritası, rota optimizasyonu, bütçe + harcama bölüşme, AI asistan. | Ulaşım + konaklama paketi yok; bütçe elle girilir, tahmin edilmez; editör gezisi yok; kalabalık arayüz. |

### 1.2 OTA paketleri ve dinamik paket

| Ürün | Bugün ne yapıyor | Eksik bıraktığı |
|---|---|---|
| [Expedia Packages](https://www.expedia.com/Vacation-Packages) | Uçak + konaklama + araç, kişi başı fiyat, üyeye indirim. | Program yok, şehirdeki maliyet yok. |
| [lastminute.com](https://www.lastminute.com/city-breaks) | Uçak + otel şehir kaçamağı, koruma sigortalı. | Program yok. |
| Wizz Holidays | 2 Temmuz 2026'da açıldı: uçak + otel + transfer, AI anahtar sözcük araması ([Cyprus Mail](https://cyprus-mail.com/2026/07/02/airline-introduces-ai-platform-for-holiday-planning)). | Program ve grup yok. |
| [Kiwi.com Nomad](https://www.kiwi.com/en/nomad) | Çok şehirli uçuşu en ucuz sıraya dizer. | Yalnız uçak. |
| Türk OTA'lar: [Enuygun](https://www.enuygun.com/otel/ucakli-paketler/), [Jolly Tur](https://www.jollytur.com/), [ETS Tur](https://www.etstur.com/), [Tatilbudur](https://www.tatilbudur.com/), [Setur](https://www.setur.com.tr/), [Obilet](https://www.obilet.com/), [Turna](https://www.turna.com/) | Uçak + otel paketleri (çoğu tatil köyü ve sahil odaklı), rehberli kültür turları (çoğu otobüsle, sabit kalkış), ayrı ayrı otobüs/uçak/otel satışı. | **Kendi başına gezilen şehir kaçamağı paketi yok.** Otobüs + otel paketi yok. AI planlama ve "nereye gidebilirim" araması yok. |

**Bugün Türkiye'de bir kullanıcı** yurt içi şehir kaçamağı için ya tatil köyü tarzı uçak + otel paketi alabiliyor ya da rehberli grup turuna katılabiliyor. Arada kalan, en yaygın davranış ("arkadaşlarla Eskişehir'e otobüsle gidip kendimiz gezelim") için hazır ürün yok.

### 1.3 Grup gezisi uygulamaları

| Ürün | Bugün ne yapıyor | Eksik bıraktığı |
|---|---|---|
| [Troupe](https://www.troupe.com/) | Tarih ve konaklama için oylama, yorum. | Bütçe, bölüşme, rezervasyon yok. |
| [SquadTrip](https://squadtrip.com/) | Organizatör için gezi satış sayfası, kapora/taksit. | Arkadaş grubu değil, gezi satan organizatör için. |
| [Splitwise](https://androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026) · [Tricount](https://tricount.com/) | Bölüşme, borç sadeleştirme, çoklu para birimi. | Plan yok; "planlanan" diye bir şey yok. |
| [Tripsy](https://tripsy.app/) · [Lambus](https://apps.apple.com/app/id1446178879) | Rezervasyon e-postasından plan, ortak belge, harcama. | Oylama ve maliyet tahmini yok. |
| [Howbout](https://finder.techleap.nl/news/feed/howbout-calendar-raises-8m-series-a) | Ortak takvim ve saat oylaması. | Gezi değil, genel takvim. |

**Hiçbiri oylama + kişi başı maliyet + harcama bölüşmeyi birleştirmiyor.** Troupe oylamayı, Splitwise bölüşmeyi yapıyor; ikisini aynı karar anında buluşturan yok.

### 1.4 Bütçe öncelikli arama ("her yere")

| Ürün | Bugün ne yapıyor | Konaklama ve şehirdeki maliyet dahil mi? |
|---|---|---|
| Skyscanner Everywhere + Savvy Search | Havalimanından en ucuz varışlar; AI ile 3 şehir önerisi ([TDN](https://www.traveldailynews.com/?p=364600)); 2026'da "Explore with AI" beta ([TDN](https://www.traveldailynews.com/technology/skyscanner-expands-ai-travel-planning-tools-and-live-flight-features/)) | Hayır, yalnız uçak |
| Google Flights Explore / Deals | Doğal dille uçuş fırsatı ([TravelPulse](https://www.travelpulse.com/news/technology/google-flights-introduces-new-ai-tool)) | Hayır |
| [Kayak Explore](https://www.kayak.com/explore) | Bütçe girip varış listesi | Yalnız uçak; AI Mode'da uçak + otel üst sınırı ([Globetrender](https://globetrender.com/2025/10/17/kayak-ai-mode-conversational-travel-search/)) |
| [Budget Your Trip](https://www.budgetyourtrip.com/) · [Numbeo](https://www.numbeo.com/cost-of-living/in/Istanbul) | Gezgin bildirimiyle günlük ortalama maliyet / fiyat kalemleri | Günlük maliyet var ama uçak, otel ve planla bağlı değil; güncel fiyatların gerisinde kalıyor |
| Türk OTA'lar | "Nereye gidebilirim" ya da bütçeden başlayan arama yok | — |

[Gezi bütçe hesaplayıcıları karşılaştırması (Mart 2026)](https://travelnoire.com/travel-budget-calculators) da aynı sonucu veriyor: konaklama, bilet ve şehir içi ulaşımı birlikte tahmin eden araç yok.

### 1.5 Kimsenin doldurmadığı boşluklar

1. **Dürüst kişi başı toplam.** Canlı ulaşım/otel fiyatını yemek, bilet ve şehir içi ulaşım **aralıklarıyla** birleştiren, kaynağını ve tarihini gösteren ürün yok.
2. **Planlanan ile harcanan.** Bölüşme uygulamaları elle yazılmış bütçeye göre izliyor; **tahmin edilmiş bir plana** göre değil.
3. **Uyarlanabilir editör gezisi.** AI sıfırdan üretiyor (kalite oynak), Layla pahalı danışman kullanıyor, Türk turları sabit. Editörün kurduğu gezinin kullanıcının gün sayısına, temposuna ve bütçesine göre esnemesi yok.
4. **Kişi başı farkla grup kararı.** Oylama ile maliyet aynı ekranda değil.
5. **Yurt içi şehir kaçamağı.** Otobüs/YHT + semt + program + toplam maliyet bir arada yok.

### 1.6 Neden farklıyız (tek paragraf)

Rakipler ya bir şey satmak için planlıyor (OTA'lar, Google, ChatGPT ortakları: fiyat doğru, ama yalnız sattıkları kalem için) ya da plan kurup parayı kullanıcıya bırakıyor (Wanderlog, AI planlayıcılar: plan var, maliyet tahmini yok ya da tek rakam). Tripmate'in vaadi ikisinin kesiştiği yerde: **editörün onayladığı bir gezi, kullanıcının gün sayısına, temposuna, ulaşımına ve bütçesine göre saniyeler içinde uyarlanıyor; her rakamın kaynağı, tarihi ve aralığı görünüyor; arkadaşlar bu paketi sohbette oylarken herkes kendi kişi başı payını görüyor ve kimse bütçesini açıklamak zorunda kalmıyor; kabul edilen paket doğrudan ortak seyahate dönüşüyor ve gezi sonunda "tahminimiz şu kadar tuttu" diyerek kendini sınıyor.** Bu, bir arama sonucu değil, gezinin başından sonuna kadar süren bir sözdür. Türkiye'de, Türkçe ve yurt içi şehir kaçamağında bunu yapan yok.

---

## 2. Kime, hangi iş için?

**Bu bölüm neye karar verdiriyor:** Faz 1'de hangi personayı **birincil** alacağımızı. Öneri: **Arkadaş grubu** (bugünkü ürünün çekirdeği) ve **çift**. Aile ve tek gezen Faz 1'de çalışır ama özel ayarları (§8 fikir 8) Faz 3'te gelir. İlk kez yurt dışı Faz 4'tür.

| Persona | Tipik gezi | Asıl dertleri | Paket ne çözer | Bizden ne ister |
|---|---|---|---|---|
| **Arkadaş grubu** (3–6 kişi, 24–35 yaş) | İstanbul'dan Eskişehir'e otobüsle 2 gece; Mardin'e uçakla uzun hafta sonu | Karar WhatsApp'ta dağılıyor; kimse bütçesini söyleyemiyor; "kim ne ödedi" gezi sonunda kavga; biri planı üstlenip yoruluyor | Tek paket kartı sohbette oylanır; gizli bütçe tavanı (§3.5); harcama hazır kurulu; plan kimsenin omzunda değil | Grup oylama, oda düzeni, kişi başı fark, gece hayatı / yeme-içme etiketleri |
| **Çift** (25–40) | Uzun hafta sonu, Kapadokya ya da Ayvalık, bütçe orta-üst | Hangi semtte kalınır; 20 sekmede otel karşılaştırma; sürpriz maliyet ("balon şu kadar mıymış") | Semt seçimi gerekçeli; toplam baştan belli; özel deneyimler isteğe bağlı kalem olarak görünür | Bölge karakteri (sakin/romantik), konfor seviyesi, rezervasyon gerekliliği |
| **Bebekli / çocuklu aile** | Arabayla 2–3 gece, yakın şehir | Tempo; bebek arabasıyla gidilemeyen yerler; öğle uykusu; otelden uzak kalmak; yorgun çocukla akşam yemeği | Program öğle uykusu penceresini ve bebek arabası uygunluğunu gözetir; otel duraklara yakın seçilir | Bebek arabası / çocuk uygunluğu, tempo yükü, en iyi saat, otopark |
| **Tek gezen** | Hafta sonu, ekonomik, YHT ya da otobüs | Güvenli ve merkezi semt; akşam ne yapılır; yalnız yemek; tek kişilik oda pahalı | Semt güvenlik/canlılık karakteriyle seçilir; akşam programı "tek gezen için uygun" yerlerden | Bölge karakteri, akşam uygunluğu, ekonomik seviye |
| **İlk kez yurt dışı** *(Faz 4)* | Avrupa'da 3–4 gün | Vize, döviz, havalimanından şehre ulaşım, dil, kart geçer mi | Transfer ve günlük maliyet ₺ karşılığıyla; "ilk saat" rehberi | Havalimanı transferi, döviz, ödeme ipuçları |

---

## 3. Kullanıcı yolculuğu, uçtan uca

**Bu bölüm neye karar verdiriyor:** Her adımda **tek** bir tasarım kararı. Öneriler **kalın**, seçenekler yanında.

### 3.1 İlham

- **Ne olur:** Ana sayfada üç giriş: (a) bugünkü "Önerilen geziler", her kartın altında artık "senin şehrinden kişi başı ~X–Y ₺"; (b) **"Bu hafta sonu nereye?"** kartı: tarih ve bütçe seçilince kapsadığımız şehirler kişi başı aralıkla sıralanır; (c) "Paket kur" düğmesi.
- **Sihirli an:** Kullanıcı hiçbir şey yazmadan kendi şehrinden gidilebilecek 3 şehri, kapıdan kapıya süresi ve kişi başı aralığıyla görür: *"Eskişehir · YHT 1 sa 45 dk · 2 gece · kişi başı 4–5,5 bin ₺"* (rakamlar örnek).
- **Karar:** Ana sayfa yeniden mi kurulsun? **Hayır; mevcut gezi kartlarına fiyat satırı eklenir, bütçe kartı tek bir bölüm olur.** Kapsanan şehir sayısı 8'in altındaysa bütçe kartı gösterilmez (boş görünür, güven kaybettirir).

### 3.2 İstekleri anlatma

- **Ne olur:** 5 kısa adım, her biri tek dokunuş: (1) nereden + kaç kişi + kimle; (2) tarih (ya da "esnek: ekim sonunda bir hafta sonu"); (3) tarz: en çok 3 ilgi çipi; (4) şehir içinde yürüyüş mü araba mı + tempo; (5) bütçe: rakam ya da seviye. Son ekranda isteğe bağlı bir kutu: *"Eklemek istediğin bir şey var mı?"*
- **Sihirli an:** Serbest metin ("annem de geliyor, çok yürüyemiyor, bir akşam güzel bir balık restoranı olsun") anında **çiplere** dönüşür: `tempo: rahat` · `yürüme: az` · `yemek: balık, 1 akşam özel`. Kullanıcı yanlış anlaşılanı çipten siler. Ne anladığımızı gösteririz, sessizce uygulamayız.
- **Karar:** Soru-cevap mı serbest yazı mı? **İkisi: soru-cevap zorunlu omurga, serbest yazı isteğe bağlı ekleme.** Gerekçe: soru-cevap motorun ihtiyacı olan yapılandırılmış girdiyi garanti eder ve ürün tonuna (sade, yönlendiren) uyar; serbest yazı "aklımdakini söyleyeyim" ihtiyacını karşılar ama yalnız çipe dönüşebildiği kadar etkili olur. Yalnız serbest yazı (ChatGPT tarzı) eksik girdi ve uydurma riski taşır.
- **Ön dolum:** Kullanıcı bir hazır geziden ya da mevcut seyahatinden geliyorsa şehir ve tarih dolu gelir; sihirbaz 2–3 adıma iner.

### 3.3 Paket önerisi

- **Ne olur:** 3–5 saniye içinde **1 önerilen paket + 2 alternatif**. Önerilen paket tam kart; alternatifler yalnız **farkı** gösterir: *"B: Odunpazarı yerine Bağlar'da kal · kişi başı −900 ₺ · günde +20 dk yol"*.
- **Sihirli an:** Her bileşenin altında tek satır gerekçe: *"Bu semti seçtim: 3 günün durakları ortalama 12 dk yürüme mesafesinde, bütçene uyan oteller burada yoğun."* Toplam: *"Kişi başı ~6.200 ₺ (5.400–7.300) · güven: orta · fiyatlar 14 Eki"*.
- **Karar:** Tek paket mi, üç mü? **1 + 2, ve alternatifler tek boyutta farklı.** Gerekçe: üç tam paket karşılaştırması yorucu (Wanderlog kalabalığı); tek paket "başka ne vardı?" sorusunu bırakır. Tek boyutta fark (bölge, ulaşım ya da seviye) karşılaştırmayı bir bakışa indirir.

### 3.4 Pazarlık / ince ayar

- **Ne olur:** Paketin altında **takas kartları** (3–6 adet), her biri gerçek, hesaplanmış bir değişiklik:
  - *"Oteli merkeze al · +2.400 ₺ · günde −50 dk yol"*
  - *"Gece otobüsüyle git · −1 gece otel · ilk gün yorgun başlar"*
  - *"3. günü çıkar · −1.300 ₺ · Sazova atlanır"*
  - *"Daha rahat tempo · 2 durak yedeğe iner"*
- Kullanıcı ayrıca bir bileşeni **kilitler** ("bu oteli istiyorum") ve gerisini yeniden kurdurur, ya da Plan'da durak ekler/çıkarır; toplam canlı değişir.
- **Sihirli an:** Her takas kartında üç sayı aynı dilde: **kişi başı ₺ · şehirde geçen saat · günlük yol süresi**. Kullanıcı parayla zamanı ilk kez aynı terazide görür.
- **Karar:** Kaydırıcı mı kart mı? **Kart.** (Ürün ekibinin #2'sine yanıt, §12.) Kaydırıcı sürekli bir uzay vaat eder ama seçenekler kesiklidir: "konfor %60" diye bir otel yoktur. Her kart motorun gerçekten kurabildiği bir pakettir.

### 3.5 Grupla karar

- **Ne olur:** Paket ya da 1+2 seti sohbete **paket kartı** olarak düşer. Her üye:
  - kendi **kişi başı payını** görür (oda düzeni ve kişiye özel isteğe bağlı kalemler dahil: "balon turu yalnız Ece ve Can");
  - **onay oyu** verir: her seçeneğe "olur / olmaz", birine yıldız;
  - isterse **gizli bütçe tavanı** girer: kimse görmez; motor yalnız *"herkesin bütçesine uyuyor ✓"* ya da *"bir kişinin bütçesini aşıyor"* der, kimin olduğunu söylemez.
- **Nerede oylanır:** Seyahat ve sohbet bugün kabul edilmiş bir seyahate bağlı. Paket bir grup için kuruluyorsa motor önce **taslak seyahat** açar (şehir ve tarih henüz kesin değil); davet, sohbet ve oy orada olur, kabulle taslak kesinleşir. Seyahatin sahibi paketi kuran kişidir.
- **İki kişilik grupta** "bir kişinin bütçesini aşıyor" uyarısı kimin olduğunu ele verir. Bu yüzden 3'ten az üyede uyarı gösterilmez; tavanı aşan seçenek yalnız sıralamada geriye iner ve önerilen paket olamaz.
- Oylamanın bir süresi vardır ("cumartesi 20:00'ye kadar"). Süre dolunca ya da herkes oy verince seyahatin sahibi kesinleştirir.
- **Sihirli an:** Para konuşmadan uzlaşma: *"3 seçenekten ikisi herkesin bütçesine uyuyor; oyların çoğu B'de."*
- **Karar:** Kişi başı fark K4 gereği yalnız oda düzeni ve isteğe bağlı kalemden doğar; bu yüzden **oda düzeni sorusu** ("2+2+1 mi, herkes ayrı mı?") grup akışının parçasıdır.

### 3.6 Kabul ve seyahate dönüşüm

- Kabul edilen paket tek işlemde yazılır: `trips` (şehir, tarih, tz), `days`, `places` + `stops` (program), `stays` (bölge merkezi ya da otel), **bütçe satırları** (kategori bazında planlanan, §5.5), **rezervasyon listesi** (§3.7). İlk dördü bugünkü nesnelerdir; bütçe satırları ve rezervasyon listesi **yeni** nesnelerdir, veri modelleri Faz 1'de tanımlanır (`09` kapsamı dışında). Bugünkü "Seyahatime al" işlevinin (`geziden_seyahat_ac`) genişlemesidir.
- **Sihirli an:** Kullanıcı kabul eder, ekran Plan sekmesine geçer; harita, saatler, bütçe ve sohbetteki karar kartı hepsi yerinde.

### 3.7 Rezervasyon

- **Ne olur (Faz 1, bağlantısız):** Seyahatin Gezi sekmesinde **Rezervasyon listesi**: "Otobüs biletleri · Otel (Odunpazarı, 2 gece) · Müze Kartsız girişler". Her satırda önerilen **sıra ve son tarih** (§8 fikir 10) ve bir "Aldım" düğmesi. "Aldım" denince gerçek tutar ve ödeyen sorulur → **otomatik harcama kaydı** + bölüşme.
- **Faz 2 (yönlendirme):** Satırlarda tedarikçi seçenekleri ve fiyatı uygulama içinde görünür; yalnız ödeme adımı tedarikçinin sitesinde/uygulamasında olur. Dönüşte "Rezervasyonu aldın mı?" kartı açılır.
- **Sihirli an:** Bilet alınır alınmaz harcama kurulmuş, bölüşülmüş ve planlanana karşı işaretlenmiş olur: *"Ulaşım: planlanan 1.800 ₺, gerçekleşen 1.650 ₺ ✓"*.
- **Karar:** Kullanıcıyı ödeme için dışarı göndermek "uygulama içi detay" ilkesine aykırı mı? **Detay içeride kalır, yalnız ödeme dışarı çıkar.** Tek sepet ve uygulama içi ödeme lisans gerektirir (§6.4); bu, Faz 4 kararıdır.

### 3.8 Gezi sırasında

- **Canlı plan:** Bugünkü Plan (canlı satır, otomatik tamamlanma, kaydırma). Paket bilgisi eklenir: **günün bütçe nabzı** ("bugün planın 200 ₺ altındasınız").
- **B planı:** Bir akşam önce hava tahmini yağmur diyorsa *"Yarın yağmur bekleniyor; B planı hazır: 2 açık hava durağı yerine Kurtuluş Müzesi ve Yedi Kapı Pasajı"* kartı. Tek dokunuşla değişir, maliyet farkı görünür. Yorgunluk: iki durak atlanmış ve program 45 dk gecikmişse öğleden sonra için hafif sürüm önerilir.
- **Sihirli an:** Kullanıcı sorunu yaşamadan önce çözüm cebinde olur.
- **Karar:** B planı kendiliğinden mi uygulansın? **Hayır; her zaman öneri kartı.** (K2.)

### 3.9 Dönüş

- **Harcamaların kapanması:** Bugünkü ödeşme akışı. Eksik kategori varsa 3 soruluk kapanış: *"Yemekte kabaca ne harcadın?"* (yalnız boş kalan kategoriler için).
- **Planlanan ile harcanan:** Kategori bazında çubuklar, kişi başı. *"Tahminimiz %6 saptı; yemekte sizi az hesaplamışız."*
- **Anı:** Rota haritası + gezilen duraklar + puanlar + kişi başı toplam → paylaşılabilir **gezi kartı**. Kartı alan arkadaş "Bu geziyi bana kur" der; aynı paket onun şehrinden ve tarihinden yeniden hesaplanır (§8 fikir 11).
- **Sihirli an:** Uygulama kendi tahminini dürüstçe puanlar.

---

## 4. Paket motoru (kavramsal)

**Bu bölüm neye karar verdiriyor:** Motorun hangi parçasının kural/optimizasyon, hangisinin LLM olacağı; motorun içeriğimizden ne beklediği (bu beklenti `09`'un gerekçesidir).

### 4.1 Girdiler

| Girdi | Kaynak | Örnek |
|---|---|---|
| Çıkış yeri | Kullanıcı | İstanbul (Anadolu yakası) |
| Varış | Kullanıcı ya da motor (bütçeden başlayan aramada) | Eskişehir / boş |
| Tarih | Kullanıcı | 24–26 Eki ya da "ekim sonu, ±1 gün" |
| Kişiler ve oda düzeni | Kullanıcı | 4 yetişkin, 2+2 |
| Kimle | Kullanıcı | `arkadas` · `cift` · `aile_cocuk` · `bebekli` · `tek` |
| İlgi | Kullanıcı (≤ 3) | tarih, yeme_icme, gece_hayati |
| Tempo | Kullanıcı | rahat · normal · yogun |
| Şehir içi hareket | Kullanıcı | yürüyüş + toplu taşıma · araba |
| Şehirlerarası tercih | Kullanıcı (isteğe bağlı) | fark etmez · otobüs · tren · uçak · kendi arabam |
| Bütçe | Kullanıcı | kişi başı 6.000 ₺ ya da "orta" |
| İndirimler | Kullanıcı profili | Müze Kart, öğrenci, 65+ |
| Serbest metin | Kullanıcı → LLM → çip | "annem çok yürüyemez" |
| Gizli bütçe tavanları | Grup üyeleri | yalnız motor görür |
| İçerik | Bizim veri (`09`) | yerler, bölgeler, geziler, gün modülleri, etiketler |
| Maliyet | Bizim tahmin + (Faz 2) canlı fiyat | §5 |
| Bağlam | Takvim | resmî tatiller, sezon, hava tahmini, kapalı günler |

### 4.2 Kısıtlar

- **Sert (ihlal eden aday elenir):** tarih aralığı; kapalı gün; bebek arabası/erişilebilirlik isteniyorsa `hayir` ve **bilinmeyen** (boş) yerler, `kismen` olanlar uyarıyla kalır; günün bitişi (varsayılan 20:00, kullanıcı değiştirebilir); önerilen paket gizli bütçe tavanlarının en küçüğünü aşamaz (alternatifler aşabilir, §3.5); yalnız yayındaki içerik; mevsim kısıtı.
- **Yumuşak (puanı düşürür):** bütçe hedefi; tempo hedefi; günlük yürüme km; ilgi uyumu; kalabalık zirvesi; "kaçın" saatleri.

### 4.3 Akış

1. **Hedef seçimi** (varış boşsa): kapsadığımız şehirlerden; çıkıştan ulaşım süresi gezi süresinin makul bir oranını geçmeyenler; sezon ve ilgi uyumu; kaba maliyet bütçeye sığanlar. En çok 5 şehir.
2. **İskelet seçimi:** Şehrin hazır gezileri ve gün modülleri arasından ilgi, kime_uygun ve ulaşım şekli uyanlar.
3. **Uyarlama:** §4.4 işlemleri.
4. **Ulaşım:** Çıkış–varış seçenekleri; varış ve dönüş saatleri **ilk ve son günün başlangıç/bitişini belirler** (yarım gün, §8 fikir 2).
5. **Konaklama bölgesi:** Günlerin ağırlık merkezlerine ortalama yol süresi + bölgenin fiyat bandı + bölge karakteri uyumu. Faz 2'de bölge içinde otel.
6. **Program:** Bugünkü Plan motoru (en yakın komşu + 2-opt, otel çapası, süreler, tempo). Değişiklik yok; motor onu çağırır.
7. **Maliyet:** §5.
8. **Puanlama ve alternatifler:** §4.5–4.6.
9. **Açıklama:** §4.7.

### 4.4 Hazır geziyi kullanıcıya göre uyarlama

| İşlem | Ne zaman | Nasıl | Gerektirdiği etiket (`09`) |
|---|---|---|---|
| **Gün düşürme** | Kullanıcının günü gezininkinden az | `secmeli` günler önce düşer; düşen günün `onem=3` durakları kalan günlere en ucuz ekleme noktasıyla taşınır | gün `rol`, yer `onem` |
| **Gün birleştirme** | İki yarım gün tek güne sığıyor | `birlesebilir_ile` işaretli çiftler; birleşik gün tempo eşiğini aşarsa birleşme yapılmaz | gün `birlesebilir_ile`, durak `rol` |
| **Gün ekleme** | Kullanıcının günü fazla | Şehrin başka gezilerinden ilgi ve bölge uyumlu gün modülü; yoksa "serbest yarım gün" | gün modülü etiketleri |
| **Yarım gün** | Varış/dönüş saati | İlk/son gün `yarim_gun_uygun` modülden; valiz bırakma durağı eklenir | gün `yarim_gun_uygun`, şehir emanet bilgisi |
| **Tempo** | Rahat ↔ yoğun | Rahat: `secmeli` duraklar yedeğe, süreler `sure_max`'a; yoğun: yedekler devreye, süreler `sure_min`'e | durak `rol`, yer `sure_min/max`, `tempo_yuku` |
| **Ulaşım şekli** | Yürüyüş → araba | `arac_gerekli` günler açılır (şehir dışı), uzak duraklar tek güne toplanır; otopark kalemi girer | gün `arac_gerekli`, şehir otopark |
| **Bütçe seviyesi** | Ekonomik ↔ konforlu | Bölge ve otel bandı; yemek seviyesi; ücretli etkinlikler `secmeli`ye iner ya da eklenir | bölge fiyat bandı, yer `fiyat_seviyesi`, bilet aralığı |
| **Kime uygun** | Bebekli, çocuklu, erişilebilirlik | Sert kısıt + öğle uykusu penceresi (otele yakın) | yer uygunluk alanları |
| **Mevsim / hava** | Tarih, tahmin | `ortam=dis` ve mevsim kısıtlı yerler; B planı için `yedek` duraklar | yer `ortam`, `mevsim_kisit` |
| **Saat** | Gün ışığı, kalabalık | `en_iyi_zaman`'a göre sıra ipucu (gün batımı durağı akşama) | yer `en_iyi_zaman`, `kacin_zaman` |

> **Editörün anlatısı bozulmamalı.** Bugünkü blog yazısı tek parça ve gezinin en uzun sürümünü anlatır. Uyarlanmış pakette yazı yerine **gün kartları** (gün başlığı + 1–3 cümle) gösterilir; blog yazısı "editörün tam gezisi" olarak okunmaya devam eder. Bu yüzden `09` her güne kısa bir anlatı alanı ekler.

### 4.5 Puanlama

Önce sert kısıtlar eler; kalan adaylar bileşik puanla sıralanır:

`puan = ilgi_uyumu + tempo_uyumu + butce_uyumu + yol_verimi + onem_kapsami + guven − cezalar`

| Bileşen | Ölçü |
|---|---|
| İlgi uyumu | Duraklardaki ilgi etiketlerinin isteğe örtüşmesi, `onem` ağırlıklı |
| Tempo uyumu | Gün doluluğu ve `tempo_yuku` toplamının hedefe uzaklığı |
| Bütçe uyumu | Hedefin altında nötr; üstünde artan ceza; gizli tavan üstü önerilen paket olamaz |
| Yol verimi | Şehirde geçen saatte yolda geçen oran; kapıdan kapıya süre |
| Önem kapsamı | `onem=3` (ikon) yerlerin kapsanması |
| Güven | Maliyet güveni düşük paket hafif ceza alır (aynı fiyatta daha emin olan öne) |
| Cezalar | Kalabalık zirvesine denk gelme, "kaçın" saatleri, art arda iki yorucu durak |

Ağırlıklar sabit başlar, kullanıcı tercihleriyle (ince ayarda neyi seçtiği) zamanla ayarlanır. **Varsayım V6:** Faz 1'de ağırlıklar editörün elle ayarladığı sabitlerdir; öğrenme Faz 3'te.

### 4.6 Alternatif üretme

1. Motor 20–80 aday üretir (iskelet × gün sayısı × tempo × bölge × ulaşım × seviye); gün düşürme ve tempo varyantları da kümededir.
2. Üç eksende **Pareto** önü alınır: kişi başı maliyet · zaman verimi (şehirde geçen saat, günlük yol) · ilgi uyumu.
3. Önerilen paket: en yüksek bileşik puan.
4. İki alternatif: Pareto önünden, önerilenden **tek boyutta** belirgin farklı olanlar (farklı bölge, farklı ulaşım ya da farklı seviye). Fark eşiği: kişi başı ≥ %10 ya da günde ≥ 20 dk.
5. Etiket, kazandığı eksenden türetilir: "daha ucuz", "daha az yol", "ilgine daha uygun".
6. Takas kartları (§3.4) aynı aday kümesinden gelir: yeni dış istek gerekmez.
7. **Yedek:** Tek boyutta fark eşiğini geçen aday 2'den azsa daha az alternatif gösterilir (ya da hiç); kullanıcı takas kartlarıyla devam eder. Zorla benzer alternatif üretilmez.

### 4.7 Açıklama ("bu oteli şu yüzden seçtim")

- Motor her seçim için **gerekçe kodu + sayı** üretir: `BOLGE_YAKIN(ort_dk=12)`, `BUTCEYE_UYUYOR(fark=-400)`, `ILGI(tarih,yeme_icme)`, `BEBEK_ARABASI_UYGUN`, `GECE_OTOBUSU_OTEL_TASARRUFU(gece=1)`.
- Metin **şablondan** üretilir: *"Bu semti seçtim: durakların ortalama {ort_dk} dk yürüme mesafesinde."* LLM yalnız birden çok kodu doğal bir cümleye bağlayabilir; sayı ekleyemez, yeni gerekçe uyduramaz (§4.8).
- Her gerekçe dokunulabilir: dokununca dayanağı gösterir (hangi duraklar, hangi fiyat tablosu, hangi tarih).

### 4.8 LLM nerede, kural nerede?

| İş | Kim yapar | Neden |
|---|---|---|
| Serbest metni yapılandırılmış isteğe çevirmek | **LLM** | Dil anlama; çıktı kapalı listeli şemaya zorlanır, kullanıcı çip olarak onaylar |
| Hedef/iskelet seçimi, uyarlama, bölge, ulaşım | **Kural + optimizasyon** | Tekrarlanabilir, test edilebilir, açıklanabilir |
| Program (sıra, saat, süre) | **Bugünkü Plan motoru** | Zaten var ve doğrulanmış |
| Her rakam (fiyat, süre, mesafe, toplam) | **Kural + veri** | LLM'ye asla rakam ürettirilmez |
| Gerekçe metni | **Şablon**; isteğe bağlı LLM bağlama | Sayılar şablondan; LLM yalnız bağlaç |
| "Daha sakin yap" gibi sohbet isteği | **LLM → düzenleme işlemi** | LLM yalnız tanımlı işlemlerden birini seçer (`tempo_dusur`, `gun_cikar(3)`, `bolge_degistir`); işlemi motor yapar |
| İçerik ve etiket üretimi | **LLM, çevrimdışı** (içerik hattı) | Ece onaylar; uygulama çalışırken içerik üretilmez |

**Uydurma riskini sınırlayan kurallar:**

1. **Kapalı dünya:** Uygulama çalışırken LLM yalnız aday kümesindeki kimliklere (yer, bölge, gezi) atıf yapabilir. Kümede olmayan bir ad çıktıda geçerse çıktı reddedilir.
2. **Şema doğrulaması:** Her LLM çıktısı JSON şemasına uymalı; değerler `09`'daki kapalı listelerden. Uymazsa şablon yedeğine düşülür (kullanıcı hata görmez).
3. **Rakam yasağı:** LLM çıktısında rakam varsa ve gerekçe kodundaki rakamla eşleşmiyorsa çıktı reddedilir.
4. **Yalnız onaylı içerik:** Paket, Ece'nin yayınladığı yerlerden kurulur. Kapsanmayan şehirde "plan uydurmak" yok (V3).
5. **Gösterilen her şeyin dayanağı:** Kullanıcı her rakamın ve gerekçenin kaynağına dokunarak ulaşır.
6. **Kayıt:** LLM girdisi ve çıktısı kişisel veri arındırılarak örneklenir; şema reddi oranı izlenir.

### 4.9 Kullanıcı başına dış istek (fizibilite)

| Akış | Google | Tedarikçi | LLM | Önbellek |
|---|---|---|---|---|
| Bütçe kartı / "nereye?" (Faz 1) | 0 | 0 (rota × ay fiyat tablosu, tüm kullanıcılar ortak) | 0 | Şehir × çıkış × ay; günlük yenilenir |
| Paket isteği (Faz 1) | **0**: konum bizim/OSM, yürüme süreleri şehir bazında önceden hesaplı (§4.10) | 0–1: uçak varsa rota-ay fiyat verisi (ör. Travelpayouts Data API, ücretsiz, 2–7 gün eski) | 0–1: yalnız serbest metin varsa | Rota × ay × kabin ortak; LLM sonucu çip olarak saklanır |
| Takas / ince ayar | 0 | 0 | 0 | Aday kümesi paket ömrü boyunca bellekte |
| Grup oylaması | 0 | 0 | 0 | — |
| Kabul → seyahat | Bugünkü Plan'la aynı: gün açılınca matris + seçili günün çizgileri; durak çiftleri `walk_cache`'te 30 gün | 0 | 0 | Hazır gezi bacakları zaten `gezi_rota_onbellek`'te (30 gün) ve "Seyahatime al" bunları seyahate kopyalıyor; uyarlanmış paketteki yeni durak çiftleri için aynı yaklaşım genişletilir |
| Paket detayı, canlı fiyat (Faz 2) | 0 | 1–2: otel müsaitliği (bölge, tarih) + varsa uçuş araması, **yalnız kullanıcı açınca** | 0 | Aynı sorgu 15–60 dk |
| Fiyat izleme (Faz 3) | 0 | Paket başına günde 1 (yalnız izlenen) | 0 | — |
| B planı | 0 | 0 (hava tahmini şehir başına günde 1, tüm kullanıcılar ortak) | 0 | Şehir × gün |
| Dönüş | 0 | 0 | 0 | — |

**Hedef:** Faz 1'de paket kurmak kullanıcıya **sıfır Google isteğine** mal olur. Google maliyeti yalnız kullanıcı seyahati açıp haritada çizgileri gördüğünde doğar (bugünkü gibi).

### 4.10 Kendi süre matrisimiz

Motor binlerce aday değerlendirir; her biri için Google Routes çağırmak hem pahalı hem gereksiz. Öneri: kapsadığımız her şehirde **onaylı yerler arası yürüme ve araç sürelerini OpenStreetMap verisi üzerinden kendi yönlendirme motorumuzla** (ör. açık kaynak OSRM/Valhalla) bir kez hesaplayıp saklamak. OSM verisi ODbL ile saklanabilir (atıf zorunlu, `07` §4). Paket bu matrisle kurulur; kullanıcı seyahati açınca gösterilen çizgi ve kesin süre bugünkü gibi Google'dan gelir. İki süre arasındaki fark izlenir; büyükse matris kalibre edilir.

---

## 5. Maliyet modeli

**Bu bölüm neye karar verdiriyor:** Her kalemin Faz 1'de hangi veriye dayanacağı, aralığın nasıl gösterileceği, fiyat değişince ne olacağı ve Harcama ile bağın şekli.

### 5.1 Üç tür rakam

| Tür | Rozet | Örnek | Gösterim |
|---|---|---|---|
| **Canlı** | `Canlı` | Tedarikçinin şu anki otel fiyatı | Tek rakam + saat ("14:20 itibarıyla") |
| **Tahmin** | `Tahmin` | Bizim yemek, bilet, şehir içi ulaşım tablomuz | **Her zaman aralık** + tarih ("Eki 2026 verisi") |
| **Senin girdiğin** | `Senin` | Kullanıcının aldığı biletin gerçek tutarı | Tek rakam |

Tahmin hiçbir zaman tek rakamla gösterilmez. Toplam da tahmin içeriyorsa aralıktır. **İstisna:** takas ve alternatif **farkları** ("+2.400 ₺") orta değerlerin farkı olarak tek rakamla gösterilir; dokununca aralık görünür.

### 5.2 Kalem kalem

| Kalem | Faz 1 kaynağı | Faz 2+ kaynağı | Nasıl tahmin edilir | Aralık / güven | Fiyat değişince |
|---|---|---|---|---|---|
| **Uçak** | Rota × ay önbellekli fiyat verisi (ör. Travelpayouts Data API, 2–7 gün eski) | Kullanıcı açınca canlı arama | Rota-ay fiyatlarının alt-üst çeyreği; bayram/köprü çarpanı | Veri yaşı ≤ 7 gün ve ≥ 5 gözlem → orta; aksi düşük | Faz 2: paket açılışında yenilenir; ≥ %5 ya da ≥ 300 ₺ fark → değişim bandı |
| **Otobüs** | Editörün rota tablosu (firma sınıfına göre min–maks, ayda bir) | Tedarikçi bağlantısı bulunursa canlı | Tablodan; hafta sonu/bayram çarpanı | Tablo ≤ 90 gün → orta | Tablo yenilenince açık paketlerde bant |
| **Tren (YHT)** | Editörün tarife tablosu | — (API bulunamadı, §6.1) | Tarife sınıfları | Tarife güncelse yüksek | Aynı |
| **Kendi arabası** | Mesafe × tüketim × yakıt fiyatı (haftalık tablo) + köprü/otoyol (rota tablosu) | Aynı | Araçtaki kişilere bölünür | Yüksek (mesafe kesin) | Yakıt tablosu haftalık |
| **Konaklama** | Bölge × seviye × sezon fiyat bandı (editör, örneklerden) | Canlı otel fiyatı | Gece × oda; oda düzenine göre kişi başı | Bant ≤ 90 gün ve sezon uyumlu → orta | Faz 2: aynı uçak kuralı |
| **Şehir içi ulaşım** | Plan'dan: yürüyüş 0; toplu taşıma biniş × ücret; taksi bacağı × (açılış + km); araba: otopark günlük | Aynı | Plan'ın bacak türleri | Yüksek (bacaklar belli), taksi orta | Şehir tablosu güncellenince |
| **Yemek** | Şehir × seviye × öğün bandı; Plan'daki yemek durağı varsa onun `fiyat_seviyesi` | Aynı | Plan'daki öğün yuvaları (kahvaltı, öğle, akşam, ara) | Orta; en büyük belirsizlik | Kalibrasyonla (§5.6) |
| **Müze / etkinlik** | Yerin bilet aralığı + doğrulama tarihi; Müze Kart geçerliyse 0 | Etkinlikte canlı fiyat (Viator/GYG vb.) | Kullanıcının indirimleri | Resmî kaynak ≤ 12 ay → yüksek | Bilet tablosu yenilenince |
| **Pay (tampon)** | Güvene bağlı yüzde: düşük güvenli kalemler kadar büyür | Aynı | Toplamın ayrı satırı: "beklenmedik" | — | — |

### 5.3 Toplam ve güven gösterimi

- **Toplam:** Kişi başı orta değer büyük, aralık küçük: *"~6.200 ₺ · 5.400–7.300"*.
- **Aralık uçları körlemesine toplanmaz, ama kalemler bağımsız da sayılmaz.** Sezon, bütçe seviyesi ve enflasyon konaklama, yemek ve ulaşımı **birlikte** oynatır; bu ortak etkenler önce birlikte uygulanır (hepsi aynı yöne), kalan kaleme özgü belirsizlikler birbirini kısmen dengeler. Sonuç **asimetrik** olabilir (fiyatlar aşağıdan çok yukarı sapar). Yöntem geliştirici notunda; ölçüt: bitmiş gezilerin gerçekleşen toplamının yaklaşık 4'te 3'ü aralığın içinde kalmalı (§5.6 karnesiyle izlenir).
- **Güven:** Üç seviye, sözle: yüksek · orta · düşük. Toplamın güveni, toplamın en büyük payını taşıyan iki kalemin güveninden türer.
- **Tarih:** Her ekranda tek satır: *"Fiyatlar 14 Eki · tahminler Eki 2026 verisi"*.
- **Kırılım ekranı:** Kalem, rozet, aralık, tarih, "neden bu aralık?" dokunuşu.

### 5.4 Fiyat değişince

- Paket oluşturulduğunda her kalemin **anlık görüntüsü** (rakam, aralık, kaynak, tarih) paketle saklanır.
- Paket yeniden açıldığında yalnız **canlı** kalemler (Faz 2) ve süresi dolmuş tahminler yenilenir.
- Fark eşiği aşılırsa: değişim bandı (*"Otel 600 ₺ arttı · kişi başı 6.200 → 6.500"*) + o bileşen için takas kartları yeniden hesaplanır. **Sessiz değişiklik yok.**
- Seyahate dönüştükten sonra planlanan bütçe **dondurulur**; gerçekleşen rakamlar ayrı tutulur.

### 5.5 Harcama ile bağ

- Kabul edilen paketin maliyeti seyahatin **planlanan bütçesi** olur: kategori × kişi başı.
- Bugünkü `harcamalar.kategori` değerleri: `yemek, ulasim, konaklama, bilet, diger`. Paket kalemleri eşlenir: uçak/otobüs/tren/araba + şehir içi → `ulasim`; konaklama → `konaklama`; yemek → `yemek`; müze/etkinlik → `bilet`; pay → `diger`.
- **Eksik:** Şehirlerarası ile şehir içi ulaşım tek kategoride; planlananla karşılaştırmada en büyük kalemle en küçüğü karışır. **Karar gerekli** (§11 S7): ayrı kategori (`ulasim_sehirlerarasi`) ya da alt etiket.
- Rezervasyon listesinde "Aldım" → harcama kaydı, kategori ve bölüşme hazır (§3.7).
- Harcama sekmesinde **bütçe nabzı:** kategori çubukları, kişi başı, gün gün.

### 5.6 Öğrenme döngüsü

- Bitmiş seyahatlerde kategori × şehir × seviye × kişi başı **gerçekleşen/planlanan** oranı **anonim ve toplu** olarak hesaplanır; maliyet tablolarının aralıkları buna göre kayar.
- Önyargı uyarısı: kullanıcılar küçük harcamaları (kahve, simit) girmez; yemek kategorisi eksik kalır. Bu yüzden yalnız kapsama oranı yeterli seyahatler (ör. harcama kaydı ≥ gün başı 2) ve kapanış anketi yanıtları kullanılır.
- Şehir başına kalibrasyon için asgari örnek (ör. 20 seyahat) dolana kadar tablo editörün değeriyle kalır.
- **Faz 0'da başlatılabilir:** Bugünkü Harcama verisi şimdiden şehir × kategori × kişi başı × gün olarak toplanabilir (gizlilik metni güncellenerek). Paket motoru çıktığında elimizde kalibrasyon verisi olur (`09` Faz 0).

---

## 6. Tedarik ve rezervasyon

**Bu bölüm neye karar verdiriyor:** Faz 1 ve Faz 2'de hangi tedarikçilerle başlanacağı; hangi iş modelinin hangi hukuki yükü doğurabileceği; avukata ne sorulacağı.

Tüm bilgi 14 Ekim 2026 itibarıyla, kaynaklı. Komisyon oranları yalnız kaynakta yayımlananlardır.

### 6.1 Bağlantı seçenekleri

**Uçak**

| Seçenek | Ne verir | Erişim | Ticari model (yayımlanan) | Not |
|---|---|---|---|---|
| Travelpayouts – Aviasales | **Data API:** önbellekli en düşük fiyatlar (2–7 gün eski), ücretsiz ([şartlar](https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access)). Search API canlı | Search API ≥ 50.000 MAU ister ([kaynak](https://support.travelpayouts.com/hc/en-us/articles/210995808)) | Gelir payı %40, bilet fiyatının ≈ %1,1–1,3'ü ([kaynak](https://travelpayouts.com/en/offers/aviasales-affiliate-program)) | Search API kuralları: yalnız kullanıcı tetiklemeli arama, başka metasearch API'siyle karıştırma yok ([kurallar](https://support.travelpayouts.com/hc/en-us/articles/34788165535250)). **Faz 1 tahmin kaynağı için en gerçekçi seçenek.** |
| Duffel | Uçuş arama/rezervasyon, ek hizmet; Stays | Kendi kendine kayıt; IATA'sız "Managed Content" | Sipariş başı 3 $ + %1 + ek hizmet 2 $ ([fiyat](https://duffel.com/pricing)) | Satıcı sensin (lisans, §6.4). Türkiye'nin Duffel Payments ülkesi olup olmadığı doğrulanamadı. |
| Skyscanner | Affiliate bağlantı; Travel API | Travel API "büyük kitleli yerleşik işletme" ([kaynak](https://www.partners.skyscanner.net/product/travel-api)); affiliate ≥ 5.000 aylık ziyaretçi ([kaynak](https://www.partners.skyscanner.net/product/affiliates)) | Skyscanner'ın aldığı komisyondan pay | Uygulama trafiği kurallarda geçmiyor. |
| Kiwi.com Tequila | Arama, Nomad, rezervasyon | 2024'ten beri yalnız B2B ortak ([Vervotech](https://www.vervotech.com/hub/integrations/tequila-api/)); kaynaklar çelişiyor | Travelpayouts üzerinden %3 ([kaynak](https://travelpayouts.com/en/offers/kiwi-affiliate-program)) | — |
| THY / Pegasus / AJet | NDC API'leri (THY TK Connect, Pegasus Travelfusion üzerinden, AJet Atlas üzerinden) ([TK Connect](https://www.turkishairlines.com/en-tr/tkconnect/resources/), [Travelfusion](https://corporate.travelfusion.com/resources/supplier/pegasus), [TDN](https://www.traveldailynews.com/aviation/atlas-launches-ajets-latest-ndc-connection/)) | Acente/aggregator sözleşmesi | Açık değil | Herkese açık güncel affiliate programı bulunamadı. |
| Türk OTA'lar | **Turna API:** uçak, 400+ otobüs firması, araç kiralama; B2B, iletişim formu ([Turna API](https://www.turna.com/turna-api-hizmeti)). Enuygun, Wingie, Obilet: herkese açık affiliate/API sayfası bulunamadı ([Enuygun reklam/iş birliği](https://www.enuygun.com/reklam/)) | Görüşmeyle | Açık değil | Yurt içi otobüs için en somut yol Turna API; diğerleriyle doğrudan iş birliği görüşmesi denenebilir. |
| Google Flights | — | Herkese açık API yok (QPX 2018'de kapandı, [Duffel](https://duffel.com/blog/google-flights-api)) | — | — |

**Otel**

| Seçenek | Ne verir | Erişim | Ticari model | Not |
|---|---|---|---|---|
| Booking.com | Affiliate; Demand API | **Haziran 2025'ten beri affiliate Awin üzerinden** ([PhocusWire](https://www.phocuswire.com/booking-terminates-partnerships-content-creators)); Demand API yalnız "Managed Affiliate Partner" ([geliştirici](https://developers.booking.com/demand/docs/getting-started/prerequisites)) | Oran açık değil | API erken aşamada erişilemez. Ayrıca Türkiye'de bekleyen yabancı platform düzenlemesi (§6.4). |
| Agoda | Bağlantı, widget, büyük ortağa API | Partner Center | %4–5, aylık rezervasyona göre kademeli ([sözleşme](https://partners.agoda.com/Content/pdf/Agoda_OnlineAffiliateAgreement.pdf)) | **Mobil uygulamalar kapsamda.** Agoda verisini rakip içerikle karıştırma yasağı (m. 4.3.2) — aynı ekranda karşılaştırmayı kısıtlar. |
| Trip.com | Otel, uçak, tren, etkinlik, araç | Doğrudan ya da Travelpayouts | Otel %5–7 ([Trip.com](https://www.trip.com/ask/questions/trip.com-affliate-program.html)); TP: otel %5,5 ([TP](https://travelpayouts.com/en/offers/trip-com-affiliate-program)) | Uygulama kuralı yazmıyor. |
| Expedia | Travel Creator Program; Rapid API | Creator: başvuru; Rapid: ortaklık + sertifikasyon ([Rapid](https://partner.expediagroup.com/en-us/solutions/build-your-travel-experience/rapid-api)) | Creator "%4'e kadar" ([kaynak](https://partner.expediagroup.com/en-us/solutions/explore-our-affiliate-program)) | — |
| LiteAPI | Otel arama, fiyat, rezervasyon | Kendi kendine, ücretsiz başlangıç ([LiteAPI](https://www.liteapi.travel/Monetisation)) | Marjı sen koyarsın ([fiyat](https://docs.liteapi.travel/reference/api-pricing-usage-costs)) | Satıcı sensin → lisans. **Faz 1'de bölge fiyat bandı örneklemesi için değerlendirilebilir.** |
| Hotelbeds | Otel/etkinlik/transfer B2B | Kayıt açık, değerlendirme anahtarı 50 istek/gün ([doküman](https://developer.hotelbeds.com/documentation/)) | Net fiyat | Satıcı sensin. |
| Hotellook (Travelpayouts) | — | **20 Ekim 2025'te kapandı**, API dahil ([SSS](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)) | — | — |
| Türk otel OTA'ları (Etstur, Tatilbudur, Jolly) | Herkese açık affiliate/API bulunamadı ([Etstur](https://www.etstur.com/)) | Görüşmeyle | — | — |

**Etkinlik ve bilet**

| Seçenek | Ne verir | Ticari model | Not |
|---|---|---|---|
| Viator | Partner API; temel erişim kayıtla otomatik ([doküman](https://docs.viator.com/partner-api/technical/)) | %8, 30 gün çerez ([Viator](https://partnerresources.viator.com/)) | Mobil uygulama ortak türü olarak geçiyor. |
| GetYourGuide | Partner API (erişim seviyeli), çıktıyı önbelleğe alma yasağı ([wiki](https://github.com/getyourguide/partner-api-spec/wiki/Getting-started)) | %8 (TP üzerinden, [kaynak](https://travelpayouts.com/en/offers/getyourguide-affiliate-program)) | — |
| Tiqets · Klook | Affiliate, Tiqets'te self-servis API ([Tiqets](https://www.tiqets.com/partner-program/affiliate)) | Tiqets %3,5–8, Klook %5 (TP) | — |
| Müze Kart / muze.gov.tr | E-bilet, uygulama ([muze.gov.tr](https://muze.gov.tr/)) | — | **Herkese açık API ya da açık veri bulunamadı.** Müze fiyatları elle tutulmalı. |
| Biletix / Passo | — | — | Herkese açık API/affiliate bulunamadı. |

**Otobüs, tren, araç**

| Seçenek | Not |
|---|---|
| Turna API | Yurt içi otobüs (400+ firma) + araç kiralama, B2B ([Turna](https://www.turna.com/turna-api-hizmeti)) |
| Busbud · Omio | Türkiye rotalarını kısmen satıyor ([Busbud](https://www.busbud.com/en-ie/asti/s/18467), [Omio](https://www.omio.co.uk/coaches/tuerkiye-yp99v)); TP üzerinden %5 ve %6 |
| Obilet | Herkese açık affiliate/API bulunamadı |
| TCDD | Herkese açık API bulunamadı → tarife elle; bilet için yönlendirme (komisyonsuz) |
| DiscoverCars | Araç kiralama kârının %70'i, 365 gün çerez, **uygulamalar açıkça serbest** ([kaynak](https://www.discovercars.com/uk/affiliate)) |

**Kapanan ve kısıtlanan API'ler (2024–2026):**

- **Amadeus Self-Service:** yeni kayıtlar Mart 2026'da durdu, portal ve anahtarlar **17 Temmuz 2026'da kapandı**; yalnız kurumsal portal kaldı ([PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)).
- **Booking.com:** doğrudan affiliate'ler Haziran 2025'te Awin'e taşındı; Demand API yönetilen ortaklara kapalı.
- **Hotellook:** Ekim 2025'te kapandı.
- **Kiwi Tequila:** self-servis değil.
- **Google Maps Platform:** 1 Mart 2025'ten beri aylık 200 $ kredi yerine SKU başına ücretsiz kota ([Google](https://developers.google.com/maps/billing-and-pricing/march-2025)); place_id saklanabilir, enlem/boylam en çok 30 gün ([hizmet koşulları](https://cloud.google.com/maps-platform/terms/maps-service-terms)).

### 6.2 Faza göre tedarik önerisi

| Dikey | Faz 1 (tahmin, bağlantı yok) | Faz 2 (yönlendirme) |
|---|---|---|
| Uçak | Travelpayouts Data API (ücretsiz, önbellekli) → "~X ₺'den, tahmin" | Aviasales/Trip.com/Kiwi affiliate; canlı arama için MAU eşiği beklenir |
| Otobüs | Editör tablosu | **Turna API görüşmesi**; Busbud/Omio kısmi kapsama; Türk OTA'larla doğrudan görüşme |
| Tren | Editör tarife tablosu | TCDD'ye komisyonsuz yönlendirme |
| Otel | Bölge × seviye fiyat bandı (editör + örnekleme) | Trip.com, Agoda (veri karıştırma kuralına dikkat), Booking (Awin), Expedia Creator |
| Etkinlik | Editörün bilet tablosu | Viator, GetYourGuide, Tiqets |
| Müze | Editörün tablosu, Müze Kart bayrağı | muze.gov.tr'ye yönlendirme |
| Araç | Yakıt + otopark tablosu | DiscoverCars |

### 6.3 Uygulama içi detay ilkesiyle uyum

- Faz 1: hiçbir dış bağlantı yok; her şey uygulama içinde.
- Faz 2: fiyat, iptal koşulu, oda tipi uygulama içinde (tedarikçi koşulları izin verdiği ölçüde; GYG gibi bazıları önbelleğe almayı yasaklar). Yalnız ödeme adımı dışarıda.
- Tek sepet ve uygulama içi ödeme: lisanslı satıcı olmayı gerektirir (§6.4); Faz 4 kararı.

### 6.4 Hukuki çerçeve (hüküm değil, harita)

> **Bu bölüm hukuki görüş değildir.** Resmî metinlerin bir kısmı (mevzuat.gov.tr, resmigazete.gov.tr) otomatik okunamadığı için güncel konsolide kopyalardan okundu; işaretlendi. Kesin değerlendirme için §6.5'teki sorular bir turizm/tüketici avukatına sorulmalı.

**Türkiye — seyahat acentası lisansı**

- **1618 sayılı Kanun m.4:** Türkiye'de seyahat acentalığı faaliyeti için Bakanlıktan işletme belgesi zorunlu. Faaliyetin tanımı geniş: turistlere bilgi vermek, paket tur düzenlemek, konaklama ve ulaşımı ayarlamak ([konsolide metin, 05.12.2025](https://www.alomaliye.com/wp-content/uploads/1972/09/1618-sk-05-12-2025.doc); [resmî kaynak](https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=1618&MevzuatTur=1&MevzuatTertip=5)).
- **Yönetmelik m.5:** bilet satışı, paket tur, konaklama rezervasyonu acentalık faaliyetidir. A/B/C grupları yürürlükte; gruplar yerine "ihtisas başkanlıkları" taslağı yasalaşmadı ([Yönetmelik, 26.07.2024 konsolide](https://alomaliye.com/wp-content/uploads/2007/10/seyahat-acent-26-07-2024.doc); [Ekonomi Gazetesi](https://www.ekonomigazetesi.com/turizm/turizmde-taslak-catlagi-24155)).
- **Çevrim içi satış:** 2021 değişikliği mobil uygulamaları da "online satış kanalı" saydı; belge numarası ilk sayfada gösterilir ([RG 31364](https://www.turmob.org.tr/arsiv/mbs/resmigazete/31364-31364-2.pdf)).
- **Belgesiz konaklama:** Acentalar belgesiz tesis ve konut satamaz (2024 değişikliği, [alomaliye](https://www.alomaliye.com/2024/07/26/seyahat-acentalari-yonetmeliginde-degisiklik-26-07-2024/)); 7464 sayılı Kanun aracı platformlara ilan kaldırma yükümlülüğü getirir ([Lexpera](https://www.lexpera.com.tr/mevzuat/kanunlar/konutlarin-turizm-amacli-kiralanmasina-ve-bazi-kanunlarda-degisiklik-yapilmasina-dair-kanun-7464)). Ağustos 2026 tarihli bir Bakanlık genelgesinin aracı platformlara da belge doğrulama getirdiği bildiriliyor (yalnız haber özeti okundu, [alomaliye](https://www.alomaliye.com/2026/10/07/belgesiz-konaklama-ilanlarina-gecit-yok-platformlar-ilanlari-tamamen-kaldiracak/)).
- **Emsal:** 2017'de TÜRSAB'ın haksız rekabet davasında Booking.com hakkında tedbir kararı onaylandı ([Hürriyet](https://www.hurriyet.com.tr/yerel-haberler/mugla/booking-com-icin-yapilan-itiraz-reddedildi-40454315)).
- **Bekleyen düzenleme:** "Yabancı Dijital Konaklama Platformları" kanun teklifi 6 Ekim 2026'da komisyondan geçti; **henüz kanun değil**, yalnız yurt dışı merkezli platformları hedefliyor ([AA/Foreks](https://www.foreks.com/haber/detay/6ac5179795016b5817e66198/AA/tr/yabanci-dijital-konaklama-platformlari-kanunu-teklifi-komisyonda-kabul-edildi-06-10-26/)). Yabancı otel tedarikçilerinin Türkiye'deki durumunu dolaylı etkileyebilir.
- **Boşluk:** Mevzuatta **affiliate/metasearch** (bilgi + yönlendirme + tedarikçiden komisyon; ödeme ve sözleşme bizde değil) açıkça düzenlenmemiş. Asıl soru budur.

**Türkiye — paket tur**

- **Paket Tur Sözleşmeleri Yönetmeliği m.4:** ulaşım, konaklama ve diğer turistik hizmetten en az ikisinin **her şeyin dahil olduğu fiyatla** satılması ya da satışa sunulması, 24 saati aşan ya da geceleme içeren ([Ticaret Bakanlığı PDF](https://ticaret.gov.tr/data/5d42aa1613b87632542a2db3/7116bd5e841e481e2e7c32f8146646d4.pdf)). Düzenleyici ve aracı, bağımsız hizmet sağlayıcıların ifasından da sorumlu.
- Türk hukukunda AB'deki "tıkla-geç paket" kavramı yok. Ayrı bağlantılar, ayrı ödemeler → **muhtemelen** paket değil; tek sepet, tek fiyat → **muhtemelen** paket. Yerleşik içtihat yok.
- **Ürün açısından kritik soru:** Ekranda bileşenleri ayrı ayrı yönlendirip **kişi başı toplam** göstermek "her şeyin dahil olduğu fiyatla satışa sunma" sayılabilir mi? (§6.5 soru 4.)

**Türkiye — yönlendirme modelinde kalan yükümlülükler**

- **Reklam ve fiyat gösterimi:** Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği'nin 1 Ağustos 2026'da yürürlüğe giren değişikliği; yanıltıcı fiyat, "reklam" işaretleme ([Ticaret Bakanlığı](https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeliginde-yapilan-degisikliklerle-tuketicilerin-aldatici-reklam-ve-ticari-uygulamalara-karsi-korunmasi-guclendiriliyor)). Tahminlerin "tahmin" olarak ve tarihle gösterilmesi (§5) bu açıdan da gerekli.
- **6563 e-ticaret:** Sözleşme bizde kurulmuyorsa aracı hizmet sağlayıcı **muhtemelen** sayılmayız; belirsiz ([Lexpera 7416](https://www.lexpera.com.tr/resmi-gazete/metin/7416-elektronik-ticaretin-duzenlenmesi-hakkinda-kanunda-degisiklik-yapilmasina-dair-kanun-31889-7416)).
- **KVKK:** Yurt dışındaki tedarikçi ve affiliate ağlarına veri aktarımı yurt dışına aktarım sayılır; 2024 değişikliğiyle standart sözleşme ve 5 iş günü içinde bildirim ([KVKK duyurusu](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)).

**AB (Faz 4 için)**

- **2015/2302 Paket Tur Direktifi:** tek sözleşme ya da tek satış noktası, toplam fiyat, "paket" adıyla satış ya da **tıkla-geç**: yolcunun adı, ödeme bilgisi ve e-postası başka bir tacire aktarılır ve ikinci sözleşme 24 saat içinde kurulursa paket ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32015L2302)). AB dışındaki düzenleyici AB'ye satış yönlendiriyorsa da kapsamda (m.17).
- **2026/1024 sayılı değişiklik Direktifi:** 28 Mayıs 2026'da yürürlüğe girdi; **bağlantılı seyahat düzenlemeleri (LTA) kaldırıldı**; tıkla-geç kuralı kaldı; yeni m.5a: ek hizmete "davet" ederken paket oluşmadığını açıkça söyleme yükümlülüğü, söylenmezse düzenleyici sayılma. Üye devletler 29 Eylül 2028'e kadar aktarır, 29 Mart 2029'dan itibaren uygulanır ([EUR-Lex](https://eur-lex.europa.eu/eli/dir/2026/1024/oj/eng); [Garrigues](https://blogturismo.garrigues.com/en/european-union/the-european-union-discontinues-linked-travel-arrangements-and-reorganizes-the-legal-framework-governing-package-travel)). O tarihe kadar ulusal LTA kuralları geçerli.

**Model → olası sonuç**

| Model | Türkiye | AB (Faz 4) |
|---|---|---|
| **(a) Yalnız öneri + maliyet tahmini, bağlantı yok** (Faz 1) | En düşük risk. Lisans **muhtemelen** gerekmez (1618 m.1'deki "bilgi vermek" ifadesi nedeniyle düşük bir risk kalır). Fiyat gösterimi ve KVKK kuralları geçerli. | Direktif dışı. |
| **(b) Bileşen başına ayrı affiliate yönlendirme, kullanıcı her birini ayrı öder** (Faz 2) | **Gri alan.** Muhtemelen paket değil; ama komisyonla yönlendirmenin lisanssız acentalık sayılıp sayılmayacağı denenmemiş; TÜRSAB itirazı riski. Belgesiz konaklamaya yönlendirme riski. | Kişisel veri aktarılmazsa paket değil. 2029'a kadar LTA olabilir; sonrasında m.5a uyarısı. |
| **(c) Tek sepet, uçak + oteli biz tahsil ederiz** | Paket tur; düzenleyici ya da aracı: **A grubu lisans**, TÜRSAB üyeliği, zorunlu sigorta, sözleşme yükümlülükleri. | Paket; biz düzenleyiciyiz, iflas koruması dahil tam sorumluluk. |
| **(d) Tek akışta kullanıcı verisini tedarikçiler arasında aktarırız** | Tek akış + toplam fiyat paket yönünde; acentalık faaliyeti → lisans olası. KVKK yurt dışı aktarım. | **Tıkla-geç paket** (24 saat kuralı); 2026 değişikliğinden sonra da. |

**Ürün ekibinin #8 düşüncesine yanıt:** Yönlendirme modeli en düşük riskli satış yolu, buna katılıyorum. Ama **"lisans yükü olmadan" kesin değil.** Türkiye'de affiliate/metasearch açıkça düzenlenmemiş ve 1618'in tanımı geniş. Önerim: Faz 1 model (a) ile çıkar (bağlantı yok, risk en düşük); Faz 2'ye geçmeden avukat görüşü alınır; Faz 4'te tek sepet için iki yol değerlendirilir: lisanslı bir acentayla iş birliği ya da kendi A grubu lisansımız.

### 6.5 Avukata sorulacaklar

1. Bilgi + yönlendirme + tedarikçiden komisyon (ödeme ve sözleşme bizde değil) 1618 m.1 ve Yönetmelik m.5 anlamında "seyahat acentalığı faaliyeti" midir? Metasearch hakkında Bakanlık görüşü, içtihat ya da TÜRSAB tutumu var mı?
2. Lisans gerekirse hangi grup (A/B)? Gerçek süre ve toplam maliyet nedir? İhtisas reformu yakın mı?
3. Şehirlerarası otobüs bileti satmak ya da yönlendirmek için Karayolu Taşıma Yönetmeliği kapsamında ayrı yetki belgesi gerekir mi?
4. Bileşenleri ayrı ayrı yönlendirip ekranda **kişi başı toplam** göstermek "her şeyin dahil olduğu fiyatla satışa sunma" sayılabilir mi? Faz 1'deki tahmin gösterimi bu açıdan risk taşır mı?
5. Belgesiz konaklama genelgesi ve 7464 sayılı Kanun, otellere yalnız bağlantı veren bir uygulamaya belge doğrulama yükümlülüğü getirir mi?
6. Bekleyen yabancı platform düzenlemesi yabancı otel tedarikçileriyle iş birliğimizi nasıl etkiler?
7. Lisanslı bir acentayla iş birliği (beyaz etiket / alt acenta) mümkün mü? Hangi sorumluluk bizde kalır?
8. Hangi modelde 6563 anlamında aracı hizmet sağlayıcı oluruz?
9. Affiliate bağlantı ve sıralama için 2026 reklam yönetmeliği değişikliği sonrası hangi açıklama gerekir? Tahmini fiyatlar yanıltıcı fiyat iddiasına karşı nasıl gösterilmeli?
10. KVKK: her modelde veri sorumlusu kim, aktarım hukuki dayanağı ne, yurt dışı tedarikçiler için standart sözleşme gerekir mi?
11. Lisanssız affiliate modeline TÜRSAB haksız rekabet davası riski ne kadar gerçekçi, nasıl azaltılır?
12. Faz 4: AB'ye satış için AB'de şirket, iflas koruması, GDPR m.27 temsilcisi gerekir mi?

---

## 7. Para kazanma

**Bu bölüm neye karar verdiriyor:** Faz 2'de hangi gelir kalemiyle başlanacağı ve güveni koruyan kuralların neler olacağı. (Bugünkü karar: lansmanda her şey ücretsiz; bu bölüm Faz 2+ içindir.)

| Gelir | Nasıl | Ne zaman | Risk |
|---|---|---|---|
| **Affiliate komisyonu** | Otel (%4–7), etkinlik (%8), araç; uçak düşük (≈ %1) | Faz 2, avukat görüşünden sonra | Lisans gri alanı (§6.4); sıralamayı bozma baskısı |
| **Tripmate+ (abonelik ya da seyahat başı)** | Paket fiyat izleme + sınırsız alternatif + çevrimdışı + dönüş raporu | Faz 3 | Çekirdek değeri ücretliye kilitlemek büyümeyi yavaşlatır |
| **Grup başı tek seferlik "paket kilidi"** | 4+ kişilik grupta rezervasyon koçu bildirimleri ve grup paketi izleme (oylama ve gizli bütçe her zaman ücretsiz) | Faz 3, deneme | Grupta "kim ödeyecek" sorusu |
| **Şehir ortaklığı (B2B)** | Belediye / il turizm müdürlüğü / bölge tanıtım kurumu şehir içeriğine sponsor; beyaz etiket planlayıcı (Mindtrip ve GuideGeek modelinin yerel karşılığı) | Faz 3+ | Editoryal bağımsızlık |
| **Yerel deneyim ortakları** | Atölye, tadım turu; komisyonla | Faz 3+ | Kalite denetimi |

**Güven kuralları (pazarlığa kapalı):**

1. **Sıralama satılmaz.** Paket puanı komisyonu bilmez; motorun girdisinde komisyon alanı yoktur.
2. **Komisyonsuz seçenek eşit görünür.** En ucuz ya da en uygun seçenek komisyon getirmiyorsa da aynı biçimde gösterilir (ör. TCDD).
3. **Açık etiket:** "Bu bağlantıdan komisyon alabiliriz; fiyatı etkilemez."
4. **Sponsorlu içerik** ayrı rozetle; paket motoruna girmez.
5. **Tahmin dürüstlüğü** (§5) gelirden önce gelir: tahminimiz kötüyse bunu söyleriz.

---

## 8. Farklılaştırıcı fikirler

**Bu bölüm neye karar verdiriyor:** Hangi fikirlerin Faz 1'e, hangilerinin sonraya gireceği. Faz önerisi her fikrin sonunda.

1. **Gizli bütçe tavanı.** Grubun her üyesi yalnız motorun gördüğü bir üst sınır girer; motor paketleri bu sınırların en küçüğüne göre işaretler ama kimin olduğunu söylemez. *Neden önemli:* Arkadaş gruplarında para konuşmak en büyük sürtünme; az bütçeli kişi ya sessizce zorlanır ya geziden düşer. Rakiplerin hiçbiri buna dokunmuyor. *Veri:* üye bazında gizli tavan (RLS'le yalnız sahibine ve motora açık), paket kişi başı maliyeti. *Faz 1.*

2. **Yarım gün mühendisliği.** Paket ilk ve son günü gerçek varış/dönüş saatine göre kurar: sabah 07:30'da gece otobüsüyle gelene "valizi otele bırak, kahvaltı, 2 hafif durak" programı; dönüş 18:00'deyse son gün otogara/gara yakın biter. *Neden önemli:* Rakipler günleri tam gün sayar; gerçekte gezinin üçte biri bu yarım günlerde kaybolur. *Veri:* gün `yarim_gun_uygun`, şehir terminal/havalimanı süreleri, emanet bilgisi, otel giriş saati. *Faz 1.*

3. **Şehirde geçen saat.** Her paket ve takas, fiyatın yanında "şehirde geçirdiğin uyanık saat" metriğini gösterir: "Uçakla 41 saat, otobüsle 34 saat". *Neden önemli:* Kullanıcı parayı karşılaştırabiliyor ama zamanı göremiyor; ucuz ulaşım bazen yarım gün çalıyor. *Veri:* ulaşım süreleri, terminal transferleri, günün başlangıç/bitişi. *Faz 1.*

4. **Takvim radarı: izin optimizasyonu.** "Ekim sonunda 1 gün izinle 4 gün" gibi resmî tatil ve köprüleri tarayıp hem en uzun hem en ucuz pencereleri önerir; sezon çarpanı ve bayram kalabalığını hesaba katar. *Neden önemli:* Türkiye'de kısa gezilerin çoğu bayram ve köprülerde; kullanıcı tarihi değil izin gününü optimize ediyor. *Veri:* resmî tatil takvimi, şehir sezon çarpanı, rota fiyat verisi. *Faz 1 (ilham ekranında).*

5. **İndirim cüzdanı.** Profilde Müze Kart, öğrenci, 65+, şehir ulaşım kartı; paket maliyeti kişiye göre değişir ("Müze Kart'ın var: bilet kalemi 0"). Grupta herkesin payı kendi cüzdanına göre. *Neden önemli:* Türkiye'de müze maliyetinin büyük kısmı Müze Kart'la sıfırlanıyor; rakiplerin tahmini bunu bilmiyor. *Veri:* yer `muzekart`, indirim türleri, şehir kart bilgisi. *Faz 1.*

6. **Tahmin karnesi.** Uygulama şehir bazında kendi doğruluğunu yayınlar: *"Eskişehir paketlerimiz son 30 gezide ortalama %7 saptı; yemekte az hesaplıyoruz."* *Neden önemli:* Dürüst maliyet vaadinin kanıtı; güveni pazarlama değil ölçüm kurar. *Veri:* planlanan/gerçekleşen, kapanış anketi. *Faz 3.*

7. **Akşamdan B planı.** Hava tahmini yağmur ya da aşırı sıcak diyorsa B planı bir akşam önce, gün başlamadan cebe gelir; aynı bölgede kalan, aynı tempoda iç mekan alternatifler. *Neden önemli:* Sabah yağmurla karşılaşan grup 40 dk kafede karar verir; çözüm önceden hazırsa gün kurtulur. *Veri:* yer `ortam`, `yedek` duraklar, bölge, hava tahmini. *Faz 3.*

8. **Bebek ve çocuk ritmi.** "Bebekliyiz" denince program öğle uykusu penceresini otele yakın bırakır, bebek arabasıyla gidilemeyen durakları eler, akşam yemeğini erkene çeker, alt değiştirme imkânı olan yerleri işaretler. *Neden önemli:* Aileler genel planlayıcılarda planı baştan yeniden yazıyor; kimse bu ritmi ürüne koymuyor. *Veri:* bebek arabası/çocuk uygunluğu, `tempo_yuku`, bebek bakım bilgisi, otel-durak süreleri. *Faz 3.*

9. **Tek fark karşılaştırması.** Alternatifler üç tam kart olarak değil, önerilenden **farkları** olarak gösterilir: "B yalnız şu 2 noktada farklı". *Neden önemli:* Karar yükünü azaltır, "sade ve hızlı" ürün tonunun özü. *Veri:* paket bileşen yapısı, gerekçe kodları. *Faz 1.*

10. **Rezervasyon koçu.** Listede her kalemin "ne zaman, hangi sırayla alınmalı" önerisi: *"Cuma YHT'leri hızlı doluyor, önce onu al; otel ücretsiz iptalli, sonra"*. *Neden önemli:* Grupta biletler geç alınınca paket çöker; sıra bilgisi kimsede yok. *Veri:* kalem bazında doluluk/oynaklık bilgisi (editör), iptal edilebilirlik, kalkış günü. *Faz 1 (editör bilgisiyle), Faz 2 (canlı).*

11. **Gezi kartı → başkasının paketi.** Dönüşte otomatik anı kartı; arkadaş kartı açıp "bana kur" derse aynı gezi onun şehrinden, tarihinden ve bütçesinden yeniden hesaplanır. *Neden önemli:* Büyüme döngüsü; "ben şöyle gezdim" paylaşımı ürünün kendisini taşır. Kullanıcı yüklemeli içerik değil, ölçülmüş bir plan. *Veri:* gerçekleşen plan, tamamlanan duraklar, puanlar, gerçekleşen maliyet. *Faz 3.*

12. **On beş dakikalık semt testi.** Konaklama bölgesi seçilirken "bu semtten 15 dakikada yürüyerek nerelere varırsın" haritası (paketin duraklarından kaçı bu alanda) ve semtin akşam karakteri ("21:00'den sonra sakin", "gece canlı"). *Neden önemli:* Otel seçiminin asıl sorusu semt; OTA'lar otel fotoğrafı gösteriyor, semtin günle ilişkisini değil. *Veri:* bölge karakteri, kendi süre matrisimiz, bölgenin durak yakınlığı. *Faz 1.*

13. **Yorgunluk algılayıcı.** Gezi sırasında atlanan durak ve gecikme birikirse öğleden sonra için hafif sürüm ve "otelde mola" önerisi. *Neden önemli:* Planlar yorgunlukla bozulur; uygulama bunu kullanıcıdan önce fark eder. *Veri:* `completed_at` gecikmeleri, `skipped`, `tempo_yuku`. *Faz 3.*

14. **Paket izleme.** Bir paketi "izle": kişi başı toplam belli bir tutar düşerse ya da bayram fiyatları açılınca bildirim. Rakipler yalnız uçuşu izliyor; biz gezinin toplamını. *Neden önemli:* Karar verememiş kullanıcıyı geri getirir. *Veri:* paket anlık görüntüsü, periyodik fiyat yenileme (maliyetli, yalnız izlenenlerde). *Faz 3.*

---

## 9. Ekran ve akış listesi

**Bu bölüm neye karar verdiriyor:** Tasarım tarafının kanvasa çizeceği ekranların listesi ve sırası. Görsel karar yok.

| # | Ekran | Ne gösterir | Kullanıcı ne yapar | Faz |
|---|---|---|---|---|
| P0 | **Ana sayfa eki** | Gezi kartlarında "senin şehrinden kişi başı aralık"; "Bu hafta sonu nereye?" bölümü; "Paket kur" girişi | Karta dokunur, bütçe kartını açar, paket kurmaya başlar | 1 |
| P1 | **İstek sihirbazı** (5 adım) | Nereden/kaç kişi/kimle · tarih/esneklik · ilgi (≤3) · şehir içi hareket + tempo · bütçe | Tek dokunuşla seçer; son adımda isteğe bağlı serbest metin | 1 |
| P1b | **Anladığım çipler** | Serbest metinden çıkan çipler | Yanlış çipi siler, onaylar | 1 |
| P2 | **Nereye gidebilirim** (varış boşsa) | En çok 5 şehir: kişi başı aralık, kapıdan kapıya süre, şehirde geçen saat, eşleşen ilgi | Şehir seçer | 1 |
| P3 | **Paket önerisi** | Önerilen paket kartı + 2 "tek fark" alternatifi; kişi başı aralık, güven, tarih | Seçer, detaya iner, sohbete gönderir | 1 |
| P4 | **Paket detayı** | Dört bölüm: Ulaşım · Konaklama (bölge, Faz 2'de otel) · Program (gün kartları) · Maliyet; her bölümde gerekçe satırı | Bölümleri açar, gerekçeye dokunur, kabul eder | 1 |
| P5 | **Takas ve kilitler** (alt pencere) | 3–6 takas kartı (₺ · saat · yol); kilitli bileşenler | Takası uygular, bileşen kilitler, geri alır | 1 |
| P6 | **Maliyet kırılımı** | Kalemler, rozet (Canlı/Tahmin/Senin), aralık, tarih, indirimler | "Neden bu aralık?"a dokunur, indirim cüzdanını açar | 1 |
| P7 | **Semt kartı** | Bölge karakteri, 15 dakikalık yürüme alanı, fiyat bandı | Başka bölge seçer | 1 |
| P8 | **Sohbet: paket kartı** | Seçenekler, herkesin kendi payı, oy durumu, "herkesin bütçesine uyuyor ✓" | Olur/olmaz + yıldız; gizli tavan girer | 1 |
| P9 | **Oda düzeni ve kişiye özel kalemler** | 2+2+1 gibi düzen; isteğe bağlı kalemlerde kimin katıldığı | Düzeni ve katılımı seçer | 1 |
| P10 | **Kabul onayı** | Seyahate neler yazılacak: tarih, günler, plan, bütçe, rezervasyon listesi | Onaylar | 1 |
| P11 | **Rezervasyon listesi** (Gezi sekmesi) | Kalemler, önerilen sıra ve son tarih; Faz 2'de tedarikçi seçenekleri | "Aldım" der, tutarı ve ödeyeni girer | 1 / 2 |
| P12 | **Bütçe nabzı** (Harcama sekmesi) | Kategori bazında planlanan/gerçekleşen, kişi başı, gün gün | Kategoriye dokunur, harcama ekler | 1 |
| P13 | **Fiyat değişim bandı** | Değişen kalem, eski/yeni, kişi başı etkisi, yeni takaslar | Kabul eder ya da takas seçer | 2 |
| P14 | **B planı kartı** (Plan sekmesi) | Akşamdan gelen öneri, değişen duraklar, maliyet farkı | Uygular ya da yok sayar | 3 |
| P15 | **Dönüş özeti** | Planlanan/gerçekleşen, tahmin sapması, kapanış anketi (yalnız boş kategoriler) | Yanıtlar, ödeşir | 1 |
| P16 | **Gezi kartı** | Rota, duraklar, puanlar, kişi başı toplam | Paylaşır; alan kişi "bana kur" der | 3 |
| P17 | **Paket izleme** | İzlenen paketler, son toplam, bildirim eşiği | İzlemeyi açar/kapar | 3 |
| BO1 | **Etiket paneli** (yer, gezi, gün, durak editörlerinde) | Sözlükten çipler, eksik etiket rozeti, AI önerisi onay kutusu | Etiketi seçer, AI önerisini onaylar/reddeder | 0 |
| BO2 | **Bölge editörü** | Şehrin konaklama bölgeleri: merkez + yarıçap, karakter, fiyat bantları | Bölge ekler/düzenler | 0 |
| BO3 | **Maliyet tabloları** | Şehir/bölge/rota fiyat tabloları, kaynak, tarih, yaşlanma uyarısı | Günceller, kaynağı girer | 0 |
| BO4 | **Motor önizleme** | Bir örnek istekle motorun ürettiği paket, aday sayısı, gerekçe kodları | İstek girer, sonucu inceler, ağırlıkları ayarlar | 1 |
| BO5 | **Tahmin karnesi** | Şehir × kategori sapma, örnek sayısı | Tabloyu kalibre eder | 3 |

---

## 10. Yol haritası

**Bu bölüm neye karar verdiriyor:** Faz sırası ve her fazın "geçti" ölçütü.

| Faz | Ne | Ölçülen | Geçiş ölçütü (öneri) |
|---|---|---|---|
| **0 — Hazırlık** (2–3 hafta) | Etiket sözlüğü onayı; veri modeli (durak→yer bağı, etiket alanları, bölgeler, maliyet tabloları); BO etiket paneli; içerik hattına etiket; Eskişehir pilotu; konum kaynağının Google'dan OSM'ye geçişi; Harcama verisinden anonim maliyet toplama. Ayrıntı: `09` §8. | Etiket doluluk oranı (zorunlu alanlar) · yer başına etiketleme süresi · AI önerisinin onaylanma oranı | Pilot şehirde zorunlu etiketler %100, AI önerilerinin ≥ %80'i değiştirilmeden onaylanıyor |
| **1 — Öneri + maliyet tahmini** (rezervasyon ve bağlantı yok) | P0–P12, P15; motor (hedef, iskelet, uyarlama, bölge, ulaşım, maliyet, alternatif, açıklama); 8+ şehir; İstanbul/Ankara/İzmir çıkışı; grup oylama ve gizli tavan | Paket → seyahat dönüşümü · takas kullanımı · alternatif seçilme dağılımı · grup oylama katılımı · **tahmin sapması** (kategori bazında) · paket başına dış istek | Dönüşüm ≥ %25; grup paketlerinde oy katılımı ≥ %60; toplam tahmin sapması medyanı ≤ %15; paket başına Google isteği 0 |
| **2 — Yönlendirme ve canlı fiyat** (avukat görüşünden sonra) | Affiliate (otel, etkinlik, araç; uçak); P11 tedarikçi seçenekleri; P13 değişim bandı; Turna/Türk OTA görüşmeleri | Tıklama → rezervasyon · aktif seyahat başı gelir · canlı/tahmin fark oranı · fiyat değişimi sıklığı | Canlı fiyatlı kalemlerde tahmin sapması ≤ %5; gelirin güven kuralı ihlali sıfır |
| **3 — Gezi sırasında ve sonrasında akıllı** | B planı, yorgunluk algılayıcı, bütçe nabzı bildirimleri, tahmin karnesi, gezi kartı → "bana kur", paket izleme, bebek ritmi; Tripmate+ denemesi | B planı kabul oranı · "bana kur" dönüşümü · karne yayımlanan şehir sayısı · abonelik dönüşümü | Gezi kartından gelen yeni seyahat ≥ toplamın %10'u |
| **4 — Yurt dışı ve tek sepet** | Avrupa şehirleri, döviz, AB hukuku; lisanslı ortak ya da kendi lisansla tek sepet; çok şehir (#20) | Yurt dışı paket payı · tek sepet dönüşümü | — |

**Faz 1'in ön koşulu:** Kapsanan şehir sayısı. Bugün 1 şehir (Eskişehir) var. Bütçeden başlayan arama 8 şehrin altında anlamsız. İçerik hattının hızı (gezi başına maliyet ve Ece'nin onay süresi) Faz 1'in takvimini belirler; Faz 0'da ölçülmeli.

---

## 11. Riskler ve açık sorular

**Bu bölüm neye karar verdiriyor:** Ece'nin vermesi gereken kararlar, seçenekleriyle.

### 11.1 Riskler

| Risk | Etki | Önlem |
|---|---|---|
| İçerik hacmi: şehir başına yer + bölge + maliyet tablosu ağır | Yüksek | Etiketlerin çoğunu AI önerir, Ece onaylar; şehir başına asgari set (`09` §3.8); Faz 0'da süre ölçülür |
| Maliyet tahmini kötü çıkar, güven kaybolur | Yüksek | Her zaman aralık + tarih; karne; kalibrasyon; ilk şehirlerde geniş aralık |
| Google koşulları: bugün `yerler`, `gezi_duraklari` ve `sehirler` Google'dan alınan koordinatları süresiz saklıyor | Orta–yüksek | Faz 0'da konum kaynağı OSM'ye (ya da 30 günlük yenilemeye) geçer (`09` §6.5) |
| Lisans gri alanı (Faz 2) | Yüksek | Faz 1 bağlantısız; Faz 2 öncesi avukat |
| Türk tedarikçilerin API/affiliate eksikliği | Orta | Turna API ve doğrudan görüşmeler; Faz 1 bunlara bağımlı değil |
| Google AI Mode Türkiye'de seyahate açılırsa | Orta | Farkımız editör içeriği, grup kararı, planlanan/gerçekleşen ve gezi sırasında yanında olmak; aramada değil |
| Ürünün kalabalıklaşması (Wanderlog tuzağı) | Orta | Paket her zaman tek ana kart; takaslar alt pencerede; alternatif tek fark |
| LLM uydurması | Düşük (tasarım gereği) | §4.8 kuralları; LLM rakam ve yer üretmez |

### 11.2 Açık sorular (karar bekleyen)

| # | Soru | Seçenekler | Önerim |
|---|---|---|---|
| S1 | İlke #1'in yeni metni | (a) §0'daki öneri · (b) daha dar: "yalnız editör gezisini uyarlar" | (a) |
| S2 | Faz 1 birincil persona | (a) Arkadaş grubu + çift · (b) yalnız arkadaş grubu · (c) aileler | (a) |
| S3 | Alternatif sayısı | (a) 1 + 2 tek fark · (b) 3 eşit kart · (c) yalnız 1 + takaslar | (a) |
| S4 | Bütçe girişi | (a) kişi başı toplam, ulaşım dahil · (b) ulaşım hariç · (c) yalnız seviye | (a) + seviye yedeği |
| S5 | Faz 1'de uçak | (a) önbellekli fiyat verisiyle aralık · (b) Faz 1'de uçak yok, yalnız otobüs/YHT/araba | (a), güven "düşük-orta" işaretli |
| S6 | Faz 1 şehir hedefi | (a) 8 şehir · (b) 5 şehir, bütçe kartı kapalı · (c) 12 şehir | (a) |
| S7 | Harcama kategorisi | (a) `ulasim_sehirlerarasi` yeni kategori · (b) alt etiket · (c) değişiklik yok | (a) |
| S8 | Gizli bütçe tavanı | (a) Faz 1 · (b) Faz 3 Tripmate+ | (a): farkımızın çekirdeği |
| S9 | Kendi süre matrisi (OSM yönlendirme) | (a) Faz 1'in ilk işi olarak kur · (b) mevcut `gezi_rota_onbellek` yaklaşımını genişlet, matris kurma | (a); Faz 0'ın dışında |
| S10 | Harcama verisinden anonim maliyet toplama | (a) şimdi başla, gizlilik metnini güncelle · (b) Faz 1'de | (a) |
| S11 | Avukat görüşü zamanı | (a) Faz 1 sırasında · (b) Faz 2 öncesi | (a): soru 4 Faz 1'i de ilgilendiriyor |
| S12 | Tek sepet uzun vadesi | (a) lisanslı acenta ortaklığı · (b) kendi A grubu lisansı · (c) hiç | Karar Faz 3 sonunda, uygulama Faz 4 |
| S13 | B planı ve izleme için hava tahmini sağlayıcısı | Ticari kullanım şartlarına göre seçim | Faz 3'te |

---

## 12. Ürün ekibinin ilk düşüncelerine yanıt

| # | Düşünce | Katılıyor muyum | Gerekçe ve önerim |
|---|---|---|---|
| 1 | **Bütçeden başlayan arama** | Kısmen | Güçlü bir giriş, ama yalnız kapsadığımız şehirlerden sıraladığı için az şehirde tekdüze ve boş görünür. Önerim: (a) ana sayfada bir bölüm olsun, ana akış değil; (b) 8 şehirden önce açılmasın; (c) tek rakam değil aralık göstersin; (d) **tarih esnekliği** (±1 gün, "ekim sonunda bir hafta sonu") eklensin, çünkü bütçe en çok tarihe bağlı; (e) sonucu "şehirde geçen saat" ile birlikte göstersin (fikir 3). |
| 2 | **Paket dengeleyici** | Özüne evet, kaydırıcıya hayır | Bedelin açıkça gösterilmesi ürünün kalbi. Ama kaydırıcı sürekli bir uzay vaat eder, seçenekler kesiklidir. Her hareket gerçek bir pakete karşılık gelmeli: **takas kartları + kilitler** (§3.4). Üç sayı her kartta aynı: ₺ · şehirde geçen saat · günlük yol. |
| 3 | **Esnek hazır gezi** | Tamamen | Etiketlerin asıl sebebi bu. İki ek: (a) editör esnekliği kendisi işaretlemeli (çekirdek/seçmeli gün, birleşebilir gün çifti), motor tahmin etmemeli; (b) blog yazısı tek parça olduğu için uyarlanmış pakette **gün kartları** gösterilmeli; bu yüzden güne kısa anlatı alanı ekliyoruz (`09`). Durak→yer bağı (`09` §6.4) bunun ön koşulu. |
| 4 | **Grup paketi** | Evet, iki düzeltmeyle | (a) Aynı çıkış noktası kararıyla (K4) kişi başı fark oda düzeninden ve isteğe bağlı kalemlerden doğar; oda düzeni sorusu akışa girmeli. (b) "Bölüşüm Harcama'ya önceden kurulmuş gelsin": **gerçekleşmemiş harcama kaydı açılmamalı**, bakiyeleri bozar. Önceden kurulan şey **planlanan bütçe** ve **rezervasyon listesi** olmalı; "Aldım" deyince harcama ve bölüşüm otomatik oluşur. Ek: **gizli bütçe tavanı** (fikir 1) ve süreli onay oyu. |
| 5 | **Planlanan ile harcanan** | Evet, ölçüm uyarısıyla | Kullanıcı küçük harcamaları girmez; yemek eksik kalır, "tahminimiz tuttu" sonucu yanlı olur. Kapanış anketi (yalnız boş kategoriler) ve kapsama eşiği gerekir. Öğrenme için şehir başına asgari örnek. Veri toplamaya bugünkü Harcama'yla **şimdi** başlanabilir. |
| 6 | **B planı** | Evet | İki ek: (a) kapalı müze B planı konusu olmamalı, plan kurulurken zaten engellenmeli (`kapali_gunler` DB'de tutulmalı); (b) B planı **bir akşam önce** hava tahminiyle gelmeli, yağmur başladığında değil. Her zaman öneri, kendiliğinden uygulanmaz. |
| 7 | **Dürüst maliyet** | Tamamen | Üçüncü tür eklenmeli: **kullanıcının girdiği** rakam. Tahmin hiçbir zaman tek rakam olmamalı; toplam aralığında uçlar toplanmamalı (§5.3). |
| 8 | **Yönlendirme, lisans yükü olmadan** | Kısmen | En düşük riskli satış yolu, ama "lisans yükü olmadan" Türkiye'de **kesin değil**: affiliate/metasearch açıkça düzenlenmemiş, 1618'in tanımı geniş, TÜRSAB'ın 2017 Booking.com davası emsal. Ayrıca kişi başı toplam gösterip bileşenleri yönlendirmenin "her şeyin dahil olduğu fiyatla satışa sunma" sayılıp sayılmayacağı sorulmalı. Önerim: Faz 1 bağlantısız; Faz 2 öncesi avukat görüşü (§6.4–6.5). |

---

## Kaynaklar

Tüm bağlantılar 14 Ekim 2026'da okundu. Belge içinde ilgili satırda da verilmiştir.

**Rakipler:** [Mindtrip](https://mindtrip.ai/) · [Mindtrip Avrupa](https://mindtrip.ai/press/mindtrip-expands-to-europe) · [Mindtrip grup sohbeti](https://www.phocuswire.com/mindtrip-secures-12m-funding-launches-group-chat) · [Expedia–Layla](https://ir.expediagroup.com/news-and-events/news/news-details/2026/Expedia-Group-acquires-Layla-accelerating-its-AI-powered-trip-planning-and-booking-strategy/default.aspx) · [Trip Planner AI](https://tripplanner.ai/) · [Wonderplan](https://wonderplan.ai/) · [Gemini planlama](https://blog.google/products-and-platforms/products/gemini/how-gemini-plans-trips/) · [AI Mode otel](https://www.phocuswire.com/news/technology/google-ai-mode-hotel-booking-agentic-flights-loyalty) · [AI Mode Türkiye](https://webrazzi.com/2026/02/18/google-ai-modu-ve-ai-bakisi-ozelliklerini-turkiye-de-de-kullanima-sunmaya-basladi/) · [ChatGPT uygulamaları](https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor) · [ChatGPT ödeme](https://www.altexsoft.com/travel-industry-news/chatgpt-can-inspire-the-trip-but-otas-still-close-the-sale/) · [Wanderlog](https://wanderlog.com/trip-planner-mobile-app) · [Trip.com](https://gulfbusiness.com/en/2026/travel/trip-coms-siddharth-sudhakar-on-the-rise-of-agentic-travel/) · [Wizz Holidays](https://cyprus-mail.com/2026/07/02/airline-introduces-ai-platform-for-holiday-planning) · [Troupe](https://www.troupe.com/) · [Tripsy](https://tripsy.app/) · [Skyscanner 2026](https://www.traveldailynews.com/technology/skyscanner-expands-ai-travel-planning-tools-and-live-flight-features/) · [Kayak Explore](https://www.kayak.com/explore) · [Budget Your Trip](https://www.budgetyourtrip.com/) · [Bütçe hesaplayıcıları](https://travelnoire.com/travel-budget-calculators)

**Tedarik:** [Travelpayouts Data API](https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access) · [Duffel fiyat](https://duffel.com/pricing) · [Skyscanner Travel API](https://www.partners.skyscanner.net/product/travel-api) · [Amadeus kapanış](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) · [Booking → Awin](https://www.phocuswire.com/booking-terminates-partnerships-content-creators) · [Agoda sözleşmesi](https://partners.agoda.com/Content/pdf/Agoda_OnlineAffiliateAgreement.pdf) · [Hotellook kapanış](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook) · [LiteAPI](https://docs.liteapi.travel/reference/api-pricing-usage-costs) · [Viator](https://partnerresources.viator.com/) · [GetYourGuide API](https://github.com/getyourguide/partner-api-spec/wiki/Getting-started) · [Turna API](https://www.turna.com/turna-api-hizmeti) · [DiscoverCars](https://www.discovercars.com/uk/affiliate) · [Google Maps fiyat değişikliği](https://developers.google.com/maps/billing-and-pricing/march-2025) · [Google hizmet koşulları](https://cloud.google.com/maps-platform/terms/maps-service-terms)

**Hukuk:** [1618 (resmî)](https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=1618&MevzuatTur=1&MevzuatTertip=5) · [1618 konsolide](https://www.alomaliye.com/wp-content/uploads/1972/09/1618-sk-05-12-2025.doc) · [Seyahat Acentaları Yönetmeliği konsolide](https://alomaliye.com/wp-content/uploads/2007/10/seyahat-acent-26-07-2024.doc) · [Paket Tur Sözleşmeleri Yönetmeliği](https://ticaret.gov.tr/data/5d42aa1613b87632542a2db3/7116bd5e841e481e2e7c32f8146646d4.pdf) · [7464](https://www.lexpera.com.tr/mevzuat/kanunlar/konutlarin-turizm-amacli-kiralanmasina-ve-bazi-kanunlarda-degisiklik-yapilmasina-dair-kanun-7464) · [Yabancı platform teklifi](https://www.foreks.com/haber/detay/6ac5179795016b5817e66198/AA/tr/yabanci-dijital-konaklama-platformlari-kanunu-teklifi-komisyonda-kabul-edildi-06-10-26/) · [Booking.com 2017](https://www.hurriyet.com.tr/yerel-haberler/mugla/booking-com-icin-yapilan-itiraz-reddedildi-40454315) · [Reklam yönetmeliği 2026](https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeliginde-yapilan-degisikliklerle-tuketicilerin-aldatici-reklam-ve-ticari-uygulamalara-karsi-korunmasi-guclendiriliyor) · [KVKK yurt dışı aktarım](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu) · [AB 2015/2302](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32015L2302) · [AB 2026/1024](https://eur-lex.europa.eu/eli/dir/2026/1024/oj/eng) · [Garrigues özeti](https://blogturismo.garrigues.com/en/european-union/the-european-union-discontinues-linked-travel-arrangements-and-reorganizes-the-legal-framework-governing-package-travel)

**Doğrulanamayanlar:** Layla uygulamasının Expedia sonrası durumu; Expedia Romie'nin sürüp sürmediği; Kiwi Tequila'nın kapalılık derecesi; Duffel Payments'ın Türkiye desteği; Booking.com'un Awin'deki güncel oranı ve uygulama/Türk şirketi uygunluğu; Enuygun, Wingie, Obilet, Etstur, Tatilbudur ve Jolly'nin affiliate programları (herkese açık sayfa bulunamadı); 2026 müze fiyatları; Müze, Biletix/Passo ve TCDD için API; Ağustos 2026 Bakanlık genelgesinin tam metni.
