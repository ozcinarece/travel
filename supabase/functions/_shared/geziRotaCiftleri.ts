// #205 Parça 1: önerilen gezi gününün rota çiftleri. Gece temizliği 30 günü geçen Google konumunu boşaltır (lat/lng null);
// konumsuz durak rotaya girmez (Routes isteğine hiç konmaz) ve bacağı hesaplanmaz (istemcide "Yol süresi bilinmiyor", kanvas
// 24b-A; toplama katılmaz, `features/icerik/gezi.ts`).
// Google isteği artmaz: rota yine konumlu durakların tek listesiyle (aynı parça sınırıyla) istenir; konumsuz durağın iki
// yanındaki konumlu duraklar arasındaki bacak (listede ardışık değiller) kullanılmaz.

export type GeziDuraklari = { id: string; sira: number; lat: number | null; lng: number | null };
export type KonumluDurak = { id: string; sira: number; lat: number; lng: number };

const gecerli = (d: GeziDuraklari): d is KonumluDurak =>
  typeof d.lat === 'number' && typeof d.lng === 'number' && Number.isFinite(d.lat) && Number.isFinite(d.lng) && Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180;

/**
 * Sıralı duraklardan: `konumlu` (rotaya giren noktalar, sırayla) ve `ciftler` — listede ardışık iki durağın İKİSİ de konumluysa
 * çift; `bacak`, rota cevabında (konumlu listesinin bacakları) o çiftin sırası.
 */
export function geziRotaCiftleri(duraklar: GeziDuraklari[]): { konumlu: KonumluDurak[]; ciftler: { a: KonumluDurak; b: KonumluDurak; bacak: number }[] } {
  const sirali = [...duraklar].sort((x, y) => x.sira - y.sira);
  const konumlu = sirali.filter(gecerli);
  const ciftler: { a: KonumluDurak; b: KonumluDurak; bacak: number }[] = [];
  for (let i = 1; i < sirali.length; i++) {
    const a = sirali[i - 1];
    const b = sirali[i];
    if (!gecerli(a) || !gecerli(b)) continue;
    ciftler.push({ a, b, bacak: konumlu.indexOf(a) });
  }
  return { konumlu, ciftler };
}
