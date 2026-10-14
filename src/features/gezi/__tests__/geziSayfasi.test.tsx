// #181 KK13: Gezi sayfası açılışında Google'a istek gitmez — ekran gerçek kancalarıyla çizilir; Supabase sahte (DB sorguları
// fikstürden), Edge Function'lar (places-light, places-nearby, route-matrix, route-legs, otomatik tamamlama) ve fetch sayılır.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';

import GeziEkrani from '../../../app/seyahat/[id]/(sekmeler)/gezi';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
// Sentry içe aktarılınca zamanlayıcı kurar (jest kapanmaz).
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/konum/useKonum', () => ({ useKonum: () => ({ konum: null, izin: 'yok' }), yakinDurakId: () => null }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

type Tablolar = Record<string, unknown[]>;
let mockTablolar: Tablolar = {};
const mockSayac = { invoke: [] as string[], rpc: [] as string[], tablolar: [] as string[] };
/** PostgREST zincirini taklit eder: her çağrı aynı nesneyi döner; `await` tablonun satırlarını, `.single()` ilk satırı verir. */
function mockSorgu(tablo: string) {
  let tek = false;
  const zincir: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_hedef, ad) {
        if (ad === 'then') {
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
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<GeziEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};

describe('#181 KK13: Gezi sayfası açılışında Google isteği yok', () => {
  it('plan modu: kapak, Sıradaki adım, plan özeti, Listem, rehberden öneriler — Edge Function ve fetch çağrılmaz', async () => {
    mockTablolar = fikstur(tarihEkle(bugun(), 12));
    const { getByText, queryAllByText, qc } = ciz();
    await waitFor(() => getByText('Eskişehir Gezisi'));
    await sakinles(qc);

    expect(getByText('12 gün kaldı')).toBeTruthy();
    // KK5: park güne atanmamış (adı bilinmiyor) · otel de seçilmedi.
    expect(getByText('1 mekan güne atanmamış')).toBeTruthy();
    expect(getByText('otel de seçilmedi')).toBeTruthy();
    expect(getByText('Dağıt')).toBeTruthy();
    // KK6: gün kartı teması ilk durağın DB'deki adı; KK7: Google'da kalan ad yerine kategori.
    expect(queryAllByText('Odunpazarı Evleri').length).toBeGreaterThan(0);
    expect(getByText('Restoran')).toBeTruthy();
    expect(getByText('Listem · 3')).toBeTruthy();
    // KK8: rehberden öneri (listede olmayan öne çıkan yer), KK10 rehber ve önerilen gezi.
    expect(getByText('Eti Arkeoloji Müzesi')).toBeTruthy();
    expect(getByText('Eskişehir rehberi')).toBeTruthy();
    expect(getByText("Eskişehir'de bir hafta sonu")).toBeTruthy();

    expect(mockSayac.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
    // Adlar bizim veriden (DB) geldi.
    expect(mockSayac.rpc).toContain('icerik_mekan_bilgileri');
  });

  it('başka ekranın önbelleğe aldığı ad istek atılmadan kullanılır', async () => {
    mockTablolar = fikstur(tarihEkle(bugun(), 12));
    hafifOnbellek.yaz([{ place_id: 'ChIJ-google-2', ad: 'Çibörek Evi', lat: 39.77, lng: 30.52, primary_type: 'restaurant', tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null }], 'pro');
    const { getByText, qc } = ciz();
    await waitFor(() => getByText('Eskişehir Gezisi'));
    await sakinles(qc);
    expect(getByText('Çibörek Evi')).toBeTruthy();
    expect(mockSayac.invoke).toEqual([]);
  });

  it('gezi modu: bugünün durak kartı ve grup kartı — yine istek yok', async () => {
    mockTablolar = fikstur(bugun());
    const { getByText, queryByText, qc } = ciz();
    await waitFor(() => getByText('Eskişehir Gezisi'));
    await sakinles(qc);
    expect(getByText('Bugün · 1. gün')).toBeTruthy();
    expect(getByText('Bugün · Odunpazarı Evleri')).toBeTruthy();
    expect(getByText('Yol tarifi')).toBeTruthy();
    expect(getByText('Haritada gör')).toBeTruthy();
    // KK11: gezi modunda Sıradaki adım satırı yok; KK12: Ayşe'nin varışı yok → konum paylaşmıyor.
    expect(queryByText('Dağıt')).toBeNull();
    expect(getByText('konumunu paylaşmıyor')).toBeTruthy();
    expect(mockSayac.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });
});
