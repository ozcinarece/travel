// #581 KK2–KK3: sihirbazın taslak seyahati. Geri dönüp şehir ya da tarih değişince aynı taslak güncellenir (seyahat sayısı
// aynı kalır), tarihsiz seyahat N gün olur, gün azalınca yerler silinmez (plansız listeye düşer), şehir değişince yerler
// yalnız onaydan sonra listeden çıkar.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Satir = Record<string, unknown>;
const mockDb: Record<string, Satir[]> = { trips: [], days: [], places: [], stops: [] };
const mockRpc: { ad: string; arg: Satir }[] = [];
/** #603 KK4: verilen tablo + işlem bir kez hata döner (ağ düşmesi). */
const mockDusur: { tablo: string; tur: string } | { tablo: null } = { tablo: null };

/** Bellekte küçük bir Supabase sorgu kurucusu: eq / gt / not(is null) / order, select · insert · update · delete. */
function mockSorgu(tablo: string) {
  const suzgecler: ((r: Satir) => boolean)[] = [];
  let islem: { tur: 'select' } | { tur: 'insert'; satirlar: Satir[] } | { tur: 'update'; alanlar: Satir } | { tur: 'delete' } = { tur: 'select' };
  let sira: string | null = null;
  const q = {
    select: () => q,
    insert: (s: Satir | Satir[]) => ((islem = { tur: 'insert', satirlar: [s].flat() }), q),
    update: (alanlar: Satir) => ((islem = { tur: 'update', alanlar }), q),
    delete: () => ((islem = { tur: 'delete' }), q),
    eq: (k: string, v: unknown) => (suzgecler.push((r) => r[k] === v), q),
    gt: (k: string, v: number) => (suzgecler.push((r) => (r[k] as number) > v), q),
    not: (k: string, _op: 'is', _v: null) => (suzgecler.push((r) => r[k] !== null), q),
    order: (k: string) => ((sira = k), q),
    then: (coz: (s: { data: unknown; error: unknown }) => unknown) => {
      if (mockDusur.tablo === tablo && 'tur' in mockDusur && mockDusur.tur === islem.tur) {
        Object.assign(mockDusur, { tablo: null });
        return Promise.resolve(coz({ data: null, error: new Error('ağ') }));
      }
      const uyan = (r: Satir) => suzgecler.every((f) => f(r));
      let data: unknown = null;
      if (islem.tur === 'insert') mockDb[tablo].push(...islem.satirlar.map((s) => ({ ...s })));
      else if (islem.tur === 'update') mockDb[tablo].filter(uyan).forEach((r) => Object.assign(r, (islem as { alanlar: Satir }).alanlar));
      else if (islem.tur === 'delete') {
        const silinen = mockDb[tablo].filter(uyan);
        mockDb[tablo] = mockDb[tablo].filter((r) => !uyan(r));
        // stops cascade (days → stops).
        if (tablo === 'days') mockDb.stops = mockDb.stops.filter((st) => !silinen.some((g) => g.id === st.day_id));
      } else {
        const satirlar = mockDb[tablo].filter(uyan);
        data = sira ? [...satirlar].sort((a, b) => (a[sira!] as number) - (b[sira!] as number)) : satirlar;
      }
      return Promise.resolve(coz({ data, error: null }));
    },
  };
  return q;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => mockSorgu(tablo),
    rpc: (ad: string, arg: Satir) => {
      mockRpc.push({ ad, arg });
      return Promise.resolve({ error: null });
    },
  },
}));

// eslint-disable-next-line import/first
import {
  gunSayisiSinirla,
  sehirDegisti,
  secimGunSayisi,
  taslakSehriniKur,
  taslakTarihiniKur,
  tarihDegisti,
  tarihSecimi,
  tarihsizGunleriKur,
  TARIHSIZ_VARSAYILAN,
} from '../taslak';

const BOLU = { place_id: 'bolu', ad: 'Bolu', ikincil: '', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR' };
const KARS = { place_id: 'kars', ad: 'Kars', ikincil: '', lat: 40.6, lng: 43.1, tz: 'Europe/Istanbul', country_code: 'TR' };

/** Sihirbazın 2 → 3 geçişi: seyahat + tetikleyicinin açtığı 1 tarihsiz gün. */
function taslakKur() {
  mockDb.trips = [{ id: 't1', city_place_id: 'bolu', city_label: 'Bolu', name: 'Bolu Gezisi', start_date: null, end_date: null }];
  mockDb.days = [{ id: 'g1', trip_id: 't1', index: 1, date: null, start_stay_id: null, end_stay_id: null }];
  mockDb.places = [];
  mockDb.stops = [];
}

beforeEach(() => {
  taslakKur();
  mockRpc.length = 0;
  Object.assign(mockDusur, { tablo: null });
});

describe('#581 KK2 "Kaç gün?" sayacı', () => {
  it('varsayılan 2, sınırlar 1–60', () => {
    expect(TARIHSIZ_VARSAYILAN).toBe(2);
    expect(gunSayisiSinirla(0)).toBe(1);
    expect(gunSayisiSinirla(61)).toBe(60);
    expect(gunSayisiSinirla(3)).toBe(3);
  });

  it('seçim: tarihsiz N gün ya da tek dokunuşlu aralık (dönüş = gidiş)', () => {
    expect(tarihSecimi({ gidis: '2026-12-04', donus: null }, null)).toEqual({ tur: 'tarihli', gidis: '2026-12-04', donus: '2026-12-04' });
    expect(tarihSecimi(null, 3)).toEqual({ tur: 'tarihsiz', gun: 3 });
    expect(tarihSecimi(null, null)).toBeNull();
    expect(secimGunSayisi({ tur: 'tarihli', gidis: '2026-12-04', donus: '2026-12-06' })).toBe(3);
  });

  it('tarihsiz seyahat N güne tamamlanır; yeni günler tarihsiz', async () => {
    await tarihsizGunleriKur('t1', 3);
    expect(mockDb.days.map((g) => [g.index, g.date])).toEqual([
      [1, null],
      [2, null],
      [3, null],
    ]);
  });
});

describe('#581 KK3a: geri dön, değiştir, Devam → aynı taslak', () => {
  it('tarih değişmediyse istek yok; değiştiyse aynı seyahat güncellenir, seyahat sayısı aynı kalır', async () => {
    const mevcut = { start_date: null, end_date: null, gunSayisi: 2 };
    expect(tarihDegisti(mevcut, { tur: 'tarihsiz', gun: 2 })).toBe(false);
    expect(tarihDegisti(mevcut, { tur: 'tarihsiz', gun: 3 })).toBe(true);
    expect(tarihDegisti(mevcut, { tur: 'tarihli', gidis: '2026-12-04', donus: '2026-12-05' })).toBe(true);
    expect(tarihDegisti({ start_date: '2026-12-04', end_date: '2026-12-05', gunSayisi: 2 }, { tur: 'tarihli', gidis: '2026-12-04', donus: '2026-12-05' })).toBe(false);

    await taslakTarihiniKur('t1', { tur: 'tarihsiz', gun: 3 });
    await taslakTarihiniKur('t1', { tur: 'tarihli', gidis: '2026-12-04', donus: '2026-12-06' });
    expect(mockDb.trips).toHaveLength(1);
    expect(mockRpc).toEqual([{ ad: 'seyahat_tarihlerini_degistir', arg: { p_trip_id: 't1', p_start: '2026-12-04', p_end: '2026-12-06' } }]);
  });

  it('tarihliden tarihsize: tarihler boşalır', async () => {
    mockDb.trips[0].start_date = '2026-12-04';
    mockDb.trips[0].end_date = '2026-12-05';
    mockDb.days = [
      { id: 'g1', trip_id: 't1', index: 1, date: '2026-12-04', end_stay_id: null },
      { id: 'g2', trip_id: 't1', index: 2, date: '2026-12-05', end_stay_id: null },
    ];
    await taslakTarihiniKur('t1', { tur: 'tarihsiz', gun: 2 });
    expect(mockDb.trips[0]).toMatchObject({ start_date: null, end_date: null });
    expect(mockDb.days.map((g) => g.date)).toEqual([null, null]);
  });

  it('KK3c: gün sayısı azalınca sondaki gün gider, o günün yeri silinmez (plansız listeye düşer)', async () => {
    await tarihsizGunleriKur('t1', 3);
    const ucuncu = mockDb.days.find((g) => g.index === 3)!;
    ucuncu.id = 'g3';
    mockDb.places = [{ id: 'p1', trip_id: 't1' }];
    mockDb.stops = [{ id: 's1', day_id: 'g3', place_id: 'p1' }];
    await taslakTarihiniKur('t1', { tur: 'tarihsiz', gun: 2 });
    expect(mockDb.days).toHaveLength(2);
    expect(mockDb.stops).toHaveLength(0);
    expect(mockDb.places).toEqual([{ id: 'p1', trip_id: 't1' }]);
  });
});

describe('#581 KK3b: şehir değişimi', () => {
  it('aynı Google kimliği değişim sayılmaz', () => {
    const boluMerkez = { ...BOLU, ad: 'Bolu Merkez' };
    expect(sehirDegisti(BOLU, boluMerkez)).toBe(false);
    expect(sehirDegisti(BOLU, KARS)).toBe(true);
    expect(sehirDegisti(null, KARS)).toBe(false);
  });

  it('onaylandıysa yerler listeden çıkar, şehir ve ad aynı taslakta güncellenir', async () => {
    mockDb.places = [
      { id: 'p1', trip_id: 't1' },
      { id: 'p2', trip_id: 'baska' },
    ];
    await taslakSehriniKur('t1', KARS, 'Kars Gezisi', true);
    expect(mockDb.trips).toHaveLength(1);
    expect(mockDb.trips[0]).toMatchObject({ city_place_id: 'kars', city_label: 'Kars', name: 'Kars Gezisi', lat: 40.6, lng: 43.1 });
    expect(mockDb.places).toEqual([{ id: 'p2', trip_id: 'baska' }]);
  });

  it('yer seçilmediyse (onaysız yol) hiçbir yer silinmez', async () => {
    mockDb.places = [{ id: 'p1', trip_id: 't1' }];
    await taslakSehriniKur('t1', KARS, 'Kars Gezisi', false);
    expect(mockDb.places).toHaveLength(1);
  });
});

describe('#603 KK4 şehir değişimi yarıda düşerse yeniden deneme düzeltir', () => {
  it('yerler silinip şehir yazılamazsa hata; ikinci deneme şehri yazar, yeni seyahat açılmaz', async () => {
    mockDb.places = [{ id: 'p1', trip_id: 't1' }];
    Object.assign(mockDusur, { tablo: 'trips', tur: 'update' });
    await expect(taslakSehriniKur('t1', KARS, 'Kars Gezisi', true)).rejects.toThrow('ağ');
    // Yarım hal: yerler gitti, şehir eski.
    expect(mockDb.places).toEqual([]);
    expect(mockDb.trips[0]).toMatchObject({ city_place_id: 'bolu' });
    // Sihirbaz aynı Devam'da listeyi boş görür, onaysız aynı çağrıyı yapar.
    await taslakSehriniKur('t1', KARS, 'Kars Gezisi', true);
    expect(mockDb.trips).toHaveLength(1);
    expect(mockDb.trips[0]).toMatchObject({ city_place_id: 'kars', city_label: 'Kars', name: 'Kars Gezisi' });
  });
});
