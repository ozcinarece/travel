import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { icerikFotoUrl, markdownAyristir, mekanlariAyikla, okumaSuresiDk, satirParcalari } from '../markdown';

describe('markdownAyristir (#97 B KK1)', () => {
  it('paragraf, başlık, alıntı, madde ve ikili foto satırı', () => {
    const md = `Giriş paragrafı\nikinci satırı.\n\n## 1. gün\n\n- a\n- b\n\n> Çibörek için erken gidin.\n\n![Porsuk](https://x/1.jpg)\n![Sazova](https://x/2.jpg)\n\nSon.`;
    expect(markdownAyristir(md)).toEqual([
      { tur: 'paragraf', metin: 'Giriş paragrafı ikinci satırı.' },
      { tur: 'baslik', seviye: 2, metin: '1. gün' },
      { tur: 'madde', ogeler: ['a', 'b'] },
      { tur: 'alinti', metin: 'Çibörek için erken gidin.' },
      { tur: 'fotolar', fotolar: [{ url: 'https://x/1.jpg', alt: 'Porsuk' }, { url: 'https://x/2.jpg', alt: 'Sazova' }], altyazi: 'Porsuk' },
      { tur: 'paragraf', metin: 'Son.' },
    ]);
  });
  it('üçüncü görsel yeni satıra; boş kaynak boş; okuma süresi en az 1 dk', () => {
    const md = '![a](https://x/u1)\n![b](https://x/u2)\n![c](https://x/u3)';
    const b = markdownAyristir(md);
    expect(b).toHaveLength(2);
    expect(b[1]).toEqual({ tur: 'fotolar', fotolar: [{ url: 'https://x/u3', alt: 'c' }], altyazi: 'c' });
    // #119 KK1b: çözülemeyen görsel (göreli yol, yer tutucu) hiç çizilmez; `foto:` kova yolu ise çözülür (#107 testi aşağıda).
    expect(markdownAyristir('![a](porsuk.jpg)\nMetin')).toEqual([{ tur: 'paragraf', metin: 'Metin' }]);
    expect(markdownAyristir(null)).toEqual([]);
    expect(okumaSuresiDk('bir iki üç')).toBe(1);
    expect(okumaSuresiDk(Array.from({ length: 800 }, () => 'kelime').join(' '))).toBe(4);
  });
});

// #107: backoffice sözdizimi — kovadaki foto, virgüllü ikili foto, mekan bağlantısı.
describe('markdownAyristir — foto: ve mekan: (#107 KK3)', () => {
  const eski = process.env.EXPO_PUBLIC_SUPABASE_URL;
  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proje.supabase.co/';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = eski;
  });

  it('foto:<yol> kovanın herkese açık adresine çözülür; virgüllü iki hedef tek satır', () => {
    expect(icerikFotoUrl('geziler/g1/a b.jpg')).toBe('https://proje.supabase.co/storage/v1/object/public/icerik/geziler/g1/a%20b.jpg');
    expect(markdownAyristir('![Porsuk ve Sazova](foto:geziler/g1/a.jpg, foto:geziler/g1/b.jpg)')).toEqual([
      {
        tur: 'fotolar',
        fotolar: [
          { url: 'https://proje.supabase.co/storage/v1/object/public/icerik/geziler/g1/a.jpg', alt: 'Porsuk ve Sazova' },
          { url: 'https://proje.supabase.co/storage/v1/object/public/icerik/geziler/g1/b.jpg', alt: 'Porsuk ve Sazova' },
        ],
        altyazi: 'Porsuk ve Sazova',
      },
    ]);
  });

  it('mekan bağlantısı ve kalın/italik: metin sade, biçim parçalarda; biçimsiz blok değişmez', () => {
    const md = "> Çibörek için [Hayri Usta](mekan:ChIJ123)'ya **erken** gidin.\n\n- [Sazova](mekan:ChIJ9) parkı\n- *yürüyüş*\n\nDüz paragraf.";
    expect(markdownAyristir(md)).toEqual([
      {
        tur: 'alinti',
        metin: "Çibörek için Hayri Usta'ya erken gidin.",
        mekanlar: [{ ad: 'Hayri Usta', place_id: 'ChIJ123' }],
        parcalar: [
          { metin: 'Çibörek için ' },
          { metin: 'Hayri Usta', place_id: 'ChIJ123' },
          { metin: "'ya " },
          { metin: 'erken', kalin: true },
          { metin: ' gidin.' },
        ],
      },
      { tur: 'madde', ogeler: ['Sazova parkı', 'yürüyüş'], mekanlar: [{ ad: 'Sazova', place_id: 'ChIJ9' }] },
      { tur: 'paragraf', metin: 'Düz paragraf.' },
    ]);
    expect(mekanlariAyikla('[a](https://x) ve [b](mekan:P)').metin).toBe('[a](https://x) ve b');
    expect(satirParcalari('2 * 3 = 6')).toEqual([{ metin: '2 * 3 = 6' }]);
  });
});
