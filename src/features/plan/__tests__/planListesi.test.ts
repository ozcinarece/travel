import { describe, expect, it } from '@jest/globals';

import type { Durak, Mekan, Yer } from '@/lib/tipler';
import type { ProgramSatiri } from '@/schedule/program';

import { AKSAM_ESIGI_DK, aksamOnerisi, kmMetni, planSatirlari, seritProjeksiyonu, yurumeMetresi } from '../planListesi';

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

describe('#182 KK5 akşam boş önerisi', () => {
  const yer = (id: string, place_id: string | null, lat: number, lng: number): Yer => ({ id, sehir_id: 's', place_id, ad: `Yer ${id}`, kategori: 'park', rehber_md: null, kapak_url: null, one_cikan_sira: null, lat, lng });
  const son = mekan('son', 'museum', 39.77, 30.52);
  const mekanlar = [son, mekan('yakin', 'park', 39.771, 30.521), mekan('uzak', 'park', 39.8, 30.6), mekan('gunde', 'cafe', 39.7701, 30.5201)];
  const duraklar = [durak('d1', 'son', 'a0'), durak('d2', 'gunde', 'a0', false, 'g2')];
  const satirlar = (ayrilis: number) => planSatirlari([duraklar[0]], new Map(mekanlar.map((m) => [m.id, m])), [satir(duraklar[0], ayrilis - 45, ayrilis)]);

  it('son durak 17:00\'den önce bitiyorsa en yakın atanmamış liste mekanı ve listede olmayan yakın rehber yeri', () => {
    const o = aksamOnerisi({ satirlar: satirlar(15 * 60), mekanlar, duraklar, yerler: [yer('r1', 'p-yakin', 39.77, 30.52), yer('r2', 'pr2', 39.772, 30.52), yer('kimliksiz', null, 39.77, 30.52), yer('cokuzak', 'pr3', 40.5, 31)] });
    expect(o?.liste?.id).toBe('yakin');
    expect(o?.rehber?.id).toBe('r2');
  });

  it('17:00 ve sonrası ya da aday yoksa öneri yok', () => {
    expect(aksamOnerisi({ satirlar: satirlar(AKSAM_ESIGI_DK), mekanlar, duraklar, yerler: [] })).toBeNull();
    expect(aksamOnerisi({ satirlar: satirlar(15 * 60), mekanlar: [son], duraklar, yerler: [] })).toBeNull();
    expect(aksamOnerisi({ satirlar: [], mekanlar, duraklar, yerler: [] })).toBeNull();
  });
});
