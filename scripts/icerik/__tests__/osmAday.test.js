// #328 KK1–KK4: `osm` aday listesi Overpass'ı yeniden denemeyle ve süre bütçesiyle sorar; düşerse tek satırlık hata.
import { OSM_ADAY_BUTCE_MS, osmAdaylariOku } from '../aday.mjs';
import { OsmOkumaHatasi } from '../konum.mjs';

const yanit = (status, govde = { elements: [] }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => govde,
});
const sahteFetch = (...sira) => jest.fn(async () => sira.shift() ?? yanit(504));
const bekle = jest.fn(async () => undefined);

const merkez = { lat: 38.42, lng: 27.14 };
const osmCevabi = {
  elements: [
    { type: 'node', id: 1, lat: 38.41, lon: 27.13, tags: { name: 'Müze', tourism: 'museum', wikidata: 'Q1' } },
    { type: 'way', id: 2, center: { lat: 38.43, lon: 27.15 }, tags: { name: 'Park', 'name:tr': 'Park TR', leisure: 'park' } },
    { type: 'node', id: 3, lat: 38.4, lon: 27.1, tags: { amenity: 'cafe' } },
  ],
};

beforeEach(() => bekle.mockClear());

describe('osmAdaylariOku (#328)', () => {
  it('KK1/KK4: Overpass 504, 504, başarı → aday listesi oluşur', async () => {
    const fetchFn = sahteFetch(yanit(504), yanit(504), yanit(200, osmCevabi));
    const adaylar = await osmAdaylariOku(merkez, 8000, { fetchFn, bekle });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(bekle).toHaveBeenCalledTimes(1);
    expect(adaylar).toEqual([
      { osm: 'node/1', ad: 'Müze', lat: 38.41, lng: 27.13, etiketler: { name: 'Müze', tourism: 'museum', wikidata: 'Q1' } },
      { osm: 'way/2', ad: 'Park TR', lat: 38.43, lng: 27.15, etiketler: { name: 'Park', 'name:tr': 'Park TR', leisure: 'park' } },
    ]);
  });

  it('KK1/KK3/KK4: Overpass hep 504 → tek satırlık hata (Overpass 504, 3 deneme)', async () => {
    const fetchFn = sahteFetch();
    const hata = await osmAdaylariOku(merkez, 8000, { fetchFn, bekle }).catch((e) => e);
    expect(hata).toBeInstanceOf(OsmOkumaHatasi);
    expect(hata.message).toBe('OSM aday listesi okunamadı (Overpass 504, 3 deneme)');
    expect(hata.message).not.toContain('\n');
    expect(bekle).toHaveBeenCalledTimes(2);
  });

  it('KK1: Retry-After başlığına uyar', async () => {
    const r429 = { ...yanit(429), headers: { get: (k) => (k === 'retry-after' ? '7' : null) } };
    const fetchFn = sahteFetch(r429, r429, yanit(200, osmCevabi));
    await osmAdaylariOku(merkez, 8000, { fetchFn, bekle });
    expect(bekle).toHaveBeenCalledWith(7000);
  });

  it('KK2/KK3: bütçe dolunca durur → "Overpass süre bütçesi doldu, N deneme"', async () => {
    let t = 0;
    const simdi = () => t;
    const fetchFn = sahteFetch();
    const hata = await osmAdaylariOku(merkez, 8000, { fetchFn, bekle, simdi, butceMs: 4_000 }).catch((e) => e);
    expect(hata).toBeInstanceOf(OsmOkumaHatasi);
    expect(hata.message).toBe('OSM aday listesi okunamadı (Overpass süre bütçesi doldu, 1 deneme)');
    expect(bekle).not.toHaveBeenCalled();
  });

  it('KK2: bütçe sabiti 15 dk', () => {
    expect(OSM_ADAY_BUTCE_MS).toBe(15 * 60_000);
  });

  it('geçici olmayan 400 hemen durur', async () => {
    const fetchFn = sahteFetch(yanit(400));
    const hata = await osmAdaylariOku(merkez, 8000, { fetchFn, bekle }).catch((e) => e);
    expect(hata.message).toBe('OSM aday listesi okunamadı (Overpass 400, 1 deneme)');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
