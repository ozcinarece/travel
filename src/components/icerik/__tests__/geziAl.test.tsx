// #193 KK12: "Seyahatime al" uçtan uca (sayfa + gerçek mutasyonlar, Supabase sahte): yeni seyahat tek işlemde açılır ve Plan'a
// (1. gün) dönülür, başarısızlıkta seyahat oluşmaz; eksik gün seyahatin sonuna eklenir. #408 KK6 (kanvas `Sayfa_v5_SeyahatimeAl`):
// seyahat satırı, onay daireli gün satırları, "1'i zaten listende", tek "N durağı al"; "Yalnız mekanlar" sekmesi yok.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { kisaTarih, tarihEkle } from '@/lib/takvim';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import { GeziAl } from '../GeziAl';

const mockRouter = router as unknown as { replace: jest.Mock; push: jest.Mock };

type Satir = Record<string, unknown>;
/** #197: içerik şehri; varsayılan kimlikli (place_id + tz + ülke kodu tabloda). */
const KIMLIKLI_SEHIR = { id: 'S1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.77, lng: 30.52, place_id: 'ChIJ_esk', tz: 'Europe/Istanbul', ulke_kodu: 'TR' };
const mockDb = {
  sehir: KIMLIKLI_SEHIR as Record<string, unknown>,
  invoke: [] as string[],
  tablolar: {} as Record<string, Satir[]>,
  yazilan: [] as { tablo: string; satir: Satir }[],
  rpc: [] as { ad: string; args: Record<string, unknown> }[],
  rpcHata: null as null | { message: string; code: string },
  sayac: 0,
  /** #587: `useSeyahatler` daha gelmedi. */
  seyahatYukleniyor: false,
};
const mockOlay = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), navigate: jest.fn() } }));
let mockCevrimdisi = false;
jest.mock('@/lib/baglanti', () => ({ ...jest.requireActual<object>('@/lib/baglanti'), useCevrimdisi: () => mockCevrimdisi }));
const mockHataBildir = jest.fn();
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined, hataBildir: (...a: unknown[]) => mockHataBildir(...a) }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/icerik/geziRota', () => ({ GEZI_ROTA_TAZE_MS: 1000, geziRotaAnahtari: (g: { id: string }) => ['gezi-rota', g.id], gunRotasiniGetir: async () => [] }));
jest.mock('@/features/icerik/sorgular', () => ({
  useSehirler: () => ({ data: [mockDb.sehir] }),
  useGezi: () => ({ data: undefined }),
  icerikPlaceId: async (d: { id: string; place_id: string | null }) => d.place_id ?? `P${d.id}`,
  cozumSebebi: () => null,
  olayYaz: (...a: unknown[]) => mockOlay(...a),
}));
// #197: şehir seçimi gerçek yoldan (girisler); Google'a giden iki çağrı sayılır. Tabloda kimlik varsa ikisi de 0 olmalı.
const mockGoogle = { otomatikTamamla: jest.fn(), hafifYerler: jest.fn() };
jest.mock('@/features/yerler/api', () => ({
  ...jest.requireActual<object>('@/features/yerler/api'),
  otomatikTamamla: async (...a: unknown[]) => (mockGoogle.otomatikTamamla(...a), [{ place_id: 'ChIJ_google_esk', ana: 'Eskişehir', ikincil: 'Türkiye' }]),
  hafifYerler: async (...a: unknown[]) => (mockGoogle.hafifYerler(...a), [{ place_id: 'ChIJ_google_esk', ad: 'Eskişehir', lat: 39.77, lng: 30.52, tz: 'Europe/Istanbul', ulke_kodu: 'TR' }]),
  yeniOturumJetonu: () => 'oturum-jetonu-1',
}));
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatler: () => ({ data: mockDb.seyahatYukleniyor ? undefined : (mockDb.tablolar.ozet ?? []), isLoading: mockDb.seyahatYukleniyor }),
}));
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: (id: string) => ({ data: (mockDb.tablolar.days ?? []).filter((g) => g.trip_id === id), isPending: false }),
  useDuraklar: (id: string) => ({ data: (mockDb.tablolar.stops ?? []).filter((g) => g.trip_id === id), isPending: false }),
}));
jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanlar: (id: string) => ({ data: (mockDb.tablolar.places ?? []).filter((g) => g.trip_id === id), isPending: false }),
}));
jest.mock('@/lib/supabase', () => {
  const { tarihEkle: mockTarihEkle } = jest.requireActual<{ tarihEkle: (t: string, n: number) => string }>('@/lib/takvim');
  function sorgu(tablo: string) {
    const filtre: [string, string, unknown][] = [];
    let tek = false;
    let yazma: Record<string, unknown> | Record<string, unknown>[] | null = null;
    const z: Record<string, unknown> = {
      select: () => z,
      order: () => z,
      eq: (k: string, v: unknown) => (filtre.push(['eq', k, v]), z),
      gt: (k: string, v: unknown) => (filtre.push(['gt', k, v]), z),
      in: (k: string, v: unknown) => (filtre.push(['in', k, v]), z),
      single: () => ((tek = true), z),
      maybeSingle: () => ((tek = true), z),
      insert: (r: Record<string, unknown> | Record<string, unknown>[]) => ((yazma = r), z),
      then: (coz: (v: unknown) => unknown, red: (e: unknown) => unknown) => {
        const liste = (mockDb.tablolar[tablo] ??= []);
        if (yazma) {
          for (const r of Array.isArray(yazma) ? yazma : [yazma]) {
            // places: unique (trip_id, place_id) → 23505.
            if (tablo === 'places' && liste.some((x) => x.trip_id === r.trip_id && x.place_id === r.place_id)) return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } }).then(coz, red);
            mockDb.yazilan.push({ tablo, satir: r });
            liste.push({ id: `${tablo}-${++mockDb.sayac}`, ...r });
          }
          return Promise.resolve({ data: null, error: null }).then(coz, red);
        }
        const satirlar = liste
          .filter((r) => filtre.every(([op, k, v]) => (op === 'eq' ? r[k] === v : op === 'gt' ? (r[k] as number) > (v as number) : (v as unknown[]).includes(r[k]))))
          .sort((a, b) => ((a.index as number) ?? 0) - ((b.index as number) ?? 0));
        return Promise.resolve(tek ? { data: satirlar[0] ?? null, error: null } : { data: satirlar, error: null }).then(coz, red);
      },
    };
    return z;
  }
  return {
    supabase: {
      from: (t: string) => sorgu(t),
      rpc: async (ad: string, args: Record<string, unknown>) => {
        mockDb.rpc.push({ ad, args });
        if (ad === 'geziden_seyahat_ac') return mockDb.rpcHata ? { data: null, error: mockDb.rpcHata } : { data: 'yeni-trip', error: null };
        if (ad === 'seyahat_tarihlerini_degistir') {
          // Sona gün: mevcut günlerden sonraki günler yeni tarihleriyle.
          const gunler = (mockDb.tablolar.days ?? []).filter((g) => g.trip_id === args.p_trip_id);
          const bas = args.p_start as string;
          let n = gunler.length;
          while (mockTarihEkle(bas, n) <= (args.p_end as string)) {
            n += 1;
            mockDb.tablolar.days.push({ id: `yeni-gun-${n}`, trip_id: args.p_trip_id, index: n, date: mockTarihEkle(bas, n - 1), end_stay_id: null });
          }
          return { data: n, error: null };
        }
        return { data: 0, error: null };
      },
      functions: {
        invoke: async (ad: string) => {
          mockDb.invoke.push(ad);
          return { data: null, error: null };
        },
      },
    },
  };
});

const durak = (id: string, gun: string, sira: number, place_id: string | null, kategori = 'museum'): GeziDuragi => ({ id, gezi_gun_id: gun, sira, place_id, ad: `Yer ${id}`, kategori, sure_dk: 60, lat: 39.7, lng: 30.5 });
const gezi = {
  id: 'gezi1',
  sehir_id: 'S1',
  baslik: "Eskişehir'de üç gün",
  slug: 'eskisehirde-uc-gun',
  kapak_url: null,
  ozet: null,
  yazi_md: null,
  yazar_ad: null,
  gun_sayisi: 3,
  mekan_sayisi: 5,
  sira: 1,
  created_at: '2026-01-01',
  sehirler: { ad: 'Eskişehir', slug: 'eskisehir' },
  gezi_gunleri: [
    { id: 'G1', gezi_id: 'gezi1', sira: 1, baslik: 'Odunpazarı', gezi_duraklari: [durak('a', 'G1', 1, 'PA'), durak('y', 'G1', 2, 'PY', 'restaurant')] },
    { id: 'G2', gezi_id: 'gezi1', sira: 2, baslik: 'Porsuk', gezi_duraklari: [durak('c', 'G2', 1, 'PC', 'park')] },
    { id: 'G3', gezi_id: 'gezi1', sira: 3, baslik: 'Sazova', gezi_duraklari: [durak('d', 'G3', 1, 'PD'), durak('e', 'G3', 2, 'PE')] },
  ],
} as GeziDetay;
const kimlik = (d: GeziDuragi) => d.place_id;

/** Mevcut seyahat: Eskişehir, 2 gün (Cum 17 – Cmt 18 May 2030); PC listede (atanmamış). */
function mevcutSeyahat() {
  mockDb.tablolar = {
    ozet: [{ id: 't1', name: 'Eskişehir Gezisi', city_label: 'Eskişehir', start_date: '2030-05-17', end_date: '2030-05-18', tz: 'Europe/Istanbul', hotel_place_id: null, created_at: '2026-01-01', members: [], places: [] }],
    trips: [{ id: 't1', start_date: '2030-05-17' }],
    days: [
      { id: 'd1', trip_id: 't1', index: 1, date: '2030-05-17', end_stay_id: null, start_stay_id: null, start_time: null, end_time: null, order_manual: false },
      { id: 'd2', trip_id: 't1', index: 2, date: '2030-05-18', end_stay_id: null, start_stay_id: null, start_time: null, end_time: null, order_manual: false },
    ],
    places: [{ id: 'm-pc', trip_id: 't1', place_id: 'PC', default_minutes: 60 }],
    stops: [],
  };
}

let qc: QueryClient;
function ac(ilkHedefId?: string | null) {
  // gcTime sonsuz: gözlemcisi kalkan sorgu / mutasyon zamanlayıcı kurmaz (jest açık kalmaz).
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const onKapat = jest.fn();
  render(
    <QueryClientProvider client={qc}>
      <GeziAl gezi={gezi} kimlik={kimlik} ilkHedefId={ilkHedefId} onKapat={onKapat} />
    </QueryClientProvider>,
  );
  return onKapat;
}

/** Yeni seyahat formu şehrin seçimini (tablodan ya da Google'dan) bekler; düğme o zamana kadar pasif. */
async function sehirHazir() {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
}

beforeEach(() => {
  mockCevrimdisi = false;
  mockDb.sehir = KIMLIKLI_SEHIR;
  mockDb.invoke = [];
  mockGoogle.otomatikTamamla.mockClear();
  mockGoogle.hafifYerler.mockClear();
  mockDb.tablolar = { ozet: [] };
  mockDb.yazilan = [];
  mockDb.rpc = [];
  mockDb.rpcHata = null;
  mockDb.seyahatYukleniyor = false;
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  mockOlay.mockClear();
});
afterEach(() => qc?.clear());

describe('#193 Yeni seyahat akışın içinde (KK2–KK4)', () => {
  it('seyahat yoksa "Yeni seyahat" seçili; tek işlem RPC: ad = gezi başlığı, şehir, tarihler, 3 gün, plan; Plan 1. gün + bildirim', async () => {
    const onKapat = ac(null);
    await sehirHazir();
    expect(screen.getByText('Sihirbaza gitmez; bitince yeni seyahatin Plan\'ı açılır.')).toBeTruthy();
    // #277 KK4: seyahati yoksa "Hangi seyahate?" adımı atlanır; yalnız tarih sorulur.
    expect(screen.queryByText('HANGİ SEYAHATE?')).toBeNull();
    expect(screen.queryByText('Yeni seyahat')).toBeNull();
    // #408 KK6: sekme ve açıklama paragrafı yok.
    expect(screen.queryByText('Yalnız mekanlar')).toBeNull();
    expect(screen.queryByText(/adıyla yeni seyahat açılır/)).toBeNull();
    // Tarih seçilmeden düğme pasif; başlangıç gününe dokununca 3 gün.
    const bugun = yerelTarih(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    fireEvent.press(screen.getByLabelText(kisaTarih(tarihEkle(bugun, 2))));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const cagri = mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac');
    expect(cagri).toHaveLength(1);
    expect(cagri[0].args).toEqual(
      expect.objectContaining({
        p_seyahat: expect.objectContaining({ name: "Eskişehir'de üç gün", city_place_id: 'ChIJ_esk', city_label: 'Eskişehir', tz: 'Europe/Istanbul', start_date: tarihEkle(bugun, 2), end_date: tarihEkle(bugun, 4) }),
        p_gun_sayisi: 3,
      }),
    );
    const duraklar = cagri[0].args.p_duraklar as { gun: number; place_id: string }[];
    expect(duraklar.map((d) => [d.gun, d.place_id])).toEqual([
      [1, 'PA'],
      [1, 'PY'],
      [2, 'PC'],
      [3, 'PD'],
      [3, 'PE'],
    ]);
    // İstemci tabloya ayrıca yazmaz (her şey tek işlemde).
    expect(mockDb.yazilan).toEqual([]);
    expect(onKapat).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: 'yeni-trip', gun: '1', eklenenGun: '3', eklenenDurak: '5', atlanan: '0' } });
    // KK3: plan kuruldu (kaynak gezi) ölçülür.
    expect(mockOlay).toHaveBeenCalledWith('plan_kuruldu', 'yeni-trip', expect.objectContaining({ kaynak: 'gezi', mekan: 5, gun: 3 }));
    // #197 KK4: şehir tablodan (kimlik, saat dilimi, ülke kodu) — Google'a giden istek 0.
    expect(cagri[0].args.p_seyahat).toEqual(expect.objectContaining({ city_place_id: 'ChIJ_esk', country_code: 'TR' }));
    expect(mockGoogle.otomatikTamamla).not.toHaveBeenCalled();
    expect(mockGoogle.hafifYerler).not.toHaveBeenCalled();
    expect(mockDb.invoke).toEqual([]);
  });

  it('#197 KK3: şehrin kimliği tabloda yoksa bugünkü yol (Autocomplete + hafif yer, birer kez)', async () => {
    mockDb.sehir = { ...KIMLIKLI_SEHIR, place_id: null, tz: null, ulke_kodu: null };
    ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByText('Tarih sonra'));
    await waitFor(() => expect(mockGoogle.hafifYerler).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(mockGoogle.otomatikTamamla).toHaveBeenCalledTimes(1);
    expect(mockDb.rpc.find((r) => r.ad === 'geziden_seyahat_ac')!.args.p_seyahat).toEqual(expect.objectContaining({ city_place_id: 'ChIJ_google_esk', tz: 'Europe/Istanbul' }));
  });

  it('"Tarih sonra": tarihsiz; gün sayısı − / + ile', async () => {
    ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByLabelText('Bir gün arttır'));
    fireEvent.press(screen.getByText('Tarih sonra'));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const args = mockDb.rpc.find((r) => r.ad === 'geziden_seyahat_ac')!.args;
    expect(args.p_gun_sayisi).toBe(4);
    expect(args.p_seyahat).toEqual(expect.objectContaining({ start_date: null, end_date: null }));
  });

  it('KK3: RPC hata verirse seyahat oluşmaz — dönüş yok, sayfa açık, hata söylenir, istemci tabloya yazmaz', async () => {
    mockDb.rpcHata = { message: 'durak yazılamadı', code: '23502' };
    const onKapat = ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByText('Tarih sonra'));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    // #388 KK2: ham sunucu metni kullanıcıya gösterilmez, yalnız Sentry'ye gider.
    await waitFor(() => expect(screen.getByText('Eklenemedi. Tekrar dener misin?')).toBeTruthy());
    expect(screen.queryByText(/durak yazılamadı/)).toBeNull();
    expect(mockHataBildir).toHaveBeenCalledWith(expect.objectContaining({ message: 'durak yazılamadı' }), 'gezi-al-yeni');
    expect(screen.queryByText('Tekrar dene')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(onKapat).not.toHaveBeenCalled();
    expect(mockDb.yazilan).toEqual([]);
    expect(mockOlay).not.toHaveBeenCalled();
  });

  it('#388 KK5: çevrimdışıyken "Seyahati aç ve planı al" pasif', async () => {
    mockCevrimdisi = true;
    ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByText('Tarih sonra'));
    const dugme = screen.getByRole('button', { name: 'Seyahati aç ve planı al' });
    expect(dugme.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(dugme);
    expect(mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac')).toHaveLength(0);
  });

  it('#388 KK1: ağ hatasında "Bağlantı yok…" ve "Tekrar dene" son denemeyi yineler', async () => {
    mockDb.rpcHata = { message: 'TypeError: Network request failed', code: '' };
    ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByText('Tarih sonra'));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    await waitFor(() => expect(screen.getByText('Bağlantı yok. Hiçbir şey eklenmedi; bağlanınca tekrar dene.')).toBeTruthy());
    expect(screen.queryByText(/Network request failed/)).toBeNull();
    const once = mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac').length;
    mockDb.rpcHata = null;
    fireEvent.press(screen.getByText('Tekrar dene'));
    await waitFor(() => expect(mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac').length).toBe(once + 1));
  });

  it('#388 inceleme: "Tekrar dene" alt bileşenin ac()\'ından geçer — bekleme kilidi atlanmaz, iki seyahat açılmaz', async () => {
    mockDb.rpcHata = { message: 'TypeError: Network request failed', code: '' };
    ac(null);
    await sehirHazir();
    fireEvent.press(screen.getByText('Tarih sonra'));
    fireEvent.press(screen.getByText('Seyahati aç ve planı al'));
    await waitFor(() => expect(screen.getByText('Tekrar dene')).toBeTruthy());
    const once = mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac').length;
    mockDb.rpcHata = null;
    const tekrar = screen.getByText('Tekrar dene');
    fireEvent.press(tekrar);
    fireEvent.press(tekrar);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockDb.rpc.filter((r) => r.ad === 'geziden_seyahat_ac')).toHaveLength(once + 1);
  });

  it('#388 inceleme: çevrimdışıyken pasif düğmenin nedeni satırda ve ipucunda', async () => {
    mockCevrimdisi = true;
    ac(null);
    await sehirHazir();
    expect(screen.getByText('Bağlantı yok. Hiçbir şey eklenmedi; bağlanınca tekrar dene.')).toBeTruthy();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
    fireEvent.press(screen.getByText('Tarih sonra'));
    expect(screen.getByRole('button', { name: 'Seyahati aç ve planı al' }).props.accessibilityHint).toBe('Bağlantı yok; bağlanınca eklenebilir.');
  });
});

describe('#193 Mevcut seyahat (KK5–KK9)', () => {
  it('KK5 · #408 KK6: eşleme sırayla, fazla gün varsayılan seçilmez ("Seyahate pazar 19\'u ekler"); seçilince sona gün eklenir, durakları oraya; Plan, ilk gün', async () => {
    mevcutSeyahat();
    ac('t1');
    // Gün satırları: hedef gün ve durak sayısı; seyahatte olmayan gün eklenecek tarihle.
    expect(screen.getByText("Cuma 17'ye · 2 durak")).toBeTruthy();
    expect(screen.getByText("Cumartesi 18'e · 1 durak")).toBeTruthy();
    expect(screen.getByText("Seyahate pazar 19'u ekler")).toBeTruthy();
    expect(screen.getByLabelText('3. gün · Sazova').props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    // PC listede (atanmamış): "1'i zaten listende"; güne taşınacağı için durak sayısına girer.
    expect(screen.getByText("1'i zaten listende")).toBeTruthy();
    expect(screen.getByText('3 durağı al')).toBeTruthy();
    // Tarih eşleme çipleri ve açıklama paragrafı yok.
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.queryByText(/seçersen seyahate/)).toBeNull();
    fireEvent.press(screen.getByLabelText('3. gün · Sazova'));
    const dugme = await screen.findByText('5 durağı al');
    fireEvent.press(dugme);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    // Tarihli seyahat: bitiş bir gün uzar (mevcut gün sayısından sayılır, gün silinmez).
    expect(mockDb.rpc.find((r) => r.ad === 'seyahat_tarihlerini_degistir')?.args).toEqual({ p_trip_id: 't1', p_start: '2030-05-17', p_end: '2030-05-19' });
    const duraklar = mockDb.yazilan.filter((y) => y.tablo === 'stops').map((y) => y.satir);
    expect(duraklar.filter((d) => d.day_id === 'yeni-gun-3')).toHaveLength(2);
    expect(duraklar.filter((d) => d.day_id === 'd1')).toHaveLength(2);
    // KK6: PC listede (atanmamış) → seçilen güne taşınır, mekan bir daha eklenmez.
    expect(mockDb.yazilan.filter((y) => y.tablo === 'places').map((y) => y.satir.place_id)).toEqual(['PA', 'PY', 'PD', 'PE']);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/program', params: expect.objectContaining({ id: 't1', gun: '1', eklenenDurak: '5' }) });
  });

  it('#408 KK6: bir günün dairesi kaldırılınca o gün alınmaz; hiç gün seçili değilse düğme pasif', async () => {
    mevcutSeyahat();
    ac('t1');
    fireEvent.press(screen.getByLabelText('1. gün · Odunpazarı'));
    expect(screen.getByText('1 durağı al')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('2. gün · Porsuk'));
    const dugme = screen.getByRole('button', { name: 'Bir gün seç' });
    expect(dugme.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(screen.queryByText(/zaten listende/)).toBeNull();
  });

  it('#408 KK6: seyahat satırı ad · tarih ve "Ayşe ve Mert de görecek"; dokununca seyahat seçici açılır; "Yalnız mekanlar" yok', async () => {
    mevcutSeyahat();
    mockDb.tablolar.ozet[0].members = [
      { user_id: 'ben', role: 'owner', display_name: 'Ece', guest: false },
      { user_id: 'a', role: 'member', display_name: 'Ayşe', guest: false },
      { user_id: 'm', role: 'member', display_name: 'Mert', guest: false },
    ];
    ac('t1');
    expect(screen.getByText('Eskişehir Gezisi · 17–18 May')).toBeTruthy();
    expect(screen.getByText('Ayşe ve Mert de görecek')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.queryByText('Yalnız mekanlar')).toBeNull();
    expect(screen.queryByText('Planı al')).toBeNull();
    expect(screen.queryByText('HANGİ SEYAHATE?')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /Eskişehir Gezisi · 17–18 May/ }));
    expect(screen.getByRole('button', { selected: true, name: /Eskişehir Gezisi/ })).toBeTruthy();
    // Yeni seyahat seçilince seçici kapanır, satır "Yeni seyahat" olur ve form açılır.
    fireEvent.press(screen.getByRole('button', { name: /Yeni seyahat/ }));
    expect(screen.getByText('Seyahati aç ve planı al')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yeni seyahat' }).props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
  });
});

describe('#587 inceleme: seyahat listesi geç gelir, "Farklı şehir" kesilmez', () => {
  const yeniden = () =>
    screen.rerender(
      <QueryClientProvider client={qc}>
        <GeziAl gezi={gezi} kimlik={kimlik} ilkHedefId="t1" onKapat={jest.fn()} />
      </QueryClientProvider>,
    );
  const seciliCip = () => screen.getAllByRole('button', { selected: true }).map((b) => b.props.accessibilityLabel ?? '');
  /** #408 KK6: seyahat çipleri seyahat satırının arkasında. */
  const seciciyiAc = () => fireEvent.press(screen.getByHintText('Seyahati değiştir'));

  it('liste yüklenirken "Yeni seyahat" formu açılmaz; liste gelince verilen hedef seçili olur', async () => {
    mevcutSeyahat();
    mockDb.seyahatYukleniyor = true;
    ac('t1');
    expect(screen.queryByText(/Eskişehir Gezisi/)).toBeNull();
    expect(screen.queryByText('Yeni seyahat')).toBeNull();
    mockDb.seyahatYukleniyor = false;
    yeniden();
    await waitFor(() => expect(screen.getByText(/^Eskişehir Gezisi/)).toBeTruthy());
    seciciyiAc();
    expect(screen.getByRole('button', { selected: true, name: /Eskişehir Gezisi/ })).toBeTruthy();
    expect(screen.getByRole('button', { selected: false, name: /Yeni seyahat/ })).toBeTruthy();
  });

  it('liste önce boş, sonra dolu gelirse verilen hedef yine seçili olur (kalıcı "Yeni seyahat" yok)', async () => {
    mevcutSeyahat();
    const dolu = mockDb.tablolar.ozet;
    mockDb.tablolar.ozet = [];
    ac('t1');
    mockDb.tablolar.ozet = dolu;
    yeniden();
    await waitFor(() => expect(screen.getByText(/^Eskişehir Gezisi/)).toBeTruthy());
    seciciyiAc();
    expect(screen.getByRole('button', { selected: true, name: /Eskişehir Gezisi/ })).toBeTruthy();
    expect(seciliCip()).toHaveLength(1);
  });

  it('hedef verilmediyse (aynı şehir varsayılanı) liste geç gelince aynı şehirdeki seyahat seçili olur', async () => {
    mevcutSeyahat();
    mockDb.seyahatYukleniyor = true;
    ac(undefined);
    expect(screen.getByLabelText('Seyahatler yükleniyor')).toBeTruthy();
    mockDb.seyahatYukleniyor = false;
    screen.rerender(
      <QueryClientProvider client={qc}>
        <GeziAl gezi={gezi} kimlik={kimlik} onKapat={jest.fn()} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText(/^Eskişehir Gezisi/)).toBeTruthy());
    seciciyiAc();
    expect(screen.getByRole('button', { selected: true, name: /Eskişehir Gezisi/ })).toBeTruthy();
  });

  it('kullanıcı "Yeni seyahat"e dokunduysa liste yenilense de seçim korunur', async () => {
    mevcutSeyahat();
    ac('t1');
    seciciyiAc();
    fireEvent.press(screen.getByRole('button', { name: /Yeni seyahat/ }));
    yeniden();
    await waitFor(() => expect(screen.getByText('Seyahati aç ve planı al')).toBeTruthy());
    seciciyiAc();
    expect(screen.getByRole('button', { selected: true, name: /Yeni seyahat/ })).toBeTruthy();
  });

  it('uzun adlı başka şehir seyahatinde "Farklı şehir" ayrı ve kısalmayan bir metin', async () => {
    mevcutSeyahat();
    mockDb.tablolar.ozet = [{ ...mockDb.tablolar.ozet[0], id: 't2', name: 'Kapadokya Hafta Sonu Balon ve Vadiler Gezisi', city_label: 'Nevşehir' }];
    ac(null);
    seciciyiAc();
    const ek = screen.getByTestId('farkli-sehir');
    expect(ek.props.children).toBe(' · Farklı şehir');
    expect(screen.getByText(/^Kapadokya Hafta Sonu Balon ve Vadiler Gezisi/).props.children).not.toContain('Farklı şehir');
    expect(StyleSheet.flatten(ek.props.style).flexShrink).toBe(0);
    expect(StyleSheet.flatten(screen.getByText(/^Kapadokya/).props.style).flexShrink).toBe(1);
  });
});
