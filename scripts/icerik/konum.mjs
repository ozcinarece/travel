// #323: `yukle`'nin konum okuması (içerik hattı, docs/07). Önce OSM (Overpass, yeniden denemeyle ve süre bütçesiyle), sonra
// Google `detay`: Overpass düşerse Google'a hiç istek gitmez. Kuru ve gerçek yükleme aynı yoldan geçer. Loglara sorgu, yanıt
// ya da Google verisi yazılmaz; hata satırında yalnız durum kodu ve deneme sayısı var.
import { detayIdleri, osmIdleri, osmKimlikSorgusu } from './dogrula.mjs';
import {
  OverpassHatasi,
  overpassYeniden,
  SureBittiHatasi,
} from './overpass.mjs';

/** `yukle`'nin OSM okuma bütçesi (iş akışı 30 dk'da kesilir; Google detayı, yazma ve kontrol için pay kalır). */
export const YUKLE_OSM_BUTCE_MS = 15 * 60_000;

/** OSM okuması düştü; ileti tek satırdır ve plan hatasından ayrı görünür (KK3). */
export class OsmOkumaHatasi extends Error {
  constructor(mesaj) {
    super(mesaj);
    this.name = 'OsmOkumaHatasi';
  }
}

/** KK3: Overpass hatasının rapordaki tek satırı (ör. 'Overpass 504, 3 deneme'). */
export function overpassHataSatiri(e) {
  if (e instanceof SureBittiHatasi)
    return `Overpass süre bütçesi doldu, ${e.deneme} deneme`;
  return `Overpass ${e.durum ?? 'ağ hatası'}, ${e.deneme ?? 1} deneme`;
}

/**
 * OSM kimliği → konum. Bulunamayan kimlik haritada olmaz. KK2: `overpassYeniden` ile (429/502/503/504 ve ağ hatasında bekleyip
 * yeniden dener) ve `osm-esle`'deki gibi süre bütçesiyle; düşerse `OsmOkumaHatasi`. Seçenekler testte sahtedir.
 */
export async function osmKonumlariOku(
  idler,
  { fetchFn, bekle, simdi = Date.now, butceMs = YUKLE_OSM_BUTCE_MS } = {},
) {
  const harita = new Map();
  if (!idler.length) return harita;
  let veri;
  try {
    veri = await overpassYeniden(osmKimlikSorgusu(idler), {
      fetchFn,
      bekle,
      simdi,
      bitis: simdi() + butceMs,
    });
  } catch (e) {
    if (!(e instanceof OverpassHatasi) && !(e instanceof SureBittiHatasi))
      throw e;
    throw new OsmOkumaHatasi(
      `OSM konumları okunamadı (${overpassHataSatiri(e)}); Google'a gidilmedi, yüklenmedi`,
    );
  }
  for (const e of veri.elements ?? []) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (typeof lat === 'number' && typeof lng === 'number')
      harita.set(`${e.type}/${e.id}`, { lat, lng });
  }
  return harita;
}

/**
 * KK1: yüklemenin konumları. Önce OSM, sonra Google `detay` (`googleFn`, tek çağrı). `overpass`: osmKonumlariOku seçenekleri.
 */
export async function yuklemeKonumlari(plan, { googleFn, overpass = {} }) {
  const idler = detayIdleri(plan);
  const osmKonumlari = await osmKonumlariOku(osmIdleri(plan), overpass);
  const { yerler } = await googleFn({ islem: 'detay', idler });
  return { idler, osmKonumlari, yerler };
}
