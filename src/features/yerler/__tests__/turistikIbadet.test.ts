import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// google.ts bir Deno modülü (`.ts` uzantılı içe aktarım, `Deno` global'i): uygulamanın tsc denetimine girmesin diye tipi
// burada yazılıp çalışma anında yüklenir.
type YakinYer = { ad: string; primary_type: string | null; puan: number | null; puan_sayisi: number | null };
type GoogleModulu = {
  CIP_TIPLERI: Record<string, string[]>;
  KONAKLAMA_TIPLERI: string[];
  IBADET_EN_AZ_YORUM: number;
  turistikDegeriVar: (d: { types?: string[]; primaryType?: string; userRatingCount?: number }) => boolean;
  yakinAra: (s: { merkez: { lat: number; lng: number }; yaricapM: number; tipler: string[]; enFazla?: number; haric?: string[]; ibadetSuzgeci?: boolean }) => Promise<YakinYer[]>;
};
const { CIP_TIPLERI, IBADET_EN_AZ_YORUM, KONAKLAMA_TIPLERI, turistikDegeriVar, yakinAra } = jest.requireActual<GoogleModulu>('../../../../supabase/functions/_shared/google');

// #178 KK3: Turistik çipinde mahalle camisi yok, tarihî ibadet yapıları kalır. Sabit cevaplar: Google Nearby Search (New)
// taklidi — `includedTypes` herhangi bir tiple eşleşir, `excludedPrimaryTypes` birincil tipi dışlar, sıra popülerlik (yorum
// sayısı). Kurşunlu Külliyesi ve Süleymaniye dışındaki ibadet yerleri temsilî kayıtlardır.
type GoogleYeri = { id: string; displayName: { text: string }; primaryType: string; types: string[]; rating: number; userRatingCount: number; location: { latitude: number; longitude: number } };

const IBADET = ['place_of_worship', 'point_of_interest', 'establishment'];
let sira = 0;
const yer = (ad: string, tipler: string[], yorum: number, puan = 4.6): GoogleYeri => ({
  id: `p${++sira}`,
  displayName: { text: ad },
  primaryType: tipler[0],
  types: tipler,
  rating: puan,
  userRatingCount: yorum,
  location: { latitude: 0, longitude: 0 },
});

const ESKISEHIR = { lat: 39.7767, lng: 30.5206 };
const ESKISEHIR_YERLERI: GoogleYeri[] = [
  yer('Kurşunlu Külliyesi', ['mosque', 'historical_landmark', 'tourist_attraction', ...IBADET], 6900, 4.8),
  yer('Odunpazarı Modern Müze', ['museum', 'art_gallery', 'tourist_attraction'], 21000),
  yer('Odunpazarı Evleri', ['historical_landmark', 'tourist_attraction'], 38000, 4.7),
  yer('Balmumu Heykeller Müzesi', ['museum', 'tourist_attraction'], 25000, 4.5),
  yer('Çağdaş Cam Sanatları Müzesi', ['museum'], 3500),
  yer('Mahalle Camii 1', ['mosque', ...IBADET], 2400, 4.9),
  yer('Mahalle Camii 2', ['mosque', ...IBADET], 900, 4.8),
  yer('Mahalle Camii 3', ['mosque', ...IBADET], 410, 4.8),
  yer('Mahalle Camii 4 (anıt tipli)', ['mosque', 'monument', ...IBADET], 650, 4.7),
  yer('Mahalle Kilisesi', ['church', ...IBADET], 120, 4.7),
];

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };
const ISTANBUL_YERLERI: GoogleYeri[] = [
  yer('Süleymaniye Camii', ['mosque', 'tourist_attraction', 'historical_landmark', ...IBADET], 70000, 4.8),
  yer('Topkapı Sarayı Müzesi', ['museum', 'historical_landmark', 'tourist_attraction'], 120000),
  yer('Yerebatan Sarnıcı', ['tourist_attraction', 'historical_landmark', 'museum'], 160000),
  yer('Galata Kulesi', ['observation_deck', 'tourist_attraction', 'historical_landmark'], 150000, 4.5),
  yer('Kilise (kültürel yapı)', ['church', 'cultural_landmark', ...IBADET], 600, 4.7),
  yer('Sinagog (müze tipli)', ['synagogue', 'museum', ...IBADET], 1200),
  yer('Mahalle Camii (manzara tipli)', ['mosque', 'observation_deck', ...IBADET], 300, 4.8),
  yer('Mahalle Camii (anıt tipli)', ['mosque', 'monument', ...IBADET], IBADET_EN_AZ_YORUM - 1, 4.7),
  yer('Mescit (anıt tipli)', ['monument', 'place_of_worship'], 150, 4.5),
  yer('Mahalle Camii A', ['mosque', ...IBADET], 5200, 4.9),
  yer('Mahalle Camii B', ['mosque', ...IBADET], 1800, 4.8),
  yer('Mahalle Camii C', ['mosque', ...IBADET], 700, 4.9),
];

/** Merkeze göre havuz seçen Google taklidi; her isteğin gövdesini ve alan maskesini kaydeder. */
function sahteGoogle() {
  const istekler: { govde: { includedTypes: string[]; excludedPrimaryTypes?: string[]; maxResultCount: number; locationRestriction: { circle: { center: { latitude: number } } } }; maske: string }[] = [];
  const fetchSahte = jest.fn(async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    const govde = JSON.parse(init.body);
    istekler.push({ govde, maske: init.headers['x-goog-fieldmask'] });
    const havuz = govde.locationRestriction.circle.center.latitude > 40 ? ISTANBUL_YERLERI : ESKISEHIR_YERLERI;
    const dahil = new Set<string>(govde.includedTypes);
    const haric = new Set<string>(govde.excludedPrimaryTypes ?? []);
    const places = havuz
      .filter((p) => p.types.some((t) => dahil.has(t)) && !haric.has(p.primaryType))
      .sort((a, b) => b.userRatingCount - a.userRatingCount)
      .slice(0, govde.maxResultCount);
    return { ok: true, status: 200, json: async () => ({ places }), text: async () => '' };
  });
  return { istekler, fetchSahte };
}

const g = globalThis as unknown as { fetch: unknown; Deno?: unknown };
const eskiFetch = g.fetch;
let google: ReturnType<typeof sahteGoogle>;
beforeEach(() => {
  google = sahteGoogle();
  g.fetch = google.fetchSahte;
  g.Deno = { env: { get: () => 'test-anahtari' } };
});
afterEach(() => {
  g.fetch = eskiFetch;
  delete g.Deno;
});

/** places-nearby'nin Turistik çipi isteği (index.ts ile aynı seçenekler). */
const turistik = (merkez: { lat: number; lng: number }) =>
  yakinAra({ merkez, yaricapM: 3000, tipler: CIP_TIPLERI.turistik, enFazla: 20, haric: KONAKLAMA_TIPLERI, ibadetSuzgeci: true });
const adlar = (yerler: { ad: string }[]) => yerler.map((y) => y.ad);

describe('#178 KK1: Turistik tip listesi', () => {
  it('ibadet tipleri çıktı; kalan 7 tip', () => {
    expect(CIP_TIPLERI.turistik).toEqual(['tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument', 'museum', 'art_gallery', 'observation_deck']);
  });

  it('ibadet kategorisi ve Tümü kümesi camileri hâlâ ister', () => {
    expect(CIP_TIPLERI.ibadet).toEqual(expect.arrayContaining(['mosque', 'church', 'synagogue']));
    expect(CIP_TIPLERI.hepsi).toEqual(expect.arrayContaining(['mosque', 'church', 'synagogue']));
  });
});

describe('#178 KK2: ibadet süzgeci', () => {
  it('turistik tip ya da ≥ 1.000 yorum; ibadet yeri olmayan olduğu gibi kalır', () => {
    expect(turistikDegeriVar({ types: ['mosque', 'place_of_worship'], userRatingCount: 50000 })).toBe(true);
    expect(turistikDegeriVar({ types: ['mosque', 'monument'], userRatingCount: 999 })).toBe(false);
    expect(turistikDegeriVar({ types: ['mosque', 'monument'], userRatingCount: 1000 })).toBe(true);
    expect(turistikDegeriVar({ types: ['church', 'cultural_landmark'], userRatingCount: 10 })).toBe(true);
    expect(turistikDegeriVar({ types: ['synagogue', 'historical_landmark'] })).toBe(true);
    expect(turistikDegeriVar({ types: ['mosque', 'tourist_attraction'] })).toBe(true);
    // place_of_worship da ibadet tipi; tip listesi yoksa birincil tip sayılır.
    expect(turistikDegeriVar({ types: ['monument', 'place_of_worship'], userRatingCount: 150 })).toBe(false);
    expect(turistikDegeriVar({ primaryType: 'mosque', userRatingCount: 20 })).toBe(false);
    expect(turistikDegeriVar({ types: ['monument'], userRatingCount: 3 })).toBe(true);
    expect(turistikDegeriVar({})).toBe(true);
  });
});

describe('#178 KK3: Eskişehir ve İstanbul merkezlerinde Turistik çipi', () => {
  it('taklit önceki sorunu üretiyor: eski listeyle mahalle camileri gelir', async () => {
    const eskiListe = [...CIP_TIPLERI.turistik, 'mosque', 'church', 'synagogue'];
    const yerler = await yakinAra({ merkez: ESKISEHIR, yaricapM: 3000, tipler: eskiListe, enFazla: 20, haric: KONAKLAMA_TIPLERI });
    expect(adlar(yerler)).toEqual(expect.arrayContaining(['Mahalle Camii 1', 'Mahalle Camii 2', 'Mahalle Camii 3', 'Mahalle Kilisesi']));
  });

  it('Eskişehir: Kurşunlu Külliyesi kalır, mahalle camisi ve kilisesi çıkmaz', async () => {
    const yerler = await turistik(ESKISEHIR);
    expect(adlar(yerler)).toEqual(['Odunpazarı Evleri', 'Balmumu Heykeller Müzesi', 'Odunpazarı Modern Müze', 'Kurşunlu Külliyesi', 'Çağdaş Cam Sanatları Müzesi']);
    expect(yerler.find((y) => y.ad === 'Kurşunlu Külliyesi')).toMatchObject({ primary_type: 'mosque', puan: 4.8, puan_sayisi: 6900 });
  });

  it('İstanbul: Süleymaniye, kültürel yapı tipli kilise ve 1.000+ yorumlu sinagog kalır; mahalle camileri çıkmaz', async () => {
    const yerler = await turistik(ISTANBUL);
    expect(adlar(yerler)).toEqual([
      'Yerebatan Sarnıcı',
      'Galata Kulesi',
      'Topkapı Sarayı Müzesi',
      'Süleymaniye Camii',
      'Sinagog (müze tipli)',
      'Kilise (kültürel yapı)',
    ]);
    expect(adlar(yerler).some((a) => a.startsWith('Mahalle') || a.startsWith('Mescit'))).toBe(false);
  });

  it('tek Google isteği; istek ibadet tipi içermez, maske tipleri ister', async () => {
    await turistik(ISTANBUL);
    expect(google.istekler).toHaveLength(1);
    const [istek] = google.istekler;
    expect(istek.govde.includedTypes).not.toEqual(expect.arrayContaining(['mosque']));
    expect(istek.govde.includedTypes.filter((t) => ['mosque', 'church', 'synagogue'].includes(t))).toEqual([]);
    expect(istek.maske.split(',')).toEqual(expect.arrayContaining(['places.types', 'places.userRatingCount']));
  });

  it('süzgeç yalnız Turistik çipinde: ibadet kategorisi mahalle camilerini göstermeye devam eder', async () => {
    const yerler = await yakinAra({ merkez: ISTANBUL, yaricapM: 3000, tipler: CIP_TIPLERI.ibadet, enFazla: 20, haric: KONAKLAMA_TIPLERI });
    expect(adlar(yerler)).toEqual(expect.arrayContaining(['Mahalle Camii A', 'Mahalle Camii B', 'Mahalle Camii C', 'Süleymaniye Camii']));
  });
});
