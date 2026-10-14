import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { bilinenKategori, kategoriEtiketi } from '@/lib/kategori';

// google.ts bir Deno modülü: tipi burada yazılıp çalışma anında yüklenir (turistikIbadet.test.ts ile aynı yol).
type YakinYer = { place_id: string; ad: string; primary_type: string | null; puan: number | null; puan_sayisi: number | null; tipler: string[] };
type Esikler = Record<'turistik' | 'yemek' | 'kafe' | 'park' | 'alisveris', { yorum: number; puan: number }>;
type GoogleModulu = {
  CIP_TIPLERI: Record<string, string[]>;
  KONAKLAMA_TIPLERI: string[];
  VARSAYILAN_ESIKLER: Esikler;
  esikleriCoz: (deger: unknown) => Esikler;
  kesfetSuzgeci: (yerler: YakinYer[], cip: string, esikler: Esikler, gizli: ReadonlySet<string>) => YakinYer[];
  hafifYer: (y: YakinYer) => Omit<YakinYer, 'tipler'>;
  yakinAra: (s: { merkez: { lat: number; lng: number }; yaricapM: number; tipler: string[]; enFazla?: number; haric?: string[]; ibadetSuzgeci?: boolean }) => Promise<YakinYer[]>;
};
const { CIP_TIPLERI, KONAKLAMA_TIPLERI, VARSAYILAN_ESIKLER, esikleriCoz, hafifYer, kesfetSuzgeci, yakinAra } = jest.requireActual<GoogleModulu>('../../../../supabase/functions/_shared/google');

// #189 KK6: sabit cevaplar. Düzce, Keşfet · Turistik (14 Ekim) örneğinden: kuaför ve teknoloji mağazası tiplerine `museum` eklemiş,
// biri birincil tipi `museum` yapmış ama birkaç yorumlu. Nearby taklidi `includedTypes`'ı `types` listesinin herhangi birinde arar.
type GoogleYeri = { id: string; displayName: { text: string }; primaryType: string; types: string[]; rating: number; userRatingCount: number; location: { latitude: number; longitude: number } };
let sira = 0;
const yer = (ad: string, birincil: string, tipler: string[], yorum: number, puan: number): GoogleYeri => ({
  id: `ChIJ-duzce-${String(++sira).padStart(3, '0')}`,
  displayName: { text: ad },
  primaryType: birincil,
  types: [birincil, ...tipler, 'point_of_interest', 'establishment'],
  rating: puan,
  userRatingCount: yorum,
  location: { latitude: 40.84, longitude: 31.16 },
});
const IBADET = ['place_of_worship'];
const DUZCE: GoogleYeri[] = [
  yer('Aslisen Erkek Kuaforu', 'hair_salon', ['museum'], 3, 1.0),
  yer('Düzce Keskin Teknoloji', 'electronics_store', ['museum', 'store'], 4, 5.0),
  yer('Müze tipli dükkân', 'museum', [], 4, 5.0),
  yer('Kafkas Anıt Rölyef', 'cultural_landmark', ['tourist_attraction'], 120, 4.6),
  yer('Düzce Müzesi', 'museum', ['tourist_attraction'], 820, 4.5),
  yer('Tarihî Hamam', 'historical_landmark', ['tourist_attraction'], 310, 4.4),
  yer('Tarihî Cami', 'mosque', ['historical_landmark', 'tourist_attraction', ...IBADET], 1500, 4.8),
  yer('Az yorumlu anıt', 'monument', [], 12, 4.9),
  yer('Düşük puanlı müze', 'museum', ['tourist_attraction'], 400, 3.2),
  yer('Mahalle Camii', 'mosque', ['monument', ...IBADET], 900, 4.9),
  yer('Lokanta', 'turkish_restaurant', ['restaurant', 'food'], 150, 4.4),
  yer('Az yorumlu kebapçı', 'kebab_shop', ['restaurant', 'food'], 10, 4.9),
  yer('Düşük puanlı restoran', 'restaurant', ['food'], 500, 3.5),
  yer('Oto tamir (restoran tipli)', 'car_repair', ['restaurant'], 200, 4.8),
  yer('Şehir Parkı', 'park', [], 25, 3.0),
  yer('Küçük park', 'park', [], 5, 4.9),
  yer('Pastane', 'bakery', ['cafe', 'food'], 60, 4.2),
];

function sahteGoogle() {
  const istekler: { includedTypes: string[] }[] = [];
  const fetchSahte = jest.fn(async (_url: string, init: { body: string }) => {
    const govde = JSON.parse(init.body);
    istekler.push(govde);
    const dahil = new Set<string>(govde.includedTypes);
    const haric = new Set<string>(govde.excludedPrimaryTypes ?? []);
    const places = DUZCE.filter((p) => p.types.some((t) => dahil.has(t)) && !haric.has(p.primaryType))
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

const DUZCE_MERKEZ = { lat: 40.84, lng: 31.16 };
/** places-nearby ile aynı yol: Nearby (ham, tipleriyle) → süzgeç (önbellekten sonra) → istemci biçimi. */
async function kesfet(cip: string, gizli: string[] = [], esikler = VARSAYILAN_ESIKLER) {
  const ham = await yakinAra({ merkez: DUZCE_MERKEZ, yaricapM: 3000, tipler: CIP_TIPLERI[cip], enFazla: 20, haric: cip === 'otel' ? undefined : KONAKLAMA_TIPLERI, ibadetSuzgeci: cip === 'turistik' });
  return kesfetSuzgeci(ham, cip, esikler, new Set(gizli)).map(hafifYer);
}
const adlar = (yerler: { ad: string }[]) => yerler.map((y) => y.ad);

describe('#189 KK1 + KK2: Düzce · Turistik', () => {
  it('kuaför ve teknoloji mağazası (yalnız types listesinde müze) düşer; az yorumlu ya da düşük puanlı yer düşer; tarihî yapılar ve gerçek müze kalır', async () => {
    const sonuc = await kesfet('turistik');
    expect(adlar(sonuc)).toEqual(['Tarihî Cami', 'Düzce Müzesi', 'Tarihî Hamam', 'Kafkas Anıt Rölyef']);
    // Ek Google isteği yok: tek Nearby.
    expect(google.fetchSahte).toHaveBeenCalledTimes(1);
    // Cevapta tip listesi yok (istemci biçimi değişmedi).
    expect(sonuc.every((y) => !('tipler' in y))).toBe(true);
  });

  it('istisna (#178 mantığı): birincil tipi turistik olmayan ama tourist_attraction / historical_landmark taşıyan yer kalır; mahalle camisi kalmaz', async () => {
    const sonuc = adlar(await kesfet('turistik'));
    expect(sonuc).toContain('Tarihî Cami');
    expect(sonuc).not.toContain('Mahalle Camii');
  });

  it('Yemek: birincil tip restoran ailesinden ve ≥ 30 yorum, ≥ 3,8 puan', async () => {
    expect(adlar(await kesfet('yemek'))).toEqual(['Lokanta']);
  });

  it('Park: ≥ 20 yorum, puan şartı yok', async () => {
    expect(adlar(await kesfet('park'))).toEqual(['Şehir Parkı']);
  });

  it('Tümü: her yer kendi grubunun eşiğiyle; grubu olmayan (kuaför, oto tamir, mahalle camisi) düşer', async () => {
    expect(adlar(await kesfet('hepsi')).sort()).toEqual(['Düzce Müzesi', 'Kafkas Anıt Rölyef', 'Lokanta', 'Pastane', 'Tarihî Cami', 'Tarihî Hamam', 'Şehir Parkı'].sort());
  });

  it('eşikler ayardan: Turistik yorum sınırı 1000 olunca yalnız Tarihî Cami kalır; 0/0 olunca yalnız birincil tip şartı kalır', async () => {
    const siki = esikleriCoz({ turistik: { yorum: 1000, puan: 3.8 } });
    expect(adlar(await kesfet('turistik', [], siki))).toEqual(['Tarihî Cami']);
    const gevsek = esikleriCoz({ turistik: { yorum: 0, puan: 0 } });
    expect(adlar(await kesfet('turistik', [], gevsek))).toEqual(['Tarihî Cami', 'Düzce Müzesi', 'Düşük puanlı müze', 'Tarihî Hamam', 'Kafkas Anıt Rölyef', 'Az yorumlu anıt', 'Müze tipli dükkân']);
  });
});

describe('#189 KK5: gizleme listesi', () => {
  it('gizlenen place_id cevaptan çıkar (her çipte, otel dahil)', async () => {
    const muze = DUZCE.find((p) => p.displayName.text === 'Düzce Müzesi')!.id;
    expect(adlar(await kesfet('turistik', [muze]))).not.toContain('Düzce Müzesi');
    expect(adlar(await kesfet('hepsi', [muze]))).not.toContain('Düzce Müzesi');
    const ham = [{ place_id: muze, ad: 'Düzce Müzesi', primary_type: 'museum', puan: 1, puan_sayisi: 1, tipler: [] }];
    expect(kesfetSuzgeci(ham, 'otel', VARSAYILAN_ESIKLER, new Set([muze]))).toEqual([]);
  });

  it('otel ve ibadet çiplerinde kalite süzgeci yok (yalnız gizleme)', () => {
    const ham = [{ place_id: 'ChIJ-otel-0001', ad: 'Otel', primary_type: 'hotel', puan: 2, puan_sayisi: 3, tipler: ['lodging'] }];
    expect(kesfetSuzgeci(ham, 'otel', VARSAYILAN_ESIKLER, new Set())).toHaveLength(1);
    expect(kesfetSuzgeci(ham, 'ibadet', VARSAYILAN_ESIKLER, new Set())).toHaveLength(1);
  });
});

describe('#189 KK2: eşik ayarı', () => {
  it('varsayılanlar (issue değerleri)', () => {
    expect(VARSAYILAN_ESIKLER).toEqual({
      turistik: { yorum: 50, puan: 3.8 },
      yemek: { yorum: 30, puan: 3.8 },
      kafe: { yorum: 30, puan: 3.8 },
      park: { yorum: 20, puan: 0 },
      alisveris: { yorum: 0, puan: 0 },
    });
  });

  it('ayar varsayılanların üstüne yazılır; geçersiz alan yok sayılır; ayar yoksa varsayılanlar', () => {
    expect(esikleriCoz(null)).toEqual(VARSAYILAN_ESIKLER);
    const e = esikleriCoz({ yemek: { yorum: 80 }, kafe: { yorum: -1, puan: 9 }, park: 'x', bilinmeyen: { yorum: 1 } });
    expect(e.yemek).toEqual({ yorum: 80, puan: 3.8 });
    expect(e.kafe).toEqual(VARSAYILAN_ESIKLER.kafe);
    expect(e.park).toEqual(VARSAYILAN_ESIKLER.park);
    // Varsayılan nesne değişmez.
    expect(VARSAYILAN_ESIKLER.yemek.yorum).toBe(30);
  });
});

describe('#189 KK4: çip tiplerinin hepsi Türkçe', () => {
  it('Keşfet çiplerinin istediği her tipin Türkçe etiketi var (ham İngilizce yok)', () => {
    const tipler = new Set(Object.entries(CIP_TIPLERI).filter(([cip]) => cip !== 'otel').flatMap(([, t]) => t));
    const etiketsiz = [...tipler].filter((t) => !bilinenKategori(t));
    expect(etiketsiz).toEqual([]);
    expect(kategoriEtiketi('cultural_landmark')).toBe('Kültürel yer');
  });
});
