// #323 KK1–KK4: `yukle` OSM konumlarını Google detayından önce ve yeniden denemeyle okur; Overpass düşerse Google'a istek gitmez.
import { overpassHataSatiri, yuklemeKonumlari } from '../konum.mjs';
import { OverpassHatasi, SureBittiHatasi } from '../overpass.mjs';

const yanit = (status, govde = { elements: [] }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => govde,
});
const sahteFetch = (...sira) => jest.fn(async () => sira.shift() ?? yanit(504));
const bekle = jest.fn(async () => undefined);

const plan = {
  gunler: [
    {
      duraklar: [
        { place_id: 'p1', osm: 'node/1' },
        { place_id: 'p2', osm: 'way/2' },
        { place_id: 'p3' },
      ],
    },
  ],
};
const osmCevabi = {
  elements: [
    { type: 'node', id: 1, lat: 40.18, lon: 29.06 },
    { type: 'way', id: 2, center: { lat: 40.19, lon: 29.07 } },
  ],
};
const googleSahte = () =>
  jest.fn(async ({ idler }) => ({
    yerler: idler.map((id) => ({
      place_id: id,
      lat: 40,
      lng: 29,
      durum: 'OPERATIONAL',
    })),
  }));

beforeEach(() => bekle.mockClear());

describe('yuklemeKonumlari (#323)', () => {
  it('KK2/KK4: Overpass ilk iki çağrıda 504, üçüncüde başarı → yükleme sürer, Google bir kez çağrılır', async () => {
    const fetchFn = sahteFetch(yanit(504), yanit(504), yanit(200, osmCevabi));
    const googleFn = googleSahte();
    const r = await yuklemeKonumlari(plan, {
      googleFn,
      overpass: { fetchFn, bekle },
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(bekle).toHaveBeenCalledTimes(1);
    expect(r.osmKonumlari.get('node/1')).toEqual({ lat: 40.18, lng: 29.06 });
    expect(r.osmKonumlari.get('way/2')).toEqual({ lat: 40.19, lng: 29.07 });
    expect(googleFn).toHaveBeenCalledTimes(1);
    expect(googleFn).toHaveBeenCalledWith({
      islem: 'detay',
      idler: ['p1', 'p2', 'p3'],
    });
    expect(r.yerler).toHaveLength(3);
  });

  it('KK1: OSM, Google detayından önce okunur', async () => {
    const sira = [];
    const fetchFn = jest.fn(async () => {
      sira.push('osm');
      return yanit(200, osmCevabi);
    });
    const googleFn = jest.fn(async () => {
      sira.push('google');
      return { yerler: [] };
    });
    await yuklemeKonumlari(plan, { googleFn, overpass: { fetchFn, bekle } });
    expect(sira).toEqual(['osm', 'google']);
  });

  it('KK1/KK3/KK4: Overpass hep 504 → Google sahtesine 0 çağrı, hata tek satır (Overpass 504, 3 deneme)', async () => {
    const fetchFn = sahteFetch();
    const googleFn = googleSahte();
    await expect(
      yuklemeKonumlari(plan, { googleFn, overpass: { fetchFn, bekle } }),
    ).rejects.toThrow(
      "OSM konumları okunamadı (Overpass 504, 3 deneme); Google'a gidilmedi, yüklenmedi",
    );
    expect(fetchFn).toHaveBeenCalledTimes(6); // 3 deneme × 2 sunucu
    expect(googleFn).not.toHaveBeenCalled();
  });

  it('KK2: süre bütçesi dolunca durur; Google çağrılmaz', async () => {
    const fetchFn = sahteFetch();
    const googleFn = googleSahte();
    let t = 0;
    const simdi = () => t;
    const ilerletenBekle = jest.fn(async (ms) => {
      t += ms;
    });
    await expect(
      yuklemeKonumlari(plan, {
        googleFn,
        overpass: { fetchFn, bekle: ilerletenBekle, simdi, butceMs: 10_000 },
      }),
    ).rejects.toThrow('Overpass süre bütçesi doldu, 2 deneme');
    expect(googleFn).not.toHaveBeenCalled();
  });

  it('OSM adayı olmayan planda Overpass sorulmaz', async () => {
    const fetchFn = sahteFetch();
    const googleFn = googleSahte();
    const r = await yuklemeKonumlari(
      { gunler: [{ duraklar: [{ place_id: 'p1' }] }] },
      { googleFn, overpass: { fetchFn, bekle } },
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.osmKonumlari.size).toBe(0);
    expect(googleFn).toHaveBeenCalledTimes(1);
  });
});

describe('overpassHataSatiri (#323 KK3)', () => {
  it('durum ve deneme sayısı; ağ hatası ve bütçe', () => {
    expect(
      overpassHataSatiri(
        Object.assign(new OverpassHatasi('x', { durum: 504 }), { deneme: 3 }),
      ),
    ).toBe('Overpass 504, 3 deneme');
    expect(
      overpassHataSatiri(Object.assign(new OverpassHatasi('x'), { deneme: 2 })),
    ).toBe('Overpass ağ hatası, 2 deneme');
    expect(overpassHataSatiri(new SureBittiHatasi(1))).toBe(
      'Overpass süre bütçesi doldu, 1 deneme',
    );
  });
});
