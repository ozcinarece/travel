import { describe, expect, it } from '@jest/globals';

import { binlik, blokTuru, gecerliPlaceId, gorselEkle, oneCikanSirasi, rehberBloklari, rehberMd, rehberSayaclari } from '../yer';

const sirali = () => {
  let i = 0;
  return () => `k${i++}`;
};

const MD = [
  '## Ne zaman gidilir',
  'Hafta içi sabah sakin; **hafta sonu** kalabalık.',
  '![Masal şatosu ve gölün sabah hali](foto:yerler/y1/a.jpg, foto:yerler/y1/b.jpg)',
  '## Ne yapılır',
  '> Gün batımında [Kent Park Seyir](mekan:ChIJkent12345) ile birleştirin.',
  '- yürüyüş\n- kafe',
].join('\n\n');

describe('Rehber blok modeli (#108 KK3)', () => {
  it('markdown → bloklar → markdown kayıpsız', () => {
    const b = rehberBloklari(MD, sirali());
    expect(b.map((x) => x.tur)).toEqual(['baslik', 'paragraf', 'gorsel', 'baslik', 'alinti', 'liste']);
    expect(b[2]).toEqual({ id: 'k2', tur: 'gorsel', metin: 'Masal şatosu ve gölün sabah hali', hedefler: ['foto:yerler/y1/a.jpg', 'foto:yerler/y1/b.jpg'] });
    expect(b[4].metin).toBe('Gün batımında [Kent Park Seyir](mekan:ChIJkent12345) ile birleştirin.');
    expect(rehberMd(b)).toBe(MD);
  });

  it('art arda iki görsel satırı tek blok; boş bloklar yazılmaz; düz metin tek paragraf', () => {
    const b = rehberBloklari('![a](foto:x)\n![b](foto:y)\n\nDüz metin\nikinci satır', sirali());
    expect(b[0].hedefler).toEqual(['foto:x', 'foto:y']);
    expect(b[1]).toMatchObject({ tur: 'paragraf', metin: 'Düz metin\nikinci satır' });
    expect(rehberMd([...b, { id: 'z', tur: 'baslik', metin: '  ' }])).toBe('![a](foto:x, foto:y)\n\nDüz metin\nikinci satır');
    expect(rehberBloklari(null)).toEqual([]);
  });

  it('araç çubuğu: tür değiştirme ve görsel ekleme', () => {
    const p = { id: 'p', tur: 'paragraf' as const, metin: 'x' };
    expect(blokTuru(p, 'baslik').tur).toBe('baslik');
    expect(blokTuru(blokTuru(p, 'alinti'), 'alinti').tur).toBe('paragraf');
    const bir = gorselEkle([p], 'p', 'foto:a', sirali());
    expect(bir.map((b) => b.tur)).toEqual(['paragraf', 'gorsel']);
    const iki = gorselEkle(bir, 'k0', 'foto:b', sirali());
    expect(iki[1].hedefler).toEqual(['foto:a', 'foto:b']);
    const uc = gorselEkle(iki, 'k0', 'foto:c', sirali());
    expect(uc.map((b) => b.hedefler?.length ?? 0)).toEqual([0, 2, 1]);
    expect(gorselEkle([], null, 'foto:a', sirali())).toHaveLength(1);
  });

  it('alt şerit sayaçları', () => {
    expect(rehberSayaclari(MD)).toEqual({ karakter: MD.length, okumaDk: 1, gorsel: 2, mekan: 1 });
    expect(rehberSayaclari(null)).toEqual({ karakter: 0, okumaDk: 1, gorsel: 0, mekan: 0 });
    expect(binlik(1240)).toBe('1.240');
    expect(binlik(12)).toBe('12');
  });
});

describe('Genel alanları (#108 KK2, KK7)', () => {
  it('place_id doğrulama (DB kısıtıyla aynı)', () => {
    expect(gecerliPlaceId('ChIJ8Wg4E0Ri0BQR')).toBe(true);
    expect(gecerliPlaceId('kisa')).toBe(false);
    expect(gecerliPlaceId('ChIJ abc def ghi')).toBe(false);
    expect(gecerliPlaceId(null)).toBe(false);
  });

  it('öne çıkan sırası: boş = yok, 1+ tam sayı', () => {
    expect(oneCikanSirasi('')).toBeNull();
    expect(oneCikanSirasi(' 3 ')).toBe(3);
    expect(oneCikanSirasi('0')).toBe('gecersiz');
    expect(oneCikanSirasi('1,5')).toBe('gecersiz');
  });
});
