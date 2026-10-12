// #101 (kanvas LegMode17): bacağın ulaşım türü — saf yardımcılar (ekrandan bağımsız; test edilir).
import { bacakAnahtari, type BacakModlari } from './sorgular';

import type { BacakSecimi } from '@/schedule/tempo';

export type BacakCifti = { from: string; to: string };

/** Hap pin kimliği `bacak:rota:<gün>:<from>><to>[#n]` → çift; başka kimlikte null. */
export function hapCifti(pinId: string, gunId: string): BacakCifti | null {
  const on = `bacak:rota:${gunId}:`;
  if (!pinId.startsWith(on)) return null;
  const cift = pinId.slice(on.length).replace(/#\d+$/, '');
  const i = cift.indexOf('>');
  if (i <= 0 || i === cift.length - 1) return null;
  return { from: cift.slice(0, i), to: cift.slice(i + 1) };
}

/** Çizgi kimliğinden (`rota:<gün>:<from>><to>`) hap pin kimliği. */
export const hapPinId = (cizgiId: string) => `bacak:${cizgiId}`;

/** KK1: çiftin elle seçimi; yoksa otomatik (çift bozulmuşsa — araya durak girmiş — eski seçim gelmez). */
export function bacakSecimi(modlar: BacakModlari | undefined, cift: BacakCifti): BacakSecimi | 'otomatik' {
  return modlar?.get(bacakAnahtari(cift.from, cift.to)) ?? 'otomatik';
}

/** Seçici başlığı: "4 → 5 · SAZOVA → PORSUK KAFE" (otel: "O"; adlar büyük harf, kısaltılmış). */
export function seciciBasligi(bas: { no: number | 'O'; ad: string }, bit: { no: number | 'O'; ad: string }): string {
  const kisa = (ad: string) => {
    const buyuk = ad.trim().toLocaleUpperCase('tr');
    return buyuk.length > 14 ? `${buyuk.slice(0, 13)}…` : buyuk;
  };
  return `${bas.no} → ${bit.no} · ${kisa(bas.ad)} → ${kisa(bit.ad)}`;
}

export type SeciciSecenegi = { mod: BacakSecimi | 'toplu'; dk: number | null; kestirim: boolean; secili: boolean; pasif: boolean };

/**
 * Seçenekler ve süreleri: yürüme (matris/rota), araba (rota `drive_seconds`; yoksa kestirim ya da yükleniyor → null),
 * toplu taşıma (v1 "yakında", pasif). `etkin` = o an uygulanan mod (elle ya da otomatik).
 */
export function seciciSecenekleri(secenek: { yurumeSn: number | null; arabaSn: number | null; arabaKestirimSn: number; arabaYukleniyor: boolean; etkin: 'yuruyus' | 'taksi' }): SeciciSecenegi[] {
  const { yurumeSn, arabaSn, arabaKestirimSn, arabaYukleniyor, etkin } = secenek;
  const dk = (sn: number | null) => (sn === null ? null : Math.max(1, Math.round(sn / 60)));
  return [
    { mod: 'yurume', dk: dk(yurumeSn), kestirim: yurumeSn === null, secili: etkin === 'yuruyus', pasif: false },
    { mod: 'araba', dk: arabaSn !== null ? dk(arabaSn) : arabaYukleniyor ? null : dk(arabaKestirimSn), kestirim: arabaSn === null && !arabaYukleniyor, secili: etkin === 'taksi', pasif: false },
    { mod: 'toplu', dk: null, kestirim: false, secili: false, pasif: true },
  ];
}
