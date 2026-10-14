// #200 KK8: Keşfet önerilerinde listedeki mekanın "ikizi". Öneri kimlikle (place_id) süzülür; ama hazır geziden ya da adla
// eklenen mekanın kimliği adından çözülür ve Nearby'nin getirdiği aynı yerin kimliğinden farklı olabilir. Güvenlik ağı: listedeki
// bir mekana 60 m'den yakın VE adı benzer öneri de listede sayılır (gösterilmez). Ek Google isteği yok — adlar eldeki hafif yer
// verisinden.
import { mesafeM } from '@/components/harita/geo';

export const BENZER_YER_M = 60;

/** Ad karşılaştırmasında atılan genel ekler ("tarihi", "müzesi", belediye öneki…) — aksansız, küçük harf. */
const EKLER = new Set([
  'tarihi',
  'muze',
  'muzesi',
  'museum',
  'cami',
  'camii',
  'camisi',
  'kulliye',
  'kulliyesi',
  'park',
  'parki',
  'bahce',
  'bahcesi',
  'ev',
  'evi',
  'evleri',
  'saray',
  'sarayi',
  'carsi',
  'carsisi',
  'kopru',
  'koprusu',
  'meydan',
  'meydani',
  'buyuksehir',
  'belediye',
  'belediyesi',
  'ebb',
  've',
  'the',
  'of',
]);

const AKSAN: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', é: 'e', è: 'e', ä: 'a', ë: 'e' };

/** Küçük harf, aksansız, noktalamasız sözcükler; genel ekler atılır (hepsi ekse ekler kalır). */
export function adSozcukleri(ad: string): string[] {
  const temiz = ad
    .toLocaleLowerCase('tr')
    // Hermes'te String.normalize'a güvenmeden: Türkçe ve sık Latin aksanları tek tek.
    .replace(/[çğıöşüâîûéèäë]/g, (h) => AKSAN[h] ?? h)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const hepsi = temiz ? temiz.split(' ') : [];
  const anlamli = hepsi.filter((s) => !EKLER.has(s));
  return anlamli.length > 0 ? anlamli : hepsi;
}

/** İki ad benzer mi: (ekler atıldıktan sonra) biri öbürünü kapsar ya da sözcüklerin en az yarısı ortak. */
export function adBenzer(a: string, b: string): boolean {
  const x = new Set(adSozcukleri(a));
  const y = new Set(adSozcukleri(b));
  if (x.size === 0 || y.size === 0) return false;
  const ortak = [...x].filter((s) => y.has(s)).length;
  if (ortak === x.size || ortak === y.size) return true;
  return ortak / new Set([...x, ...y]).size >= 0.5;
}

/**
 * Listede sayılacak öneriler: kimliği listede olmayan ama listedeki bir mekana 60 m'den yakın ve adı benzer olanlar. Listedeki
 * mekanın adı bilinmiyorsa (hafif veri gelmediyse) yalnız kimlikle süzülür.
 */
export function listedekiBenzerler(oneriler: { place_id: string; lat: number; lng: number; ad: string }[], liste: { place_id: string; lat: number; lng: number; ad: string | null | undefined }[]): Set<string> {
  const kimlik = new Set(liste.map((m) => m.place_id));
  const adli = liste.filter((m): m is typeof m & { ad: string } => !!m.ad?.trim());
  const sonuc = new Set<string>();
  if (adli.length === 0) return sonuc;
  for (const o of oneriler) {
    if (kimlik.has(o.place_id) || !o.ad?.trim()) continue;
    if (adli.some((m) => mesafeM(m, o) < BENZER_YER_M && adBenzer(m.ad, o.ad))) sonuc.add(o.place_id);
  }
  return sonuc;
}
