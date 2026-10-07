import { describe, expect, it } from '@jest/globals';

import { birakmaCizgisiY, hedefSira, type Yuva } from '../SiralaListesi';

// #55 §C8: satırlar içeriğe göre (ad 2 satır) farklı yükseklikte — ölçülen yuvalar.
const yuvalar: Yuva[] = [
  { y: 32, h: 60 },
  { y: 92, h: 78 },
  { y: 170, h: 60 },
  { y: 230, h: 60 },
  { y: 290, h: 78 },
];

describe('sürükle-sırala (#53 §5, #55 §C8)', () => {
  it('hedef: tutulan yuvanın merkezi + kayma, merkezi en yakın yuva; uçlarda sınırlı', () => {
    expect(hedefSira(2, 0, yuvalar)).toBe(2);
    expect(hedefSira(2, 25, yuvalar)).toBe(2);
    expect(hedefSira(2, 45, yuvalar)).toBe(3);
    expect(hedefSira(2, -80, yuvalar)).toBe(1);
    expect(hedefSira(2, -500, yuvalar)).toBe(0);
    expect(hedefSira(2, 500, yuvalar)).toBe(4);
    expect(hedefSira(9, 0, yuvalar)).toBe(9);
  });

  it('bırakma çizgisi yukarı taşırken hedefin üstünde, aşağı taşırken altında', () => {
    expect(birakmaCizgisiY(3, 1, yuvalar)).toBeLessThan(birakmaCizgisiY(3, 2, yuvalar));
    // Aşağı 1 → 2 çizgisi 2'nin altında = 3'ün üstüyle aynı yer (4 → 3 yukarı).
    expect(birakmaCizgisiY(1, 2, yuvalar)).toBe(birakmaCizgisiY(4, 3, yuvalar));
    // Son yuvanın altı.
    expect(birakmaCizgisiY(0, 4, yuvalar)).toBeGreaterThan(birakmaCizgisiY(0, 3, yuvalar));
  });
});
