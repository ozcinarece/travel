import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// #70 incelemesi 🔴1: Nearby Search `includedTypes` yalnız Table A tiplerini kabul eder; Table B tipi (ör. place_of_worship)
// isteğin tamamını INVALID_ARGUMENT ile düşürür. Edge Function'daki kümeler bu sabit listeye karşı denetlenir.
const TABLE_A = new Set([
  'tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument', 'historical_place',
  'museum', 'art_gallery',
  'church', 'mosque', 'synagogue', 'hindu_temple',
  'park', 'garden', 'botanical_garden', 'zoo', 'national_park', 'observation_deck',
  'restaurant', 'cafe', 'coffee_shop', 'bakery',
  'shopping_mall', 'market',
  'lodging',
]);
const TABLE_B = new Set(['place_of_worship', 'point_of_interest', 'establishment', 'food', 'health', 'natural_feature', 'locality', 'political', 'premise', 'route']);

describe('places-nearby tip kümeleri', () => {
  const kaynak = readFileSync(join(__dirname, '../../../../supabase/functions/_shared/google.ts'), 'utf8');
  const tipler = [...kaynak.matchAll(/^\s+\w+: \[([^\]]+)\],/gm)].flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
  it('en az 20 tip bulundu, hepsi Table A, hiçbiri Table B değil', () => {
    expect(tipler.length).toBeGreaterThanOrEqual(20);
    const yabanci = tipler.filter((t) => !TABLE_A.has(t));
    expect(yabanci).toEqual([]);
    expect(tipler.filter((t) => TABLE_B.has(t))).toEqual([]);
  });
  it('eski çip anahtarları (populer, sanat, yemek, manzara) hâlâ tanımlı', () => {
    for (const k of ['populer', 'sanat', 'yemek', 'manzara', 'hepsi', 'otel']) expect(kaynak).toMatch(new RegExp(`^\\s+${k}: \\[`, 'm'));
  });
  it('#164: turistik kümesi tanımlı; konaklama dışlama listesi yalnız Table A konaklama tipleri', () => {
    expect(kaynak).toMatch(/^\s+turistik: \[/m);
    const KONAKLAMA_TABLE_A = new Set(['lodging', 'hotel', 'motel', 'hostel', 'bed_and_breakfast', 'guest_house', 'resort_hotel', 'extended_stay_hotel', 'private_guest_room', 'cottage', 'farmstay', 'campground', 'camping_cabin', 'rv_park']);
    const blok = kaynak.match(/export const KONAKLAMA_TIPLERI = \[([^\]]+)\]/);
    const liste = [...(blok?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(liste.length).toBeGreaterThanOrEqual(5);
    expect(liste.filter((t) => !KONAKLAMA_TABLE_A.has(t))).toEqual([]);
  });
});
