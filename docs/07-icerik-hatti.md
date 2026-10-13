# İçerik hattı (AI gezi editörü → BO taslağı)

Sürüm 1.0 · 13 Ekim 2026 · Sahip: Ece (ürün) · Kod: `scripts/icerik/`, `supabase/functions/icerik-google/`,
`supabase/migrations/20261101120000_icerik_hatti.sql`, `.github/workflows/icerik.yml`

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
                                            ├─ arastir ─▶ icerik-google (Edge Function) ─▶ Google Places
                                            │             sonuç: oturumun açık anahtarıyla şifreli ─▶ geçici dal icerik-sonuc/<run_id>
                                            └─ yukle / sil / kontrol / sehirler ─▶ Yönetim API (postgres) ─▶ icerik_* SQL işlevleri
oturum ◀── adım durumları ve duyurular (yalnız sayı, slug, id) · şifreli dal (yalnız oturum çözer)
```

| İşlem | Ne yapar | Yazar mı? |
|---|---|---|
| `sehirler` | Şehirler: slug, ad, yayında mı, geziler (slug, durum, gün, durak) | Hayır |
| `arastir` | Metin araması ve/veya detay; sonuç şifreli geçici dalda | Hayır (DB'ye) |
| `yukle` | Plan dosyasını denetler, duraklar için detay alır (kapalı mı, konum, kategori), `icerik_gezi_taslak_yukle` | `kuru=false` ise |
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
  sırası, satir/kart); taslak yer satırı açmaz. Döner: `{gezi_id, slug, gun_sayisi, mekan_sayisi, updated_at, …}`.
- `icerik_gezi_taslak_sil(p_slug)` — yalnız `yayin=false`; fotoğrafı olan taslağı silmez (önce BO'dan kaldırılır).
- `icerik_sehirler()`, `icerik_gezi_kontrol(p_slug)` — okuma; kullanıcı verisi yok.
- `icerik_google_butcesi(p_istek)` (yalnız service_role) — Edge Function Google'a gitmeden sorar: bugünkü tahmini
  harcama + bu isteğin üst sınırı günlük bütçeyi (`yonetim_ayarlari.google_gunluk_butce`) aşar mı?

Hata kodları: `22023` geçersiz veri · `23505` slug ya da şehir zaten var · `42501` yayındaki satır · `P0002` bulunamadı.

### icerik-google (Edge Function)

- Yalnız service_role anahtarı (taşıyıcı birebir aynı) ya da `is_admin()` olan oturum; diğerlerine 403. Geçidin JWT
  ayarına güvenilmez.
- `{"islem": "ara", "merkez": {lat, lng}, "yaricap_m": 15000, "sorgular": [{"metin": "…", "tip": "museum"}]}` — en çok
  25 sorgu, sorgu başına en çok 20 sonuç; konaklama (`KONAKLAMA_TIPLERI` ya da `lodging` tipi) elenir. Alanlar: id, ad,
  birincil tip, tipler, konum, puan, yorum sayısı, işletme durumu.
- `{"islem": "detay", "idler": ["ChIJ…"]}` — en çok 60 id. Alanlar: id, ad, birincil tip, konum, işletme durumu, haftalık
  açılış periyotları.
- Günlük bütçe doluysa Google'a gitmeden 429; bütçe okunamazsa 503 (kapalı kalır). Her Google isteği `googleSay` ile
  sayılır (`api_sayac`, fonksiyon `icerik-google`). Cevap gövdesi ve Google verisi loglanmaz.
- Genel bakış: içerik istekleri **Mekan** kalemine eklenir, Mekan birim fiyatı o günün karışık fiyatı olur
  (`google_birim_fiyat.icerik` = 35 $/1000, üst sınır). İstek sayısı gerçek, tahmini dolar doğru kalır.

### Maliyet (liste fiyatı, ücretsiz kota düşülmeden)

| | İstek | Tahmin |
|---|---|---|
| Araştırma, üst sınır | 25 metin araması (Text Search Enterprise 35 $/1000) + 60 detay (Place Details Enterprise 20 $/1000) | ≈ 2,08 $ |
| Araştırma, tipik | 15 arama + 30 detay | ≈ 1,13 $ |
| Yükleme (kuru ya da gerçek), 2 gün × 6 durak + 2 ek mekan | 14 detay | ≈ 0,28 $ |

Günlük Google bütçesi uygulamayla ortaktır (varsayılan 10 $). BO Genel bakış içerik isteklerini 35 $/1000 ile sayar
(üst sınır).

## 2. Plan dosyası

`icerik/geziler/<slug>.json` — dosya adı `gezi.slug` ile aynı. Google verisi yok: `place_id` ve durak adı dışında Google'dan
gelen alan girmez (koordinat, puan, adres, saat, yorum doğrulayıcıda HATA). Koordinat ve kategori yükleme anında
Google'dan taze alınır.

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
        { "place_id": "ChIJ…", "ad": "…", "sure_dk": 75, "sure_gerekcesi": "varsayılan 90; koleksiyon küçük" }
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
| Google alanı (koordinat, puan, adres, saat, yorum) | durak plandaki güne göre kapalı güne ya da saat dışına düşüyor |
| `#`, `###`, tablo, numaralı ya da iç içe liste, `* `/`+ ` madde | varsayılandan sapan süre için `sure_gerekcesi` yok |
| http(s) bağlantı, `mekan:` dışı bağlantı, `foto:` ve görsel | durak yazıda bağlantılı geçmiyor; gün başına 1–2 kart değil |
| iç içe ya da kapanmamış kalın/italik | 500–900 kelime dışı; `>` ipucu yok; gün başlığı sayısı tutmuyor |
| köşeli parantezli not (`[doğrula]`, kaynak notu), TODO | klişe ("muhteşem", "eşsiz" …); ondalıkta nokta |
| yazıdaki `mekan:id` / `::mekan[id]` ne durakta ne `ek_mekanlar`'da | aynı mekan iki durakta |

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

gh api -X POST repos/ozcinarece/travel/actions/workflows/icerik.yml/dispatches -f ref=main \
  -f 'inputs[islem]=arastir' \
  -f 'inputs[istek]={"sehir":"eskisehir","yaricap_m":15000,"sorgular":[{"metin":"Eskişehir müze","tip":"museum"}],"detay":[],"acik_anahtar":"<base64>"}'

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

Araştırma sonucunu çözmek (repo dışındaki geçici klasöre; geçici dal okunduktan sonra silinir):

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
- **Maliyet.** Alan maskeleri en dar; araştırma başına en çok 25 metin araması ve 60 detay; günlük bütçe doluysa
  Google'a gidilmez.
- **Workflow girdileri** adımlara ortam değişkeniyle geçer (komut satırına gömülmez). Bağımlılık kurulmaz.
