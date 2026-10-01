import { describe, expect, it } from '@jest/globals';

import { toplamYol, varsayilanSira } from '../siralama';

// Düz çizgi üzerinde noktalar: otel 0'da, duraklar 10, 30, 20 (karışık eklenmiş).
const konum = (i: number) => (i < 0 ? 0 : [10, 30, 20][i]);
const mesafe = (a: number, b: number) => Math.abs(konum(a) - konum(b));

describe('varsayilanSira', () => {
  it('otelden en yakın komşuyla doğru sıraya dizer', () => {
    expect(varsayilanSira(3, mesafe, true)).toEqual([0, 2, 1]);
  });

  it('otel yoksa ilk durak başlangıçtır', () => {
    const sira = varsayilanSira(3, mesafe, false);
    expect(sira[0]).toBe(0);
    expect(sira).toEqual([0, 2, 1]);
  });

  it('2-opt çaprazı açar', () => {
    // Kare köşeleri: NN sırası çapraz yapabilir; 2-opt kısa turu bulur.
    const noktalar = [
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ];
    const m = (a: number, b: number) => {
      const p = a < 0 ? [-1, 5] : noktalar[a];
      const q = b < 0 ? [-1, 5] : noktalar[b];
      return Math.hypot(p[0] - q[0], p[1] - q[1]);
    };
    const sira = varsayilanSira(4, m, true);
    const yol = toplamYol(sira, m, true);
    // En kısa tur: otel→(0,0)→(10,0)→(10,10)→(0,10)→otel ≈ 5,1+10+10+10+5,1
    expect(yol).toBeLessThan(40.3);
  });

  it('tek ve sıfır durak', () => {
    expect(varsayilanSira(0, mesafe, true)).toEqual([]);
    expect(varsayilanSira(1, mesafe, true)).toEqual([0]);
  });
});
