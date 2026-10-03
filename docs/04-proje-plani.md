# Proje Planı — v1 yayına kadar

Sürüm: 0.1 · Tarih: 3 Ekim 2026 (Cumartesi) · Sahip: Ece
Varsayımlar: geliştirici hafta içi her gün çalışır, günde 1–2 PR; ürün incelemesi aynı gün; cihaz testi akşam/hafta sonu Ece'de. Tarihler kayarsa plan haftalık güncellenir; kilometre taşları sabit kalmaya çalışır.

## Kilometre taşları

| Tarih | Kilometre taşı | Ölçüt |
|---|---|---|
| 9 Eki Cum | **M1 · Çekirdek temiz** | #24–#34 kapalı, tek cihazda uçtan uca akış hatasız |
| 16 Eki Cum | **M2 · v1 özellik tamam** | 3.10 davet linki tarayıcıda çalışıyor, iki cihazla ortak düzenleme |
| 23 Eki Cum | **M3 · 5 kişi testi bitti** | Bulgular issue'da, kritik olanlar kapalı |
| 30 Eki Cum | **M4 · Mağazaya hazır** | İsim, logo, gizlilik politikası, mağaza metinleri, Apple/Play hesapları |
| 6 Kas Cum | **M5 · Kapalı beta** | TestFlight + Play internal, 20 kişi |
| 13 Kas Cum | **M6 · Mağaza gönderimi** | İki mağazaya inceleme için gönderildi |
| 20 Kas Cum | **M7 · v1 yayında** | Mağazada; v2 planı onaylı |

## Haftalık plan

### Hafta 1 · 5–9 Ekim — Hatalar ve bilgi mimarisi
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 5 | #24 pin çizimi, #25 Atla sonsuz yükleme, #26 ikonlar → tek PR, derleme | Akşam: otel ekranı + Atla yolu + ikonlar testi |
| Sal 6 | #32 harita kayması, #34 Günler+Program birleşmesi (Harita/Çizelge) | PR incelemesi; akşam test |
| Çar 7 | #33 rota çizgisi, #30 pin etiketleri (tüm haritalar) | PR incelemesi |
| Per 8 | #28 bölgede ara, #29 önizleme kartı; derleme | Akşam: Keşfet'te Üsküdar denemesi, önizleme kartı |
| Cum 9 | #31 fotoğraf galerisi; küçük düzeltmeler | **M1 kontrolü:** Roma seyahatini baştan sona kur (otel, 8 mekan, 3 gün, program) |
| Hafta sonu | — | Bugünün tarihiyle İstanbul'da 2 saatlik gerçek "gezi": Vardık, Kaydır, mini-çubuk |

### Hafta 2 · 12–16 Ekim — Davet linki ve Sprint 4
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 12 | 3.10 web istemci: `/r/{token}` sayfası, `invite_preview`, `join_trip` | **Alan adı al** (sabah) → DNS'i geliştiriciye ver |
| Sal 13 | 3.10: tarayıcıda Program + Keşfet, universal/app links | PRD v0.3 yazımı (IA değişikliği, #28–#34 kararları, 3.3 v0.3) |
| Çar 14 | Hız sınırı (join_trip, invite_preview), §9 bildirimler, §10 analitik olayları | PRD v0.3 depoya |
| Per 15 | Derleme + web dağıtımı; hata turu | Akşam: bir arkadaşa link gönder, o tarayıcıdan mekan eklesin |
| Cum 16 | Düzeltmeler | **M2 kontrolü:** iki cihaz, 2 sn içinde senkron; misafir sonradan hesap açınca birleşiyor mu |
| Hafta sonu | — | Test katılımcılarını belirle (5 kişi, son 6 ayda arkadaşla şehir gezisi yapmış) |

### Hafta 3 · 19–23 Ekim — 5 kişi testi
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 19 | Bekleme/küçük işler; test APK'sı sabit | Test 1–2: görev "Ayşe seni Roma'ya davet etti, planı bitir" (30 dk, ekran kaydı) |
| Sal 20 | — | Test 3–4 |
| Çar 21 | — | Test 5; bulguları issue'lara yaz (ürün) |
| Per 22 | Kritik bulgular (akışı kıranlar) | Önceliklendirme |
| Cum 23 | Kritik bulgular, derleme | **M3 kontrolü** |

### Hafta 4 · 26–30 Ekim — Mağaza hazırlığı
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 26 | Orta öncelikli test bulguları | **İsim kararı** (bkz. isim listesi), alan adı/sosyal hesaplar, **Apple Developer başvurusu (99 $)**, **Play Console (25 $)** |
| Sal 27 | Uygulama adı/ikon/splash değişimi; Apple girişi açılır | Logo (basit yazı logosu yeter), gizlilik politikası + kullanım koşulları metni (şablon) |
| Çar 28 | Hesap silme, veri dışa aktarma (mağaza şartı), çökme raporlama | Mağaza metinleri (TR + EN kısa), 5 ekran görüntüsü |
| Per 29 | Performans turu: Program 500 ms, soğuk açılış | Google Cloud: faturalandırma ve kota kontrolü, bütçe 50 $'a |
| Cum 30 | Sürüm derlemeleri (release) | **M4 kontrolü** |

### Hafta 5 · 2–6 Kasım — Kapalı beta
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 2 | TestFlight + Play internal yükleme | 20 kişilik beta listesi (test grubu + arkadaşlar), davet |
| Sal 3–Per 5 | Beta hataları | Geri bildirim toplama (tek form), günlük özet |
| Cum 6 | Düzeltmeler, derleme | **M5 kontrolü:** beta'da akışı kıran hata yok |

### Hafta 6 · 9–13 Kasım — Gönderim
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 9–Çar 11 | Son düzeltmeler, sürüm notu | Mağaza formları, yaş derecelendirme, veri güvenliği beyanı |
| Per 12 | Gönderim derlemeleri | App Store + Play gönderimi |
| Cum 13 | — | **M6:** inceleme bekleniyor (Apple 1–3 gün, Play 1–7 gün) |

### Hafta 7 · 16–20 Kasım — Yayın ve v2
| Gün | Geliştirici | Ürün (Ece) |
|---|---|---|
| Pzt 16–Çar 18 | İnceleme reddi olursa düzeltme | v2 planı: Gezi sonu puanlama → Haritam → Arkadaşlar → Profil (kapsam §5), ardından #20–#22 |
| Per 19–Cum 20 | — | **M7:** yayın, ilk 100 kullanıcı ölçütleri (kapsam §6) izlemeye alınır |

## Ece'nin tarihli işleri (özet)
- 12 Eki: alan adı
- 16 Eki: iki cihaz testi (bir arkadaşla)
- 17–18 Eki: 5 test katılımcısını bul
- 19–21 Eki: testler
- 26 Eki: isim kararı, Apple Developer + Play Console hesapları
- 27–28 Eki: logo, gizlilik politikası, mağaza metinleri, ekran görüntüleri
- 2 Kas: beta davetleri
- 12 Kas: mağaza gönderimi

## Riskler ve tampon
- Apple Developer onayı 1–7 gün sürebilir; 26 Ekim'de başvurulursa 2 Kasım TestFlight'a yetişir, gecikirse Android beta önce başlar.
- 5 kişi testi büyük bir akış değişikliği çıkarırsa Hafta 4'e 3 gün tampon var (orta öncelikli işler ertelenir).
- Mağaza reddi olursa yayın 27 Kasım'a kayar; v2 planı etkilenmez.

## Takip
- Her Cuma: bu belge güncellenir (yapıldı / kaydı / neden), kilometre taşı durumu README'ye işlenir.
- GitHub'da issue'lar `M1`…`M7` kilometre taşlarına bağlanır; açık issue sayısı = kalan iş.
