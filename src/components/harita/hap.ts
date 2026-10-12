// #91 B: diğer gün noktasının üstündeki gün hapı — yerleşim hesabı (saf; test edilir).
import type { HaritaBolgesi, Konum } from './tipler';

/** Hap ekran kenarına bu kadar yaklaşır (px). */
export const HAP_KENAR_PX = 8;
/** Üçgen hapın köşesine bu kadar yaklaşabilir (px; hap köşeleri yuvarlak). */
export const HAP_UC_PAYI_PX = 16;
/** Hap yüksekliği + üçgen + noktaya boşluk: hapın alt kenarı nokta merkezinin bu kadar üstünde (px). */
export const HAP_NOKTA_BOSLUGU_PX = 18;
export const HAP_YUKSEKLIK = 30;
export const HAP_UCGEN = 8;

/**
 * KK4: hap ekranın dışına taşmaz — noktanın ekran x'i kenara yakınsa hap içeri kayar, üçgen noktada kalır.
 * Dönüş: `sol` = hapın sol kenarı (px), `uc` = üçgenin hap içindeki x'i (sol kenardan).
 */
export function hapYerlesimi(noktaX: number, ekranGenisligi: number, hapGenisligi: number): { sol: number; uc: number } {
  const enSol = HAP_KENAR_PX;
  const enSag = Math.max(enSol, ekranGenisligi - HAP_KENAR_PX - hapGenisligi);
  const sol = Math.min(enSag, Math.max(enSol, noktaX - hapGenisligi / 2));
  const uc = Math.min(hapGenisligi - HAP_UC_PAYI_PX, Math.max(HAP_UC_PAYI_PX, noktaX - sol));
  return { sol, uc };
}

/** Noktanın ekran x'i (px) — bölge yalnız ölçek ve merkez verir. */
export function noktaEkranX(konum: Konum, bolge: HaritaBolgesi | null, ekranGenisligi: number): number {
  if (!bolge || bolge.lngDelta <= 0) return ekranGenisligi / 2;
  return ekranGenisligi / 2 + ((konum.lng - bolge.merkez.lng) * ekranGenisligi) / bolge.lngDelta;
}

/** Noktanın ekran y'si (px) — yalnız ölçek ve merkez (üstte pozitif y aşağı). */
export function noktaEkranY(konum: Konum, bolge: HaritaBolgesi | null, ekranYukseklik: number): number {
  if (!bolge || bolge.latDelta <= 0) return ekranYukseklik / 2;
  return ekranYukseklik / 2 - ((konum.lat - bolge.merkez.lat) * ekranYukseklik) / bolge.latDelta;
}

/**
 * #101 KK2: seçicinin yerleşimi — hapın ekran noktasının (x, y) üstünde; kenarda içeri kayar (hapYerlesimi ile aynı kural),
 * üçgen hapta kalır. Dönüş: `sol`, `ust` (görünümün üst kenarı) ve `uc`. Üstte yer yoksa (y küçük) hapın ALTINA iner.
 */
export function seciciYerlesimi(nokta: { x: number; y: number }, ekran: { genislik: number; yukseklik: number }, boyut: { genislik: number; yukseklik: number }, ustSinir = 0): { sol: number; ust: number; uc: number; altta: boolean } {
  const { sol, uc } = hapYerlesimi(nokta.x, ekran.genislik, boyut.genislik);
  const ustte = nokta.y - HAP_NOKTA_BOSLUGU_PX - boyut.yukseklik;
  if (ustte >= ustSinir) return { sol, ust: ustte, uc, altta: false };
  return { sol, ust: Math.min(ekran.yukseklik - boyut.yukseklik, nokta.y + HAP_NOKTA_BOSLUGU_PX), uc, altta: true };
}

/**
 * İşaretçi çapası: x = üçgenin hap içindeki oranı (üçgen noktanın üstünde kalır), y = 1 (görünümün altı = nokta merkezi;
 * görünüm altta HAP_NOKTA_BOSLUGU_PX boşluk taşır).
 */
export function hapCapasi(uc: number, hapGenisligi: number): { x: number; y: number } {
  return { x: hapGenisligi > 0 ? uc / hapGenisligi : 0.5, y: 1 };
}
