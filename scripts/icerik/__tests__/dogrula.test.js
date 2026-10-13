// İçerik hattı doğrulayıcısı (docs/07): HATA yüklemeyi durdurur, UYARI rapora girer.
import {
  acikMi,
  detayIdleri,
  dolarEtiketi,
  gunleriDenetle,
  kelimeSayisi,
  markdownHatalari,
  mekanIzleri,
  planDenetle,
  slugUret,
  yuklemeVerisi,
  yurumeDk,
} from '../dogrula.mjs';
import { anahtarCifti, coz, sifrele } from '../sifre.mjs';

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
          { place_id: ID.kursunlu, ad: 'Kurşunlu Külliyesi', sure_dk: 30, sure_gerekcesi: 'avlu küçük' },
          { place_id: ID.modern, ad: 'Odunpazarı Modern Müze', sure_dk: 90 },
          { place_id: ID.cam, ad: 'Çağdaş Cam Sanatları Müzesi', sure_dk: 45, sure_gerekcesi: 'tek kat' },
          { place_id: ID.ogle, ad: 'Öğle yemeği', sure_dk: 75 },
          { place_id: ID.kafe, ad: 'Kafe', sure_dk: 30 },
        ],
      },
    ],
    ek_mekanlar: [{ place_id: ID.sazova, ad: 'Sazova Parkı' }],
    notlar: { dogrulanacaklar: [], fotograf_onerileri: [], varsayimlar: ['Hafta sonu: 1. gün cumartesi'] },
  };
}

// Odunpazarı çevresi: duraklar birbirine yürüme mesafesinde.
const det = (lat, lng, primary_type, periyotlar = []) => ({ lat, lng, primary_type, periyotlar, durum: 'OPERATIONAL' });
const PZT_KAPALI = [2, 3, 4, 5, 6, 0].map((gun) => ({ gun, ac: '10:00', kapaGun: gun, kapa: '18:00' }));
function detaylar() {
  return new Map([
    [ID.kursunlu, det(39.7627, 30.5261, 'mosque')],
    [ID.modern, det(39.7646, 30.5236, 'museum', PZT_KAPALI)],
    [ID.cam, det(39.764, 30.5248, 'museum', PZT_KAPALI)],
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
    const { hatalar, uyarilar } = planDenetle(ornekPlan());
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
    const { hatalar } = planDenetle(p);
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
    const { hatalar } = planDenetle(p);
    expect(hatalar).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^yayin/),
        expect.stringMatching(/^gunler\[0\]\.duraklar\[0\]\.lat: plan dosyasında Google verisi/),
        expect.stringMatching(/^gunler\[0\]\.duraklar\[1\]\.puan/),
        '2. gün: en az 1 durak olmalı',
      ]),
    );
    expect(planDenetle({ ...ornekPlan(), gezi: { ...ornekPlan().gezi, yayin: false } }).hatalar).toEqual([]);
  });

  it('yazıda bilinmeyen mekan HATA; araştırmadaki ya da ek mekan geçer', () => {
    const p = ornekPlan();
    p.gezi.yazi_md += '\n\n::mekan[ChIJbilinmeyen001]';
    expect(planDenetle(p).hatalar).toEqual([expect.stringContaining('ChIJbilinmeyen001 ne durakta ne araştırmada')]);
    expect(planDenetle(p, { bilinenIdler: ['ChIJbilinmeyen001'] }).hatalar).toEqual([]);
  });

  it('durak sayısı, yazıda geçmeyen durak, kelime sayısı, klişe UYARI', () => {
    const p = ornekPlan();
    p.gunler[0].duraklar = p.gunler[0].duraklar.slice(0, 3);
    p.gezi.yazi_md = p.gezi.yazi_md.replace(`[Cam Müzesi](mekan:${ID.cam})`, 'Cam Müzesi') + ' Muhteşem bir gün.';
    const { hatalar, uyarilar } = planDenetle(p, { bilinenIdler: [ID.ogle, ID.kafe] });
    expect(hatalar).toEqual([]);
    expect(uyarilar).toEqual(
      expect.arrayContaining(['1. gün: 3 durak (önerilen 4–7)', expect.stringMatching(/^g1\.d3: yazıda bağlantılı geçmiyor/), 'yazi_md: klişe "muhteşem"']),
    );
    p.gezi.yazi_md = p.gezi.yazi_md.replace(paragraf(250), '').replace(paragraf(250), '');
    expect(planDenetle(p, { bilinenIdler: [ID.ogle, ID.kafe] }).uyarilar).toEqual(expect.arrayContaining([expect.stringMatching(/^yazi_md: \d+ kelime/)]));
  });

  it('yeni şehir place_id ister', () => {
    const p = ornekPlan();
    p.sehir = { yeni: { ad: 'Bursa', slug: 'bursa' } };
    expect(planDenetle(p).hatalar).toEqual([expect.stringMatching(/^sehir\.yeni\.place_id/)]);
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

describe('açılış saatleri', () => {
  it('kapalı gün, saat dışı, her zaman açık, bilinmiyor', () => {
    expect(acikMi(PZT_KAPALI, 1, 600, 660)).toBe('kapali_gun');
    expect(acikMi(PZT_KAPALI, 6, 570, 660)).toBe('saat_disi');
    expect(acikMi(PZT_KAPALI, 6, 600, 690)).toBe('acik');
    expect(acikMi([], 1, 0, 60)).toBe('acik');
    expect(acikMi(null, 1, 0, 60)).toBe('bilinmiyor');
    // Gece yarısını geçen periyot (Cumartesi 18:00 – Pazar 02:00).
    expect(acikMi([{ gun: 6, ac: '18:00', kapaGun: 0, kapa: '02:00' }], 6, 1380, 1430)).toBe('acik');
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
    p.gunler[0].duraklar.splice(4, 0, { place_id: ID.sazova, ad: 'Sazova', sure_dk: 400 });
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

describe('yükleme verisi', () => {
  it('kategori ve konum detaydan, ad plandan; yayın alanı yok', () => {
    const v = yuklemeVerisi(ornekPlan(), detaylar());
    expect(v.sehir).toEqual({ slug: 'eskisehir' });
    expect(v.gezi).not.toHaveProperty('yayin');
    expect(v.gunler[0].duraklar[1]).toEqual({ place_id: ID.modern, ad: 'Odunpazarı Modern Müze', kategori: 'museum', sure_dk: 90, lat: 39.7646, lng: 30.5236 });
    expect(detayIdleri(ornekPlan())).toEqual([ID.kursunlu, ID.modern, ID.cam, ID.ogle, ID.kafe, ID.sazova]);
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
