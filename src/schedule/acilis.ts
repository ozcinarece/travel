// PRD 3.7 KK5: varış saati o günün açılış saatleri dışındaysa uyarı. Kontrol seyahat dilimindedir (çağıran gün/saat verir).

export type Periyot = { gun: number; ac: string; kapaGun: number; kapa: string };

export type AcilisDurumu =
  | { durum: 'bilinmiyor' }
  | { durum: 'acik' }
  | { durum: 'kapali_gun' }
  | { durum: 'kapali_saat'; sonrakiAcilis: string | null };

function dk(hhmm: string) {
  const [s, d] = hhmm.split(':').map(Number);
  return s * 60 + d;
}

/** Verilen hafta günü (0 = Pazar) için açık aralıklar, dakika cinsinden [başlangıç, bitiş). */
export function gununAraliklari(periyotlar: Periyot[], gun: number): [number, number][] {
  const sonuc: [number, number][] = [];
  for (const p of periyotlar) {
    if (p.gun === gun) sonuc.push([dk(p.ac), p.kapaGun === gun ? dk(p.kapa) : 24 * 60]);
    else if (p.kapaGun === gun) sonuc.push([0, dk(p.kapa)]); // önceki günden sarkan (gece) periyot
  }
  return sonuc.sort((a, b) => a[0] - b[0]);
}

/**
 * `periyotlar` null/undefined → bilinmiyor; boş dizi → her zaman açık.
 * Varış aralık içindeyse açık; o gün aralık yoksa "bugün kapalı"; varış sonrası açılış varsa saatiyle "bu saatte kapalı".
 */
export function acilisDurumu(periyotlar: Periyot[] | null | undefined, gun: number, varisDk: number): AcilisDurumu {
  if (!periyotlar) return { durum: 'bilinmiyor' };
  if (periyotlar.length === 0) return { durum: 'acik' };
  const araliklar = gununAraliklari(periyotlar, gun);
  if (araliklar.length === 0) return { durum: 'kapali_gun' };
  if (araliklar.some(([a, b]) => varisDk >= a && varisDk < b)) return { durum: 'acik' };
  const sonraki = araliklar.find(([a]) => a > varisDk);
  const saat = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { durum: 'kapali_saat', sonrakiAcilis: sonraki ? saat(sonraki[0]) : null };
}

/** Tarihsiz seyahat (KK5): yalnız haftalık bilgi — kapalı günlerin kısa adları. */
export function kapaliGunler(periyotlar: Periyot[] | null | undefined): number[] {
  if (!periyotlar || periyotlar.length === 0) return [];
  return [0, 1, 2, 3, 4, 5, 6].filter((g) => gununAraliklari(periyotlar, g).length === 0);
}
