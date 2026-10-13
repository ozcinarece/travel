import { describe, expect, it } from '@jest/globals';

import { gecerliPlaceId, oneCikanSirasi } from '../yer';

describe('Genel alanları (#108 KK2, KK7)', () => {
  it('place_id doğrulama (DB kısıtıyla aynı)', () => {
    expect(gecerliPlaceId('ChIJ8Wg4E0Ri0BQR')).toBe(true);
    expect(gecerliPlaceId('kisa')).toBe(false);
    expect(gecerliPlaceId('ChIJ abc def ghi')).toBe(false);
    expect(gecerliPlaceId(null)).toBe(false);
  });

  it('öne çıkan sırası: boş = yok, 1+ tam sayı', () => {
    expect(oneCikanSirasi('')).toBeNull();
    expect(oneCikanSirasi(' 3 ')).toBe(3);
    expect(oneCikanSirasi('0')).toBe('gecersiz');
    expect(oneCikanSirasi('1,5')).toBe('gecersiz');
  });
});
