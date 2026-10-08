# Kapsam Dokümanı — Gezi Planlayıcı (çalışma adı)

Sürüm: 0.3 · Tarih: 8 Ekim 2026 · Sahip: Ece (ürün) · Durum: v1 çekirdeği kodda; PRD v0.3 ile güncellendi

Tasarım kanvası: https://claude.ai/artifact/46jh8ggGczM7VDTVHyzRQT (21 ekran, tıklanabilir akış)

---

## 1. Vizyon

**Tek cümle:** Arkadaşlarınla haritada plan kur, saat saat gez.

Kullanıcılar seyahat planlarken üç şeyi aynı anda çözemez: *nereye gidilecek*, *hangi gün / hangi sırayla*, *herkes aynı plana nasıl bakacak*. Bu ürün üçünü tek bir nesnede birleştirir: **ortak seyahat planı**. Mekanlar haritada seçilir, günlere haritada dağıtılır, program (saat saat çizelge) otomatik hesaplanır, herkes linkle katılıp düzenler.

Uzun vadede ürün ikinci bir döngü kazanır: gezilen yerler puanlanır → kişisel harita (Haritam) dolar → arkadaşların puanları yeni planlarda öneri olarak geri döner. Bu döngü v2'dir; v1 yalnızca ilk vaadi doğrular.

## 2. Hedef kullanıcı

Birincil: 2–6 kişilik arkadaş grupları, şehir gezisi (3–5 gün), yurt içi + Avrupa. Solo kullanıcı da aynı akışı kullanır; tek fark birden fazla kişinin düzenleyebilmesi ve "kim ekledi" görünürlüğüdür.

## 3. Ürün ilkeleri

1. **Kullanıcı kontrolde.** Yapay zeka mekan seçmez, sıralamaz. Sistem hesaplar (yol süresi, tempo, çakışma), kullanıcı karar verir.
2. **Harita ekranın kendisidir.** Liste her zaman haritanın altındaki panel; ayrı liste ekranı yok.
3. **Otel günün başı ve sonudur.** Tüm süre ve rota hesapları otelden başlar, otele döner.
4. **Kimse uygulama indirmek zorunda değil.** Davet linki tarayıcıda çalışır; plan görülür ve düzenlenir.
5. **Google verisi canlı, saklanmaz.** Puan, yorum, saat ve fotoğraf Places API'den anlık çekilir; kendi veritabanımızda yalnızca `place_id` ve kullanıcının girdiği veri durur.
6. **Kim ne yaptı görünür.** Her mekan ve her değişiklik ekleyenin adıyla işaretlidir. Çakışmada son yazan kazanır; değişiklik kaydı tutulur.

## 4. Bilgi mimarisi

Alt menü (uygulama seviyesi, her ekranda): **Seyahatler · Haritam · Yeni · Profil**
Seyahat içi alt menü (bir seyahat açıkken üsttekinin yerine geçer): **Keşfet · Günler · Program · Grup**

```
Giriş
  0.1 Karşılama + hesap (Apple / Google / telefon)
  0.2 Profilini kur (ad, kullanıcı adı, harita gizliliği)
  0.3 İlk seyahat yönlendirmesi (yeni plan / davet linki / haritayı doldur)
  0.4 Arkadaş teşviki (rehber eşleşmesi)
  0.5 Boş durum ana ekran

Seyahatler (sekme)
  1 Seyahatler — aktif seyahat öne, gelecek, geçmiş
  2 Nereye? — şehir + tarih
  3 Otel — konum, yoksa atla (bölge önerisi sonra)
  4 Keşfet — harita üstünde mekan seçimi (arama, link, öneri kartları)
  5 Günlere dağıt — haritada pin → gün, canlı tempo paneli
  6 Gün içi sıralama — sürükle-bırak + süre
  7 Program — saat saat çizelge, "Vardık", kaydırma
  8 Mekan detayı — Google verisi + kim ekledi + süre
  9 Grup — üyeler, davet linki, değişiklik akışı
 10 Davetle katılım — tarayıcı, uygulamasız
 11 Gezi sonu — puanlama

Haritam (sekme)
 12 Türkiye görünümü · 13 Dünya görünümü · 14 Şehir detayı

Profil (sekme)
 15 Arkadaşlar · 16 Profil (Instagram düzeni, rozetler)
```

## 5. Sürüm kesimi

### v1 — "planla ve gez" (11 ekran)

| # | Ekran | Neden v1 |
|---|---|---|
| 0.1 | Karşılama + hesap | Zorunlu |
| 0.2 | Profilini kur | Kullanıcı adı, "kim ekledi" için gerekli |
| 0.3 | İlk seyahat yönlendirmesi | Aktivasyon; "haritayı doldur" kapısı v1'de **gizli** |
| 0.5 | Boş durum | Zorunlu |
| 1 | Seyahatler | Ana ekran |
| 2 | Nereye? | Akış başı |
| 3 | Otel | Tüm hesapların ankeri |
| 4 | Keşfet | Çekirdek |
| 5 | Günlere dağıt | Çekirdek, farklılaştırıcı |
| 7 | Program | Çekirdek, "kalp" |
| 8 | Mekan detayı | Süre ve Google verisi için gerekli |
| 10 | Davetle katılım | Grup vaadi bunsuz test edilemez |

v1'de Program ekranı içinde sürükle-bırak sıralama vardır; ayrı "Gün içi sıralama" ekranı yoktur. "Grup" ekranı yerine Program üstünde üye avatarları ve basit bir "son değişiklikler" listesi vardır.

### v2 — "puanla, haritan dolsun, arkadaşlar" (10 ekran)

0.4 Arkadaş teşviki · 6 Gün içi sıralama (ayrı ekran) · 9 Grup · 11 Gezi sonu · 12–14 Haritam · 15 Arkadaşlar · 16 Profil · rozet sistemi

### Kapsam dışı (şimdilik)

Yapay zeka ile otomatik plan üretimi · sesli rehber · çevrimdışı mod · ayrıl-buluş özelliği · ödeme / premium · rezervasyon ve komisyon · Google'a yorum yazdırma (API desteklemiyor; yalnızca derin link)

### v0.3 kapsam değişiklikleri (8 Ekim)
- **v1'e çekildi:** tamamlanan durağı puanlama (yıldız + not; etiket ve fotoğraf yok) · gün bazlı otel (başlangıç/bitiş, taşınma günü; #21'in bir kısmı) · canlı gezi günü (konum, Bitti, otomatik tamamlanma).
- **Birleşti:** Günlere dağıt + Program → tek "Program" ekranı. Seyahat içi alt menü kalktı; uygulama tek alt menü (Seyahatler · Yeni · Profil).
- **v1'den çıktı / ertelendi:** Grup ayrı ekran değil, Program'daki panel. Davet linki (3.10) M2'ye ertelendi.
- **v2'de kalan:** Haritam, Profil (sosyal), Arkadaşlar, rozetler, gezi sonu ekranı, çok şehir (#20), şehirler arası ulaşım (#22), puanlamada etiket ve fotoğraf.

### Açık konu — konumlanma (8 Ekim, ürün kararı bekliyor)
Wanderlog planlama, ortak düzenleme ve haritayı ücretsiz sunuyor; fark buradan gelmez. Önerilen üç ayak: (1) **gezi günü deneyimi** (canlı program, otomatik tamamlanma, ücretsiz rota optimizasyonu), (2) **arkadaş ağı** (arkadaş puanları öneri sinyali; puanlama → Haritam → arkadaşın planı döngüsü), (3) **Türkiye ve Türkçe öncelik**. Karar verilirse arkadaş önerilerinin v1'e çekilmesi değerlendirilecek. 5 kişilik teste "Wanderlog kullandın mı, neden bıraktın?" ve "Gezi günü ne kullanıyorsun?" soruları eklenecek.

## 6. Başarı ölçütleri (v1 prototip testi ve ilk 100 kullanıcı)

- Aktivasyon: kayıt olan kullanıcının %60'ı ilk oturumda en az 3 mekanlı bir seyahat oluşturur.
- Grup: seyahatlerin %40'ında en az bir ek üye linkle katılır.
- Program kullanımı: seyahat günlerinde kullanıcıların %50'si Program ekranını açar ve en az bir "Vardık" işaretler.
- Teknik: Program ekranı hesaplaması 500 ms altında; Google Places + Routes maliyeti kullanıcı başına ayda 0,50 $ altında (Sprint 3 sonunda ölçülür).

## 7. Teknik çerçeve (öneri, PRD'de detaylanır)

- İstemci: React Native + Expo + Expo Router + TypeScript (iOS, Android ve davet linki için web aynı kod). Harita iOS'ta da Google sağlayıcısı; EAS development build.
- Arka uç: Supabase (Postgres + Auth + Realtime + Edge Functions). Google çağrıları Edge Function'dan, anahtarlar sunucuda. Eşzamanlı düzenleme Realtime ile, son yazan kazanır.
- Harita ve mekan: Google Maps Platform — Maps SDK, Places API (New), Routes API (yürüyüş süreleri).
- Yapay zeka: v1'de yok.

## 8. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Google Places maliyeti | Orta | Autocomplete oturum token'ı, sonuçların `place_id` ile önbelleklenmesi (Google kuralı: 30 gün), detay çağrısı yalnızca kart açıldığında |
| Davet linkinin tarayıcıda çalışmaması / ağır olması | Yüksek | Web istemci yalnızca Program + Keşfet; harita için Maps JS API |
| Gün dağıtımı ekranı anlaşılmazsa | Yüksek | Prototip testi 5 kişi, "gün seç → pine dokun" onboarding ipucu |
| "Kalınacak süre" verisi Google'da yok | Orta | Kategori bazlı varsayılanlar (PRD §6), kullanıcı iki dokunuşla değiştirir |

## 9. Sonraki adımlar

1. ~~V1 PRD~~ — teslim edildi, v0.2
2. ~~Teknik tasarım notu~~ — `02-teknik-tasarim.md`, inceleme `03-inceleme-teknik-tasarim.md`
3. 5 kişilik prototip testi — kanvastaki Play akışıyla
4. Sprint planı — ekran bazlı, PRD kabul kriterleriyle
