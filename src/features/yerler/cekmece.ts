// #98 B: Keşfet öneri çekmecesi — görünür alanda olup LİSTEDE OLMAYAN öneriler, puan sırası (saf; test edilir).
import type { HaritaBolgesi } from '@/components/harita/tipler';
import { pinKategorisi, type PinKategorisi } from '@/lib/pinIkonu';

import { oneriSirala, type HafifYer } from './api';

export type CekmeceCipi = 'bolge' | 'yemek' | 'kafe' | 'manzara' | 'rehber';
export const CEKMECE_CIPLERI: CekmeceCipi[] = ['bolge', 'yemek', 'kafe', 'manzara', 'rehber'];
const KATEGORI: Partial<Record<CekmeceCipi, PinKategorisi>> = { yemek: 'yemek', kafe: 'kafe', manzara: 'manzara' };

/**
 * KK2–3: görünür bölgedeki öneriler, havuzdakiler düşülür (az önce "+" ile eklenenler `tut` ile bir sonraki yenilemeye
 * kadar "Listede ✓" olarak kalır), puan × log(yorum) sırası. `cip` kategori süzgeci (bölge = hepsi).
 */
export function cekmeceListesi(oneriler: HafifYer[], havuz: Set<string>, bolge: HaritaBolgesi | null, tut: Set<string> = new Set(), cip: CekmeceCipi = 'bolge'): HafifYer[] {
  if (!bolge) return [];
  const gorunur = oneriler.filter((y) => Math.abs(y.lat - bolge.merkez.lat) <= bolge.latDelta / 2 && Math.abs(y.lng - bolge.merkez.lng) <= bolge.lngDelta / 2);
  const k = KATEGORI[cip];
  return oneriSirala(gorunur.filter((y) => (!havuz.has(y.place_id) || tut.has(y.place_id)) && (!k || pinKategorisi(y.primary_type) === k)));
}

/** KK1 küçük hal sayısı: listede olmayanlar (az önce eklenenler sayılmaz). */
export function cekmeceSayisi(liste: HafifYer[], havuz: Set<string>): number {
  return liste.filter((y) => !havuz.has(y.place_id)).length;
}
