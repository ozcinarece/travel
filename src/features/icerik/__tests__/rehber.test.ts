import { describe, expect, it } from '@jest/globals';

import { bolumYazisi, doluBolumler, rehberMekanIdleri } from '../rehber';

describe('şehir rehberi sekmesi (#142 KK4–5)', () => {
  it('yazılardaki mekanlar: kart ve satır içi bağlantı, tekil, sırayla', () => {
    const a = 'Çiböreği [Hayri Usta](mekan:ChIJ-hayri-usta-0001) yapar.\n\n::mekan[ChIJ-hayri-usta-0001]\n\n::mekan[ChIJ-met-helva-00002]';
    const b = '# Mahalleler\n\nOdunpazarı ve [Kurşunlu](mekan:ChIJ-kursunlu-00003).';
    expect(rehberMekanIdleri([a, null, b])).toEqual(['ChIJ-hayri-usta-0001', 'ChIJ-met-helva-00002', 'ChIJ-kursunlu-00003']);
  });
  it('bölüm yazısının ilk başlığı düşer', () => {
    expect(bolumYazisi('# Ne yenir\n\nÇibörek.')).toBe('Çibörek.');
    expect(bolumYazisi(null)).toBe('');
  });
  it('#397 KK4: yalnız içi dolu bölüm sekme olur', () => {
    const b = [
      { id: 'a', yazi_md: '# Nasıl gezilir\n\nTramvayla.' },
      { id: 'b', yazi_md: '# Ne yenir' },
      { id: 'c', yazi_md: '# Mahalleler\n\n   ' },
      { id: 'd', yazi_md: null },
      { id: 'e', yazi_md: 'İpucu.' },
    ];
    expect(doluBolumler(b).map((x) => x.id)).toEqual(['a', 'e']);
  });
});
