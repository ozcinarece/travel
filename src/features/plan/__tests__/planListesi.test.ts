import { describe, expect, it } from '@jest/globals';

import type { Durak, Mekan } from '@/lib/tipler';
import type { ProgramSatiri } from '@/schedule/program';

import { AKSAM_ESIGI_DK, aksamBoslugu, kmMetni, planSatirlari, seritProjeksiyonu, yurumeMetresi } from '../planListesi';

const mekan = (id: string, tip: string, lat = 39.77, lng = 30.52): Mekan => ({
  id,
  trip_id: 't',
  place_id: `p-${id}`,
  primary_type: tip,
  lat,
  lng,
  google_fetched_at: '',
  default_minutes: 45,
  added_by: null,
  note: null,
  created_at: '2026-10-01T00:00:00Z',
});
const durak = (id: string, mekanId: string, order: string, skipped = false, gun = 'g1'): Durak => ({
  id,
  trip_id: 't',
  day_id: gun,
  place_ref: mekanId,
  order_key: order,
  minutes: 45,
  arrived_at: null,
  arrived_by: null,
  completed_at: null,
  completed_by: null,
  auto_completed: false,
  skipped,
});
const satir = (d: Durak, varisDk: number, ayrilisDk: number, m = 600, durum: ProgramSatiri['durum'] = 'bekliyor'): ProgramSatiri =>
  ({ durak: { id: d.id } as ProgramSatiri['durak'], varisDk, ayrilisDk, yuruyus: { sn: 600, m, kestirim: true, mod: 'yuruyus' }, durum, otomatik: false, bosluk: null }) as ProgramSatiri;

describe('#182 KK1–KK2 durak satırları', () => {
  const mekanlar = [mekan('a', 'museum'), mekan('b', 'restaurant'), mekan('c', 'park')];
  const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
  const duraklar = [durak('d1', 'a', 'a0'), durak('d2', 'b', 'a1', true), durak('d3', 'c', 'a2'), durak('d4', 'yok', 'a3')];

  it('atlanmayanlar numaralanır; atlananda saat ve bacak yok; yemek işaretlenir; mekansız durak atlanır', () => {
    const r = planSatirlari(duraklar, mekanIle, [satir(duraklar[0], 576, 651), satir(duraklar[2], 663, 708)]);
    expect(r.map((x) => [x.durak.id, x.numara, x.varisDk, x.yemek, x.gelis?.m ?? null])).toEqual([
      ['d1', 1, 576, false, 600],
      ['d2', null, null, true, null],
      ['d3', 2, 663, false, 600],
    ]);
  });

  it('şerit etiketinin yürümesi: yürünen bacaklar + otele dönüş; araç bacağı sayılmaz', () => {
    const satirlar = [{ gelis: { sn: 1, m: 400, kestirim: false, mod: 'yuruyus' as const } }, { gelis: { sn: 1, m: 3000, kestirim: false, mod: 'taksi' as const } }, { gelis: null }];
    expect(yurumeMetresi(satirlar, { sn: 1, m: 1700, kestirim: true, mod: 'yuruyus' })).toBe(2100);
    expect(kmMetni(2100)).toBe('2,1 km');
    expect(kmMetni(846)).toBe('850 m');
  });
});

describe('#182 KK3 şerit projeksiyonu', () => {
  it('tüm noktalar iç boşlukla kutuya sığar; kuzey yukarıda, doğu sağda', () => {
    const p = seritProjeksiyonu(
      [
        { lat: 39.77, lng: 30.5 },
        { lat: 39.78, lng: 30.53 },
        { lat: 39.775, lng: 30.52 },
      ],
      350,
      112,
      22,
    );
    const bat = p({ lat: 39.77, lng: 30.5 });
    const dogu = p({ lat: 39.78, lng: 30.53 });
    for (const n of [bat, dogu]) {
      expect(n.x).toBeGreaterThanOrEqual(22 - 1e-6);
      expect(n.x).toBeLessThanOrEqual(350 - 22 + 1e-6);
      expect(n.y).toBeGreaterThanOrEqual(22 - 1e-6);
      expect(n.y).toBeLessThanOrEqual(112 - 22 + 1e-6);
    }
    expect(dogu.x).toBeGreaterThan(bat.x);
    expect(dogu.y).toBeLessThan(bat.y);
  });

  it('tek nokta merkeze düşer; boş liste de', () => {
    expect(seritProjeksiyonu([{ lat: 1, lng: 2 }], 300, 112)({ lat: 1, lng: 2 })).toEqual({ x: 150, y: 56 });
    expect(seritProjeksiyonu([], 300, 112)({ lat: 1, lng: 2 })).toEqual({ x: 150, y: 56 });
  });
});

describe('#182 KK5 / #532 KK3 akşam boşluğu', () => {
  const son = mekan('son', 'museum', 39.77, 30.52);
  const duraklar = [durak('d1', 'son', 'a0')];
  const satirlar = (ayrilis: number) => planSatirlari(duraklar, new Map([[son.id, son]]), [satir(duraklar[0], ayrilis - 45, ayrilis)]);

  it('son durak 17:00\'den önce bitiyorsa referans son durağın konumu', () => {
    expect(aksamBoslugu(satirlar(15 * 60))).toEqual({ lat: 39.77, lng: 30.52 });
  });

  it('17:00 ve sonrası ya da durak yoksa boşluk yok', () => {
    expect(aksamBoslugu(satirlar(AKSAM_ESIGI_DK))).toBeNull();
    expect(aksamBoslugu([])).toBeNull();
  });
});

describe('#262 / #318: Google koordinatı boşalmış mekan', () => {
  const bos = { ...mekan('bos', 'museum'), lat: null, lng: null } as Mekan;
  const a = mekan('a', 'park', 39.77, 30.52);
  const b = mekan('b', 'cafe', 39.771, 30.521);
  const mekanIle = new Map([a, bos, b].map((m) => [m.id, m]));
  const d = [durak('d1', 'a', 'a0'), durak('d2', 'bos', 'a1'), durak('d3', 'b', 'a2')];

  it('plan listesinde kalır, numarası ve saati diğerleri gibi', () => {
    const r = planSatirlari(d, mekanIle, [satir(d[0], 600, 645), satir(d[1], 660, 705), satir(d[2], 720, 765)]);
    expect(r.map((x) => [x.mekan.id, x.numara, x.varisDk])).toEqual([
      ['a', 1, 600],
      ['bos', 2, 660],
      ['b', 3, 720],
    ]);
  });

  it('akşam boşluğu son konumlu duraktan; günün bütün durakları koordinatsızsa null, çökme yok', () => {
    const satirlar = planSatirlari([d[0], d[1]], mekanIle, [satir(d[0], 600, 645), satir(d[1], 660, 705)]);
    expect(aksamBoslugu(satirlar)).toEqual({ lat: 39.77, lng: 30.52 });
    const yalnizBos = planSatirlari([d[1]], mekanIle, [satir(d[1], 660, 705)]);
    expect(aksamBoslugu(yalnizBos)).toBeNull();
  });
});
