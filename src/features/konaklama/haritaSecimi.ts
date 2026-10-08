// #56: günün oteli alt sayfası → "Haritadan" (3.3 harita seçimi) köprüsü. Seçim veritabanına yazılmadan alt sayfaya
// döner; Kaydet'e kadar hiçbir şey yazılmaz.
import type { OtelSecimi } from '@/lib/tipler';

let bekleyen: ((secim: OtelSecimi) => void) | null = null;

export function haritadanSecimBekle(teslim: (secim: OtelSecimi) => void) {
  bekleyen = teslim;
}

/** 3.3 seçim modunda "Bunu kullan" → bekleyen alt sayfaya teslim (bekleyen yoksa false). */
export function haritaSeciminiTeslimEt(secim: OtelSecimi): boolean {
  const teslim = bekleyen;
  bekleyen = null;
  if (!teslim) return false;
  teslim(secim);
  return true;
}

export function haritaSeciminiBirak() {
  bekleyen = null;
}
