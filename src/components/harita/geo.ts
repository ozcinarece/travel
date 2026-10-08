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

/**
 * #55 §A2 çakışma önceliği: seçili > seçili günün durakları (sıra no küçük önce) > listede (Keşfet) > diğer günler >
 * atanmamış > öneri > rota bacağı hapı. Seçili gün = tam opak durak pini.
 */
export function etiketOnceligi(p: HaritaPini): number {
  if (p.tur === 'etiket') return 0;
  if (p.secili) return 100;
  if (p.tur === 'durak') {
    if ((p.opaklik ?? 1) < 1) return 50;
    const sira = Number(p.etiket);
    return 80 - (Number.isFinite(sira) ? Math.min(sira, 99) * 0.1 : 9.9);
  }
  if (p.tur === 'listede') return 70;
  if (p.tur === 'otel') return 60;
  if (p.tur === 'bos') return 40;
  if (p.tur === 'oneri') return 30;
  return 20;
}

/** Daire çapı (px) — PinIcerigi ile aynı sayılar. #55 §A1: 32 px, seçili 38 px (siyah halka dairenin kenarıdır). */
export function pinCapi(p: HaritaPini): number {
  return p.secili ? 38 : 32;
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
export function gizliEtiketler(
  pinler: HaritaPini[],
  bolge: HaritaBolgesi | null,
  ekran: { genislik: number; yukseklik: number },
  /** #55 §A6: ekranın üstünden bu kadar px (başlık + gün seçici) içine düşen rota hapları gizlenir. */
  ustBosluk = 0,
): GizliEtiketler {
  const gizli: GizliEtiketler = { etiket: new Set(), detay: new Set() };
  if (!bolge || bolge.latDelta <= 0 || bolge.lngDelta <= 0) return gizli;
  const pxLat = ekran.yukseklik / bolge.latDelta;
  const pxLng = ekran.genislik / bolge.lngDelta;
  type Kutu = { x1: number; y1: number; x2: number; y2: number; pin?: string };
  // #55 §A2: pin daireleri de engeldir — bir etiket başka bir pinin dairesinin üstüne binemez.
  const yerlesen: Kutu[] = pinler
    .filter((p) => p.tur !== 'etiket')
    .map((p) => {
      const cx = (p.konum.lng - bolge.merkez.lng) * pxLng;
      const cy = -(p.konum.lat - bolge.merkez.lat) * pxLat;
      const r = (p.tur === 'otel' ? 34 : p.tur === 'konum' ? 22 : pinCapi(p)) / 2;
      return { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r, pin: p.id };
    });
  const cakisiyor = (kutu: Kutu, sahip?: string) => yerlesen.some((k) => k.pin !== sahip && kutu.x1 < k.x2 && kutu.x2 > k.x1 && kutu.y1 < k.y2 && kutu.y2 > k.y1);
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
      const basliktaKalir = kutu.y1 + ekran.yukseklik / 2 < ustBosluk;
      if (basliktaKalir || cakisiyor(kutu)) gizli.etiket.add(p.id);
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
    if (!cakisiyor(tam, p.id)) {
      yerlesen.push(tam);
      continue;
    }
    if (detayli) {
      const sade = kutuYap(false);
      if (!cakisiyor(sade, p.id)) {
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

/** Harita dolgusu (mapPadding, dp). Sabit nesne: hazır değilken prop hiç değişmez, native taraf çağrılmaz. */
export const SIFIR_DOLGU = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/**
 * #49: Android'de mapPadding, GoogleMap hazır olmadan değişirse native çöküş (NullPointerException) olur.
 * Harita hazır değilken ya da alt boşluk geçersizken hep aynı sıfır nesnesi döner.
 */
export function haritaDolgusu(hazir: boolean, altBosluk: number) {
  if (!hazir || !Number.isFinite(altBosluk) || altBosluk <= 0) return SIFIR_DOLGU;
  return { top: 0, right: 0, bottom: Math.round(altBosluk), left: 0 };
}

/**
 * #53 §5: noktaları görünür alana sığdıran kamera (merkez + Google zoom). `alan`: haritanın panel ve başlık dışında
 * kalan görünür kısmı (px). Web Mercator yaklaşımı; kenarlarda pay bırakılır, 11–16 arası sınırlanır.
 */
export function sigdir(noktalar: Konum[], alan: { genislik: number; yukseklik: number }, pay = 0.35): { konum: Konum; zoom: number } | null {
  if (noktalar.length === 0) return null;
  const latlar = noktalar.map((n) => n.lat);
  const lnglar = noktalar.map((n) => n.lng);
  const [g, k] = [Math.min(...latlar), Math.max(...latlar)];
  const [b, d] = [Math.min(...lnglar), Math.max(...lnglar)];
  const konum = { lat: (g + k) / 2, lng: (b + d) / 2 };
  if (noktalar.length === 1) return { konum, zoom: 15 };
  const cos = Math.cos((konum.lat * Math.PI) / 180);
  const zLng = d - b > 0 ? Math.log2((alan.genislik * 360) / ((d - b) * 256)) : 20;
  const zLat = k - g > 0 ? Math.log2((alan.yukseklik * 360 * cos) / ((k - g) * 256)) : 20;
  const zoom = Math.max(11, Math.min(16, Math.min(zLng, zLat) - pay));
  return { konum, zoom };
}

export type Kumeler = {
  /** Kümeye katılıp çizilmeyen pinler. */
  gizli: Set<string>;
  /** Küme başı → üye sayısı ("+N" rozeti). */
  rozet: Map<string, number>;
  /** Küme başı → kümenin tüm konumları (dokununca bunlara yakınlaşılır). */
  uyeler: Map<string, Konum[]>;
};

/**
 * #55 §A2: üst üste binen (aynı / çok yakın) pinler kümelenir — en öncelikli olan küme başıdır ve "+N" rozeti taşır,
 * diğerleri çizilmez. Rota hapları, konum ve otel kümelenmez. Yakınlaşınca daireler ayrılır, küme kendiliğinden dağılır.
 */
export function kumeHesapla(pinler: HaritaPini[], bolge: HaritaBolgesi | null, ekran: { genislik: number; yukseklik: number }): Kumeler {
  const sonuc: Kumeler = { gizli: new Set(), rozet: new Map(), uyeler: new Map() };
  if (!bolge || bolge.latDelta <= 0 || bolge.lngDelta <= 0) return sonuc;
  const pxLat = ekran.yukseklik / bolge.latDelta;
  const pxLng = ekran.genislik / bolge.lngDelta;
  const adaylar = pinler
    .filter((p) => p.tur !== 'etiket' && p.tur !== 'konum' && p.tur !== 'otel')
    .map((p) => ({ p, x: (p.konum.lng - bolge.merkez.lng) * pxLng, y: -(p.konum.lat - bolge.merkez.lat) * pxLat }))
    .sort((a, b) => etiketOnceligi(b.p) - etiketOnceligi(a.p) || a.p.id.localeCompare(b.p.id));
  const baslar: typeof adaylar = [];
  for (const a of adaylar) {
    const bas = baslar.find((b) => Math.hypot(a.x - b.x, a.y - b.y) < ((pinCapi(a.p) + pinCapi(b.p)) / 2) * 0.7);
    if (!bas) {
      baslar.push(a);
      continue;
    }
    sonuc.gizli.add(a.p.id);
    sonuc.rozet.set(bas.p.id, (sonuc.rozet.get(bas.p.id) ?? 0) + 1);
    sonuc.uyeler.set(bas.p.id, [...(sonuc.uyeler.get(bas.p.id) ?? [bas.p.konum]), a.p.konum]);
  }
  return sonuc;
}
