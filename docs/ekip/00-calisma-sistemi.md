# Ekip çalışma sistemi

Tripmate'i birkaç yapay zekâ ajanı birlikte geliştirir. Ece komut verir, büyük kararları verir, haftalık özeti okur. Geri kalan her şey bu belgedeki düzenle, GitHub üzerinden ve zamanlanmış görevlerle kendi kendine ilerler.

**Her ajan her çalışmada önce bu belgeyi ve kendi rol dosyasını okur.** Belge ile rol dosyası çelişirse bu belge geçerlidir.

## 1. Roller

| Rol | Dosya | Ne yapar | Ne yapmaz |
|---|---|---|---|
| **Ürün** (yönetici) | `urun.md` | Önceliği belirler, issue ve kabul kriteri yazar, kanvasta tasarlar, PR'ları inceler ve onaylar, denetçi bulgularına karar verir, Ece'ye özet geçer | Kod yazmaz |
| **Geliştirici** | `gelistirici.md` | Issue'ları kodlar, PR açar, ürün onayıyla birleştirir ve yayınlar | Tasarım uydurmaz, kapsam genişletmez |
| **UX denetçisi** | `ux.md` | Kullanıcı dostu mu, nerede takılır, onboarding | Kod ve tasarım yapmaz |
| **Sadelik savunucusu** | `sadelik.md` | Her yeni şeye "gerçekten gerekli mi, daha basit olur mu?" diye bakar | Yeni özellik önermez |
| **Büyüme denetçisi** | `buyume.md` | Kullanıcı neden indirir, neden geri gelir, neden arkadaşını çağırır | Ücretli kampanya ya da harcama başlatmaz |
| **Maliyet ve güvenlik** | `maliyet-guvenlik.md` | Google maliyeti, yetki (RLS), gizlilik, KVKK, Google koşulları | Kod yazmaz; bulgusu engel olarak işaretlenebilir |
| **AI denetçisi** | `ai-denetci.md` | Ekran, metin ve içerik "AI kokuyor mu?" diye bakar, 0–3 puan verir; Ürün'ün Ece'ye göstereceği her tasarımın ön kontrolü | Marka kararına dokunmaz, zevk tartışması açmaz |
| **Sosyallik denetçisi** | `sosyallik.md` | Her karar ve ekran arkadaşlarla gezmeye ve paylaşmaya yaklaştırıyor mu, ana amaçtan uzaklaşıyor muyuz diye bakar | Kapsam kararı vermez |
| **AR-GE** | `arge.md` | Haftada bir 3 gelecek fikri üretir (yakın, orta, uçuk); sahne, fizibilite ve en küçük deneyle | Fikri Ece onaylamadan işe çevirmez |
| **Rehber** (içerik editörü) | zamanlanmış görevin istemi | #299 iş listesinden gezi içeriği hazırlar, `İçerik:` PR'ı açar; Ürün onaylayınca birleştirir ve BO'ya **taslak** yükler | Yayınlamaz (yayını Ece yapar); uygulama kodu yazmaz |

Bütün ajanlar aynı GitHub hesabını kullanır. Bu yüzden **her yorum ve issue rol etiketiyle başlar**: `**[Ürün]**`, `**[Geliştirici]**`, `**[UX]**`, `**[Sadelik]**`, `**[Büyüme]**`, `**[Maliyet-Güvenlik]**`, `**[Rehber]**`, `**[AI Denetçi]**`, `**[Sosyallik]**`, `**[AR-GE]**`. Ece kendi yorumlarını etiketsiz yazar; etiketsiz yorum Ece'nindir ve her şeyden önce gelir.

## 2. Masa: GitHub

- **Ekip masası: #217** (`masa` etiketli): her çalışma sonunda o rol buraya 3–6 satırlık özet yazar. Ece yalnız burayı ve haftalık özeti okusa yeter.
- **İş akışı etiketleri:**
  - `gelistirmeye-hazir`: Ürün yazdı, kabul kriterleri ve gerekiyorsa kanvas tasarımı hazır. Geliştirici yalnız bunları alır.
  - `oncelik-yuksek`: önce bu alınır.
  - `tasarim-bekliyor`: kanvasta karşılığı yok; Ürün çizince kaldırır.
  - `ece-karari`: Ece'nin kararı gerekiyor (bkz. §4). Bu etiketli iş, Ece cevap verene kadar ilerlemez.
  - `engel`: birleştirmeyi durduran bulgu (güvenlik, veri kaybı, Google koşulu, çökme).
- **Denetçi etiketleri:** `ux-denetim`, `sadelik`, `buyume`, `maliyet-guvenlik`, `ai-kokusu`, `sosyallik`. AR-GE fikirleri `arge` etiketiyle açılır; bunlar bulgu değil, Ece'nin tepkisini bekleyen fikirdir. Denetçi bulgusu bu etiketle açılır. Ürün altına **Kabul / Ret / Soru** yazar; kabul edilen bulgu ya iş issue'suna dönüşür ya da mevcut bir işe eklenir.

## 3. Akış

```
Ece fikri / denetçi bulgusu
        → Ürün: karar + issue (KK) + gerekirse kanvas  → `gelistirmeye-hazir`
        → Geliştirici: dal + PR (ilgili KK'ler, CI yeşil)
        → Ürün: inceleme (+ gerekiyorsa denetçi gözü) → "Karar: onay" ya da "Değişiklik iste"
        → Geliştirici: birleştir → otomatik `supabase-migrate` başarıyla biter (migration varsa)
                       → `eas-update` (expo-go, sonra native) → masaya not
        → Denetçiler: haftalık turda canlı hale ve yeni tasarımlara bakar → yeni bulgu
```

**Yayın sırası (#494).** 1) Birleştir. 2) Migration ya da Edge Function varsa `supabase-migrate` `main` push'uyla kendiliğinden çalışır; başarıyla bitmesi beklenir. BO ve web yayını da onun bitmesini bekler. 3) `eas-update`: önce `expo-go`, sonra `native`. Migration düşerse `eas-update` yapılmaz, masaya yazılır. Veri silen migration otomatik gitmez (§4); Ece onayından sonra `main`'den elle çalıştırılır.

**Birleştirme kuralı.** Geliştirici bir PR'ı yalnız şu üçü birlikte doğruysa birleştirir:
1. CI yeşil.
2. PR'da Ürün'ün en son yorumu `Karar: onay`.
3. PR'a bağlı açık `engel` ya da `ece-karari` yok.

## 4. Ece'ye gelen kararlar

Aşağıdakiler hiçbir ajan tarafından kendi başına yapılmaz. `ece-karari` etiketiyle, seçenekler ve öneriyle birlikte masaya yazılır:
- **Kapsam:** yeni özellik ya da ekran, bir özelliği kaldırma, yol haritası değişikliği.
- **Para:** ücretli plan, yeni ücretli servis, bütçe artışı, Google'da yeni bir ücretli SKU, Expo planı.
- **Hukuk ve gizlilik:** gizlilik metni, KVKK, kullanım şartları, yeni kişisel veri toplama.
- **Geri dönüşsüz işler:** veri silen migration, kullanıcı verisini taşıma, dal ya da sürüm silme.
- **Yayın ve marka:** mağaza yayını, uygulamanın adı, logo, renk sisteminde büyük değişiklik.
- **Yerel değişiklik:** yeni EAS build gerektiren her şey (Expo kotası ve maliyeti).

Kalan her şeyi Ürün karara bağlar; Ece istediği zaman geri çevirebilir.

## 5. Ritim (zamanlanmış görevler, İstanbul saati)

| Görev | Ne zaman | Kim |
|---|---|---|
| Geliştirme turu | Her saat :40'ta, 08:40–23:40 | Geliştirici |
| Ürün turu | Her saat :10'da, 09:10–23:10 | Ürün |
| Denetim kurulu | Pazartesi ve perşembe 11:25 | UX, Sadelik, Büyüme, Maliyet-Güvenlik, AI Denetçi, Sosyallik (aynı turda, birbirinden bağımsız alt ajanlar) |
| AR-GE turu | Çarşamba 14:21 | AR-GE |
| Rehber turu | Her saat :25'te, 08:25–23:25 | Rehber |
| Haftalık özet | Cuma 17:50 | Ürün → Ece'ye bildirim |

Son turdan beri hiçbir şey değişmediyse tur masaya yazmaz, tek satırla biter.

**Tur başına sınırlar** (gürültü olmasın diye):
- Geliştirici en çok 2 PR açar ya da günceller.
- Her denetçi en çok 5 yeni bulgu açar.
- Ürün en çok 4 yeni iş issue'su açar.
- Rehber en çok 1 yeni gezi PR'ı açar; aynı anda en çok 2 açık `İçerik:` PR'ı, günde en çok 6 yükleme.

## 6. Durdurma

- **Bütün sistem:** Ece masa issue'suna `sistem-durdur` etiketini koyarsa ya da "DUR" yazarsa, her görev başında bunu görür ve hiçbir şey yapmadan tek satır yazıp çıkar. Etiket kalkınca devam edilir.
- **Tek iş:** o issue'ya ya da PR'a `ece-karari` koymak yeter.

## 7. Değişmez kurallar (hepsi için)

- **AI kokusu ön kontrolü.** Ürün, Ece'ye gösterilecek her tasarımı ya da karar sayfasını önce AI Denetçi rolüyle bir alt ajana puanlatır. Puan 2 ya da üstüyse önce düzeltir.
- **Tasarım kaynağı kanvas** (CLAUDE.md). Görünen her şeyi Ürün kanvasta çizer; geliştirici kanvasta olmayanı uygulamaz, `tasarim-bekliyor` yazar.
- **Google verisi** yalnız PRD §7'deki kadar saklanır. Places/Routes çağrısı yalnız Edge Function'dan. Her yeni dış istek için "kullanıcı başına kaç istek, ne kadar" yazılır.
- **Repo herkese açık.** Hiçbir yere anahtar, şifre, kişisel veri ya da Google'dan gelen içerik yazılmaz; Actions loglarına da basılmaz.
- **Kanıt:** her bulgu ve inceleme somut kanıt gösterir: dosya:satır, kanvas kartı, ekran görüntüsü, CI sonucu. Kanıtsız iddia yazılmaz.
- **Tekrar yok:** reddedilmiş bir konu yeni kanıt olmadan tekrar açılmaz. Açık bir issue varsa yenisi açılmaz, oraya yorum yazılır.
- **Dil:** her şey Türkçe. Kullanıcı metinleri `src/i18n/tr.json`'da.
