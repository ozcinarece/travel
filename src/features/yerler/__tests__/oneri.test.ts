import { describe, expect, it, jest } from '@jest/globals';

import { oneriIstegi, oneriSirala } from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// #61 §1: aynı bölge + aynı çip → aynı istek ve aynı sıra.
describe('öneri deterministikliği', () => {
  it('küçük kaydırma isteği değiştirmez; büyük kaydırma değiştirir', () => {
    const a = oneriIstegi({ lat: 39.76512, lng: 30.52137, yaricapM: 1480 });
    const b = oneriIstegi({ lat: 39.76568, lng: 30.5219, yaricapM: 1560 });
    expect(b).toEqual(a);
    expect(a.yaricapM).toBe(1500);
    expect(oneriIstegi({ lat: 39.77, lng: 30.53, yaricapM: 1480 })).not.toEqual(a);
    expect(oneriIstegi({ lat: 0, lng: 0, yaricapM: 60 }).yaricapM).toBe(250);
  });
  it('puan × log(yorum) azalan; eşitlikte place_id', () => {
    const y = (place_id: string, puan: number | null, puan_sayisi: number | null) => ({ place_id, puan, puan_sayisi });
    const s = oneriSirala([y('c', 4.5, 10), y('a', 4.8, 1000), y('b', 4.8, 1000), y('d', null, 50)]).map((x) => x.place_id);
    expect(s).toEqual(['a', 'b', 'c', 'd']);
  });
});
