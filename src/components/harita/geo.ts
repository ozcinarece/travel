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
export function bolgeHesapla(merkez: Konum, latDelta: number, lngDelta: number, zoom?: number): HaritaBolgesi {
  const yukseklik = latDelta * ENLEM_DERECE_M;
  const genislik = lngDelta * ENLEM_DERECE_M * Math.cos((merkez.lat * Math.PI) / 180);
  return { merkez, yaricapM: Math.max(50, Math.min(yukseklik, genislik) / 2), latDelta, lngDelta, zoom: zoom ?? deltaZoom(latDelta) };
}

/** Enlem aralığı → yaklaşık Google zoom'u (zoomDelta'nın tersi). */
export function deltaZoom(latDelta: number): number {
  return latDelta > 0 ? Math.log2(360 / latDelta) : 20;
}

// ---------------------------------------------------------------- #30 puan satırı

/** Puan + yorum satırının göründüğü yakınlık (Google zoom). #40: 14 (mahalle ölçeği); önce 16'ydı. */
export const DETAY_ZOOM = 14;

/** "★ 4,8 · 312K" satırı: yalnız seçili pinde ya da zoom ≥ 14'te (#30, #40). Ad yoksa ya da puan yoksa yok. */
export function detayGoster(p: HaritaPini, zoom: number): boolean {
  if (!p.ad || p.puan === null || p.puan === undefined) return false;
  if (p.tur === 'aday' || p.tur === 'otel' || p.tur === 'etiket') return false;
  return !!p.secili || zoom >= DETAY_ZOOM;
}

// ---------------------------------------------------------------- #30 pin etiketleri

export const ETIKET_EN_FAZLA = 18;

/** Pin altı etiketi: ≤ 18 karakter, aşarsa "…". */
export function kisaAd(ad: string): string {
  const t = ad.trim();
  return t.length <= ETIKET_EN_FAZLA ? t : `${t.slice(0, ETIKET_EN_FAZLA - 1).trimEnd()}…`;
}

/** Çakışma önceliği: seçili > listede/atanmış (durak/listede/bos) > öneri > rota bacağı etiketi. */
export function etiketOnceligi(p: HaritaPini): number {
  if (p.tur === 'etiket') return 0;
  if (p.secili) return 3;
  if (p.tur === 'durak' || p.tur === 'listede' || p.tur === 'bos') return 2;
  return 1;
}

/** Daire çapı (px) — PinIcerigi ile aynı sayılar. Seçili: büyük daire + turuncu halka (#42 KK5), halka dahil. */
export function pinCapi(p: HaritaPini): number {
  if (p.secili) return 32;
  if (p.tur === 'oneri') return 18;
  return 22;
}

const ETIKET_YUKSEKLIK = 16;
/** İkinci satır (★ puan · yorum) ile etiket yüksekliği. */
const DETAY_YUKSEKLIK = 30;
const HARF_PX = 6.5;
/** Bacak etiketi hapı ("🚶 12 dk"): yükseklik ve karakter genişliği. */
const HAP_YUKSEKLIK = 22;
const HAP_HARF_PX = 7;

export function etiketYuksekligi(detay: boolean): number {
  return detay ? DETAY_YUKSEKLIK : ETIKET_YUKSEKLIK;
}

export type GizliEtiketler = {
  /** Etiketi (ad + puan) tamamen gizlenen pinler; `etiket` türünde hapın kendisi. */
  etiket: Set<string>;
  /** #40: yalnız puan satırı gizlenen pinler (ad kalır). */
  detay: Set<string>;
};

/**
 * Hangi pinlerin etiketi gizlenmeli? Etiket kutuları ekran pikseline çevrilir (görünür bölge + ekran boyutu),
 * yüksek öncelikli olandan başlanır, önceden yerleşen bir kutuyla çakışan etiket gizlenir (kutu-çakışma; kümeleme v2).
 * Yakınlaşınca aralık büyür, gizlenenler kendiliğinden geri gelir. Zoom ≥ 14'te (ya da seçili pinde) kutu iki satırdır
 * (ad + ★ puan · yorum); çakışırsa #40 gereği önce puan satırı düşer (tek satır dener), hâlâ çakışıyorsa ad da gizlenir.
 * `etiket` türü pinler (rota bacağı hapları) en düşük önceliklidir ve hapın kendisi kutudur.
 */
export function gizliEtiketler(pinler: HaritaPini[], bolge: HaritaBolgesi | null, ekran: { genislik: number; yukseklik: number }): GizliEtiketler {
  const gizli: GizliEtiketler = { etiket: new Set(), detay: new Set() };
  if (!bolge || bolge.latDelta <= 0 || bolge.lngDelta <= 0) return gizli;
  const pxLat = ekran.yukseklik / bolge.latDelta;
  const pxLng = ekran.genislik / bolge.lngDelta;
  type Kutu = { x1: number; y1: number; x2: number; y2: number };
  const yerlesen: Kutu[] = [];
  const cakisiyor = (kutu: Kutu) => yerlesen.some((k) => kutu.x1 < k.x2 && kutu.x2 > k.x1 && kutu.y1 < k.y2 && kutu.y2 > k.y1);
  const sirali = pinler
    .filter((p) => (p.tur === 'etiket' ? !!p.etiket : !!p.ad))
    .map((p) => ({ p, oncelik: etiketOnceligi(p) }))
    .sort((a, b) => b.oncelik - a.oncelik || a.p.id.localeCompare(b.p.id));
  for (const { p } of sirali) {
    const cx = (p.konum.lng - bolge.merkez.lng) * pxLng;
    const cy = -(p.konum.lat - bolge.merkez.lat) * pxLat;
    if (p.tur === 'etiket') {
      const en = (p.etiket?.length ?? 0) * HAP_HARF_PX + 16;
      const kutu: Kutu = { x1: cx - en / 2, y1: cy - HAP_YUKSEKLIK / 2, x2: cx + en / 2, y2: cy + HAP_YUKSEKLIK / 2 };
      if (cakisiyor(kutu)) gizli.etiket.add(p.id);
      else yerlesen.push(kutu);
      continue;
    }
    const adEn = Math.min(kisaAd(p.ad!).length, ETIKET_EN_FAZLA);
    const ust = cy + pinCapi(p) / 2 + 2;
    const kutuYap = (detay: boolean): Kutu => {
      const en = Math.max(adEn, detay ? 11 : 0) * HARF_PX + 12;
      return { x1: cx - en / 2, y1: ust, x2: cx + en / 2, y2: ust + etiketYuksekligi(detay) };
    };
    const detayli = detayGoster(p, bolge.zoom);
    const tam = kutuYap(detayli);
    if (!cakisiyor(tam)) {
      yerlesen.push(tam);
      continue;
    }
    if (detayli) {
      const sade = kutuYap(false);
      if (!cakisiyor(sade)) {
        gizli.detay.add(p.id);
        yerlesen.push(sade);
        continue;
      }
    }
    gizli.etiket.add(p.id);
  }
  return gizli;
}

/** İşaretçi çapası: daire merkezi, etiket dairenin altında (daire + 2 px + etiket kutusu). */
export function pinCapasi(p: HaritaPini, detay = false): { x: number; y: number } {
  const d = pinCapi(p);
  return { x: 0.5, y: d / 2 / (d + 2 + etiketYuksekligi(detay)) };
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
