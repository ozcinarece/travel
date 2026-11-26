// #308 KK1: seyahat sayfasının üst haritası (kanvas `Sayfa_v7_Seyahat_*`).
import { describe, expect, it } from '@jest/globals';

import type { Durak, Gun, Mekan } from '@/lib/tipler';

import { ustHaritaVerisi } from '../ustHarita';

const gun = (id: string, index: number) => ({ id, index, trip_id: 't', date: null, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null }) as Gun;
const mekan = (id: string, lat: number | null) => ({ id, place_id: `p${id}`, lat, lng: lat === null ? null : 30.5, primary_type: 'museum' }) as unknown as Mekan;
const durak = (id: string, day: string, mekanId: string, order: string, tamam = false) =>
  ({ id, day_id: day, place_ref: mekanId, order_key: order, skipped: false, completed_at: tamam ? '2026-11-25T08:00:00Z' : null }) as unknown as Durak;

const gunler = [gun('g1', 1), gun('g2', 2)];
const mekanlar = [mekan('a', 39.7), mekan('b', 39.8), mekan('c', null), mekan('d', 39.9)];
const duraklar = [durak('1', 'g1', 'a', 'a'), durak('2', 'g1', 'b', 'b', true), durak('3', 'g1', 'c', 'c'), durak('4', 'g2', 'd', 'a')];
const ortak = { gunler, duraklar, mekanlar, bugunGunId: 'g1', konum: { lat: 39.75, lng: 30.5 }, otel: { lat: 39.76, lng: 30.51 }, oneriler: [{ id: 'x', konum: { lat: 39.7, lng: 30.4 } }], bugunCizgileri: [] };

describe('ustHaritaVerisi (#308 KK1)', () => {
  it('plan modu: bütün günler gün renginde, çok duraklı günde çizgi; konum noktası yok', () => {
    const v = ustHaritaVerisi({ ...ortak, hal: 'plan' });
    expect(v.pinler.map((p) => p.id)).toEqual(['durak:1', 'durak:2', 'durak:4']);
    expect(v.cizgiler.map((c) => c.id)).toEqual(['ust:g1']);
    expect(v.pinler.some((p) => p.tur === 'konum')).toBe(false);
  });

  it('gezi modu: yalnız bugünün durakları (gezilen tamam), #532 öneri pini, konum noktası; koordinatsız durak yok', () => {
    const v = ustHaritaVerisi({ ...ortak, hal: 'gezi' });
    expect(v.pinler.map((p) => p.id)).toEqual(['durak:1', 'durak:2', 'ust:oneri:x', 'ust:konum']);
    expect(v.pinler[1].tamam).toBe(true);
  });

  it('boş gün: otel, öneri ve konum; konum izni yoksa konum noktası çizilmez', () => {
    expect(ustHaritaVerisi({ ...ortak, hal: 'bos' }).pinler.map((p) => p.tur)).toEqual(['otel', 'oneri', 'konum']);
    expect(ustHaritaVerisi({ ...ortak, hal: 'bos', konum: null }).pinler.map((p) => p.tur)).toEqual(['otel', 'oneri']);
  });
});
