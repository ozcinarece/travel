import { describe, expect, it, jest } from '@jest/globals';

import type { Durak, Mekan } from '@/lib/tipler';
import type { ProgramSatiri } from '@/schedule/program';

import { KART_ADIM, kartDugmeleri, kartIndeksi, kartKamerasi, kartListesi } from '../durakKarti';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));

const mekan = (id: string, place_id: string, tip: string | null = 'museum'): Mekan => ({ id, place_id, lat: 39.7, lng: 30.5, primary_type: tip, default_minutes: 60 } as unknown as Mekan);
const durak = (id: string, place_ref: string, ek: Partial<Durak> = {}): Durak => ({ id, day_id: 'g1', place_ref, skipped: false, completed_at: null, minutes: 60, ...ek } as unknown as Durak);
const satir = (id: string, varisDk: number, ayrilisDk: number, durum: ProgramSatiri['durum']): ProgramSatiri => ({ durak: { id }, varisDk, ayrilisDk, durum } as unknown as ProgramSatiri);

describe('kartListesi (#99 KK1)', () => {
  const mekanIle = new Map([
    ['m1', mekan('m1', 'p1', 'mosque')],
    ['m2', mekan('m2', 'p2', 'tourist_attraction')],
    ['m3', mekan('m3', 'p3')],
  ]);
  const adlar = {
    p1: { place_id: 'p1', ad: 'Kurşunlu Cami', primary_type: 'mosque', puan: 4.6, puan_sayisi: 3100 },
    p2: { place_id: 'p2', ad: 'Odunpazarı Evleri', primary_type: 'tourist_attraction', puan: 4.7, puan_sayisi: 7600 },
  } as never;
  it('gün listesi sırasıyla kart; saat aralığı programdan; ★ puan · yorum kısaltılmış; ad yoksa …', () => {
    const k = kartListesi({ gunDurak: [durak('d1', 'm1'), durak('d2', 'm2'), durak('d3', 'm3', { skipped: true })], mekanIle, adlar, satirlar: [satir('d1', 600, 630, 'bekliyor'), satir('d2', 640, 730, 'bekliyor'), satir('d3', 730, 730, 'atlandi')] });
    expect(k.map((x) => [x.sira, x.ad, x.altSatir, x.puan, x.yorum])).toEqual([
      [1, 'Kurşunlu Cami', 'Cami · 10:00–10:30', 4.6, '3,1K'],
      [2, 'Odunpazarı Evleri', 'Gezilecek yer · 10:40–12:10', 4.7, '7,6K'],
      [3, '…', 'Müze', null, null],
    ]);
    expect(k[2].durum).toBe('atlandi');
  });
  it('mekanı silinmiş durak karta girmez', () => {
    expect(kartListesi({ gunDurak: [durak('d9', 'yok'), durak('d1', 'm1')], mekanIle, adlar, satirlar: [] })).toHaveLength(1);
  });
});

describe('kartKamerasi (#99 KK2)', () => {
  it('merkez pinin güneyinde (pin kartın üstünde kalır); zoom 14–17 arasına sıkıştırılır', () => {
    const k = kartKamerasi({ konum: { lat: 39.78, lng: 30.5 }, zoom: 15, ekranYukseklik: 800 });
    expect(k.konum.lng).toBe(30.5);
    expect(k.konum.lat).toBeLessThan(39.78);
    expect(39.78 - k.konum.lat).toBeCloseTo(((200 + 14) / 2) * (360 / 2 ** 15 / 800), 8);
    expect(kartKamerasi({ konum: { lat: 0, lng: 0 }, zoom: 11, ekranYukseklik: 800 }).zoom).toBe(14);
    expect(kartKamerasi({ konum: { lat: 0, lng: 0 }, zoom: 19, ekranYukseklik: 800 }).zoom).toBe(17);
  });
});

describe('kartIndeksi / kartDugmeleri (#99 KK2, KK4)', () => {
  it('ofset → en yakın kart, sınırlar içinde', () => {
    expect(kartIndeksi(0, 5)).toBe(0);
    expect(kartIndeksi(KART_ADIM * 2 + 40, 5)).toBe(2);
    expect(kartIndeksi(KART_ADIM * 9, 5)).toBe(4);
    expect(kartIndeksi(-50, 5)).toBe(0);
  });
  it('gezi sırasında sıradaki/buradasın durakta Vardık ilk; diğerlerinde Detay · Yol tarifi', () => {
    const kart = { durum: 'siradaki', tamamlandi: false } as never;
    expect(kartDugmeleri(kart, true)).toEqual(['vardik', 'detay']);
    expect(kartDugmeleri(kart, false)).toEqual(['detay', 'yolTarifi']);
    expect(kartDugmeleri({ durum: 'bekliyor', tamamlandi: false } as never, true)).toEqual(['detay', 'yolTarifi']);
    expect(kartDugmeleri({ durum: 'buradasin', tamamlandi: true } as never, true)).toEqual(['detay', 'yolTarifi']);
  });
});
