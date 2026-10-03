import type { HaritaBolgesi, HaritaPini, Konum } from './tipler';

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
  return { merkez, yaricapM: Math.max(50, Math.min(yukseklik, genislik) / 2), latDelta, lngDelta };
}

// ---------------------------------------------------------------- #30 pin etiketleri

export const ETIKET_EN_FAZLA = 18;

/** Pin altı etiketi: ≤ 18 karakter, aşarsa "…". */
export function kisaAd(ad: string): string {
  const t = ad.trim();
  return t.length <= ETIKET_EN_FAZLA ? t : `${t.slice(0, ETIKET_EN_FAZLA - 1).trimEnd()}…`;
}

/** Çakışma önceliği: seçili > listede (durak/bos) > öneri. */
export function etiketOnceligi(p: HaritaPini): number {
  if (p.secili) return 3;
  if (p.tur === 'durak' || p.tur === 'bos') return 2;
  return 1;
}

/** Daire çapı (px) — PinIcerigi ile aynı sayılar. */
export function pinCapi(p: HaritaPini): number {
  if (p.secili) return 28;
  if (p.tur === 'oneri') return 18;
  return 22;
}

const ETIKET_YUKSEKLIK = 16;
const HARF_PX = 6.5;

/**
 * Hangi pinlerin etiketi gizlenmeli? Etiket kutuları ekran pikseline çevrilir (görünür bölge + ekran boyutu),
 * yüksek öncelikli olandan başlanır, önceden yerleşen bir kutuyla çakışan etiket gizlenir (kutu-çakışma; kümeleme v2).
 * Yakınlaşınca aralık büyür, gizlenenler kendiliğinden geri gelir.
 */
export function gizliEtiketler(pinler: HaritaPini[], bolge: HaritaBolgesi | null, ekran: { genislik: number; yukseklik: number }): Set<string> {
  const gizli = new Set<string>();
  if (!bolge || bolge.latDelta <= 0 || bolge.lngDelta <= 0) return gizli;
  const pxLat = ekran.yukseklik / bolge.latDelta;
  const pxLng = ekran.genislik / bolge.lngDelta;
  type Kutu = { x1: number; y1: number; x2: number; y2: number };
  const yerlesen: Kutu[] = [];
  const sirali = pinler
    .filter((p) => p.ad)
    .map((p) => ({ p, oncelik: etiketOnceligi(p) }))
    .sort((a, b) => b.oncelik - a.oncelik || a.p.id.localeCompare(b.p.id));
  for (const { p } of sirali) {
    const cx = (p.konum.lng - bolge.merkez.lng) * pxLng;
    const cy = -(p.konum.lat - bolge.merkez.lat) * pxLat;
    const en = Math.min(kisaAd(p.ad!).length, ETIKET_EN_FAZLA) * HARF_PX + 12;
    const ust = cy + pinCapi(p) / 2 + 2;
    const kutu: Kutu = { x1: cx - en / 2, y1: ust, x2: cx + en / 2, y2: ust + ETIKET_YUKSEKLIK };
    const cakisiyor = yerlesen.some((k) => kutu.x1 < k.x2 && kutu.x2 > k.x1 && kutu.y1 < k.y2 && kutu.y2 > k.y1);
    if (cakisiyor) gizli.add(p.id);
    else yerlesen.push(kutu);
  }
  return gizli;
}

/** İşaretçi çapası: daire merkezi, etiket dairenin altında (daire + 2 px + 16 px etiket). */
export function pinCapasi(p: HaritaPini): { x: number; y: number } {
  const d = pinCapi(p);
  return { x: 0.5, y: d / 2 / (d + 2 + ETIKET_YUKSEKLIK) };
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
