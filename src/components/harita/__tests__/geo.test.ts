import { describe, expect, it } from '@jest/globals';

import { bolgedenUzaklasti, bolgeHesapla, mesafeM } from '../geo';

const roma = { lat: 41.9028, lng: 12.4964 };

describe('geo', () => {
  it('mesafeM: Roma–Vatikan ~3 km', () => {
    const vatikan = { lat: 41.9029, lng: 12.4534 };
    const m = mesafeM(roma, vatikan);
    expect(m).toBeGreaterThan(3300);
    expect(m).toBeLessThan(3700);
  });

  it('bolgeHesapla: kısa kenarın yarısı yarıçap olur', () => {
    // 0,02° enlem ≈ 2,2 km; 0,06° boylam Roma enleminde ≈ 5 km → yarıçap ≈ 1,1 km.
    const b = bolgeHesapla(roma, 0.02, 0.06);
    expect(b.yaricapM).toBeGreaterThan(1000);
    expect(b.yaricapM).toBeLessThan(1200);
  });

  it('bolgedenUzaklasti: küçük kaymada hayır, yarıçapın %30 üstünde ya da ölçek değişince evet', () => {
    const arama = { merkez: roma, yaricapM: 2000 };
    expect(bolgedenUzaklasti({ merkez: { lat: roma.lat + 0.003, lng: roma.lng }, yaricapM: 2000 }, arama)).toBe(false);
    expect(bolgedenUzaklasti({ merkez: { lat: roma.lat + 0.01, lng: roma.lng }, yaricapM: 2000 }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ merkez: roma, yaricapM: 4000 }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ merkez: roma, yaricapM: 1200 }, arama)).toBe(true);
  });
});
