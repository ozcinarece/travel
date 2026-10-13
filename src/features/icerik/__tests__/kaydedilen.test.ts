import { describe, expect, it } from '@jest/globals';

import { yerGruplari } from '../kaydedilen';

const yer = (id: string, sehir_id: string, ad: string | null) => ({ id, sehir_id, sehirler: ad ? { ad } : null });

describe('Kaydettiklerim · Yerler grupları (#144 KK3)', () => {
  it('şehre göre gruplar; kaydetme sırası (yeni önce); şehirsiz en sonda', () => {
    const yerler = [yer('a', 'esk', 'Eskişehir'), yer('b', 'bur', 'Bursa'), yer('c', 'esk', 'Eskişehir'), yer('d', 'x', null)];
    const sira = new Map([['d', 0], ['c', 1], ['b', 2], ['a', 3]]);
    expect(yerGruplari(yerler, sira, 'Diğer').map((g) => [g.sehirAd, g.yerler.map((y) => y.id)])).toEqual([
      ['Eskişehir', ['c', 'a']],
      ['Bursa', ['b']],
      ['Diğer', ['d']],
    ]);
  });
});
