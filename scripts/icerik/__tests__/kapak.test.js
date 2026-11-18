// #345 KK2: Commons kapağı — plan biçimi, lisans kabulü, yazar temizliği, Commons cevabının eşlenmesi.
import { commonsBilgisi, kapakDenetimi, kapakDenetle, kapakIstekleri, kapakVerisi, kapakYolu, lisansCoz, yazarTemizle } from '../kapak.mjs';

const meta = (kisa, kod, yazar = 'Ad Soyad') => ({ LicenseShortName: { value: kisa }, License: { value: kod }, Artist: { value: yazar } });

describe('kapakDenetle', () => {
  it('kapak isteğe bağlı', () => {
    expect(kapakDenetle({ gezi: {}, sehir: {}, gunler: [{ duraklar: [{}] }] })).toEqual([]);
  });
  it('gezi, şehir ve durak kapağının biçimi denetlenir', () => {
    const h = kapakDenetle({
      gezi: { kapak: { commons: 'File:Koza Han.jpg' } },
      sehir: { kapak: 'File:x.jpg' },
      gunler: [{ duraklar: [{ kapak: { commons: 'Koza.jpg' } }, { kapak: { commons: 'File:a.gif' } }, { kapak: { commons: 'File:a.jpg', url: 'x' } }] }],
    });
    expect(h).toEqual([
      'sehir.kapak: {commons: "File:…"} olmalı',
      'g1.d1.kapak.commons: "File:Ad.jpg" biçiminde bir Commons dosyası olmalı (jpg, png, webp)',
      'g1.d2.kapak.commons: "File:Ad.jpg" biçiminde bir Commons dosyası olmalı (jpg, png, webp)',
      'g1.d3.kapak: {commons: "File:…"} olmalı',
    ]);
  });
});

describe('kapakIstekleri', () => {
  it('gezi, şehir (yeni ya da mevcut) ve durak; aynı yer bir kez', () => {
    const plan = {
      gezi: { slug: 'g', kapak: { commons: 'File:A.jpg' } },
      sehir: { yeni: { slug: 'bursa' }, kapak: { commons: 'File:B.jpg' } },
      gunler: [{ duraklar: [{ place_id: 'p1', kapak: { commons: 'File:C.jpg' } }, { place_id: 'p2' }] }, { duraklar: [{ place_id: 'p1', kapak: { commons: 'File:D.jpg' } }] }],
    };
    expect(kapakIstekleri(plan)).toEqual([
      { hedef: 'gezi', anahtar: 'g', dosya: 'File:A.jpg' },
      { hedef: 'sehir', anahtar: 'bursa', dosya: 'File:B.jpg' },
      { hedef: 'yer', anahtar: 'p1', dosya: 'File:C.jpg' },
    ]);
  });
});

describe('lisansCoz', () => {
  it.each([
    [meta('CC BY-SA 4.0', 'cc-by-sa-4.0'), { kabul: true, lisans: 'CC BY-SA 4.0' }],
    [meta('CC BY 2.0', 'cc-by-2.0'), { kabul: true, lisans: 'CC BY 2.0' }],
    [meta('CC0', 'cc0'), { kabul: true, lisans: 'CC0' }],
    [meta('Public domain', 'pd'), { kabul: true, lisans: 'PD' }],
    [meta('CC BY-NC-SA 2.0', 'cc-by-nc-sa-2.0'), { kabul: false, lisans: 'CC BY-NC-SA 2.0' }],
    [meta('CC BY-ND 4.0', 'cc-by-nd-4.0'), { kabul: false, lisans: 'CC BY-ND 4.0' }],
    [meta('GFDL', 'gfdl'), { kabul: false, lisans: 'GFDL' }],
    [{}, { kabul: false, lisans: 'bilinmiyor' }],
  ])('%#', (m, beklenen) => {
    expect(lisansCoz(m)).toEqual(beklenen);
  });
});

describe('yazarTemizle', () => {
  it('HTML etiketleri ve varlıklar temizlenir', () => {
    expect(yazarTemizle('<a href="//commons.wikimedia.org/wiki/User:X">Ali &amp; Ayşe</a>\n<span>(foto)</span>')).toBe('Ali & Ayşe (foto)');
  });
  it('en çok 200 karakter', () => {
    expect([...yazarTemizle('ş'.repeat(300))]).toHaveLength(200);
  });
});

it('kapakYolu aynı dosyada aynı, türe göre uzantı', () => {
  expect(kapakYolu('File:A.jpg', 'image/jpeg')).toBe(kapakYolu('File:A.jpg', 'image/jpeg'));
  expect(kapakYolu('File:A.png', 'image/png')).toMatch(/^kapak\/commons\/[0-9a-f]{24}\.png$/);
});

describe('commonsBilgisi + kapakDenetimi', () => {
  const cevap = {
    query: {
      normalized: [{ from: 'File:Koza_Han.jpg', to: 'File:Koza Han.jpg' }],
      pages: [
        {
          title: 'File:Koza Han.jpg',
          imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/k1600.jpg', url: 'https://upload.wikimedia.org/k.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Koza_Han.jpg', extmetadata: meta('CC BY-SA 3.0', 'cc-by-sa-3.0', 'Yazar') }],
        },
        { title: 'File:Yok.jpg', missing: true },
        {
          title: 'File:NC.jpg',
          imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://u/t.jpg', descriptionurl: 'https://c/NC', extmetadata: meta('CC BY-NC 2.0', 'cc-by-nc-2.0') }],
        },
      ],
    },
  };
  const fetchFn = jest.fn(async () => ({ ok: true, json: async () => cevap }));

  it('lisansı uygun dosya hazır, diğerleri HATA; istek 1600 px ister', async () => {
    const istekler = [
      { hedef: 'gezi', anahtar: 'g', dosya: 'File:Koza_Han.jpg' },
      { hedef: 'yer', anahtar: 'p1', dosya: 'File:Yok.jpg' },
      { hedef: 'yer', anahtar: 'p2', dosya: 'File:NC.jpg' },
    ];
    const bilgi = await commonsBilgisi(istekler.map((i) => i.dosya), { fetchFn });
    const adres = new URL(fetchFn.mock.calls[0][0]);
    expect(adres.searchParams.get('iiurlwidth')).toBe('1600');
    expect(fetchFn.mock.calls[0][1].headers['user-agent']).toMatch(/Tripmate/);
    const { hatalar, hazir } = kapakDenetimi(istekler, bilgi);
    expect(hatalar).toEqual([
      "yer p1: File:Yok.jpg Commons'ta bulunamadı",
      'yer p2: File:NC.jpg lisansı uygun değil (CC BY-NC 2.0); yalnız CC0, PD, CC BY, CC BY-SA',
    ]);
    expect(hazir).toHaveLength(1);
    expect(hazir[0]).toMatchObject({ kucukUrl: 'https://upload.wikimedia.org/k1600.jpg', yazar: 'Yazar', lisans: 'CC BY-SA 3.0' });

    const veri = kapakVerisi({ gezi: { slug: 'g' }, sehir: { slug: 'bursa' } }, hazir, 'https://x.supabase.co/');
    expect(veri).toEqual({
      sehir_slug: 'bursa',
      gezi_slug: 'g',
      yerler: [],
      gezi: {
        kapak_url: `https://x.supabase.co/storage/v1/object/public/icerik/${hazir[0].yol}`,
        kapak_atif: { yazar: 'Yazar', lisans: 'CC BY-SA 3.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:Koza_Han.jpg' },
      },
    });
  });

  it('Commons hata verirse fırlatır', async () => {
    await expect(commonsBilgisi(['File:A.jpg'], { fetchFn: async () => ({ ok: false, status: 503 }) })).rejects.toThrow('Commons API 503');
  });
});
