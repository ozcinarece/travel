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

/** Puan + yorum satırının göründüğü yakınlık (Google zoom). #66 (docs/05 §2): 15 (sokak); #40'ta 14'tü. */
export const DETAY_ZOOM = 15;
/** #66 (docs/05 §2, kanvas KesfetZoom7): bu zoom'un altında öneri pini 20 px küçük pin, adsız. */
export const KUCUK_ZOOM = 13;
/** Pinin küçük (20 px, adsız) çizileceği durum: seçili ve öne çıkan (#69) olmayan öneri, zoom < 13. */
export function kucukPin(p: HaritaPini, zoom: number): boolean {
  return p.tur === 'oneri' && !p.secili && !p.oneCikan && zoom < KUCUK_ZOOM;
}
/** Zoom'a göre pinleri küçültür (`kucuk` işareti; ad ve puan düşer). Diğer türler olduğu gibi. */
export function zoomaGorePinler(pinler: HaritaPini[], zoom: number): HaritaPini[] {
  return pinler.map((p) => (kucukPin(p, zoom) ? { ...p, kucuk: true, ad: undefined, puan: null } : p));
}

/** "★ 4,8 · 312K" satırı: yalnız seçili pinde ya da zoom ≥ 14'te (#30, #40). Ad yoksa ya da puan yoksa yok. */
export function detayGoster(p: HaritaPini, zoom: number): boolean {
  if (!p.ad || p.puan === null || p.puan === undefined) return false;
  if (p.tur === 'aday' || p.tur === 'otel' || p.tur === 'etiket') return false;
  // #69: öne çıkan pinin altında ★ puan her zoom'da.
  return !!p.secili || !!p.oneCikan || zoom >= DETAY_ZOOM;
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
  // #69: öne çıkan önerinin adı sıradan öneriyi yener.
  if (p.tur === 'oneri') return p.oneCikan ? 35 : 30;
  return 20;
}

/**
 * Daire çapı (px) — PinIcerigi ile aynı sayılar. #59 §A2: 28 px; #65: seçili iğne 38 px baş (IGNE).
 * #61 §5: seçili gün dışındaki (soluk) durak pini numarasız küçük nokta, 20 px.
 */
export function pinCapi(p: HaritaPini): number {
  if (p.secili) return IGNE.en;
  if (p.kucuk) return KUCUK_PIN;
  if (p.tur === 'durak' && (p.opaklik ?? 1) < 1) return 20;
  return 28;
}
/**
 * #65 (docs/05 §2): seçili pin iğne (damla) biçimi 38 × 46 px; çapa iğnenin UCU (konum), gövde ucun üstünde; ad etiketi
 * ucun 4 px altında. Öneri / listede / tamamlandı PNG, numaralı durak görünüm.
 */
export const IGNE = { en: 38, boy: 46, etiketPayi: 4, halka: 3.25 } as const;
/** İğnenin görünen yüksekliği (yol + dış halkanın uçtan taşması). */
export const IGNE_GORUNEN_BOY = IGNE.boy + IGNE.halka;
/** #66: küçük öneri pini (zoom < 13): 20 px, 1,5 px kategori kenarı, 11 px glif, adsız. */
export const KUCUK_PIN = 20;
/** Pinin ekran kutusu (engel): daire konumun ortasında; seçili iğne konumun üstünde. */
export function pinKutusu(p: HaritaPini, cx: number, cy: number): { x1: number; y1: number; x2: number; y2: number } {
  if (p.secili && p.tur !== 'etiket' && p.tur !== 'konum' && p.tur !== 'aday') return { x1: cx - IGNE.en / 2, y1: cy - IGNE_GORUNEN_BOY, x2: cx + IGNE.en / 2, y2: cy };
  const r = (p.tur === 'otel' ? OTEL_KARE : p.tur === 'konum' ? KONUM_HALKA : pinCapi(p)) / 2;
  return { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r };
}
/** Ad etiketinin üst kenarı (px, konuma göre): daire altı + 2; seçili iğnede uç + 4. */
export function etiketUstu(p: HaritaPini): number {
  return p.secili ? IGNE.etiketPayi : pinCapi(p) / 2 + 2;
}
/** #59 §A2: otel karesi ve konum halkası (px) — PinIcerigi ile aynı. */
export const OTEL_KARE = 28;
export const KONUM_HALKA = 22;

/**
 * #59 §B: etiket çakışması yalnız yakınlığa bağlıdır (kaydırmada pinlerin piksel uzaklığı değişmez). Hesap, zoom'u
 * 0,25 adıma yuvarlanmış bölgeyle yapılır; saf kaydırma aynı bölgeyi döndürür → hiçbir işaretçi değişmez.
 */
export const ETIKET_ZOOM_ADIMI = 0.25;
export function etiketZoomu(zoom: number): number {
  return Math.round(zoom / ETIKET_ZOOM_ADIMI) * ETIKET_ZOOM_ADIMI;
}
export function etiketBolgesi(onceki: HaritaBolgesi | null, yeni: HaritaBolgesi): HaritaBolgesi {
  return onceki && etiketZoomu(onceki.zoom) === etiketZoomu(yeni.zoom) ? onceki : yeni;
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
  /** #55 §A6 / #71 KK5: ekranın üstünden bu kadar px (başlık, arama, çipler) içine düşen rota hapları VE ad etiketleri gizlenir. */
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
      return { ...pinKutusu(p, cx, cy), pin: p.id };
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
    const ust = cy + etiketUstu(p);
    const kutuYap = (detay: boolean): Kutu => {
      const en = Math.max(adEn, detay ? 11 : 0) * HARF_PX + 12;
      return { x1: cx - en / 2, y1: ust, x2: cx + en / 2, y2: ust + etiketYuksekligi(detay) };
    };
    const detayli = detayGoster(p, bolge.zoom);
    const tam = kutuYap(detayli);
    // #71 KK5: üst katmanın (arama + çipler + hap) altında kalan ad çizilmez (seçili pin dahil).
    if (tam.y1 + ekran.yukseklik / 2 < ustBosluk) {
      gizli.etiket.add(p.id);
      continue;
    }
    // #65: seçili iğnenin adı ucun hemen altında — komşu pin dairesine binse de gizlenmez (en üstte çizilir, pinZ 40).
    if (p.secili || !cakisiyor(tam, p.id)) {
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

/**
 * Pinlerin üst üste binme sırası (#59 §A3): konum > seçili > otel > seçili günün durakları (sıra no küçük üstte, #61 §5:
 * üst üste binen duraklarda görünen numara ve altındaki ad aynı pine ait olsun) > listede / diğer gün durağı > diğer > hap.
 */
export function pinZ(p: HaritaPini): number {
  if (p.tur === 'konum') return 50;
  if (p.secili) return 40;
  if (p.tur === 'otel') return 30;
  if (p.tur === 'durak' && (p.opaklik ?? 1) >= 1) {
    const sira = Number(p.etiket);
    return 29 - (Number.isFinite(sira) && sira > 0 ? Math.min(sira, 19) : 19);
  }
  if (p.tur === 'durak' || p.tur === 'listede') return 9;
  if (p.tur === 'etiket') return 0;
  return p.oneCikan ? 5 : 1;
}

/**
 * Görünümlü işaretçinin çapası: daire merkezi (etiket dairenin altında: daire + 2 px + etiket kutusu); seçili iğnede
 * ucu (iğne + 4 px + etiket kutusu).
 */
export function pinCapasi(p: HaritaPini, detay = false): { x: number; y: number } {
  if (p.secili) return { x: 0.5, y: IGNE_GORUNEN_BOY / (IGNE_GORUNEN_BOY + IGNE.etiketPayi + etiketYuksekligi(detay)) };
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

/**
 * #59 §B: Android bitmap izlemesi (tracksViewChanges) açık kalmalı mı? Görünüm imzası henüz yakalanmadıysa ya da pinin
 * beklediği PNG ikon (varsa) henüz yüklenmediyse. Yüklenme PNG anahtarına bağlıdır, imzaya değil: imza değişip PNG aynı
 * kalınca Image yeniden yüklenmez; yalnız 350 ms'lik yakalama turu çalışır.
 */
export function izlemeGerekli(imza: string, yakalanan: string | null, beklenenPng: string | null, yuklenenPng: string | null): boolean {
  return yakalanan !== imza || (beklenenPng !== null && yuklenenPng !== beklenenPng);
}

/**
 * #59 §B: işaretçinin görünümünü belirleyen her şey — değişince Android bitmap'i yeniden alınır (işaretçi yeniden
 * KURULMAZ; anahtar yalnız pin kimliğidir). Konum, opaklık ve z-sırası native özelliktir, imzaya girmez.
 */
export function isaretciImzasi(p: HaritaPini, etiketGizli: boolean, detay: boolean): string {
  return [p.tur ?? '', p.renk, p.etiket ?? '', p.ikon ?? '', p.kategoriRenk ?? '', p.etiketIkon ?? '', p.secili ? 1 : 0, p.kucuk ? 1 : 0, p.oneCikan ? 1 : 0, p.tamam ? 1 : 0, p.ad && !etiketGizli ? p.ad : '', detay ? 1 : 0, p.puan ?? '', p.yorumSayisi ?? ''].join('|');
}
