import { describe, expect, it, jest } from '@jest/globals';

import type { GunUcNoktalari } from '@/features/konaklama/plan';
import type { Durak, Gun, Mekan } from '@/lib/tipler';

import { gunProgramlari, gunSecenekleri, listemGruplari } from '../listem';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));

const mekan = (id: string, lat: number, ek: Partial<Mekan> = {}): Mekan =>
  ({ id, place_id: `p-${id}`, lat, lng: 30.5, primary_type: 'museum', default_minutes: 60, added_by: 'u1', created_at: `2026-10-0${id.length}T10:00:00Z`, ...ek }) as unknown as Mekan;
const durak = (id: string, gun: string, ref: string, key: string, ek: Partial<Durak> = {}): Durak =>
  ({ id, day_id: gun, place_ref: ref, order_key: key, minutes: 60, skipped: false, completed_at: null, arrived_at: null, ...ek }) as unknown as Durak;
const gun = (id: string, index: number): Gun => ({ id, index, date: null, start_time: null, end_time: null, order_manual: false }) as unknown as Gun;

describe('listemGruplari (#141 KK2–3)', () => {
  const mekanlar = [mekan('a', 39.7), mekan('b', 39.71), mekan('c', 39.72, { created_at: '2026-10-01T09:00:00Z' }), mekan('d', 39.73, { created_at: '2026-10-05T09:00:00Z' })];
  const duraklar = [durak('s1', 'g1', 'a', 'a0'), durak('s2', 'g1', 'b', 'a1')];
  const gunler = [gun('g2', 2), gun('g1', 1)];
  const oylar = [
    { mekan: 'b', kullanici: 'u1' },
    { mekan: 'b', kullanici: 'u2' },
    { mekan: 'd', kullanici: 'u2' },
  ];
  it('atanmamışlar eklenme sırasıyla, günler sırayla; sayılar', () => {
    const g = listemGruplari({ mekanlar, duraklar, gunler, oylar, benId: 'u1', siralama: 'plan' });
    expect(g.atanmamis.map((x) => x.mekan.id)).toEqual(['c', 'd']);
    expect(g.gunler.map((x) => [x.gun.id, x.satirlar.map((s) => s.mekan.id)])).toEqual([
      ['g1', ['a', 'b']],
      ['g2', []],
    ]);
    expect(g.sayi).toEqual({ tumu: 4, gunlerde: 2, atanmamis: 2 });
    expect(g.gunler[0].satirlar[1]).toMatchObject({ oy: 2, benimOyum: true });
  });
  it('En çok oy: her grup oya göre, eşitlikte asıl sıra', () => {
    const g = listemGruplari({ mekanlar, duraklar, gunler, oylar, benId: 'u2', siralama: 'oy' });
    expect(g.gunler[0].satirlar.map((x) => x.mekan.id)).toEqual(['b', 'a']);
    expect(g.atanmamis.map((x) => x.mekan.id)).toEqual(['d', 'c']);
  });
});

describe('gunSecenekleri (#141 KK5)', () => {
  // 1. gün kuzeyde (39.80), 2. gün güneyde (39.70); 3. gün boş. Yeni mekan güneyde.
  const mekanlar = [mekan('n1', 39.8), mekan('n2', 39.801), mekan('s1', 39.7), mekan('s2', 39.702), mekan('yeni', 39.703)];
  const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
  const duraklar = [durak('d1', 'g1', 'n1', 'a0'), durak('d2', 'g1', 'n2', 'a1'), durak('d3', 'g2', 's1', 'a0'), durak('d4', 'g2', 's2', 'a1')];
  const gunler = [gun('g1', 1), gun('g2', 2), gun('g3', 3)];
  const ortak = { seyahat: { day_start: '09:00:00' }, mekanIle, gunUclari: new Map<string, GunUcNoktalari>(), yuruyus: () => null, gunler, duraklar };
  it('önerilen en yakın durağı olan gün; en üstte; bitiş yeni süreyle uzar; boş gün ve son gün', () => {
    const s = gunSecenekleri({ ...ortak, mekan: mekanIle.get('yeni')! });
    expect(s.map((x) => [x.gun.id, x.onerilen])).toEqual([
      ['g2', true],
      ['g1', false],
      ['g3', false],
    ]);
    expect(s[0].yakindaki).toBe(2);
    expect(s[0].enYakinM).toBeLessThan(200);
    expect(s[0].yeniBitisDk).toBeGreaterThan(s[0].bitisDk! + 60);
    expect(s[2]).toMatchObject({ durakSayisi: 0, bitisDk: null, enYakinM: null, sonGun: true });
    expect(s[0].ekleIndeksi).toBe(2);
  });
  it('hiç durak yoksa ilk boş gün önerilir; gün sonunu aşan gün yerine sığan', () => {
    const bos = gunSecenekleri({ ...ortak, duraklar: [], mekan: mekanIle.get('yeni')! });
    expect(bos[0]).toMatchObject({ onerilen: true });
    expect(bos[0].gun.id).toBe('g1');
    const dar = gunSecenekleri({ ...ortak, mekan: mekanIle.get('yeni')!, gunSonuDk: 9 * 60 + 200 });
    // 2. gün eklenince 12:30'u aşar; 1. gün de aşar → hiçbiri sığmıyor, en yakın yine 2. gün.
    expect(dar[0].gun.id).toBe('g2');
  });
  it('gunProgramlari Program ile aynı hesap (varış saatleri)', () => {
    const p = gunProgramlari({ ...ortak });
    expect(p.get('g1')!.satirlar.map((x) => x.varisDk)).toEqual([540, 540 + 60 + 2]); // 111 m × 1,3 ÷ 4,5 km/sa ≈ 2 dk
    expect(p.get('g3')!.satirlar).toEqual([]);
  });
});
