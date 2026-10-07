import { describe, expect, it } from '@jest/globals';

import { gunUclari, konaklamaAnahtari, otelinGeceleri, otelPlani, yeniGunUclari, type Konaklama } from '../plan';

const gun = (index: number, start: string | null, end: string | null) => ({ id: `g${index}`, index, start_stay_id: start, end_stay_id: end });
const dort = (s: string | null) => [gun(1, s, s), gun(2, s, s), gun(3, s, s), gun(4, s, s)];

describe('gün bazlı otel (#56)', () => {
  it('Atla dendiyse (otel yok) ilk gün eklenen otel "bu gün ve sonrası" ile tüm günlere zincirlenir', () => {
    expect(otelPlani(dort(null), 'g1', 'sonrasi', 'A')).toEqual([
      { id: 'g1', start_stay_id: 'A', end_stay_id: 'A' },
      { id: 'g2', start_stay_id: 'A', end_stay_id: 'A' },
      { id: 'g3', start_stay_id: 'A', end_stay_id: 'A' },
      { id: 'g4', start_stay_id: 'A', end_stay_id: 'A' },
    ]);
  });

  it('ilk günden sonra otel değiştirme (bu gün ve sonrası): önceki günler aynen', () => {
    expect(otelPlani(dort('A'), 'g3', 'sonrasi', 'B')).toEqual([
      { id: 'g3', start_stay_id: 'B', end_stay_id: 'B' },
      { id: 'g4', start_stay_id: 'B', end_stay_id: 'B' },
    ]);
  });

  it('taşınma günü: sabah A, akşam B; sonrası B (bu gün ve sonrası)', () => {
    expect(otelPlani(dort('A'), 'g2', 'sonrasi', 'A', 'B')).toEqual([
      { id: 'g2', start_stay_id: 'A', end_stay_id: 'B' },
      { id: 'g3', start_stay_id: 'B', end_stay_id: 'B' },
      { id: 'g4', start_stay_id: 'B', end_stay_id: 'B' },
    ]);
  });

  it('taşınma günü (yalnız bu gün): ertesi gün B\'den başlar, dönüş günüyse B\'ye döner; sonrası değişmez', () => {
    expect(otelPlani(dort('A'), 'g2', 'bugun', 'A', 'B')).toEqual([
      { id: 'g2', start_stay_id: 'A', end_stay_id: 'B' },
      { id: 'g3', start_stay_id: 'B', end_stay_id: 'B' },
    ]);
    // Ertesi gün zaten bir taşınma günüyse (B → C) yalnız başlangıcı değişir.
    const g = [gun(1, 'A', 'A'), gun(2, 'X', 'C')];
    expect(otelPlani(g, 'g1', 'bugun', 'A', 'B')).toEqual([
      { id: 'g1', start_stay_id: 'A', end_stay_id: 'B' },
      { id: 'g2', start_stay_id: 'B', end_stay_id: 'C' },
    ]);
  });

  it('yalnız bu gün, taşınma yok: yalnız o gün değişir', () => {
    expect(otelPlani(dort('A'), 'g2', 'bugun', 'B')).toEqual([{ id: 'g2', start_stay_id: 'B', end_stay_id: 'B' }]);
  });

  it('otel kaldırma: otelsiz gün (null); değişmeyen günler listeye girmez', () => {
    expect(otelPlani(dort('A'), 'g3', 'sonrasi', null)).toEqual([
      { id: 'g3', start_stay_id: null, end_stay_id: null },
      { id: 'g4', start_stay_id: null, end_stay_id: null },
    ]);
    expect(otelPlani(dort('A'), 'g1', 'sonrasi', 'A')).toEqual([]);
    expect(otelPlani(dort('A'), 'yok', 'sonrasi', 'B')).toEqual([]);
  });

  it('varsayılan zincir: yeni gün son günün bitişinden başlar ve oraya döner', () => {
    expect(yeniGunUclari([gun(1, 'A', 'A'), gun(2, 'A', 'B')])).toEqual({ start_stay_id: 'B', end_stay_id: 'B' });
    expect(yeniGunUclari([])).toEqual({ start_stay_id: null, end_stay_id: null });
  });

  it('gunUclari, anahtar ve geceler', () => {
    const k = new Map<string, Konaklama>([['A', { id: 'A', trip_id: 't', place_id: null, lat: 1, lng: 2, label: 'Ibis' }]]);
    expect(gunUclari(gun(1, 'A', null), k)).toEqual({ baslangic: k.get('A'), bitis: null });
    expect(gunUclari(undefined, k)).toEqual({ baslangic: null, bitis: null });
    expect(konaklamaAnahtari('A')).toBe('stay:A');
    expect(otelinGeceleri([gun(2, 'A', 'A'), gun(1, null, 'A'), gun(3, 'A', 'B')], 'A').map((g) => g.index)).toEqual([1, 2]);
  });
});
