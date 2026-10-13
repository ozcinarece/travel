import { describe, expect, it } from '@jest/globals';

import type { Degisiklik } from '@/lib/tipler';

import { degisiklikGruplari, geriAlinabilir, grupMetni } from '../degisiklikMetni';

const d = (id: number, ek: Partial<Degisiklik>): Degisiklik => ({ id, user_id: 'u1', entity: 'stops', entity_id: 's1', field: null, old: null, new: null, at: '2026-10-13T10:00:00Z', ...ek });

describe('Son değişiklikler (#141 KK6)', () => {
  const liste = [
    d(9, { field: 'day_id', old: 'g1', new: 'g2' }),
    d(8, { field: 'order_key', old: 'a0', new: 'b0' }),
    d(7, { entity: 'places', entity_id: 'p2', new: { place_id: 'x' }, at: '2026-10-13T09:00:00Z', user_id: 'u2' }),
    d(6, { field: 'completed_at', new: '2026-10-13T08:00:00Z', at: '2026-10-13T08:00:00Z' }),
  ];
  const k = { mekanAdi: (id: string | null | undefined) => (id === 'p1' ? 'Kurşunlu Külliyesi' : id === 'p2' ? 'Sazova Parkı' : '…'), gunNo: (g: string) => (g === 'g2' ? 2 : null), durakMekani: () => 'p1' };

  it('aynı an + kişi + satır tek grup; taşıma cümlesi gün numarasıyla', () => {
    const g = degisiklikGruplari(liste);
    expect(g.map((x) => [x.id, x.satirlar.length])).toEqual([
      [9, 2],
      [7, 1],
      [6, 1],
    ]);
    expect(grupMetni(g[0], k)).toBe('Kurşunlu Külliyesi mekanını 2. güne taşıdı');
    expect(grupMetni(g[1], k)).toBe('Sazova Parkı ekledi');
  });

  it('geri alınabilir: plan verisi evet, otomatik tamamlanma / üyelik hayır', () => {
    const g = degisiklikGruplari(liste);
    expect(geriAlinabilir(g[0])).toBe(true);
    expect(geriAlinabilir(g[1])).toBe(true);
    expect(geriAlinabilir(g[2])).toBe(false);
    expect(geriAlinabilir(degisiklikGruplari([d(1, { entity: 'members', entity_id: 'u3', new: {} })])[0])).toBe(false);
    expect(geriAlinabilir(degisiklikGruplari([d(1, { entity: 'days', entity_id: 'g1', field: 'start_time', old: '09:00', new: '10:00' })])[0])).toBe(true);
  });
});
