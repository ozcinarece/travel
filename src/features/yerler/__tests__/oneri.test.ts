import { describe, expect, it, jest } from '@jest/globals';

import { oneriSirala } from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// #61 §1: aynı sonuç kümesi → aynı sıra (Google'ın POPULARITY sırası çağrıdan çağrıya oynuyordu). #66: istek
// nicemlemesi (oneriIstegi) karo ızgarasına taşındı (karolar.test.ts).
describe('öneri sıralaması', () => {
  it('puan × log(yorum) azalan; eşitlikte place_id', () => {
    const y = (place_id: string, puan: number | null, puan_sayisi: number | null) => ({ place_id, puan, puan_sayisi });
    const s = oneriSirala([y('c', 4.5, 10), y('a', 4.8, 1000), y('b', 4.8, 1000), y('d', null, 50)]).map((x) => x.place_id);
    expect(s).toEqual(['a', 'b', 'c', 'd']);
  });
});
