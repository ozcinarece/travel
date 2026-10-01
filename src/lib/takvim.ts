// Takvim yardımcıları: `YYYY-MM-DD` metinleri üzerinde, saat dilimsiz (UTC) gün aritmetiği.
// v1 yalnızca Türkçe; ay/gün adları burada (Intl'e bağımlı olmadan aynı sonuç her platformda).

export const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;
export const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;
/** Pazartesi'den başlar (Türkiye takvimi). */
export const GUNLER_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
export const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

export type Tarih = string; // YYYY-MM-DD

export function parcala(t: Tarih): { yil: number; ay: number; gun: number } {
  const [y, a, g] = t.split('-').map(Number);
  return { yil: y, ay: a, gun: g };
}

export function birlestir(yil: number, ay: number, gun: number): Tarih {
  return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
}

export function tarihEkle(t: Tarih, gun: number): Tarih {
  const { yil, ay, gun: g } = parcala(t);
  const d = new Date(Date.UTC(yil, ay - 1, g + gun));
  return birlestir(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 0 = Pazartesi … 6 = Pazar. */
export function haftaGunu(t: Tarih): number {
  const { yil, ay, gun } = parcala(t);
  return (new Date(Date.UTC(yil, ay - 1, gun)).getUTCDay() + 6) % 7;
}

export function ayinGunSayisi(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

/** Ay ızgarası: Pazartesi başlangıçlı, 7'nin katı hücre; ay dışı hücreler null. */
export function ayIzgarasi(yil: number, ay: number): (Tarih | null)[] {
  const ilk = birlestir(yil, ay, 1);
  const bosluk = haftaGunu(ilk);
  const hucreler: (Tarih | null)[] = Array.from({ length: bosluk }, () => null);
  for (let g = 1; g <= ayinGunSayisi(yil, ay); g++) hucreler.push(birlestir(yil, ay, g));
  while (hucreler.length % 7 !== 0) hucreler.push(null);
  return hucreler;
}

export function ayKaydir(yil: number, ay: number, adim: number): { yil: number; ay: number } {
  const d = new Date(Date.UTC(yil, ay - 1 + adim, 1));
  return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1 };
}

/** "12 Eki, Pzt" — 3.2 tarih kutuları. */
export function kisaTarih(t: Tarih): string {
  const { ay, gun } = parcala(t);
  return `${gun} ${AYLAR_KISA[ay - 1]}, ${GUNLER_KISA[haftaGunu(t)]}`;
}

/** "Ekim 2026" — takvim başlığı ve geçmiş kartları. */
export function ayYil(t: Tarih): string {
  const { yil, ay } = parcala(t);
  return `${AYLAR[ay - 1]} ${yil}`;
}

/**
 * Seyahat listesi tarih metni (3.1): aynı ay "12–15 Ekim", farklı ay "28 Eki – 2 Kas",
 * farklı yıl "30 Ara 2026 – 2 Oca 2027", tek gün "12 Ekim".
 */
export function tarihAraligi(start: Tarih, end: Tarih): string {
  const b = parcala(start);
  const s = parcala(end);
  if (start === end) return `${b.gun} ${AYLAR[b.ay - 1]}`;
  if (b.yil === s.yil && b.ay === s.ay) return `${b.gun}–${s.gun} ${AYLAR[b.ay - 1]}`;
  if (b.yil === s.yil) return `${b.gun} ${AYLAR_KISA[b.ay - 1]} – ${s.gun} ${AYLAR_KISA[s.ay - 1]}`;
  return `${b.gun} ${AYLAR_KISA[b.ay - 1]} ${b.yil} – ${s.gun} ${AYLAR_KISA[s.ay - 1]} ${s.yil}`;
}
