import { describe, expect, it } from '@jest/globals';

import { arasindaAnahtar, sonAnahtar } from '../sira';

describe('sira anahtarı', () => {
  it('boş listede ortadan başlar, sona eklenir', () => {
    const ilk = arasindaAnahtar();
    expect(ilk).toBe('i');
    const ikinci = sonAnahtar([ilk]);
    expect(ikinci > ilk).toBe(true);
  });

  it('iki anahtar arasına sığar', () => {
    const k = arasindaAnahtar('a', 'b');
    expect(k > 'a' && k < 'b').toBe(true);
    const k2 = arasindaAnahtar('a', k);
    expect(k2 > 'a' && k2 < k).toBe(true);
  });

  it('bitişik basamaklarda uzar ama sıra bozulmaz', () => {
    let alt = '0';
    let ust = '1';
    for (let i = 0; i < 30; i++) {
      const k = arasindaAnahtar(alt, ust);
      expect(k > alt && k < ust).toBe(true);
      ust = k;
    }
  });

  it('çok eklemede sıra artar', () => {
    const liste: string[] = [];
    for (let i = 0; i < 50; i++) liste.push(sonAnahtar(liste));
    const sirali = [...liste].sort();
    expect(sirali).toEqual(liste);
  });

  it('ters girdi hata', () => {
    expect(() => arasindaAnahtar('b', 'a')).toThrow();
  });
});
