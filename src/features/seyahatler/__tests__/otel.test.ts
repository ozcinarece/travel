// #268: trips.hotel_label'a Google'dan gelen otel adı yazılmaz.
import { describe, expect, it } from '@jest/globals';

import { otelAlanlari } from '../otel';

const simdi = new Date('2026-11-16T18:00:00Z');

describe('trips otel alanları (#268)', () => {
  it('KK1/KK3: place_id varken hotel_label null', () => {
    const a = otelAlanlari({ place_id: 'ChIJ-otel-1', ad: 'Google adı', lat: 41, lng: 29 }, simdi);
    expect(a.hotel_label).toBeNull();
    expect(a).toMatchObject({ hotel_place_id: 'ChIJ-otel-1', hotel_lat: 41, hotel_lng: 29, hotel_fetched_at: simdi.toISOString() });
  });
  it("place_id'siz harita seçiminde kullanıcının adı kalır (80 karakter)", () => {
    expect(otelAlanlari({ place_id: null, ad: 'Teyzemin evi', lat: 41, lng: 29 }, simdi).hotel_label).toBe('Teyzemin evi');
    expect(otelAlanlari({ place_id: null, ad: 'x'.repeat(90), lat: 41, lng: 29 }, simdi).hotel_label).toHaveLength(80);
    expect(otelAlanlari({ place_id: null, ad: '', lat: 41, lng: 29 }, simdi).hotel_label).toBeNull();
  });
  it('otel yok → bütün alanlar null', () => {
    expect(Object.values(otelAlanlari(null, simdi)).every((v) => v === null)).toBe(true);
  });
});
