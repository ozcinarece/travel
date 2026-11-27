// #569 KK4: ana sayfadaki gezi sırasındaki kartın "Sıradaki: durak · saat" satırı Gezi sayfasının "Şimdi" verisiyle aynı
// hesaptan gelir (bugünün canlı programı, `simdiHedefi`). Aynı fikstürle (Gezi sayfası testi #181 KK13) çizilir; Google'a
// (Edge Function, fetch) istek gitmez.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelSaatDk, yerelTarih } from '@/lib/zaman';
import { dakikaSaat } from '@/schedule/tempo';

import { SiradakiSatiri } from '../SiradakiSatiri';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
// Sentry içe aktarılınca zamanlayıcı kurar (jest kapanmaz).
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
// #243: bağlantı durumu testte elle verilir.
let mockCevrimdisi = false;
jest.mock('@/lib/baglanti', () => ({ useCevrimdisi: () => mockCevrimdisi }));
jest.mock('@/features/konum/useKonum', () => ({ useKonum: () => ({ konum: null, izin: 'yok' }), yakinDurakId: () => null }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  useNavigationContainerRef: () => ({ getRootState: () => undefined }),
}));

type Tablolar = Record<string, unknown[]>;
let mockTablolar: Tablolar = {};
/** #243: bu tabloların sorgusu hiç yanıt vermez (bağlantı yok, cihazda kopya yok). */
const mockAsili = new Set<string>();
const mockSayac = { invoke: [] as string[], rpc: [] as string[], tablolar: [] as string[] };
/** PostgREST zincirini taklit eder: her çağrı aynı nesneyi döner; `await` tablonun satırlarını, `.single()` ilk satırı verir. */
function mockSorgu(tablo: string) {
  let tek = false;
  const zincir: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_hedef, ad) {
        if (ad === 'then') {
          if (mockAsili.has(tablo)) return () => undefined;
          const satirlar = mockTablolar[tablo] ?? [];
          const sonuc = tek ? { data: satirlar[0] ?? null, error: satirlar[0] ? null : { code: 'PGRST116' } } : { data: satirlar, error: null };
          return (coz: (v: unknown) => unknown, red: (e: unknown) => unknown) => Promise.resolve(sonuc).then(coz, red);
        }
        if (ad === 'single' || ad === 'maybeSingle') {
          return () => {
            tek = true;
            return zincir;
          };
        }
        return () => zincir;
      },
    },
  );
  return zincir;
}
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => {
      mockSayac.tablolar.push(tablo);
      return mockSorgu(tablo);
    },
    rpc: async (ad: string, args: { p_place_ids?: string[] }) => {
      mockSayac.rpc.push(ad);
      if (ad !== 'icerik_mekan_bilgileri') return { data: null, error: { message: `beklenmeyen rpc ${ad}` } };
      const db: Record<string, string> = { 'ChIJ-db-1': 'Odunpazarı Evleri' };
      return { data: (args.p_place_ids ?? []).filter((id) => db[id]).map((id) => ({ place_id: id, ad: db[id], kategori: 'tourist_attraction', lat: 39.77, lng: 30.52, kapak_url: null, foto_yol: null })), error: null };
    },
    functions: {
      invoke: async (ad: string) => {
        mockSayac.invoke.push(ad);
        return { data: null, error: { message: 'Google isteği beklenmiyordu' } };
      },
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  },
}));

const IST = 'Europe/Istanbul';
const bugun = () => yerelTarih(new Date(), IST);
const mekan = (id: string, place_id: string, primary_type: string, created_at: string) => ({
  id,
  trip_id: 't1',
  place_id,
  primary_type,
  lat: 39.77,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: 60,
  added_by: 'ben',
  note: null,
  created_at,
});
const durak = (id: string, day_id: string, place_ref: string, order_key: string) => ({
  id,
  trip_id: 't1',
  day_id,
  place_ref,
  order_key,
  minutes: 60,
  arrived_at: null,
  arrived_by: null,
  completed_at: null,
  completed_by: null,
  auto_completed: false,
  skipped: false,
});

/** Eskişehir, 3 gün; 1. günde Odunpazarı Evleri (adı DB'de) + bir restoran (adı yalnız Google'da); park güne atanmamış; otel yok. */
function fikstur(baslangic: string): Tablolar {
  return {
    trips: [
      {
        id: 't1',
        name: 'Eskişehir Gezisi',
        city_label: 'Eskişehir',
        country_code: 'TR',
        lat: 39.7767,
        lng: 30.5206,
        tz: IST,
        start_date: baslangic,
        end_date: tarihEkle(baslangic, 2),
        hotel_place_id: null,
        hotel_lat: null,
        hotel_lng: null,
        hotel_label: null,
        day_start: '09:00:00',
        day_end: '20:00:00',
        invite_token: 'davet123',
      },
    ],
    days: [1, 2, 3].map((i) => ({ id: `g${i}`, trip_id: 't1', index: i, date: tarihEkle(baslangic, i - 1), start_time: '09:30:00', end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null })),
    places: [mekan('m1', 'ChIJ-db-1', 'tourist_attraction', '2026-10-01T00:00:00Z'), mekan('m2', 'ChIJ-google-2', 'restaurant', '2026-10-02T00:00:00Z'), mekan('m3', 'ChIJ-google-3', 'park', '2026-10-03T00:00:00Z')],
    stops: [durak('d1', 'g1', 'm1', 'a0'), durak('d2', 'g1', 'm2', 'a1')],
    stays: [],
    members: [
      { trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' },
      { trip_id: 't1', user_id: 'ayse', guest: false, display_name: 'Ayşe', role: 'member', joined_at: '2026-10-02T00:00:00Z' },
    ],
    profiles: [],
    oylar: [
      { mekan: 'm3', kullanici: 'ayse' },
      { mekan: 'm3', kullanici: 'ben' },
      { mekan: 'm1', kullanici: 'ayse' },
    ],
    sehirler: [{ id: 's1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.7767, lng: 30.5206, ozet: null, geziler: [{ count: 1 }] }],
    yerler: [
      { id: 'y1', sehir_id: 's1', place_id: 'ChIJ-rehber-1', ad: 'Eti Arkeoloji Müzesi', kategori: 'museum', rehber_md: null, kapak_url: null, one_cikan_sira: 1, lat: 39.78, lng: 30.51 },
      { id: 'y2', sehir_id: 's1', place_id: 'ChIJ-db-1', ad: 'Odunpazarı Evleri', kategori: 'tourist_attraction', rehber_md: null, kapak_url: null, one_cikan_sira: 2, lat: 39.77, lng: 30.52 },
    ],
    geziler: [{ id: 'gz1', sehir_id: 's1', baslik: "Eskişehir'de bir hafta sonu", slug: 'eskisehir-hafta-sonu', kapak_url: null, ozet: null, yazar_ad: 'Tripmate ekibi', gun_sayisi: 2, mekan_sayisi: 11, sira: 1, created_at: '', sehirler: { ad: 'Eskişehir', slug: 'eskisehir' } }],
  };
}

const fetchSahte = jest.fn(async () => {
  throw new Error('ağ isteği beklenmiyordu');
});
const eskiFetch = globalThis.fetch;
/** Çizilen ağaçlar ve istemcileri: söküldükten sonra önbellek temizlenir (24 sa gc zamanlayıcıları jest'i açık tutmasın). */
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
  mockSayac.invoke = [];
  mockSayac.rpc = [];
  mockSayac.tablolar = [];
  fetchSahte.mockClear();
  globalThis.fetch = fetchSahte as unknown as typeof fetch;
  hafifOnbellek.temizle();
  mockCevrimdisi = false;
  mockAsili.clear();
});
afterEach(() => {
  while (acik.length) {
    const r = acik.pop()!;
    r.unmount();
    r.qc.clear();
  }
  globalThis.fetch = eskiFetch;
});

function ciz() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const sarmal = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const r = render(<SiradakiSatiri seyahatId="t1" />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};

describe('#569 KK4 Sıradaki satırı', () => {
  it('gezi günü: Şimdi bölümünün durağı ve varış saati — "Sıradaki: Odunpazarı Evleri · SS:DD"; Google isteği yok', async () => {
    mockTablolar = fikstur(bugun());
    const dk = Math.max(0, yerelSaatDk(new Date(), IST) - 5);
    (mockTablolar.days[0] as { start_time: string }).start_time = `${dakikaSaat(dk)}:00`;
    const { getByTestId, qc } = ciz();
    await waitFor(() => getByTestId('kart-siradaki'));
    await sakinles(qc);
    expect(getByTestId('kart-siradaki').props.children).toBe(`Sıradaki: Odunpazarı Evleri · ${dakikaSaat(dk)}`);
    expect(mockSayac.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('bugün durak yoksa satır yok', async () => {
    mockTablolar = fikstur(bugun());
    mockTablolar.stops = [];
    const { queryByTestId, qc } = ciz();
    await sakinles(qc);
    expect(queryByTestId('kart-siradaki')).toBeNull();
    expect(mockSayac.invoke).toEqual([]);
  });

  it('seyahat henüz başlamadıysa (gezi günü değil) satır yok', async () => {
    mockTablolar = fikstur(tarihEkle(bugun(), 3));
    const { queryByTestId, qc } = ciz();
    await sakinles(qc);
    expect(queryByTestId('kart-siradaki')).toBeNull();
  });
});
