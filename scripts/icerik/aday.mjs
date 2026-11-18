// #328: `osm` işleminin aday listesi (içerik hattı, docs/07). Overpass `overpassYeniden` ile (429/502/503/504 ve ağ hatasında
// bekleyip yeniden dener, `Retry-After`'a uyar) ve süre bütçesiyle sorulur. Google'a gidilmez. Loglara sorgu ya da yanıt
// yazılmaz; hata satırında yalnız durum kodu ve deneme sayısı var. `hat.mjs` üst düzey `await` kullandığı için ayrı dosya.
import { OsmOkumaHatasi, overpassHataSatiri } from './konum.mjs';
import { OverpassHatasi, overpassYeniden, SureBittiHatasi } from './overpass.mjs';

/** KK2: `osm` aday listesinin Overpass bütçesi (`yukle` ile aynı; iş akışı 30 dk'da kesilir). */
export const OSM_ADAY_BUTCE_MS = 15 * 60_000;

/** OSM etiketlerinden yalnız aday seçimine yarayanlar (ODbL; atıf: © OpenStreetMap katkıcıları). */
export const OSM_ETIKETLERI = ['name', 'name:tr', 'name:en', 'tourism', 'historic', 'amenity', 'leisure', 'religion', 'cuisine', 'opening_hours', 'wikipedia', 'wikidata', 'website', 'heritage'];

export function overpassSorgusu({ lat, lng }, yaricap) {
  const a = `(around:${Math.round(yaricap)},${lat},${lng})`;
  return `[out:json][timeout:90];
(
  nwr${a}["tourism"~"^(museum|attraction|viewpoint|gallery|artwork|zoo|theme_park)$"]["name"];
  nwr${a}["historic"]["name"];
  nwr${a}["amenity"="place_of_worship"]["name"];
  nwr${a}["leisure"~"^(park|garden)$"]["name"];
  nwr${a}["amenity"~"^(restaurant|cafe)$"]["name"];
);
out center tags;`;
}

/** Overpass yanıtı → aday listesi (adı ve konumu olanlar). */
export function adaylariAyikla(veri) {
  return (veri?.elements ?? [])
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const etiketler = Object.fromEntries(OSM_ETIKETLERI.filter((k) => e.tags?.[k] !== undefined).map((k) => [k, e.tags[k]]));
      return { osm: `${e.type}/${e.id}`, ad: e.tags?.['name:tr'] ?? e.tags?.name, lat, lng, etiketler };
    })
    .filter((a) => a.ad && typeof a.lat === 'number' && typeof a.lng === 'number');
}

/**
 * KK1–KK3: şehrin OSM aday listesi. Düşerse (yeniden denemeler ya da bütçe bitince) tek satırlık `OsmOkumaHatasi`:
 * "OSM aday listesi okunamadı (Overpass 504, 3 deneme)". Seçenekler testte sahtedir.
 */
export async function osmAdaylariOku(merkez, yaricap, { fetchFn, bekle, simdi = Date.now, butceMs = OSM_ADAY_BUTCE_MS } = {}) {
  let veri;
  try {
    veri = await overpassYeniden(overpassSorgusu(merkez, yaricap), { fetchFn, bekle, simdi, bitis: simdi() + butceMs });
  } catch (e) {
    if (!(e instanceof OverpassHatasi) && !(e instanceof SureBittiHatasi)) throw e;
    throw new OsmOkumaHatasi(`OSM aday listesi okunamadı (${overpassHataSatiri(e)})`);
  }
  return adaylariAyikla(veri);
}
