// #234 KK3: kova-temizle'nin saf yardımcıları (Deno ve Jest ortak). Silinecek yol yalnız kuyruk satırından kurulur:
// kova bilinen iki kovadan biri, klasör `{trip_id}/`; o önekle başlamayan ya da `..` taşıyan ad silinmez.

export const KOVALAR = ['sohbet', 'fisler'] as const;
export type Kova = (typeof KOVALAR)[number];
export type KuyrukSatiri = { kova: string; trip_id: string; dosyalar: string[] | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Kuyruk satırından kova ve önek; satır bozuksa null (o satıra dokunulmaz). */
export function onekKur(satir: Pick<KuyrukSatiri, 'kova' | 'trip_id'>): { kova: Kova; onek: string } | null {
  if (!(KOVALAR as readonly string[]).includes(satir.kova)) return null;
  if (typeof satir.trip_id !== 'string' || !UUID.test(satir.trip_id)) return null;
  return { kova: satir.kova as Kova, onek: `${satir.trip_id}/` };
}

/** Silinecek adlar: yalnız önekle başlayan, `..` taşımayan, boş olmayan adlar. */
export function silinecekler(onek: string, dosyalar: readonly unknown[] | null | undefined): string[] {
  return (dosyalar ?? []).filter(
    (ad): ad is string => typeof ad === 'string' && ad.length > onek.length && ad.startsWith(onek) && !ad.split('/').includes('..'),
  );
}

/** Storage remove çağrısı başına en çok `boyut` ad. */
export function parcala<T>(liste: readonly T[], boyut = 100): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < liste.length; i += boyut) parcalar.push(liste.slice(i, i + boyut));
  return parcalar;
}
