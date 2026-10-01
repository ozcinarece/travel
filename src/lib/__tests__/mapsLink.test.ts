import { describe, expect, it } from '@jest/globals';

import { googleMapsLinkiMi, haritaLinkiAyristir, kisaLinkMi } from '../../../supabase/functions/_shared/mapsLink';

describe('Google Maps linki ayrıştırma', () => {
  it('tam place linkinden ad, mekan koordinatı ve place id çıkar', () => {
    const url =
      'https://www.google.com/maps/place/Hotel+Artemide/@41.9008,12.4927,17z/data=!3m1!4b1!4m9!3m8!1s0x132f61a1b8:0x5d!8m2!3d41.90123!4d12.49456!16s%2Fg%2F1td!19sChIJabc_DEF-123';
    expect(haritaLinkiAyristir(url)).toEqual({ ad: 'Hotel Artemide', lat: 41.90123, lng: 12.49456, placeId: 'ChIJabc_DEF-123' });
  });

  it('query_place_id ve place_id: biçimleri', () => {
    expect(haritaLinkiAyristir('https://www.google.com/maps/search/?api=1&query=41.9,12.49&query_place_id=ChIJxyz')).toMatchObject({
      placeId: 'ChIJxyz',
      lat: 41.9,
      lng: 12.49,
    });
    expect(haritaLinkiAyristir('https://www.google.com/maps/place/?q=place_id:ChIJqwe')).toEqual({ placeId: 'ChIJqwe' });
  });

  it('yalnız koordinat ve geo: linkleri', () => {
    expect(haritaLinkiAyristir('https://maps.google.com/?q=41.9,12.49')).toEqual({ lat: 41.9, lng: 12.49 });
    expect(haritaLinkiAyristir('geo:41.9,12.49?q=41.9,12.49(Hotel+X)')).toEqual({ lat: 41.9, lng: 12.49, ad: 'Hotel X' });
  });

  it('desteklenmeyen linkleri reddeder', () => {
    expect(googleMapsLinkiMi('https://www.booking.com/hotel/it/artemide.html')).toBe(false);
    expect(googleMapsLinkiMi('https://www.google.com/search?q=otel')).toBe(false);
    expect(googleMapsLinkiMi('https://www.google.com.tr/maps/place/x')).toBe(true);
    expect(kisaLinkMi('https://maps.app.goo.gl/AbC123')).toBe(true);
    expect(haritaLinkiAyristir('https://www.google.com/maps')).toBeNull();
  });
});
