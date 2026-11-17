// #248 KK1/KK4: place_id'li otelde Google'dan gelen ad stays.label'a yazılmaz; ad yalnız bellekte canlı eklenir.
import { describe, expect, it } from '@jest/globals';

import { adiEksikKimlikler, adlarlaKonaklamalar, yeniKonaklamaSatiri, type Konaklama } from '../plan';

const an = new Date('2026-11-16T12:00:00Z');

describe('Google adı saklanmaz (#248)', () => {
  it('place_id varken label null, google_fetched_at dolu', () => {
    expect(yeniKonaklamaSatiri('t', { place_id: 'ChIJ-otel-0001', ad: 'Grand Otel', lat: 1, lng: 2 }, an)).toEqual({
      trip_id: 't',
      place_id: 'ChIJ-otel-0001',
      lat: 1,
      lng: 2,
      label: null,
      google_fetched_at: an.toISOString(),
    });
  });

  it('place_id yokken (haritadan seçilen nokta) kullanıcının adı tutulur, 80 karakterle', () => {
    const satir = yeniKonaklamaSatiri('t', { place_id: null, ad: `  ${'E'.repeat(90)} `, lat: 1, lng: 2 }, an);
    expect(satir.label).toBe('E'.repeat(80));
    expect(satir.google_fetched_at).toBeNull();
    expect(yeniKonaklamaSatiri('t', { place_id: null, ad: '  ', lat: 1, lng: 2 }, an).label).toBeNull();
  });

  it('canlı ad yalnız label boş ve place_id dolu satırlara eklenir', () => {
    const liste: Konaklama[] = [
      { id: 'a', trip_id: 't', place_id: 'ChIJ-otel-0001', lat: 1, lng: 2, label: null },
      { id: 'b', trip_id: 't', place_id: 'ChIJ-otel-0002', lat: 1, lng: 2, label: 'Eski ad' },
      { id: 'c', trip_id: 't', place_id: null, lat: 1, lng: 2, label: null },
    ];
    expect(adiEksikKimlikler(liste)).toEqual(['ChIJ-otel-0001']);
    const adli = adlarlaKonaklamalar(liste, (id) => (id === 'ChIJ-otel-0001' ? 'Canlı ad' : undefined));
    expect(adli.map((k) => k.label)).toEqual(['Canlı ad', 'Eski ad', null]);
    expect(adlarlaKonaklamalar(liste, () => undefined)[0].label).toBeNull();
    expect(liste[0].label).toBeNull();
  });
});
