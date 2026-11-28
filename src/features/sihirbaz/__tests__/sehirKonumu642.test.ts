import { describe, expect, it } from '@jest/globals';

import { sehirKonumu } from '../sihirbaz';

const simdi = new Date('2026-11-28T12:00:00.000Z');
const gunOnce = (n: number) => new Date(simdi.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('#642 KK3: seyahatin şehir koordinatı şehrin damgasıyla', () => {
  it('içerik şehrinin damgası taşınır (now() değil)', () => {
    expect(sehirKonumu({ lat: 39.7, lng: 30.5, google_fetched_at: gunOnce(10) }, simdi)).toEqual({ lat: 39.7, lng: 30.5, google_fetched_at: gunOnce(10) });
  });
  it("Google'dan yeni seçim (damga yok) ve osm/elle şehir (null): şimdi", () => {
    expect(sehirKonumu({ lat: 1, lng: 2 }, simdi).google_fetched_at).toBe(simdi.toISOString());
    expect(sehirKonumu({ lat: 1, lng: 2, google_fetched_at: null }, simdi)).toEqual({ lat: 1, lng: 2, google_fetched_at: simdi.toISOString() });
  });
  it('30 günü geçen damgada koordinat boş, damga kalır', () => {
    expect(sehirKonumu({ lat: 1, lng: 2, google_fetched_at: gunOnce(31) }, simdi)).toEqual({ lat: null, lng: null, google_fetched_at: gunOnce(31) });
  });
  it('gelecek tarihli damga şimdiye iner', () => {
    expect(sehirKonumu({ lat: 1, lng: 2, google_fetched_at: gunOnce(-5) }, simdi).google_fetched_at).toBe(simdi.toISOString());
  });
  it('konumu boşalmış şehir konumsuz kalır', () => {
    expect(sehirKonumu({ lat: null, lng: null, google_fetched_at: gunOnce(40) }, simdi)).toEqual({ lat: null, lng: null, google_fetched_at: gunOnce(40) });
  });
});
