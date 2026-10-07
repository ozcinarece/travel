import { describe, expect, it } from '@jest/globals';

import { birakmaCizgisiY, hedefSira, YUVA } from '../SiralaListesi';

describe('sürükle-sırala (#53 §5)', () => {
  it('hedef sıra yuva kadar kaymayla değişir, uçlarda sınırlı', () => {
    expect(hedefSira(2, 0, 5)).toBe(2);
    expect(hedefSira(2, YUVA * 0.4, 5)).toBe(2);
    expect(hedefSira(2, YUVA * 0.6, 5)).toBe(3);
    expect(hedefSira(2, -YUVA * 2, 5)).toBe(0);
    expect(hedefSira(2, -YUVA * 9, 5)).toBe(0);
    expect(hedefSira(2, YUVA * 9, 5)).toBe(4);
  });

  it('bırakma çizgisi yukarı taşırken hedefin üstünde, aşağı taşırken altında', () => {
    expect(birakmaCizgisiY(3, 1)).toBeLessThan(birakmaCizgisiY(3, 2));
    // Aşağı 1 → 2 çizgisi 2'nin altında = 4 → 3 (yukarı) çizgisiyle aynı yer.
    expect(birakmaCizgisiY(1, 2)).toBe(birakmaCizgisiY(4, 3));
  });
});
