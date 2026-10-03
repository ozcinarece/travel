import { describe, expect, it } from '@jest/globals';

import { bolgedenUzaklasti, bolgeHesapla, gizliEtiketler, kisaAd, mesafeM, pinCapasi } from '../geo';
import type { HaritaPini } from '../tipler';

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
    const arama = { merkez: roma, yaricapM: 2000, latDelta: 0.04, lngDelta: 0.05 };
    expect(bolgedenUzaklasti({ ...arama, merkez: { lat: roma.lat + 0.003, lng: roma.lng } }, arama)).toBe(false);
    expect(bolgedenUzaklasti({ ...arama, merkez: { lat: roma.lat + 0.01, lng: roma.lng } }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ ...arama, yaricapM: 4000 }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ ...arama, yaricapM: 1200 }, arama)).toBe(true);
  });

  it('kisaAd 18 karakterde kısaltır', () => {
    expect(kisaAd('Pantheon')).toBe('Pantheon');
    expect(kisaAd('Galleria Nazionale d’Arte Moderna')).toHaveLength(18);
    expect(kisaAd('Galleria Nazionale d’Arte Moderna').endsWith('…')).toBe(true);
  });

  it('gizliEtiketler: çakışanda düşük öncelikli gizlenir, uzakta ikisi de görünür, yakınlaşınca geri gelir', () => {
    // Ekran 400×800 px, görünür alan 0,02° × 0,01° → 1 px ≈ 0,000025°.
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const pin = (id: string, dLng: number, tur: HaritaPini['tur'], secili = false): HaritaPini => ({
      id,
      konum: { lat: roma.lat, lng: roma.lng + dLng },
      renk: '#000',
      tur,
      ad: `Mekan ${id}`,
      secili,
    });
    // 20 px arayla: etiketler (~70 px) çakışır → öneri gizlenir, durak kalır.
    const yakin = [pin('a', 0, 'oneri'), pin('b', 0.0005, 'durak')];
    expect([...gizliEtiketler(yakin, bolge, ekran)]).toEqual(['a']);
    // Seçili öneri durağı yener.
    expect([...gizliEtiketler([pin('a', 0, 'oneri', true), pin('b', 0.0005, 'durak')], bolge, ekran)]).toEqual(['b']);
    // 200 px arayla çakışma yok.
    expect(gizliEtiketler([pin('a', 0, 'oneri'), pin('b', 0.005, 'durak')], bolge, ekran).size).toBe(0);
    // Yakınlaşınca (aralık 10 kat küçük) aynı pinler artık çakışmaz.
    expect(gizliEtiketler(yakin, { ...bolge, latDelta: 0.002, lngDelta: 0.001 }, ekran).size).toBe(0);
  });

  it('pinCapasi daire merkezini çapa yapar', () => {
    const c = pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' });
    expect(c.x).toBe(0.5);
    expect(c.y).toBeCloseTo(11 / 40);
  });
});
