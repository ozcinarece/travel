import { describe, expect, it, jest } from '@jest/globals';

import { yakinDurakId } from '../useKonum';

jest.mock('expo-location', () => ({}));

describe('yakinDurakId (#140 inceleme)', () => {
  const konum = { lat: 39.7637, lng: 30.5243 };
  it('100 m içindeki duraklardan ilki değil en yakını', () => {
    // a ≈ 90 m, b ≈ 20 m.
    const duraklar = [
      { id: 'a', konum: { lat: 39.7645, lng: 30.5243 } },
      { id: 'b', konum: { lat: 39.76388, lng: 30.5243 } },
    ];
    expect(yakinDurakId(konum, duraklar)).toBe('b');
  });
  it('100 m dışındaysa ya da konum yoksa null', () => {
    expect(yakinDurakId(konum, [{ id: 'uzak', konum: { lat: 39.766, lng: 30.5243 } }])).toBeNull();
    expect(yakinDurakId(null, [{ id: 'a', konum }])).toBeNull();
  });
});
