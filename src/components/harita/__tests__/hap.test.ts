import { describe, expect, it } from '@jest/globals';

import { bolgeHesapla } from '../geo';
import { HAP_KENAR_PX, HAP_UC_PAYI_PX, hapCapasi, hapYerlesimi, noktaEkranX } from '../hap';

describe('gün hapı yerleşimi (#91 KK4)', () => {
  it('ortadaki nokta: hap ortalanır, üçgen ortada', () => {
    expect(hapYerlesimi(195, 390, 200)).toEqual({ sol: 95, uc: 100 });
    expect(hapCapasi(100, 200)).toEqual({ x: 0.5, y: 1 });
  });
  it('sol kenara yakın nokta: hap içeri kayar, üçgen noktada kalır (en az 16 px içeride)', () => {
    const y = hapYerlesimi(20, 390, 200);
    expect(y.sol).toBe(HAP_KENAR_PX);
    expect(y.uc).toBe(HAP_UC_PAYI_PX);
    expect(hapYerlesimi(40, 390, 200)).toEqual({ sol: 8, uc: 32 });
  });
  it('sağ kenara yakın nokta: hapın sağı ekranın 8 px içinde biter', () => {
    const y = hapYerlesimi(380, 390, 200);
    expect(y.sol + 200).toBe(390 - HAP_KENAR_PX);
    expect(y.uc).toBe(200 - HAP_UC_PAYI_PX);
  });
  it('hap ekrandan genişse sola yaslanır', () => {
    expect(hapYerlesimi(100, 300, 400).sol).toBe(HAP_KENAR_PX);
  });
  it('ekran x: merkezdeki nokta ekranın ortası, doğudaki sağda; bölge yoksa orta', () => {
    const bolge = bolgeHesapla({ lat: 39.78, lng: 30.5 }, 0.01, 0.01);
    expect(noktaEkranX({ lat: 39.78, lng: 30.5 }, bolge, 390)).toBe(195);
    expect(noktaEkranX({ lat: 39.78, lng: 30.5025 }, bolge, 390)).toBeCloseTo(292.5);
    expect(noktaEkranX({ lat: 39.78, lng: 30.5 }, null, 390)).toBe(195);
  });
});
