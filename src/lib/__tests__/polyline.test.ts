import { describe, expect, it } from '@jest/globals';

import { cizgiOrtasi, polylineCoz } from '../polyline';
import { pinIkonu, yorumKisa } from '../pinIkonu';

describe('polylineCoz', () => {
  it('Google örneğini çözer', () => {
    // developers.google.com/maps/documentation/utilities/polylinealgorithm örneği
    expect(polylineCoz('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });
  it('boş dizgi → boş', () => {
    expect(polylineCoz('')).toEqual([]);
  });
  it('cizgiOrtasi uzunluğa göre ortayı bulur', () => {
    const o = cizgiOrtasi([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 4 },
    ]);
    expect(o?.lat).toBeCloseTo(0);
    expect(o?.lng).toBeCloseTo(2);
    expect(cizgiOrtasi([])).toBeNull();
  });
});

describe('pinIkonu / yorumKisa', () => {
  it('primaryType eşlemesi', () => {
    expect(pinIkonu('park')).toBe('agac');
    expect(pinIkonu('italian_restaurant')).toBe('catal');
    expect(pinIkonu('coffee_shop')).toBe('fincan');
    expect(pinIkonu('art_museum')).toBe('muze');
    expect(pinIkonu('tourist_attraction')).toBe('anit');
    expect(pinIkonu('historical_landmark')).toBe('anit');
    expect(pinIkonu('observation_deck')).toBe('goz');
    expect(pinIkonu('neighborhood')).toBe('kare');
    expect(pinIkonu(null)).toBe('pin');
    expect(pinIkonu('shoe_store')).toBe('pin');
  });
  it('yorum sayısı kısaltması', () => {
    expect(yorumKisa(812)).toBe('812');
    expect(yorumKisa(1234)).toBe('1,2K');
    expect(yorumKisa(312_456)).toBe('312K');
    expect(yorumKisa(2_100_000)).toBe('2,1M');
    expect(yorumKisa(null)).toBeNull();
    expect(yorumKisa(0)).toBeNull();
  });
});
