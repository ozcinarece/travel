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

/**
 * #51: Places 7/24 açık mekanı tek periyotla verir: `open {day 0, 00:00}`, `close` yok. Edge Function kapanışı olmayan
 * periyodu `kapaGun = gun, kapa = '24:00'` yazıyordu (önbellekte de böyle) — bu biçim her zaman açık demektir.
 */
export function hepAcikMi(periyotlar: Periyot[]): boolean {
  if (periyotlar.length !== 1) return false;
  const [p] = periyotlar;
  return p.kapaGun === p.gun && p.ac === '00:00' && p.kapa === '24:00';
}

/** Verilen hafta günü (0 = Pazar) için açık aralıklar, dakika cinsinden [başlangıç, bitiş). */
export function gununAraliklari(periyotlar: Periyot[], gun: number): [number, number][] {
  const sonuc: [number, number][] = [];
  for (const p of periyotlar) {
    const ac = dk(p.ac);
    const kapa = dk(p.kapa);
    // Aynı gün içinde kapanış açılıştan önceyse (ör. 18:00–02:00 ama kapanış günü yazılmamış) gece yarısını geçer.
    const geceGecer = p.kapaGun !== p.gun || kapa <= ac;
    const kapaGun = p.kapaGun !== p.gun ? p.kapaGun : geceGecer && kapa < 24 * 60 ? (p.gun + 1) % 7 : p.gun;
    if (p.gun === gun) sonuc.push([ac, kapaGun === gun ? kapa : 24 * 60]);
    if (kapaGun === gun && kapaGun !== p.gun) sonuc.push([0, kapa]); // önceki günden sarkan (gece) periyot
  }
  // Sıfır uzunluklu aralık (ör. ertesi gün 00:00 kapanış) açık sayılmaz.
  return sonuc.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
}

/**
 * `periyotlar` null/undefined → bilinmiyor; boş dizi → her zaman açık.
 * Varış aralık içindeyse açık; o gün aralık yoksa "bugün kapalı"; varış sonrası açılış varsa saatiyle "bu saatte kapalı".
 */
export function acilisDurumu(periyotlar: Periyot[] | null | undefined, gun: number, varisDk: number): AcilisDurumu {
  if (!periyotlar) return { durum: 'bilinmiyor' };
  if (periyotlar.length === 0 || hepAcikMi(periyotlar)) return { durum: 'acik' };
  const araliklar = gununAraliklari(periyotlar, gun);
  if (araliklar.length === 0) return { durum: 'kapali_gun' };
  if (araliklar.some(([a, b]) => varisDk >= a && varisDk < b)) return { durum: 'acik' };
  const sonraki = araliklar.find(([a]) => a > varisDk);
  const saat = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { durum: 'kapali_saat', sonrakiAcilis: sonraki ? saat(sonraki[0]) : null };
}

/** Tarihsiz seyahat (KK5): yalnız haftalık bilgi — kapalı günlerin kısa adları. */
export function kapaliGunler(periyotlar: Periyot[] | null | undefined): number[] {
  if (!periyotlar || periyotlar.length === 0 || hepAcikMi(periyotlar)) return [];
  return [0, 1, 2, 3, 4, 5, 6].filter((g) => gununAraliklari(periyotlar, g).length === 0);
}
