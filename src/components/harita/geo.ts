import type { HaritaBolgesi, Konum } from './tipler';

const DUNYA_YARICAPI_M = 6_371_000;
const ENLEM_DERECE_M = 111_320;

/** Haversine; metre. */
export function mesafeM(a: Konum, b: Konum): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * DUNYA_YARICAPI_M * Math.asin(Math.sqrt(h));
}

/** Enlem/boylam aralığından görünür bölge: kısa kenarın yarısı kadar yarıçap. */
export function bolgeHesapla(merkez: Konum, latDelta: number, lngDelta: number): HaritaBolgesi {
  const yukseklik = latDelta * ENLEM_DERECE_M;
  const genislik = lngDelta * ENLEM_DERECE_M * Math.cos((merkez.lat * Math.PI) / 180);
  return { merkez, yaricapM: Math.max(50, Math.min(yukseklik, genislik) / 2) };
}

/** Google zoom → enlem aralığı (yaklaşık): 360 / 2^zoom. */
export function zoomDelta(zoom: number) {
  return 360 / 2 ** zoom;
}

/**
 * #17: harita, son aramanın yapıldığı bölgeden belirgin uzaklaştı mı?
 * Merkez yarıçapın %30'undan fazla kaydıysa ya da ölçek %40'tan fazla değiştiyse evet.
 */
export function bolgedenUzaklasti(simdi: HaritaBolgesi, arama: HaritaBolgesi): boolean {
  if (mesafeM(simdi.merkez, arama.merkez) > arama.yaricapM * 0.3) return true;
  const oran = simdi.yaricapM / arama.yaricapM;
  return oran > 1.4 || oran < 1 / 1.4;
}
