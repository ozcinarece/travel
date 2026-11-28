// İçerik hattı doğrulayıcısı (docs/07): HATA yüklemeyi durdurur, UYARI rapora girer.
import {
  VARSAYILAN_DAKIKA,
  detayIdleri,
  mekanDurumuDenetle,
  dolarEtiketi,
  gunleriDenetle,
  kelimeSayisi,
  markdownHatalari,
  mekanIzleri,
  planDenetle,
  rehberDenetle,
  sehirKimligi,
  sehirKimligiSql,
  slugUret,
  yuklemeVerisi,
  yurumeDk,
  AMACLAR,
  amacHatasi,
  osmIdleri,
  osmKimlikSorgusu,
  osmKonumDenetle,
  adSade,
  adUyar,
  osmEslestir,
  eslemeKareleri,
  eslemeYaricapi,
  yemekMi,
} from '../dogrula.mjs';
import { anahtarCifti, coz, sifrele } from '../sifre.mjs';
import { VARSAYILAN_DAKIKA as UYGULAMA_DAKIKA } from '../../../src/lib/kategori';

const ID = {
  kursunlu: 'ChIJkursunlu0001',
  modern: 'ChIJmodernmuze01',
  cam: 'ChIJcamsanatlar1',
  ogle: 'ChIJogleyemegi01',
  kafe: 'ChIJkafeyerim001',
  sazova: 'ChIJsazovaparki1',
};

const paragraf = (n) => Array.from({ length: n }, (_, i) => `kelime${i}`).join(' ');

function ornekPlan() {
  return {
    surum: 1,
    sehir: { slug: 'eskisehir' },
    gezi: {
      slug: 'eskisehirde-bir-hafta-sonu',
      baslik: "Eskişehir'de bir hafta sonu",
      ozet: 'Yürüyerek, rahat tempoda; ilk kez gidenler için',
      yazar_ad: 'Tripmate ekibi',
      yazi_md: [
        `Giriş ${paragraf(250)}.`,
        '',
        '> Pazartesi müzeler kapalı; planı hafta sonuna kur.',
        '',
        '## 1. gün · Odunpazarı',
        '',
        `Sabah [Kurşunlu Külliyesi](mekan:${ID.kursunlu}) ile başla, sonra [Modern Müze](mekan:${ID.modern}) ve [Cam Müzesi](mekan:${ID.cam}).`,
        `::mekan[${ID.modern}]`,
        '',
        `Öğlen [yemek](mekan:${ID.ogle}), akşamüstü **kahve** için [kafe](mekan:${ID.kafe}). ${paragraf(250)}`,
        '',
        '- Kısa madde, *italik* bir not',
        '',
        `Kısaltmak istersen [Sazova](mekan:${ID.sazova}) ekle.`,
      ].join('\n'),
    },
    gunler: [
      {
        baslik: 'Odunpazarı',
        duraklar: [
          { place_id: ID.kursunlu, osm: 'way/101', ad: 'Kurşunlu Külliyesi', sure_dk: 30, sure_gerekcesi: 'avlu küçük', kapali_gunler: [], rehber: 'kursunlu' },
          { place_id: ID.modern, osm: 'way/102', ad: 'Odunpazarı Modern Müze', sure_dk: 90, kapali_gunler: ['pazartesi'], rehber: 'omm' },
          { place_id: ID.cam, osm: 'node/103', ad: 'Çağdaş Cam Sanatları Müzesi', sure_dk: 45, sure_gerekcesi: 'tek kat', kapali_gunler: ['Pazartesi'], rehber: 'cam' },
          { place_id: ID.ogle, osm: 'node/104', ad: 'Öğle yemeği', sure_dk: 75, kapali_gunler: [], rehber: 'ogle' },
          { place_id: ID.kafe, osm: 'node/105', ad: 'Kafe', sure_dk: 30, kapali_gunler: [], rehber: 'kafe' },
        ],
      },
    ],
    ek_mekanlar: [{ place_id: ID.sazova, ad: 'Sazova Parkı' }],
    notlar: { dogrulanacaklar: [], fotograf_onerileri: [], varsayimlar: ['Hafta sonu: 1. gün cumartesi'] },
  };
}

// Odunpazarı çevresi: duraklar birbirine yürüme mesafesinde.
const det = (lat, lng, primary_type) => ({ lat, lng, primary_type, durum: 'OPERATIONAL' });

// Mekan rehberi: ~170 kelime, tek ipucu.
const ornekRehber = (ad) => `${ad} ${paragraf(80)}.\n\n${paragraf(80)}.\n\n> Girişte sağdaki merdivenden çık; üst kat daha sakin.`;
const REHBERLER = new Map(['kursunlu', 'omm', 'cam', 'ogle', 'kafe'].map((k) => [k, ornekRehber(k)]));
function detaylar() {
  return new Map([
    [ID.kursunlu, det(39.7627, 30.5261, 'mosque')],
    [ID.modern, det(39.7646, 30.5236, 'museum')],
    [ID.cam, det(39.764, 30.5248, 'museum')],
    [ID.ogle, det(39.7655, 30.5247, 'restaurant')],
    [ID.kafe, det(39.7660, 30.5240, 'cafe')],
    [ID.sazova, det(39.7536, 30.4556, 'park')],
  ]);
}

describe('slugUret', () => {
  it('Türkçe harfleri sadeleştirir, yalnız küçük harf, rakam ve tire', () => {
    expect(slugUret("Eskişehir'de bir hafta sonu")).toBe('eskisehirde-bir-hafta-sonu');
    expect(slugUret('Çarşı, Göl & Ülke — İzmir 2 gün')).toBe('carsi-gol-ulke-izmir-2-gun');
    expect(slugUret('a'.repeat(100))).toHaveLength(80);
  });
});

describe('planDenetle', () => {
  it('örnek plan temiz', () => {
    const { hatalar, uyarilar } = planDenetle(ornekPlan(), { rehberler: REHBERLER });
    expect(hatalar).toEqual([]);
    expect(uyarilar).toEqual([]);
  });

  it('uzunluk ve desen sınırları HATA', () => {
    const p = ornekPlan();
    p.gezi.baslik = 'x'.repeat(51);
    p.gezi.ozet = 'y'.repeat(71);
    p.gezi.slug = 'Buyuk_Harf';
    p.gunler[0].baslik = 'z'.repeat(31);
    p.gunler[0].duraklar[1].sure_dk = 10;
    p.gunler[0].duraklar[2].sure_dk = 45.5;
    p.gunler[0].duraklar[3].place_id = 'kisa';
    p.gunler[0].duraklar[4].ad = 'a'.repeat(121);
    const { hatalar } = planDenetle(p, { rehberler: REHBERLER });
    expect(hatalar).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^gezi\.baslik: 51 karakter/),
        expect.stringMatching(/^gezi\.ozet: 71 karakter/),
        expect.stringMatching(/^gezi\.slug/),
        expect.stringMatching(/^1\. gün: başlık 31 karakter/),
        expect.stringMatching(/^g1\.d2: sure_dk/),
        expect.stringMatching(/^g1\.d3: sure_dk/),
        expect.stringMatching(/^g1\.d4: place_id/),
        expect.stringMatching(/^g1\.d5: ad 121 karakter/),
      ]),
    );
  });

  it('yayin=true, Google alanları ve boş gün HATA', () => {
    const p = ornekPlan();
    p.gezi.yayin = true;
    p.gunler[0].duraklar[0].lat = 39.7;
    p.gunler[0].duraklar[1].puan = 4.6;
    p.gunler.push({ baslik: 'Boş', duraklar: [] });
    const { hatalar } = planDenetle(p, { rehberler: REHBERLER });
    expect(hatalar).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^yayin/),
        expect.stringMatching(/^gunler\[0\]\.duraklar\[0\]\.lat: plan dosyasında Google verisi/),
        expect.stringMatching(/^gunler\[0\]\.duraklar\[1\]\.puan/),
        '2. gün: en az 1 durak olmalı',
      ]),
    );
    expect(planDenetle({ ...ornekPlan(), gezi: { ...ornekPlan().gezi, yayin: false } }, { rehberler: REHBERLER }).hatalar).toEqual([]);
  });

  it('yazıda bilinmeyen mekan HATA; araştırmadaki ya da ek mekan geçer', () => {
    const p = ornekPlan();
    p.gezi.yazi_md += '\n\n::mekan[ChIJbilinmeyen001]';
    expect(planDenetle(p, { rehberler: REHBERLER }).hatalar).toEqual([expect.stringContaining('ChIJbilinmeyen001 ne durakta ne araştırmada')]);
    expect(planDenetle(p, { bilinenIdler: ['ChIJbilinmeyen001'], rehberler: REHBERLER }).hatalar).toEqual([]);
  });

  it('durak sayısı, yazıda geçmeyen durak, kelime sayısı, klişe UYARI', () => {
    const p = ornekPlan();
    p.gunler[0].duraklar = p.gunler[0].duraklar.slice(0, 3);
    p.gezi.yazi_md = p.gezi.yazi_md.replace(`[Cam Müzesi](mekan:${ID.cam})`, 'Cam Müzesi') + ' Muhteşem bir gün.';
    const { hatalar, uyarilar } = planDenetle(p, { bilinenIdler: [ID.ogle, ID.kafe], rehberler: REHBERLER });
    expect(hatalar).toEqual([]);
    expect(uyarilar).toEqual(
      expect.arrayContaining(['1. gün: 3 durak (önerilen 4–7)', expect.stringMatching(/^g1\.d3: yazıda bağlantılı geçmiyor/), 'yazi_md: klişe "muhteşem"']),
    );
    p.gezi.yazi_md = p.gezi.yazi_md.replace(paragraf(250), '').replace(paragraf(250), '');
    expect(planDenetle(p, { bilinenIdler: [ID.ogle, ID.kafe], rehberler: REHBERLER }).uyarilar).toEqual(expect.arrayContaining([expect.stringMatching(/^yazi_md: \d+ kelime/)]));
  });

  it('yeni şehir place_id ister', () => {
    const p = ornekPlan();
    p.sehir = { yeni: { ad: 'Bursa', slug: 'bursa' } };
    expect(planDenetle(p, { rehberler: REHBERLER }).hatalar).toEqual([expect.stringMatching(/^sehir\.yeni\.place_id/)]);
  });
});

describe('markdownHatalari', () => {
  it('uygulamanın çizdiği sözdizimi geçer', () => {
    const md = `Paragraf **kalın** ve *italik*, [Ad](mekan:${ID.modern}).\n\n> İpucu\n\n## 1. gün · Odunpazarı\n\n::mekan[${ID.modern}]\n\n- Madde [Ad](mekan:${ID.cam})`;
    expect(markdownHatalari(md)).toEqual([]);
  });

  it.each([
    ['# Başlık', /tek diyezli/],
    ['### Alt başlık', /###/],
    ['| a | b |', /tablo/],
    ['|---|---|', /tablo/],
    ['1. birinci', /numaralı/],
    ['- üst\n  - alt', /iç içe liste/],
    ['* madde', /"- " kullan/],
    ['Bkz. https://ornek.com', /dış bağlantı/],
    ['[Site](https://ornek.com)', /dış bağlantı/],
    ['![Kapak](foto:geziler/x/a.webp)', /foto/],
    ['Burada [doğrula] kaldı', /köşeli parantez/],
    ['Açılış saati 10:00 [kaynak: müze]', /köşeli parantez|kaynak/],
    ['***kalın italik***', /iç içe/],
    ['**kalın *içinde italik* var**', /iç içe/],
    ['*kapanmamış italik', /kapanmamış/],
    ['::mekan[kisa]', /geçersiz kart/],
  ])('%s → HATA', (md, beklenen) => {
    expect(markdownHatalari(md).join('\n')).toMatch(beklenen);
  });
});

describe('mekanIzleri ve kelimeSayisi', () => {
  it('yazı sırasıyla satır ve kart', () => {
    const md = `A [X](mekan:${ID.cam}) b.\n::mekan[${ID.modern}]\nC [Y](mekan:${ID.kafe})`;
    expect(mekanIzleri(md)).toEqual([
      { place_id: ID.cam, bicim: 'satir', ad: 'X' },
      { place_id: ID.modern, bicim: 'kart' },
      { place_id: ID.kafe, bicim: 'satir', ad: 'Y' },
    ]);
    expect(kelimeSayisi(`## 1. gün · Odunpazarı\n\nBir [iki](mekan:${ID.cam}) üç.\n::mekan[${ID.modern}]`)).toBe(6);
  });
});

describe('kapalı günler ve mekan rehberi', () => {
  it('kapali_gunler zorunlu ve yalnız gün adı; rehber dosyası bulunmalı', () => {
    const p = ornekPlan();
    delete p.gunler[0].duraklar[0].kapali_gunler;
    p.gunler[0].duraklar[1].kapali_gunler = ['pzt'];
    p.gunler[0].duraklar[2].rehber = 'yok-boyle';
    delete p.gunler[0].duraklar[3].rehber;
    const { hatalar, uyarilar } = planDenetle(p, { rehberler: REHBERLER });
    expect(hatalar).toEqual(
      expect.arrayContaining([expect.stringMatching(/^g1\.d1: kapali_gunler gerekli/), expect.stringMatching(/^g1\.d2: kapali_gunler yalnız gün adı/), expect.stringMatching(/^g1\.d3: rehber dosyası bulunamadı/)]),
    );
    expect(uyarilar).toContain('g1.d4: mekan rehberi yok (rehber)');
  });

  it('rehber: tek ipucu, 150–300 kelime, fiyat ve saat yok, sözdizimi', () => {
    expect(rehberDenetle(ornekRehber('OMM'))).toEqual({ hatalar: [], uyarilar: [] });
    expect(rehberDenetle(`${paragraf(170)}.`).hatalar).toEqual(['tek bir ">" İPUCU olmalı (gelen 0)']);
    expect(rehberDenetle(`${paragraf(170)}.\n\n> Bir.\n\n> İki.`).hatalar).toEqual(['tek bir ">" İPUCU olmalı (gelen 2)']);
    const kisa = rehberDenetle('Kısa.\n\n> İpucu, giriş 250 TL ve 10:00 açılır.');
    expect(kisa.uyarilar).toEqual(expect.arrayContaining([expect.stringMatching(/kelime/), expect.stringMatching(/fiyat ya da saat/)]));
    expect(rehberDenetle(`# Başlık\n\n${paragraf(170)}.\n\n> İpucu [kaynak].`).hatalar.join('\n')).toMatch(/tek diyezli[\s\S]*köşeli parantez/);
  });
});

describe('gunleriDenetle', () => {
  it('örnek gün: uyarı yok; yürüme kestirimi 1,3 × kuş uçuşu ÷ 75', () => {
    const p = ornekPlan();
    const { uyarilar, gunler } = gunleriDenetle(p, detaylar());
    expect(uyarilar).toEqual([]);
    expect(gunler[0].durak).toBe(5);
    expect(yurumeDk({ lat: 39.7627, lng: 30.5261 }, { lat: 39.7646, lng: 30.5236 })).toBe(6);
  });

  it('pazartesi kapalı müze, uzun geçiş, öğle yemeği, 8 saat, gerekçesiz süre', () => {
    const p = ornekPlan();
    p.takvim = { ilk_gun: 'pazartesi' };
    p.gunler[0].duraklar.splice(4, 0, { place_id: ID.sazova, ad: 'Sazova', sure_dk: 400, kapali_gunler: [] });
    p.gunler[0].duraklar.splice(3, 1);
    const { uyarilar } = gunleriDenetle(p, detaylar());
    expect(uyarilar).toEqual(
      expect.arrayContaining([
        'g1.d2: pazartesi günü kapalı',
        'g1.d3: pazartesi günü kapalı',
        expect.stringMatching(/^g1\.d4: önceki duraktan tahmini yürüme \d+ dk/),
        '1. gün: 12:00–14:00 arasına yemek durağı düşmüyor',
        expect.stringMatching(/^1\. gün: \d+ dk \(> 480/),
        'g1.d4: süre 400 dk, varsayılan 45; sure_gerekcesi yaz',
      ]),
    );
  });
});

describe('#300 amaç etiketleri', () => {
  it('sabit 6 etiket; amaclar yoksa ya da null ise sorun yok', () => {
    expect(AMACLAR).toEqual(['kultur_tarih', 'lezzet', 'doga', 'yavas', 'gece', 'cocuklu']);
    expect(amacHatasi(undefined)).toBeNull();
    expect(amacHatasi(null)).toBeNull();
    expect(amacHatasi([])).toBeNull();
    expect(amacHatasi(['lezzet', 'doga'])).toBeNull();
  });

  it('listede olmayan değer, tekrar ya da dizi olmayan alan HATA', () => {
    const plan = ornekPlan();
    plan.gezi.amaclar = ['lezzet', 'plaj'];
    plan.gunler[0].duraklar[1].amaclar = ['doga', 'doga'];
    plan.gunler[0].duraklar[2].amaclar = 'gece';
    const { hatalar } = planDenetle(plan, { rehberler: REHBERLER });
    expect(hatalar).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^gezi\.amaclar listede olmayan değer/),
        expect.stringMatching(/^g1\.d2: amaclar aynı değeri iki kez/),
        expect.stringMatching(/^g1\.d3: amaclar bir dizi olmalı/),
      ]),
    );
    plan.gezi.amaclar = ['lezzet', 'kultur_tarih'];
    plan.gunler[0].duraklar[1].amaclar = ['doga'];
    plan.gunler[0].duraklar[2].amaclar = ['gece'];
    expect(planDenetle(plan, { rehberler: REHBERLER }).hatalar.filter((h) => h.includes('amaclar'))).toEqual([]);
  });

  it('yükleme verisi amaçları taşır; boş ya da verilmemişse alan yok', () => {
    const plan = ornekPlan();
    expect(yuklemeVerisi(plan, detaylar()).gezi).not.toHaveProperty('amaclar');
    plan.gezi.amaclar = ['kultur_tarih'];
    plan.gunler[0].duraklar[0].amaclar = ['lezzet', 'yavas'];
    plan.gunler[0].duraklar[1].amaclar = [];
    const v = yuklemeVerisi(plan, detaylar());
    expect(v.gezi.amaclar).toEqual(['kultur_tarih']);
    expect(v.gunler[0].duraklar[0].amaclar).toEqual(['lezzet', 'yavas']);
    expect(v.gunler[0].duraklar[1]).not.toHaveProperty('amaclar');
  });
});

describe('yükleme verisi', () => {
  it('kategori ve konum detaydan, ad plandan; yayın alanı yok', () => {
    const v = yuklemeVerisi(ornekPlan(), detaylar());
    expect(v.sehir).toEqual({ slug: 'eskisehir' });
    expect(v.gezi).not.toHaveProperty('yayin');
    expect(v.gunler[0].duraklar[1]).toEqual({ place_id: ID.modern, ad: 'Odunpazarı Modern Müze', kategori: 'museum', sure_dk: 90, lat: 39.7646, lng: 30.5236 });
    expect(detayIdleri(ornekPlan())).toEqual([ID.kursunlu, ID.modern, ID.cam, ID.ogle, ID.kafe]);
    const r = yuklemeVerisi(ornekPlan(), detaylar(), REHBERLER);
    expect(r.gunler[0].duraklar[1].rehber_md).toBe(ornekRehber('omm'));
  });

  it('#205 KK2: OSM adayı olan durakta konum OSM\'den ve osm_id ile; olmayanda Google detayından', () => {
    const plan = ornekPlan();
    plan.gunler[0].duraklar[1].osm = 'way/123456';
    const osm = new Map([['way/123456', { lat: 39.7648, lng: 30.5237 }]]);
    const v = yuklemeVerisi(plan, detaylar(), new Map(), osm);
    expect(v.gunler[0].duraklar[1]).toEqual({ place_id: ID.modern, ad: 'Odunpazarı Modern Müze', kategori: 'museum', sure_dk: 90, lat: 39.7648, lng: 30.5237, osm_id: 'way/123456' });
    expect(v.gunler[0].duraklar[0]).not.toHaveProperty('osm_id');
    expect(v.gunler[0].duraklar[0].lat).toBe(39.7627);
    // Overpass'ta okunamadıysa (denetim bunu hata sayar) Google konumuna düşer, osm_id yazılmaz.
    expect(yuklemeVerisi(plan, detaylar()).gunler[0].duraklar[1]).not.toHaveProperty('osm_id');
    expect(osmIdleri(plan)).toEqual(['way/101', 'way/123456', 'node/103', 'node/104', 'node/105']);
  });

  it('#205 KK2: OSM adayı bulunamazsa ya da 150 m\'den uzaksa hata; satırda koordinat yok', () => {
    const plan = ornekPlan();
    for (const d of plan.gunler[0].duraklar) delete d.osm;
    plan.gunler[0].duraklar[0].osm = 'node/1';
    plan.gunler[0].duraklar[1].osm = 'way/2';
    plan.gunler[0].duraklar[2].osm = 'relation/3';
    const osm = new Map([
      ['node/1', { lat: 39.7628, lng: 30.5262 }],
      ['way/2', { lat: 39.7700, lng: 30.5236 }],
    ]);
    const h = osmKonumDenetle(plan, detaylar(), osm);
    expect(h).toEqual(['g1.d2: OSM konumu Google konumundan 600 m uzakta (en çok 150; way/2)', 'g1.d3: OSM nesnesi bulunamadı (relation/3)']);
    expect(h.join(' ')).not.toMatch(/39\.|30\./);
  });

  it('#205 KK2: plan denetimi osm biçimini sınar, eksikse uyarır', () => {
    const plan = ornekPlan();
    plan.gunler[0].duraklar[0].osm = 'node/abc';
    delete plan.gunler[0].duraklar[1].osm;
    const { hatalar, uyarilar } = planDenetle(plan, { rehberler: REHBERLER });
    expect(hatalar).toContain('g1.d1: osm "node/123", "way/45" ya da "relation/6" olmalı');
    expect(uyarilar).toContain("g1.d2: OSM adayı yok (osm); konum Google'dan, 30 günde yenilenmeli");
  });

  it('#205 KK2: OSM kimlik sorgusu türlere ayrılır; geçersiz kimlik sorguya girmez', () => {
    expect(osmKimlikSorgusu(['node/1', 'way/2', 'node/3'])).toBe('[out:json][timeout:60];\n(\n  node(id:1,3);\n  way(id:2);\n);\nout center;');
    expect(() => osmKimlikSorgusu(['node/1);out;'])).toThrow('osm kimliği biçimi geçersiz');
  });

  it('dolar tırnağı etiketi metinde geçmez', () => {
    let n = 0;
    const sira = ['abc', 'abc', 'xyz'];
    expect(dolarEtiketi('içinde $iabc$ var', () => sira[n++])).toBe('$ixyz$');
  });
});

describe('şifreleme (arastir sonucu)', () => {
  it('RSA-OAEP-SHA256 ile sarılmış AES-256-GCM: açık anahtarla şifrelenir, özel anahtarla çözülür', async () => {
    const { acik, ozelPem } = await anahtarCifti();
    const paket = await sifrele('{"ara":"çok gizli"}', acik);
    expect(paket.alg).toBe('RSA-OAEP-SHA256+AES-256-GCM');
    expect(JSON.stringify(paket)).not.toContain('gizli');
    expect(await coz(paket, ozelPem)).toBe('{"ara":"çok gizli"}');
    await expect(coz({ ...paket, veri: Buffer.from('bozuk').toString('base64') }, ozelPem)).rejects.toThrow();
  });
});

describe('#197 şehir kimliği', () => {
  const sehir = { lat: 39.7767, lng: 30.5206 };
  const yer = { place_id: 'ChIJ_eskisehir_1', tz: 'Europe/Istanbul', ulke_kodu: 'TR', lat: 39.78, lng: 30.52 };
  test('geçerli ve yakın: kimlik, saat dilimi, ülke kodu', () => {
    expect(sehirKimligi(sehir, yer)).toEqual({ place_id: 'ChIJ_eskisehir_1', tz: 'Europe/Istanbul', ulke_kodu: 'TR' });
    expect(sehirKimligi(sehir, { ...yer, ulke_kodu: null })).toEqual({ place_id: 'ChIJ_eskisehir_1', tz: 'Europe/Istanbul', ulke_kodu: null });
    expect(sehirKimligi(sehir, { ...yer, tz: 'America/Argentina/Buenos_Aires' })?.tz).toBe('America/Argentina/Buenos_Aires');
  });
  test("Google'ın şehri 50 km'den uzaksa ya da biçim bozuksa yazılmaz", () => {
    expect(sehirKimligi(sehir, { ...yer, lat: 41.0, lng: 29.0 })).toBeNull();
    expect(sehirKimligi(sehir, { ...yer, tz: null })).toBeNull();
    expect(sehirKimligi(sehir, { ...yer, tz: "Europe/Istanbul'; drop" })).toBeNull();
    expect(sehirKimligi(sehir, { ...yer, place_id: 'kisa' })).toBeNull();
    expect(sehirKimligi(sehir, null)).toBeNull();
    // #205 Parça 1: şehrimizin konumu boşaldıysa 50 km denetimi yapılamaz; yazılmaz.
    expect(sehirKimligi({ lat: null, lng: null }, yer)).toBeNull();
  });
  test('SQL yalnız doğrulanmış değerlerle', () => {
    expect(sehirKimligiSql('eskisehir', { place_id: 'ChIJ_eskisehir_1', tz: 'Europe/Istanbul', ulke_kodu: 'TR' })).toBe(
      "select public.icerik_sehir_kimligi_yaz('eskisehir', 'ChIJ_eskisehir_1', 'Europe/Istanbul', 'TR') as y",
    );
    expect(sehirKimligiSql('eskisehir', { place_id: 'ChIJ_eskisehir_1', tz: 'UTC', ulke_kodu: null })).toContain("'UTC', null)");
    expect(() => sehirKimligiSql("x'; drop", { place_id: 'ChIJ_eskisehir_1', tz: 'UTC' })).toThrow();
    expect(() => sehirKimligiSql('eskisehir', { place_id: "ChIJ'x", tz: 'UTC' })).toThrow();
    expect(() => sehirKimligiSql('eskisehir', { place_id: 'ChIJ_eskisehir_1', tz: 'UTC', ulke_kodu: 'tr' })).toThrow();
  });
});

describe('#205 KK3: OSM eşleştirmesi (ad + 150 m)', () => {
  const satir = { ad: 'Kurşunlu Camii', lat: 39.7667, lng: 30.5256 };
  // ~0,001° enlem ≈ 111 m
  const yakin = { osm: 'way/10', adlar: ['Kurşunlu Camii'], lat: 39.7677, lng: 30.5256 };
  const uzak = { osm: 'way/11', adlar: ['Kurşunlu Camii'], lat: 39.7687, lng: 30.5256 };
  const baskaAd = { osm: 'node/12', adlar: ['Başka Kafe'], lat: 39.7667, lng: 30.5256 };

  it('adı Türkçe harf ve noktalamadan bağımsız sadeleştirir', () => {
    expect(adSade('  KURŞUNLU Camii & Külliyesi ')).toBe('kursunlu camii kulliyesi');
    expect(adSade('İstanbul')).toBe('istanbul');
    expect(adSade('Işık')).toBe('isik');
  });

  it('aynı ad ya da tam sözcük dizisi olarak içerme uyar; kısa ya da yarım sözcük uymaz', () => {
    expect(adUyar('Kurşunlu Camii', 'KURSUNLU CAMİİ')).toBe(true);
    expect(adUyar('Odunpazarı Modern Müze', 'OMM Odunpazarı Modern Müze')).toBe(true);
    expect(adUyar('Park', 'Kent Park')).toBe(false);
    expect(adUyar('Kurşunlu', 'Kurşunluk Parkı')).toBe(false);
    expect(adUyar('', 'Kurşunlu')).toBe(false);
  });

  it('150 m içindeki adı uyan adayı seçer, en yakını tercih eder', () => {
    expect(osmEslestir(satir, [uzak, yakin, baskaAd])).toEqual({ osm_id: 'way/10', lat: yakin.lat, lng: yakin.lng });
    expect(osmEslestir(satir, [{ ...yakin, osm: 'node/13', lat: 39.7672 }, yakin])?.osm_id).toBe('node/13');
  });

  it('150 m dışı, adı uymayan ya da kimliği bozuk aday eşleşmez', () => {
    expect(osmEslestir(satir, [uzak])).toBeNull();
    expect(osmEslestir(satir, [baskaAd])).toBeNull();
    expect(osmEslestir(satir, [{ ...yakin, osm: 'node/abc' }])).toBeNull();
    expect(osmEslestir(satir, [])).toBeNull();
  });

  it('ikinci adlardan (name:tr, alt_name) da eşleşir', () => {
    expect(osmEslestir(satir, [{ ...yakin, adlar: ['Kursunlu Mosque', 'Kurşunlu Camii'] }])?.osm_id).toBe('way/10');
  });

  it('Overpass daireyi en çok 6 km kenarlı karelere böler, daireyi kapsar', () => {
    const m = { lat: 41.9028, lng: 12.4964 };
    expect(eslemeKareleri(m, 1000)).toHaveLength(1);
    const k = eslemeKareleri(m, 12000);
    // 24 km çap → 4×4 ızgara; köşedeki 4 kare de daireye değer (karenin iç köşesi merkeze 8,5 km).
    expect(k).toHaveLength(16);
    const k30 = eslemeKareleri(m, 30000);
    expect(k30.length).toBeLessThan(100);
    expect(k30.length).toBeGreaterThan(70);
    for (const [g, b, kz, d] of k30) {
      expect(kz).toBeGreaterThan(g);
      expect(d).toBeGreaterThan(b);
      expect((kz - g) * 111320).toBeLessThanOrEqual(6000 + 12);
    }
    // Dairenin dört ucu bir karenin içinde.
    const dLat = 30000 / 111320;
    const dLng = 30000 / (111320 * Math.cos((m.lat * Math.PI) / 180));
    for (const [la, ln] of [[m.lat + dLat * 0.999, m.lng], [m.lat - dLat * 0.999, m.lng], [m.lat, m.lng + dLng * 0.999], [m.lat, m.lng - dLng * 0.999]])
      expect(k30.some(([g, b, kz, d]) => la >= g && la <= kz && ln >= b && ln <= d)).toBe(true);
    // Köşeler 4 ondalığa yuvarlanır.
    for (const v of k30.flat()) expect(Math.round(v * 1e4) / 1e4).toBe(v);
  });

  it('Overpass yarıçapı en uzak satırı kapsar; 1–30 km', () => {
    const m = { lat: 39.7667, lng: 30.5256 };
    expect(eslemeYaricapi(m, [])).toBe(1000);
    expect(eslemeYaricapi(m, [{ lat: 39.7967, lng: 30.5256 }])).toBeGreaterThan(3800);
    expect(eslemeYaricapi(m, [{ lat: 41, lng: 30.5256 }])).toBe(30000);
    // #205 Parça 1: konumu boşalmış satır yarıçapa girmez.
    expect(eslemeYaricapi(m, [{ lat: null, lng: null }, { lat: 39.7967, lng: 30.5256 }])).toBe(eslemeYaricapi(m, [{ lat: 39.7967, lng: 30.5256 }]));
  });
});

describe('#335 işletme durumu denetimi', () => {
  const yer = (place_id, durum) => ({ place_id, lat: 38.4, lng: 27.1, ...(durum === undefined ? {} : { durum }) });

  test('boş durum (null ya da yok) uyarı; yükleme sürer', () => {
    const r = mekanDurumuDenetle(['aaaaaaaaaa1', 'aaaaaaaaaa2'], [yer('aaaaaaaaaa1', null), yer('aaaaaaaaaa2')]);
    expect(r.hatalar).toEqual([]);
    expect(r.uyarilar).toEqual([
      "aaaaaaaaaa1: işletme durumu Google'da boş; kapalı günleri elle doğrula",
      "aaaaaaaaaa2: işletme durumu Google'da boş; kapalı günleri elle doğrula",
    ]);
  });

  test('CLOSED_TEMPORARILY ve CLOSED_PERMANENTLY hata, metin aynı', () => {
    const r = mekanDurumuDenetle(['bbbbbbbbbb1', 'bbbbbbbbbb2'], [yer('bbbbbbbbbb1', 'CLOSED_TEMPORARILY'), yer('bbbbbbbbbb2', 'CLOSED_PERMANENTLY')]);
    expect(r.hatalar).toEqual([
      'bbbbbbbbbb1: işletme durumu OPERATIONAL değil (CLOSED_TEMPORARILY)',
      'bbbbbbbbbb2: işletme durumu OPERATIONAL değil (CLOSED_PERMANENTLY)',
    ]);
    expect(r.uyarilar).toEqual([]);
  });

  test('bilinmeyen değer hata (temkinli)', () => {
    const r = mekanDurumuDenetle(['cccccccccc1'], [yer('cccccccccc1', 'BUSINESS_STATUS_UNSPECIFIED')]);
    expect(r.hatalar).toEqual(['cccccccccc1: işletme durumu OPERATIONAL değil (BUSINESS_STATUS_UNSPECIFIED)']);
  });

  test('OPERATIONAL sorunsuz', () => {
    expect(mekanDurumuDenetle(['dddddddddd1'], [yer('dddddddddd1', 'OPERATIONAL')])).toEqual({ hatalar: [], uyarilar: [] });
  });

  test('şehrin kendi place_id\'si durumdan muaf; detay ya da konum yoksa hata', () => {
    const r = mekanDurumuDenetle(
      ['sehir000001', 'eeeeeeeeee1', 'eeeeeeeeee2'],
      [yer('sehir000001', 'CLOSED_PERMANENTLY'), { place_id: 'eeeeeeeeee1', hata: 'HTTP 404' }, { place_id: 'eeeeeeeeee2', durum: 'OPERATIONAL' }],
      'sehir000001',
    );
    expect(r.hatalar).toEqual(['eeeeeeeeee1: detay alınamadı (HTTP 404)', 'eeeeeeeeee2: konum yok']);
    expect(r.uyarilar).toEqual([]);
  });
});

describe('#160 KK-ek4: kebapçı yemek sayılır', () => {
  it('kebab_shop yemek; restoran türleri bugünkü gibi; müze değil', () => {
    expect(yemekMi('kebab_shop')).toBe(true);
    expect(yemekMi('turkish_restaurant')).toBe(true);
    expect(yemekMi('museum')).toBe(false);
  });
});

describe('#440: cafeteria yemek durağı', () => {
  it('cafeteria yemek; cafe ve coffee_shop değil', () => {
    expect(yemekMi('cafeteria')).toBe(true);
    expect(yemekMi('cafe')).toBe(false);
    expect(yemekMi('coffee_shop')).toBe(false);
  });
});

describe('VARSAYILAN_DAKIKA (#440)', () => {
  it('içerik hattı tablosu uygulamanınkiyle aynı', () => {
    expect(VARSAYILAN_DAKIKA).toEqual(UYGULAMA_DAKIKA);
  });
  it('lokanta restoran kadar sürer', () => {
    expect(VARSAYILAN_DAKIKA.cafeteria).toBe(75);
  });
});
