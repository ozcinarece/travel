import { describe, expect, it } from '@jest/globals';

import type { Degisiklik } from '@/lib/tipler';

import { degisiklikGruplari, geriAlinabilir, geriAlmaYetkisi, grupMetni } from '../degisiklikMetni';

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

  it('#183 harcama ve ödeşme: cümle, geri alma düğmesi yalnız yetkiliye (ekleyen / sahip; ödeşmede iki taraf)', () => {
    const ekleme = degisiklikGruplari([d(1, { entity: 'harcamalar', entity_id: 'h1', user_id: 'ayse', new: { aciklama: 'Tramvay', tl_kurus: 9000, olusturan: 'ayse' } })])[0];
    expect(grupMetni(ekleme, k)).toBe('"Tramvay" harcamasını ekledi · 90 ₺');
    expect(geriAlinabilir(ekleme)).toBe(true);
    expect(geriAlmaYetkisi(ekleme, 'ayse', false)).toBe(true);
    expect(geriAlmaYetkisi(ekleme, 'mert', false)).toBe(false);
    expect(geriAlmaYetkisi(ekleme, 'mert', true)).toBe(true);
    const odesme = degisiklikGruplari([d(2, { entity: 'odesmeler', entity_id: 'o1', user_id: 'ayse', new: { kimden: 'ayse', kime: 'ben', tl_kurus: 21333 } })])[0];
    expect(grupMetni(odesme, k)).toBe('bir ödeşmeyi işaretledi · 213,33 ₺');
    expect(geriAlmaYetkisi(odesme, 'ben', false)).toBe(true);
    expect(geriAlmaYetkisi(odesme, 'mert', true)).toBe(false);
    // Düzenleme (alan satırı) — değişikliği yapan ya da sahip.
    const duzenleme = degisiklikGruplari([d(3, { entity: 'harcamalar', entity_id: 'h1', user_id: 'ayse', field: 'tl_kurus', old: 9000, new: 12000 })])[0];
    expect(grupMetni(duzenleme, k)).toBe('bir harcamayı değiştirdi');
    expect(geriAlmaYetkisi(duzenleme, 'ayse', false)).toBe(true);
    expect(geriAlmaYetkisi(duzenleme, 'mert', false)).toBe(false);
  });
});
