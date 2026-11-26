// #532 (kanvas UX önerileri › `Sayfa_v7_Seyahat_GunBitti`): "Yakında, bugüne ekle" ve Plan'daki "Akşam için yakında". Saf
// kurallar; Google'a istek yok. Adaylar bizim içeriğimizden (il listesi #401, rehber yerleri) ve seyahatin listesinden (güne
// atanmamış yerler, önce onlar). Akşam (17:00 sonrası, `trips.tz`) doğa ve manzara çıkar; yemek, tatlı-kahve, çarşı, müze öne.
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import type { IlYeri } from '@/features/icerik/ilOnerileri';
import type { IlKategori } from '@/features/yonetim/ilOneri';
import { konumu, konumVar } from '@/lib/konum';
import { konaklamaMi } from '@/lib/pinIkonu';
import type { Durak, Mekan, Yer } from '@/lib/tipler';

/** KK2: son durağın bitişi bundan önceyse bölüm görünür (18:00). */
export const GUN_SONU_DK = 18 * 60;
/** KK2–KK3 ek (#532 yorum): bu saatten sonra akşam kuralı (17:00). */
export const AKSAM_DK = 17 * 60;
/** KK1: konum noktası kadraja yalnız bugünün en yakın durağına bu kadar yakınsa girer. */
export const KONUM_KADRAJ_M = 10_000;

/**
 * KK2 görünme koşulu (gezi modu): bugünün en az bir durağı var ve
 * bütün duraklar gezildi ya da atlandı, kalan (gezilmemiş) durak ≤ 1 ya da son durağın bitişi 18:00'den önce.
 */
export function yakindaGorunur(kartlar: { numara: number | null; gezildi: boolean; varisDk: number | null; dakika: number }[]): boolean {
  const etkin = kartlar.filter((k) => k.numara !== null);
  if (etkin.length === 0) return false;
  const kalan = etkin.filter((k) => !k.gezildi).length;
  if (kalan <= 1) return true;
  const son = etkin[etkin.length - 1];
  return son.varisDk !== null && son.varisDk + son.dakika < GUN_SONU_DK;
}

const AKSAM_DISI_IL: ReadonlySet<IlKategori> = new Set(['doga', 'manzara']);
const AKSAM_ONDE_IL: ReadonlySet<IlKategori> = new Set(['yemek', 'tatli_kahve', 'carsi', 'muze']);
/** İl kategorisi olmayan adaylar (liste, rehber) için Google tipinden aynı ayrım. */
const AKSAM_DISI_TIP = new Set([
  'park',
  'city_park',
  'national_park',
  'state_park',
  'hiking_area',
  'garden',
  'botanical_garden',
  'nature_preserve',
  'natural_feature',
  'beach',
  'lake',
  'scenic_spot',
  'observation_deck',
  'picnic_ground',
  'zoo',
]);
const AKSAM_ONDE_TIP = /restaurant|cafe|coffee|bakery|dessert|confectionery|ice_cream|tea_house|meal_|food|bar$|pub|market|shopping|store|bazaar|museum|art_gallery/;

function aksamSinifi(kategori: IlKategori | null, tip: string | null): 'disi' | 'onde' | 'notr' {
  if (kategori) return AKSAM_DISI_IL.has(kategori) ? 'disi' : AKSAM_ONDE_IL.has(kategori) ? 'onde' : 'notr';
  if (!tip) return 'notr';
  if (AKSAM_DISI_TIP.has(tip)) return 'disi';
  return AKSAM_ONDE_TIP.test(tip) ? 'onde' : 'notr';
}

export type YakinAday =
  | { kaynak: 'liste'; place_id: string; mekan: Mekan; tip: string | null; ilKategori: null; mesafeM: number | null }
  | {
      kaynak: 'icerik';
      place_id: string;
      /** Rehber yeri (`yerler.id`), `yer_eklendi` olayı için; il satırında null. */
      yerId: string | null;
      ad: string;
      tip: string | null;
      ilKategori: IlKategori | null;
      lat: number;
      lng: number;
      mesafeM: number | null;
    };

/**
 * Adaylar: seyahatin listesinde olup hiçbir güne atanmamış yerler (önce), sonra il listesi ve rehber yerleri (listede
 * olmayanlar, place_id'ye göre tekil). Her grupta `referans`a uzaklık sırası; akşamsa doğa/manzara çıkar, akşamlık olanlar öne.
 * `icerikSiniriM` içerik adaylarını referansa uzaklıkla sınırlar (liste adayları sınırsız: kullanıcı kendisi eklemiş).
 */
export function yakindaAdaylari(p: {
  mekanlar: Mekan[];
  duraklar: Pick<Durak, 'place_ref'>[];
  ilYerleri: IlYeri[];
  rehberYerleri: Yer[];
  referans: Konum | null;
  aksam: boolean;
  adet: number;
  icerikSiniriM?: number;
}): YakinAday[] {
  const uzaklik = (k: { lat: number | null; lng: number | null }) => (p.referans && konumVar(k) ? mesafeM(p.referans, { lat: k.lat!, lng: k.lng! }) : null);
  const atanan = new Set(p.duraklar.map((d) => d.place_ref));
  const listede = new Set(p.mekanlar.map((m) => m.place_id));

  const liste: YakinAday[] = p.mekanlar
    .filter((m) => !atanan.has(m.id) && konumVar(m) && !konaklamaMi(m.primary_type))
    .map((m) => ({ kaynak: 'liste', place_id: m.place_id, mekan: m, tip: m.primary_type, ilKategori: null, mesafeM: uzaklik(m) }));

  const gorulen = new Set<string>();
  const icerik: YakinAday[] = [];
  for (const y of p.ilYerleri) {
    if (!y.place_id || listede.has(y.place_id) || gorulen.has(y.place_id) || typeof y.lat !== 'number' || typeof y.lng !== 'number') continue;
    gorulen.add(y.place_id);
    icerik.push({ kaynak: 'icerik', place_id: y.place_id, yerId: null, ad: y.ad, tip: y.primary_type, ilKategori: y.kategori, lat: y.lat, lng: y.lng, mesafeM: uzaklik(y) });
  }
  for (const y of p.rehberYerleri) {
    if (!y.place_id || listede.has(y.place_id) || !Number.isFinite(y.lat) || !Number.isFinite(y.lng)) continue;
    if (gorulen.has(y.place_id)) {
      // Aynı yer il listesinde de var: olay için rehber kimliği taşınır, il kategorisi kalır.
      const i = icerik.findIndex((a) => a.place_id === y.place_id);
      if (i >= 0 && icerik[i].kaynak === 'icerik') icerik[i] = { ...icerik[i], yerId: y.id } as YakinAday;
      continue;
    }
    gorulen.add(y.place_id);
    icerik.push({ kaynak: 'icerik', place_id: y.place_id, yerId: y.id, ad: y.ad, tip: y.kategori, ilKategori: null, lat: y.lat, lng: y.lng, mesafeM: uzaklik(y) });
  }

  const sirala = (a: YakinAday, b: YakinAday) => {
    if (p.aksam) {
      const oa = aksamSinifi(a.ilKategori, a.tip) === 'onde' ? 0 : 1;
      const ob = aksamSinifi(b.ilKategori, b.tip) === 'onde' ? 0 : 1;
      if (oa !== ob) return oa - ob;
    }
    return (a.mesafeM ?? Infinity) - (b.mesafeM ?? Infinity);
  };
  const uygun = (a: YakinAday) => !p.aksam || aksamSinifi(a.ilKategori, a.tip) !== 'disi';
  const sinirli = (a: YakinAday) => p.icerikSiniriM === undefined || (a.mesafeM !== null && a.mesafeM <= p.icerikSiniriM);
  return [...liste.filter(uygun).sort(sirala), ...icerik.filter(uygun).filter(sinirli).sort(sirala)].slice(0, p.adet);
}

/**
 * KK1: üst haritanın kadrajı (gezi modu). Bugünün durakları ve öneri pinleri; konum yalnız bugünün en yakın durağına
 * ≤ 10 km ise. Boş gün: otel ve öneriler. Hiçbiri yoksa boş (çağıran şehir merkezini zoom 13 ile gösterir).
 */
export function geziKadraji(p: { duraklar: Konum[]; oneriler: Konum[]; otel: Konum | null; konum: Konum | null }): Konum[] {
  if (p.duraklar.length === 0) return [...(p.otel ? [p.otel] : []), ...p.oneriler];
  const noktalar = [...p.duraklar, ...p.oneriler];
  if (p.konum && Math.min(...p.duraklar.map((d) => mesafeM(p.konum!, d))) <= KONUM_KADRAJ_M) noktalar.push(p.konum);
  return noktalar;
}

/** Adayın konumu (harita pini ve uzaklık için). */
export function adayKonumu(a: YakinAday): Konum | null {
  return a.kaynak === 'liste' ? konumu(a.mekan) : { lat: a.lat, lng: a.lng };
}

/**
 * KK2: eklenen satır ✓ ile yerinde kalır. Eklenen aday listeye ya da güne girince yeni hesapta düşer; eklenirken görünen
 * sırası (`sira`) tutulur, kalan yerler yeni adaylarla dolar.
 */
export function eklenenleriSabitle<T extends { place_id: string }>(sabitler: ReadonlyMap<string, { aday: T; sira: number }>, yeni: T[], adet: number): T[] {
  const kalan = yeni.filter((a) => !sabitler.has(a.place_id));
  const sirada = new Map([...sabitler.values()].map((x) => [x.sira, x.aday]));
  const sonuc: T[] = [];
  for (let i = 0; i < adet; i++) {
    const a = sirada.get(i) ?? kalan.shift();
    if (a) sonuc.push(a);
  }
  return sonuc;
}
