// #248 KK1/KK4, #584 KK1/KK2: place_id'li otelde Google'dan gelen ad stays.label'a yazılmaz ve okunmaz; ad yalnız
// bellekte canlı eklenir. Kullanıcının takma adı (stays.takma_ad) saklanır ve önce gelir.
import { describe, expect, it } from '@jest/globals';

import { adiEksikKimlikler, adlarlaKonaklamalar, satirdanKonaklama, takmaAdDegeri, yeniKonaklamaSatiri, type Konaklama } from '../plan';

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

  it('canlı ad yalnız place_id dolu, takma adsız satırlara eklenir', () => {
    const liste: Konaklama[] = [
      { id: 'a', trip_id: 't', place_id: 'ChIJ-otel-0001', lat: 1, lng: 2, label: null },
      { id: 'c', trip_id: 't', place_id: null, lat: 1, lng: 2, label: null },
    ];
    expect(adiEksikKimlikler(liste)).toEqual(['ChIJ-otel-0001']);
    const adli = adlarlaKonaklamalar(liste, (id) => (id === 'ChIJ-otel-0001' ? 'Canlı ad' : undefined));
    expect(adli.map((k) => k.label)).toEqual(['Canlı ad', null]);
    expect(adlarlaKonaklamalar(liste, () => undefined)[0].label).toBeNull();
    expect(liste[0].label).toBeNull();
  });
});

describe('#584 KK1: eski satırdaki Google adı okunmaz', () => {
  const eski: Konaklama = { id: 'b', trip_id: 't', place_id: 'ChIJ-otel-0002', lat: 1, lng: 2, label: 'Eski ad', takma_ad: null };

  it('DB satırında place_id varsa label atılır; place_id yoksa kalır', () => {
    expect(satirdanKonaklama(eski).label).toBeNull();
    expect(satirdanKonaklama({ ...eski, place_id: null }).label).toBe('Eski ad');
  });

  it('canlı ad gelmese de eski label gösterilmez; canlı ad gelince o görünür', () => {
    expect(adlarlaKonaklamalar([eski], () => undefined)[0].label).toBeNull();
    expect(adlarlaKonaklamalar([eski], () => 'Canlı ad')[0].label).toBe('Canlı ad');
    expect(adiEksikKimlikler([eski])).toEqual(['ChIJ-otel-0002']);
  });
});

describe('#584 KK2: takma ad', () => {
  const liste: Konaklama[] = [
    { id: 'a', trip_id: 't', place_id: 'ChIJ-otel-0001', lat: 1, lng: 2, label: null, takma_ad: 'Bizim otel' },
    { id: 'c', trip_id: 't', place_id: null, lat: 1, lng: 2, label: 'Pin', takma_ad: 'Teyzemler' },
  ];

  it('takma ad görünen addır; takma adlı otel için canlı ad istenmez', () => {
    expect(adlarlaKonaklamalar(liste, () => 'Canlı ad').map((k) => k.label)).toEqual(['Bizim otel', 'Teyzemler']);
    expect(adiEksikKimlikler(liste)).toEqual([]);
  });

  it('boş takma ad yok sayılır', () => {
    expect(satirdanKonaklama({ ...liste[0], takma_ad: '  ' }).takma_ad).toBeNull();
    expect(adiEksikKimlikler([satirdanKonaklama({ ...liste[0], takma_ad: '  ' })])).toEqual(['ChIJ-otel-0001']);
  });

  it('yazılacak değer kırpılır, 80 karakter, boşsa null', () => {
    expect(takmaAdDegeri('  Bizim otel ')).toBe('Bizim otel');
    expect(takmaAdDegeri('x'.repeat(90))).toHaveLength(80);
    expect(takmaAdDegeri('   ')).toBeNull();
  });
});
