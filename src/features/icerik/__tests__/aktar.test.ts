import { describe, expect, it, jest } from '@jest/globals';

import type { GeziDetay, GeziDuragi, Gun } from '@/lib/tipler';

import { aktarmaDugmesi, aktarmaPlani, varsayilanEslesme } from '../aktar';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const durak = (id: string, gun: string, sira: number, place_id: string | null = null): GeziDuragi => ({ id, gezi_gun_id: gun, sira, place_id, ad: id, kategori: 'museum', sure_dk: 60, lat: 39.7, lng: 30.5 });
const gezi = {
  gezi_gunleri: [
    { id: 'G1', gezi_id: 'z', sira: 1, baslik: 'Odunpazarı', gezi_duraklari: [durak('a', 'G1', 1, 'PA'), durak('b', 'G1', 2)] },
    { id: 'G2', gezi_id: 'z', sira: 2, baslik: 'Porsuk', gezi_duraklari: [durak('c', 'G2', 1), durak('a2', 'G2', 2, 'PA')] },
    { id: 'G3', gezi_id: 'z', sira: 3, baslik: null, gezi_duraklari: [durak('d', 'G3', 1)] },
  ],
} as unknown as Pick<GeziDetay, 'gezi_gunleri'>;
const gun = (id: string, index: number, date: string | null): Gun => ({ id, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null });
const gunler = [gun('d2', 2, '2026-10-17'), gun('d1', 1, '2026-10-16')];

describe('geziyi seyahatime al (#97 C)', () => {
  it('tüm gezi: günler sırayla; gün azsa fazlası listeye; aynı mekan iki günde geçiyorsa bir kez', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'tum' });
    expect(varsayilanEslesme(gezi, gunler)).toEqual({ G1: 'd1', G2: 'd2', G3: null });
    expect(p.atamalar).toEqual([
      { gunId: 'd1', duraklar: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] },
      { gunId: 'd2', duraklar: [expect.objectContaining({ id: 'c' })] },
    ]);
    expect(p.listeyeKalan.map((d) => d.id)).toEqual(['d']);
    expect(p.duraklar.map((d) => d.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(aktarmaDugmesi(p, gunler, { tur: 'tum' })).toBe('2 günü al · Cum 16, Cmt 17');
  });
  it('günleri seç: eşleşmeye göre; eşleşmeyen gün listeye', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'gunler', eslesme: { G1: 'd2', G2: null, G3: 'd2' } });
    expect(p.atamalar).toEqual([{ gunId: 'd2', duraklar: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' }), expect.objectContaining({ id: 'd' })] }]);
    expect(p.listeyeKalan.map((d) => d.id)).toEqual(['c']);
    expect(aktarmaDugmesi(p, gunler, { tur: 'gunler', eslesme: {} })).toBe('1 günü al · Cmt 17');
  });
  it('yalnız mekanlar: atama yok, hepsi listeye', () => {
    const p = aktarmaPlani(gezi, gunler, { tur: 'mekanlar' });
    expect(p.atamalar).toEqual([]);
    expect(p.listeyeKalan).toHaveLength(4);
    expect(aktarmaDugmesi(p, gunler, { tur: 'mekanlar' })).toBe('4 mekanı listeye ekle');
  });
});
