import { describe, expect, it, jest } from '@jest/globals';

import { bolgeHesapla } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { AZ_ONERI, cekmeceListesi, cekmeceSayisi, gorunurOneriSayisi } from '../cekmece';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const yer = (id: string, lat: number, lng: number, puan: number, yorum: number, tip = 'tourist_attraction'): HafifYer =>
  ({ place_id: id, ad: id, lat, lng, primary_type: tip, tz: null, puan, puan_sayisi: yorum, acik: null, ulke_kodu: null }) as HafifYer;

describe('öneri çekmecesi listesi (#98 B KK2–3)', () => {
  const bolge = bolgeHesapla({ lat: 39.78, lng: 30.5 }, 0.02, 0.02);
  const icerde = [yer('a', 39.78, 30.5, 4.7, 12000), yer('b', 39.781, 30.501, 4.5, 2400, 'restaurant'), yer('c', 39.779, 30.499, 4.4, 1100, 'viewpoint'), yer('d', 39.782, 30.502, 4.6, 941, 'museum')];
  const disarda = yer('z', 39.9, 30.9, 4.9, 99999);

  it('görünür alanda olup listede olmayanlar, puan sırası; dışarıdakiler yok', () => {
    const liste = cekmeceListesi([...icerde, disarda], new Set(['d']), bolge);
    expect(liste.map((y) => y.place_id)).toEqual(['a', 'b', 'c']);
  });
  it('"+" ile eklenen bir sonraki yenilemeye kadar listede kalır (tut), sayıya girmez', () => {
    const liste = cekmeceListesi(icerde, new Set(['a']), bolge, new Set(['a']));
    // Puan × log10(yorum): d (4,6 · 941) c'nin (4,4 · 1,1K) önünde.
    expect(liste.map((y) => y.place_id)).toEqual(['a', 'b', 'd', 'c']);
    expect(cekmeceSayisi(liste, new Set(['a']))).toBe(3);
  });
  it('#189 KK3: görünür alandaki öneri sayısı listedekileri de sayar; dışarıdakiler ve bölgesiz durum 0', () => {
    expect(AZ_ONERI).toBe(3);
    expect(gorunurOneriSayisi([...icerde, disarda], bolge)).toBe(4);
    expect(gorunurOneriSayisi([icerde[0], icerde[1], disarda], bolge)).toBeLessThan(AZ_ONERI);
    expect(gorunurOneriSayisi(icerde, null)).toBe(0);
  });
  it('kategori çipleri süzer; bölge yoksa boş', () => {
    expect(cekmeceListesi(icerde, new Set(), bolge, new Set(), 'yemek').map((y) => y.place_id)).toEqual(['b']);
    expect(cekmeceListesi(icerde, new Set(), bolge, new Set(), 'manzara').map((y) => y.place_id)).toEqual(['c']);
    expect(cekmeceListesi(icerde, new Set(), null)).toEqual([]);
  });
});
