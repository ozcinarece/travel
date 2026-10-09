// #66: Keşfet karo (tile) bazlı birikimli yükleme — saf hesaplar. Görünür alan zoom adımına bağlı sabit bir ızgaraya
// bölünür; her karo için bir Nearby Search (20 sonuç). Önbellek anahtarı = çip + karo; bir kez gelen mekan oturum
// boyunca çipin birikimli listesinde kalır (hiçbir şey silinmez). Önbellek ve birikim modül belleğindedir (oturum boyu).
import type { HaritaBolgesi, Konum } from '@/components/harita/tipler';

import { oneriSirala, type HafifYer, type OneriCipi } from './api';

const ENLEM_DERECE_M = 111_320;
/** Karo ızgarasının zoom adımı aralığı; dışında en yakın adım kullanılır. */
export const KARO_ZOOM_EN_AZ = 11;
export const KARO_ZOOM_EN_COK = 17;
/** Bir görünümde (bir kaydırma / yakınlaştırma sonunda) istenecek en çok yeni karo; fazlası sıradaki kaydırmaya kalır. */
export const KARO_EN_FAZLA_ISTEK = 12;
/** Kaydırma / yakınlaştırma bittikten sonra karo isteğine kadar bekleme. */
export const KARO_GECIKME_MS = 400;

export type Karo = { anahtar: string; z: number; ix: number; iy: number; merkez: Konum; yaricapM: number };

/** Bölgenin karo zoom adımı (tam sayı, 11–17; aşağı yuvarlanır → ara zoom'da büyük karo, görünüm 8–15 karo kalır). */
export function karoZoomu(zoom: number): number {
  return Math.max(KARO_ZOOM_EN_AZ, Math.min(KARO_ZOOM_EN_COK, Math.floor(zoom)));
}

/**
 * Karo kenarı (metre): zoom 12'de 2,5 km, 14'te 625 m, 16'da ~156 m (her adımda yarıya iner). Ölçek, telefon ekranında
 * (400 × 800 px) bir görünümün ≈ 3 × 4 karo olmasına göre seçildi (uygulamanın zoom'u görünür enlem aralığından türer,
 * geo.deltaZoom).
 */
export function karoKenariM(z: number): number {
  return 2500 * 2 ** (12 - z);
}

/** Karo kenarı derece cinsinden (enlem ve boylam için aynı; boylam karosu metrede cos(enlem) kadar dardır). */
export function karoKenariDerece(z: number): number {
  return karoKenariM(z) / ENLEM_DERECE_M;
}

/** Karo (z, ix, iy) → anahtar, merkez ve karoyu örten arama yarıçapı. */
export function karoYap(z: number, ix: number, iy: number): Karo {
  const d = karoKenariDerece(z);
  const merkez = { lat: (iy + 0.5) * d, lng: (ix + 0.5) * d };
  const kenarM = karoKenariM(z);
  const genislikM = kenarM * Math.cos((merkez.lat * Math.PI) / 180);
  // Yarım köşegen: karo dairenin içinde kalır (komşu karolarla bindirme kabul).
  const yaricapM = Math.ceil(Math.hypot(kenarM / 2, genislikM / 2));
  return { anahtar: `${z}:${ix}:${iy}`, z, ix, iy, merkez, yaricapM };
}

/**
 * Görünür alanı örten karolar, merkeze yakınlık sırasıyla (istek sınırı uygulanınca ortadakiler önce gelir).
 * Alan haritanın görünen enlem/boylam aralığıdır; en fazla 400 karo (güvenlik).
 */
export function gorunurKarolar(bolge: HaritaBolgesi): Karo[] {
  const z = karoZoomu(bolge.zoom);
  const d = karoKenariDerece(z);
  const { merkez, latDelta, lngDelta } = bolge;
  const ix1 = Math.floor((merkez.lng - lngDelta / 2) / d);
  const ix2 = Math.floor((merkez.lng + lngDelta / 2) / d);
  const iy1 = Math.floor((merkez.lat - latDelta / 2) / d);
  const iy2 = Math.floor((merkez.lat + latDelta / 2) / d);
  const karolar: Karo[] = [];
  for (let iy = iy1; iy <= iy2; iy++) {
    for (let ix = ix1; ix <= ix2; ix++) {
      karolar.push(karoYap(z, ix, iy));
      if (karolar.length >= 400) break;
    }
  }
  const uzaklik = (k: Karo) => Math.hypot(k.merkez.lat - merkez.lat, (k.merkez.lng - merkez.lng) * Math.cos((merkez.lat * Math.PI) / 180));
  return karolar.sort((a, b) => uzaklik(a) - uzaklik(b) || a.anahtar.localeCompare(b.anahtar));
}

/** Çip + karo → önbellek anahtarı. */
export function karoOnbellekAnahtari(cip: OneriCipi, karo: Karo): string {
  return `${cip}|${karo.anahtar}`;
}

/** Bu görünümde istenecek karolar: önbellekte / yolda olmayanlar, merkeze yakınlık sırasıyla, en fazla 12. */
export function istenecekKarolar(bolge: HaritaBolgesi, cip: OneriCipi, bilinen: (anahtar: string) => boolean, enFazla = KARO_EN_FAZLA_ISTEK): Karo[] {
  return gorunurKarolar(bolge)
    .filter((k) => !bilinen(karoOnbellekAnahtari(cip, k)))
    .slice(0, enFazla);
}

/** Birikimli listeye ekler: yeni place_id eklenir, bilinen güncellenir (puan tazelenir), hiçbir şey silinmez. */
export function birikimeEkle(birikim: Map<string, HafifYer>, yerler: HafifYer[]): number {
  let yeni = 0;
  for (const y of yerler) {
    if (!y.place_id) continue;
    if (!birikim.has(y.place_id)) yeni += 1;
    birikim.set(y.place_id, y);
  }
  return yeni;
}

/** Birikimli liste, popülerlik sırasıyla (oneriSirala). */
export function birikimListesi(birikim: Map<string, HafifYer> | undefined): HafifYer[] {
  return birikim ? oneriSirala([...birikim.values()]) : [];
}

/**
 * #66 KK6: çizilecek öneri pini sayısı sınırı. Aşılırsa görünür alan dışındakiler çizilmez (listede kalırlar);
 * görünür alanda bile sınır aşılırsa popülerlik sırasıyla ilk `sinir` kalır.
 */
export const PIN_SINIRI = 250;
export function gorunurOneriler<T extends Konum | { lat: number; lng: number }>(yerler: T[], bolge: HaritaBolgesi | null, sinir = PIN_SINIRI): T[] {
  if (yerler.length <= sinir) return yerler;
  if (!bolge) return yerler.slice(0, sinir);
  const icinde = (y: T) => Math.abs(y.lat - bolge.merkez.lat) <= bolge.latDelta / 2 && Math.abs(y.lng - bolge.merkez.lng) <= bolge.lngDelta / 2;
  return yerler.filter(icinde).slice(0, sinir);
}
