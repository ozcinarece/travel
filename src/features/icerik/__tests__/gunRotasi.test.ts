import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// routes.ts bir Deno modülü (`.ts` uzantılı içe aktarım, `Deno` global'i): uygulamanın tsc denetimine girmesin diye tipi burada
// yazılıp çalışma anında yüklenir.
type Nokta = { key: string; lat: number; lng: number };
type RotaBacagi = { seconds: number; meters: number; polyline: string };
type RoutesModulu = { GUN_PARCA_BACAK: number; gunRotasi: (noktalar: Nokta[], mod?: 'WALK' | 'DRIVE') => Promise<(RotaBacagi | null)[]> };
const { GUN_PARCA_BACAK, gunRotasi } = jest.requireActual<RoutesModulu>('../../../../supabase/functions/_shared/routes');

type Istek = { origin: unknown; destination: unknown; intermediates: unknown[]; travelMode: string };
const g = globalThis as unknown as { fetch: unknown; Deno?: unknown };
const eskiFetch = g.fetch;
let istekler: { govde: Istek; maske: string }[] = [];

/** computeRoutes taklidi: ara noktalı istekte her bacak için süre, mesafe, polyline; `bosBacak` aynı noktadaki iki durak (Google
 * 0 değerleri yazmaz); `rotasiz` rota çıkmadı. */
function sahteRoutes(bosBacak?: number, rotasiz = false) {
  return jest.fn(async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    const govde = JSON.parse(init.body) as Istek;
    istekler.push({ govde, maske: init.headers['x-goog-fieldmask'] });
    const bacakSayisi = govde.intermediates.length + 1;
    const legs = Array.from({ length: bacakSayisi }, (_, i) => (i === bosBacak ? {} : { duration: `${600 + i}s`, distanceMeters: 800 + i, polyline: { encodedPolyline: `p${i}` } }));
    return { ok: true, status: 200, json: async () => (rotasiz ? {} : { routes: [{ legs }] }), text: async () => '' };
  });
}

const noktalar = (n: number): Nokta[] => Array.from({ length: n }, (_, i) => ({ key: `d${i}`, lat: 39.7 + i / 1000, lng: 30.5 }));

beforeEach(() => {
  istekler = [];
  g.Deno = { env: { get: () => 'test-anahtari' } };
});
afterEach(() => {
  g.fetch = eskiFetch;
  delete g.Deno;
});

describe('#192 gunRotasi (gezi-rota)', () => {
  it('gün tek istekte: origin → ara noktalar → destination; bacak başına süre / mesafe / polyline; maske yalnız bacaklar', async () => {
    g.fetch = sahteRoutes(1);
    const sonuc = await gunRotasi(noktalar(4));
    expect(istekler).toHaveLength(1);
    expect(istekler[0].govde.intermediates).toHaveLength(2);
    expect(istekler[0].govde.travelMode).toBe('WALK');
    expect(istekler[0].maske).toBe('routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline');
    // Aynı noktadaki durak çifti: 1 sn, 0 m, boş polyline (yolu "yok" sayılmaz — yoksa her açılışta yeniden sorulurdu).
    expect(sonuc).toEqual([{ seconds: 600, meters: 800, polyline: 'p0' }, { seconds: 1, meters: 0, polyline: '' }, { seconds: 602, meters: 802, polyline: 'p2' }]);
  });

  it('rota çıkmazsa bacaklar null (istemci kuş uçuşunda kalır)', async () => {
    g.fetch = sahteRoutes(undefined, true);
    expect(await gunRotasi(noktalar(3))).toEqual([null, null]);
  });

  it('11 bacaktan uzun gün parçalanır (parça başına ≤ 10 ara nokta — Essentials); bacak sırası korunur', async () => {
    g.fetch = sahteRoutes();
    const sonuc = await gunRotasi(noktalar(GUN_PARCA_BACAK + 4));
    expect(istekler).toHaveLength(2);
    expect(istekler.map((i) => i.govde.intermediates.length)).toEqual([10, 2]);
    expect(sonuc).toHaveLength(GUN_PARCA_BACAK + 3);
    expect(sonuc.every(Boolean)).toBe(true);
    // İkinci parça birincinin son noktasından başlar.
    expect(istekler[1].govde.origin).toEqual(istekler[0].govde.destination);
  });
});
