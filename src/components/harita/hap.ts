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

/**
 * İşaretçi çapası: x = üçgenin hap içindeki oranı (üçgen noktanın üstünde kalır), y = 1 (görünümün altı = nokta merkezi;
 * görünüm altta HAP_NOKTA_BOSLUGU_PX boşluk taşır).
 */
export function hapCapasi(uc: number, hapGenisligi: number): { x: number; y: number } {
  return { x: hapGenisligi > 0 ? uc / hapGenisligi : 0.5, y: 1 };
}
