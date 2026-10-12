// stops.order_key: kesirli sıra anahtarı (metin, "C" sıralaması). Sürükle-bırak tek satır yazar (T7).
// Basamaklar 0-9a-z; iki anahtar arasına her zaman yeni bir anahtar sığar.

import { izEkle } from '@/lib/izler';

const BASAMAK = '0123456789abcdefghijklmnopqrstuvwxyz';

function deger(ch: string | undefined, varsayilan: number) {
  if (ch === undefined) return varsayilan;
  return BASAMAK.indexOf(ch);
}

/**
 * `a < sonuc < b` olacak bir anahtar. `a` yoksa baştan önce, `b` yoksa sondan sonra.
 * Eşit ya da ters sıralı girdi hatadır.
 */
export function arasindaAnahtar(a?: string, b?: string): string {
  // #120 KK4: eşit ya da ters sıralı komşu anahtarlar (eşzamanlı ekleme, eski veri) render'ı düşürmesin — `a`dan sonra
  // bir anahtar üretilir (sıra görsel olarak korunur; bir sonraki yazımda normalize olur). İz bırakılır.
  if (a !== undefined && b !== undefined && a >= b) {
    izEkle('sira', `komşu anahtarlar sıralı değil: ${a} >= ${b}`);
    b = undefined;
  }
  let sonuc = '';
  for (let i = 0; ; i++) {
    const alt = deger(a?.[i], 0);
    const ust = deger(b?.[i], BASAMAK.length);
    if (ust - alt > 1) {
      sonuc += BASAMAK[Math.floor((alt + ust) / 2)];
      return sonuc;
    }
    // Aralık yok: alt basamağı kopyala, üst sınırı serbest bırak (b'nin bu basamağından küçük kalır).
    sonuc += BASAMAK[alt];
    if (b !== undefined && b[i] !== undefined && ust - alt === 1) b = undefined;
  }
}

/** Listenin sonuna eklenecek anahtar. */
export function sonAnahtar(mevcut: string[]): string {
  const sirali = [...mevcut].sort();
  return arasindaAnahtar(sirali[sirali.length - 1], undefined);
}
