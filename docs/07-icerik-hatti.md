# İçerik hattı (AI gezi editörü → BO taslağı)

Sürüm 1.1 · 13 Ekim 2026 (OSM destekli araştırma, mekan rehberleri) · Sahip: Ece (ürün) · Kod: `scripts/icerik/`, `supabase/functions/icerik-google/`,
`supabase/migrations/20261101120000_icerik_hatti.sql`, `…20261102120000_icerik_osm_rehber.sql`, `.github/workflows/icerik.yml`

AI gezi editörü önerilen gezileri hazırlar ve BO'ya **taslak** olarak yükler. Ece BO'da gezi editöründe açar, düzenler,
fotoğraf ekler ve kendisi yayınlar. Hat hiçbir şeyi yayınlamaz.

> **BO'ya yüklendikten sonra doğruluk kaynağı BO'dur.** Plan dosyası (`icerik/geziler/<slug>.json`) AI'ın ilk teslimidir
> ve arşiv içindir. Ece BO'da değişiklik yaptıktan sonra plan dosyası BO ile eşitlenmez. Yeniden yükleme BO'daki
> düzenlemeleri siler; yalnız Ece'nin açık onayıyla yapılır.

## 1. Nasıl çalışır

Editör oturumunun Google'a ve Supabase'e doğrudan erişimi yoktur (ve olmamalıdır: anahtarlar yalnız GitHub Secrets ve
Supabase secrets'tadır). Köprü GitHub Actions'tır:

```
oturum ──(workflow_dispatch: icerik.yml)──▶ GitHub Actions
                                            │  SUPABASE_ACCESS_TOKEN (secret) ─▶ Yönetim API ─▶ service_role (çalışma anında, maskeli)
                                            ├─ osm ─▶ Overpass (OpenStreetMap; Google'a gidilmez)
                                            ├─ arastir ─▶ icerik-google (Edge Function) ─▶ Google Places (kimlik · puan)
                                            │             osm/arastir sonucu: oturumun açık anahtarıyla şifreli ─▶ geçici dal icerik-sonuc/<run_id>
                                            └─ yukle / sil / kontrol / sehirler ─▶ Yönetim API (postgres) ─▶ icerik_* SQL işlevleri
oturum ◀── adım durumları ve duyurular (yalnız sayı, slug, id) · şifreli dal (yalnız oturum çözer)
```

| İşlem | Ne yapar | Yazar mı? |
|---|---|---|
| `sehirler` | Şehirler: slug, ad, yayında mı, geziler (slug, durum, gün, durak). #197: Google kimliği ve saat dilimi eksik şehirleri listeler; `kuru=false` ise bir kez doldurur (Autocomplete `cities` + hafif yer, şehir başına ≤ 2 istek; Google'ın şehri bizimkinden 50 km'den uzaksa yazmaz). Mevcut şehirlerin tek seferlik doldurması budur | `kuru=false` ise (yalnız boş kimlik) |
| `osm` | Şehrin OSM aday listesi (Overpass): ad, konum, tür, opening_hours, wikipedia/wikidata; sonuç şifreli geçici dalda | Hayır |
| `arastir` | `kimlik` (OSM adayının place_id'si, ücretsiz) ve/veya `puan` (kısa liste ≤ 30); sonuç şifreli geçici dalda | Hayır (DB'ye) |
| `yukle` | Plan dosyasını ve mekan rehberlerini denetler, duraklar için detay alır (kapalı mı, konum, kategori), `icerik_gezi_taslak_yukle`. Yeni şehir açtıysa şehrin kimliğini de yazar (place_id plandan, saat dilimi ve ülke kodu tek hafif yer isteğiyle; olmazsa uyarı, `sehirler` sonra doldurur) | `kuru=false` ise |
| `kontrol` | Slug için: durum, gün ve durak sayısı, place_id'si eksik durak, yazıdaki mekanlar, updated_at, BO linki | Hayır |
| `sil` | `icerik_gezi_taslak_sil` (yalnız taslak) | `kuru=false` ise |
| `temizle` | Geçici `icerik-sonuc/*` dallarını siler | Dal siler |

**Kuru çalıştırma** (`kuru`, varsayılan `true`): yükle ve sil her şeyi yapar — doğrulayıcı, Google detayı, veritabanı
denetimleri — ama yazmaz. Çağrı bir `DO` bloğunda çalışır ve sonucunu bir hatayla taşıyarak biter; işlem her durumda geri
alınır, yazma kalıcı olamaz. Gerçek yazma için `kuru=false`.

### Veritabanı işlevleri (yalnız `postgres`; public, anon, authenticated, service_role çalıştıramaz)

- `icerik_gezi_taslak_yukle(p_veri jsonb, p_yeniden boolean default false)` — tek işlem; hata olursa hiçbir şey yazılmaz.
  `yayin=false`, `yayin_at=null` işlevin kendisinden gelir; girdide `yayin`/`yayin_at` varsa reddeder. Slug varsa reddeder;
  `p_yeniden=true` yalnız taslağın günlerini, duraklarını ve yazısını yeniden yazar (kimlik, kapak, sıra, fotoğraflar
  kalır). Yayındaki (planlı dahil) geziye hiçbir durumda dokunmaz. Şehir slug'la bulunur; yoksa yalnız `sehir.yeni` ile
  (Ece'nin onayıyla) taslak şehir açar. Tablo kısıtlarını kendisi denetler ve Türkçe hata verir. Yazıdaki
  `[ad](mekan:id)` ve `::mekan[id]` izlerini `icerik_mekanlari`'na yazar (BO'nun `icerik_mekanlari_yaz` kuralı: yazı
  sırası, satir/kart). Durağın mekan rehberini (`rehber_md`) `yerler`'e yazar: yer satırı yoksa **taslak** açar
  (`yayin=false`); taslak ve rehberi boşsa doldurur; yayındaki ya da rehberi dolu satıra dokunmaz (`rehber_atlanan`).
  Döner: `{gezi_id, slug, gun_sayisi, mekan_sayisi, updated_at, yer_acilan, rehber_yazilan, rehber_atlanan, …}`.
- `icerik_gezi_taslak_sil(p_slug)` — yalnız `yayin=false`; fotoğrafı olan taslağı silmez (önce BO'dan kaldırılır).
  Açılan taslak yer satırları kalır (mekan başkadır, başka gezide de kullanılır).
- `icerik_sehirler()`, `icerik_gezi_kontrol(p_slug)` — okuma; kullanıcı verisi yok. Kontrol durakların rehber durumunu
  da verir (`rehber_dolu`, `rehber_yayinda`, `yer_yok`). `icerik_sehirler` şehrin konumunu ve `kimlik` (place_id ve tz dolu
  mu) durumunu da verir (konum loga yazılmaz).
- `icerik_sehir_kimligi_yaz(p_slug, p_place_id, p_tz, p_ulke_kodu)` (#197) — şehrin Google kimliğini, IANA saat dilimini ve
  ülke kodunu **bir kez** yazar: dolu alan ezilmez. Geçersiz saat dilimi tetikleyiciyle reddedilir (`22023`).
- `icerik_google_butcesi(p_istek)` (yalnız service_role) — Edge Function Google'a gitmeden sorar: bugünkü tahmini
  harcama + bu isteğin üst sınırı günlük bütçeyi (`yonetim_ayarlari.google_gunluk_butce`) aşar mı?

Hata kodları: `22023` geçersiz veri · `23505` slug ya da şehir zaten var · `42501` yayındaki satır · `P0002` bulunamadı.

### icerik-google (Edge Function)

- Yalnız service_role anahtarı ya da `is_admin()` olan oturum; diğerlerine 403. service_role: taşıyıcı ortamdaki
  anahtarla birebir aynıysa ya da PostgREST onu yalnız service_role'e açık `icerik_google_butcesi`'ne kabul ediyorsa
  (ortamdaki anahtar yeni biçimde, `sb_secret_…`, olabilir). Geçidin JWT ayarına güvenilmez.
- `{"islem": "kimlik", "sorgular": [{"metin": "…", "lat": …, "lng": …, "yaricap_m": 300}]}` — OSM adayının place_id'si:
  Text Search yalnız `places.id` maskesiyle (**Text Search Essentials IDs Only — ücretsiz, sınırsız**). En çok 80 sorgu;
  sorgu başına en çok 3 id (Google sırasıyla). Başka alan istenemez (istekte bilinmeyen anahtar → 400). Bütçe
  denetimine girmez; istek sayısı ayrı sayaca (`api_sayac`, fonksiyon `icerik-kimlik`) yazılır ve maliyet kalemine girmez.
- `{"islem": "puan", "idler": ["ChIJ…"]}` — **yalnız son kısa liste**, en çok 30 id: ad, birincil tip, işletme durumu,
  puan, yorum sayısı (Place Details Enterprise). Geniş aramada puan istenmez.
- `{"islem": "detay", "idler": ["ChIJ…"]}` — yükleme, en çok 60 id: ad, birincil tip, konum, işletme durumu (Place
  Details Pro). Açılış saatleri istenmez; kapalı gün plandaki `kapali_gunler`'den gelir.
- `puan` ve `detay`: günlük bütçe doluysa Google'a gitmeden 429; bütçe okunamazsa 503 (kapalı kalır). Her istek
  `googleSay` ile sayılır (`api_sayac`, fonksiyon `icerik-google`). Cevap gövdesi ve Google verisi loglanmaz.
- Genel bakış: içerik istekleri **Mekan** kalemine eklenir, Mekan birim fiyatı o günün karışık fiyatı olur
  (`google_birim_fiyat.icerik` = 20 $/1000: puan 20, detay 17 — üst sınır). İstek sayısı gerçek, tahmini dolar doğru
  kalır. Ücretsiz `icerik-kimlik` sayacı maliyete girmez.
- **Bakım notu:** Fonksiyon → kalem eşlemesi iki yerde: `yonetim_genel_temel` (Genel bakış) ve `google_harcama_bugun`
  (bütçe denetimi). Yeni bir Google çağıran Edge Function eklenince ikisi de güncellenir. `yonetim_genel` bir sarmaldır
  (`yonetim_genel_temel` + içerik istekleri); `create or replace` ile yeniden yazılırsa sarmal korunur.

### Araştırma akışı (gezi başına)

1. `osm` — şehrin aday listesi (Overpass, ücretsiz). OSM verisi saklanabilir (ODbL; atıf: "© OpenStreetMap katkıcıları").
2. Oturum adayları süzer: konaklama, alt kayıtlar, şehir dışı elenir. Önem: Wikipedia/Wikidata varlığı + kategori
   boşluğu + editörün değerlendirmesi.
3. `arastir` `kimlik` — seçilen adayların place_id'si (ad + OSM konumu, 300 m yanlılık; ücretsiz).
4. `arastir` `puan` — son kısa liste (duraklar, yedekler, restoran/kafe adayları; **en çok 30**). Puan ve yorum sayısı
   yalnız burada.
5. Kapalı günler resmî siteden ya da OSM `opening_hours`'tan plana yazılır (`kapali_gunler`).
6. `yukle` (önce kuru) — duraklar için detay (konum, kategori, açık mı).

### Maliyet (liste fiyatı, ücretsiz kota düşülmeden)

| Adım | İstek | Tahmin |
|---|---|---|
| `osm` | Overpass | 0 $ |
| `kimlik` | Text Search IDs Only (ör. 60 sorgu) | 0 $ |
| `puan` | kısa liste: tipik 25, en çok 30 × Place Details Enterprise (20 $/1000) | 0,50 $ (en çok 0,60 $) |
| `yukle` kuru + gerçek | 2 × 12 durak × Place Details Pro (17 $/1000) | 0,41 $ |
| **Gezi başına** | | **≈ 0,91 $** (30 kısa liste + 14 durakla en çok 1,08 $) |

Ücretsiz aylık kota (Google Maps Platform, SKU başına; uygulamayla ortak): Pro 5.000, Enterprise 1.000 istek. Bu kotalar
içinde kalındığında gerçek fatura 0 $. Günlük Google bütçesi uygulamayla ortaktır (varsayılan 10 $); BO Genel bakış
içerik isteklerini 20 $/1000 ile sayar (üst sınır). 1 $ hedefinde kalmak için kısa liste 25'i, kuru deneme 1'i
geçmemeli.

## 2. Plan dosyası

`icerik/geziler/<slug>.json` — dosya adı `gezi.slug` ile aynı. Google verisi yok: `place_id` ve durak adı dışında Google'dan
gelen alan girmez (koordinat, puan, adres, saat, yorum doğrulayıcıda HATA). Koordinat ve kategori yükleme anında
Google'dan taze alınır. Mekan rehberleri ayrı dosyalarda: `icerik/yerler/<şehir slug>/<rehber>.md`.

```json
{
  "surum": 1,
  "sehir": { "slug": "eskisehir" },
  "takvim": { "ilk_gun": "cumartesi" },
  "gezi": {
    "slug": "eskisehir-hafta-sonu",
    "baslik": "Eskişehir'de bir hafta sonu",
    "ozet": "Yürüyerek, rahat tempoda; ilk kez gidenler için",
    "yazar_ad": "Tripmate ekibi",
    "yazi_md": "…"
  },
  "gunler": [
    {
      "baslik": "Odunpazarı",
      "duraklar": [
        {
          "place_id": "ChIJ…", "ad": "…", "sure_dk": 75, "sure_gerekcesi": "varsayılan 90; koleksiyon küçük",
          "kapali_gunler": ["pazartesi"], "rehber": "odunpazari-modern-muze"
        }
      ]
    }
  ],
  "ek_mekanlar": [{ "place_id": "ChIJ…", "ad": "…" }],
  "notlar": {
    "dogrulanacaklar": ["[Alan] · \"yazıdaki ifade\" · neden şüpheli · nereden kontrol edilir"],
    "fotograf_onerileri": [{ "ne": "…", "altyazi": "…", "arama": "…" }],
    "varsayimlar": ["Hafta sonu: 1. gün cumartesi"]
  }
}
```

- `takvim.ilk_gun` (isteğe bağlı, varsayılan cumartesi): kapalı gün denetimi için 1. günün haftanın günü.
- `kapali_gunler` (zorunlu; her gün açıksa `[]`): resmî siteden ya da OSM `opening_hours`'tan. Bilinmiyorsa `[]` ve
  DOĞRULANACAKLAR'a bir satır.
- `rehber` (isteğe bağlı, yoksa UYARI): mekan rehberi dosyasının adı → `icerik/yerler/<şehir>/<rehber>.md`.
- `ek_mekanlar` (isteğe bağlı): yazıda anılan ama durak olmayan mekanlar (araştırmadan). Yüklemede bunların da kapalı
  olup olmadığına bakılır; veritabanına durak olarak girmez.
- Yeni şehir (yalnız Ece'nin onayıyla): `"sehir": {"yeni": {"ad": "…", "slug": "…", "place_id": "ChIJ…"}}`; şehrin
  koordinatı yüklemede bu place_id'den alınır, şehir taslak açılır.

### Doğrulayıcı (`scripts/icerik/dogrula.mjs`)

HATA yüklemeyi durdurur, UYARI rapora girer. İletilerde durak adı yazılmaz; duraklar `g2.d3` (2. gün 3. durak) ile anılır.

| HATA | UYARI |
|---|---|
| başlık ≤ 50, özet ≤ 70, gün başlığı ≤ 30, durak adı ≤ 120 | günde 4'ten az ya da 7'den çok durak |
| slug `^[a-z0-9-]{2,80}$`, place_id `^[A-Za-z0-9_-]{10,255}$` | gün toplamı (durak + tahmini yürüme) 8 saati aşıyor |
| 1–30 gün, her günde en az 1 durak, `sure_dk` 15–480 tam sayı | ardışık iki durak arası tahmini yürüme > 25 dk |
| `yayin` / `yayin_at` alanı | 12:00–14:00 arasına yemek durağı düşmüyor |
| Google alanı (koordinat, puan, adres, saat, yorum) | durak `kapali_gunler`'e göre kapalı güne düşüyor |
| `#`, `###`, tablo, numaralı ya da iç içe liste, `* `/`+ ` madde | varsayılandan sapan süre için `sure_gerekcesi` yok |
| http(s) bağlantı, `mekan:` dışı bağlantı, `foto:` ve görsel | durak yazıda bağlantılı geçmiyor; gün başına 1–2 kart değil |
| iç içe ya da kapanmamış kalın/italik | 350–900 kelime dışı; `>` ipucu yok; gün başlığı sayısı tutmuyor |
| köşeli parantezli not (`[doğrula]`, kaynak notu), TODO | klişe ("muhteşem", "eşsiz" …); ondalıkta nokta |
| yazıdaki `mekan:id` / `::mekan[id]` ne durakta ne `ek_mekanlar`'da | aynı mekan iki durakta |
| `kapali_gunler` yok ya da gün adı değil | durağın mekan rehberi yok |
| rehber dosyası yok; rehberde tek `>` İPUCU değil, `::mekan` kartı, yukarıdaki sözdizimi hataları | rehber 150–300 kelime dışı; fiyat ya da saat geçiyor; klişe |

Gezi yazısında durak başına 1–3 cümle; ayrıntı mekan rehberinde.

### Mekan rehberi (`icerik/yerler/<şehir>/<rehber>.md` → `yerler.rehber_md`)

- 150–300 kelime: ne olduğu ve neden gidilir · neye bakılır · ne kadar sürer, ne zaman gidilir.
- Tek bir `>` İPUCU paragrafı: uygulama mekana 100 m yaklaşınca bildirimde gösterir; o anda işe yarasın.
- Fiyat ve açılış saati yok; kapalı gün yazılabilir. Emin olunmayan her şey DOĞRULANACAKLAR'a.
- Kaynak: resmî siteler önce; Vikipedi yalnız doğrulama için. Kopyalama ve yakın çeviri yok. Kaynaklar içerik PR'ına
  yazılır, metne değil.
- Yükleme yer satırı yoksa taslak açar; yayındaki ya da rehberi dolu satıra dokunmaz — o durumda dosya repoda kalır ve
  teslimde listelenir.

Yürüme tahmini: kuş uçuşu × 1,3 ÷ 75 m/dk. Saat kestirimi gün 09:30'da başlar (uygulama saatleri kendisi hesaplar).
Varsayılan süreler `src/lib/kategori.ts` ile aynıdır.

## 3. Komutlar

Oturumda (bir kez): anahtar çifti. Özel anahtar `.icerik-gizli/ozel.pem` (gitignore) — repoya girmez.

```bash
node scripts/icerik/anahtar.mjs            # açık anahtarı (tek satır base64) yazar
```

İş akışını tetiklemek (REST; GraphQL ve `gh workflow run` gerekmez):

```bash
gh api -X POST repos/ozcinarece/travel/actions/workflows/icerik.yml/dispatches \
  -f ref=main -f 'inputs[islem]=sehirler'

# OSM aday listesi (Google'a gidilmez)
gh api -X POST repos/ozcinarece/travel/actions/workflows/icerik.yml/dispatches -f ref=main \
  -f 'inputs[islem]=osm' -f 'inputs[istek]={"sehir":"eskisehir","yaricap_m":8000,"acik_anahtar":"<base64>"}'

# place_id eşleme (ücretsiz) — ad + OSM konumu
gh api -X POST …/dispatches -f ref=main -f 'inputs[islem]=arastir' \
  -f 'inputs[istek]={"sehir":"eskisehir","kimlik":[{"metin":"Odunpazarı Modern Müze","lat":39.76,"lng":30.52}],"acik_anahtar":"<base64>"}'

# kısa liste puanı (en çok 30)
gh api -X POST …/dispatches -f ref=main -f 'inputs[islem]=arastir' \
  -f 'inputs[istek]={"sehir":"eskisehir","puan":["ChIJ…"],"acik_anahtar":"<base64>"}'

# yükle: ref = içerik dalı (dosya o dalda); önce kuru, sonra gerçek
gh api -X POST repos/ozcinarece/travel/actions/workflows/icerik.yml/dispatches -f ref=claude/icerik-<slug> \
  -f 'inputs[islem]=yukle' -f 'inputs[dosya]=icerik/geziler/<slug>.json' -F 'inputs[kuru]=true'

gh api -X POST …/dispatches -f ref=main -f 'inputs[islem]=kontrol' -f 'inputs[istek]=<slug>'
gh api -X POST …/dispatches -f ref=main -f 'inputs[islem]=sil' -f 'inputs[istek]=<slug>' -F 'inputs[kuru]=false'
```

Sonucu okumak (loglar indirilemese de):

```bash
gh api repos/ozcinarece/travel/actions/runs/<run_id>/jobs          # adım durumları, job id
gh api repos/ozcinarece/travel/check-runs/<job_id>/annotations     # duyurular (HATA / UYARI / sonuç)
```

OSM ve araştırma sonucunu çözmek (repo dışındaki geçici klasöre; geçici dal okunduktan sonra silinir):

```bash
node scripts/icerik/coz.mjs <run_id> --cikti /tmp/…/icerik-arastirma
```

Dal silinemezse: `inputs[islem]=temizle`, `inputs[istek]=<run_id>` (ya da `hepsi`).

## 4. Güvenlik kuralları

- **Yayın yok.** Her yükleme `yayin=false`, `yayin_at=null`. Yayındaki (planlı dahil) gezi, şehir, yer ya da rehber
  satırı değiştirilmez, silinmez, üzerine yazılmaz. Var olan taslağı silmek, üzerine yeniden yüklemek ve yeni şehir
  açmak Ece'nin "evet"i olmadan yapılmaz.
- **Gizli anahtarlar.** `SUPABASE_ACCESS_TOKEN` yalnız GitHub Secrets'ta; `GOOGLE_SERVER_KEY` yalnız Supabase
  secrets'ta (Google'a yalnız Edge Function'dan gidilir). service_role anahtarı iş akışında çalışma anında Yönetim
  API'sinden alınır, rolü ve projesi doğrulanır, `::add-mask::` ile maskelenir, dosyaya ya da ortama yazılmaz.
  Oturumun özel anahtarı `.icerik-gizli/`'de, repoya girmez.
- **Herkese açık loglar.** Repo, Actions logları ve duyurular herkese açıktır. Loga yalnız sayı, slug, id ve
  başarılı/başarısız yazılır; Google verisi (ad, puan, yorum sayısı, adres, saat, koordinat) ve kullanıcı verisi
  yazılmaz. Veritabanı hata iletisinin yalnız ilk satırı yazılır (sorgu metni loga düşmez). `supabase-sql` iş akışı
  içerik ya da kullanıcı verisi okumak için kullanılmaz. Kullanıcı tabloları okunmaz.
- **Google verisi (PRD §7).** Araştırma sonucu yalnız şifreli olarak geçici dalda ve oturumun belleğinde / repo
  dışındaki geçici klasöründe durur; repoya ve veritabanına ham girmez. Veritabanına yalnız gezi editörünün yazdığı
  alanlar girer: place_id, durak adı, kategori (birincil tip), lat, lng.
  Mekan rehberi editörün kendi metnidir (Google verisi değil).
- **OSM verisi** (ODbL) saklanabilir; kullanıldığı yerde atıf: "© OpenStreetMap katkıcıları".
- **Maliyet.** Alan maskeleri en dar; geniş aday listesi OSM'den, place_id eşleme ücretsiz (IDs Only); puan yalnız kısa
  listede (≤ 30); yükleme detayı açılış saati istemez. Günlük bütçe doluysa Google'a gidilmez. Hedef: gezi başına ücretsiz
  kota içinde, liste fiyatıyla en çok 1 $.
- **Workflow girdileri** adımlara ortam değişkeniyle geçer (komut satırına gömülmez). Bağımlılık kurulmaz.
