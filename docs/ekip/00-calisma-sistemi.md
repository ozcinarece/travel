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

Bütün ajanlar aynı GitHub hesabını kullanır. Bu yüzden **her yorum ve issue rol etiketiyle başlar**: `**[Ürün]**`, `**[Geliştirici]**`, `**[UX]**`, `**[Sadelik]**`, `**[Büyüme]**`, `**[Maliyet-Güvenlik]**`. Ece kendi yorumlarını etiketsiz yazar; etiketsiz yorum Ece'nindir ve her şeyden önce gelir.

## 2. Masa: GitHub

- **Ekip masası: #217** (`masa` etiketli): her çalışma sonunda o rol buraya 3–6 satırlık özet yazar. Ece yalnız burayı ve haftalık özeti okusa yeter.
- **İş akışı etiketleri:**
  - `gelistirmeye-hazir`: Ürün yazdı, kabul kriterleri ve gerekiyorsa kanvas tasarımı hazır. Geliştirici yalnız bunları alır.
  - `oncelik-yuksek`: önce bu alınır.
  - `tasarim-bekliyor`: kanvasta karşılığı yok; Ürün çizince kaldırır.
  - `ece-karari`: Ece'nin kararı gerekiyor (bkz. §4). Bu etiketli iş, Ece cevap verene kadar ilerlemez.
  - `engel`: birleştirmeyi durduran bulgu (güvenlik, veri kaybı, Google koşulu, çökme).
- **Denetçi etiketleri:** `ux-denetim`, `sadelik`, `buyume`, `maliyet-guvenlik`. Denetçi bulgusu bu etiketle açılır. Ürün altına **Kabul / Ret / Soru** yazar; kabul edilen bulgu ya iş issue'suna dönüşür ya da mevcut bir işe eklenir.

## 3. Akış

```
Ece fikri / denetçi bulgusu
        → Ürün: karar + issue (KK) + gerekirse kanvas  → `gelistirmeye-hazir`
        → Geliştirici: dal + PR (ilgili KK'ler, CI yeşil)
        → Ürün: inceleme (+ gerekiyorsa denetçi gözü) → "Karar: onay" ya da "Değişiklik iste"
        → Geliştirici: birleştir + yayınla (CLAUDE.md'deki sıra) → masaya not
        → Denetçiler: haftalık turda canlı hale ve yeni tasarımlara bakar → yeni bulgu
```

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
| Geliştirme turu | Her gün 08:40 ve 18:40 | Geliştirici |
| Ürün turu | Her gün 10:10 ve 20:10 | Ürün |
| Denetim kurulu | Pazartesi ve perşembe 11:25 | UX, Sadelik, Büyüme, Maliyet-Güvenlik (aynı turda, birbirinden bağımsız alt ajanlar) |
| Haftalık özet | Cuma 17:50 | Ürün → Ece'ye bildirim |

**Tur başına sınırlar** (gürültü olmasın diye):
- Geliştirici en çok 2 PR açar ya da günceller.
- Her denetçi en çok 5 yeni bulgu açar.
- Ürün en çok 4 yeni iş issue'su açar.

## 6. Durdurma

- **Bütün sistem:** Ece masa issue'suna `sistem-durdur` etiketini koyarsa ya da "DUR" yazarsa, her görev başında bunu görür ve hiçbir şey yapmadan tek satır yazıp çıkar. Etiket kalkınca devam edilir.
- **Tek iş:** o issue'ya ya da PR'a `ece-karari` koymak yeter.

## 7. Değişmez kurallar (hepsi için)

- **Tasarım kaynağı kanvas** (CLAUDE.md). Görünen her şeyi Ürün kanvasta çizer; geliştirici kanvasta olmayanı uygulamaz, `tasarim-bekliyor` yazar.
- **Google verisi** yalnız PRD §7'deki kadar saklanır. Places/Routes çağrısı yalnız Edge Function'dan. Her yeni dış istek için "kullanıcı başına kaç istek, ne kadar" yazılır.
- **Repo herkese açık.** Hiçbir yere anahtar, şifre, kişisel veri ya da Google'dan gelen içerik yazılmaz; Actions loglarına da basılmaz.
- **Kanıt:** her bulgu ve inceleme somut kanıt gösterir: dosya:satır, kanvas kartı, ekran görüntüsü, CI sonucu. Kanıtsız iddia yazılmaz.
- **Tekrar yok:** reddedilmiş bir konu yeni kanıt olmadan tekrar açılmaz. Açık bir issue varsa yenisi açılmaz, oraya yorum yazılır.
- **Dil:** her şey Türkçe. Kullanıcı metinleri `src/i18n/tr.json`'da.
