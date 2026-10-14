// #182 KK7: Plan sekmesini açıp günler arasında gezinmek Google isteği doğurmaz — sekme gerçek kancalarıyla çizilir (Supabase
// sahte; Edge Function çağrıları ve fetch sayılır). Harita "Haritayı aç" ile açılınca istek beklenir (yalnız orada).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { gunEtiketi } from '@/features/gezi/geziOzeti';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { sahte, sahteSifirla, type Tablolar } from '@/testYardim/sahteSupabase';

import ProgramEkrani from '../../../app/seyahat/[id]/(sekmeler)/program';

jest.mock('@/lib/supabase', () => jest.requireActual('@/testYardim/sahteSupabase'));
jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
// Liste görünümünde harita çizilmez; yerel harita modülü jest'te yok.
jest.mock('react-native-maps', () => ({ __esModule: true, default: () => null, Marker: () => null, Polyline: () => null, Circle: () => null, PROVIDER_GOOGLE: 'google' }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/konum/useKonum', () => ({ useKonum: () => ({ konum: null, izin: 'yok' }), yakinDurakId: () => null }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const IST = 'Europe/Istanbul';
const mekan = (id: string, place_id: string, primary_type: string) => ({
  id,
  trip_id: 't1',
  place_id,
  primary_type,
  lat: 39.77 + id.length * 0.001,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: 60,
  added_by: id === 'm22' ? 'ayse' : 'ben',
  note: null,
  created_at: `2026-10-0${id.length}T00:00:00Z`,
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

/** 3 gün: 1. gün müze (adı DB'de) + restoran (adı yalnız Google'da, Ayşe ekledi), 2. gün park; elle sıralı günler. */
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
    days: [1, 2, 3].map((i) => ({ id: `g${i}`, trip_id: 't1', index: i, date: tarihEkle(baslangic, i - 1), start_time: '09:30:00', end_time: null, order_manual: true, start_stay_id: null, end_stay_id: null })),
    places: [mekan('m1', 'ChIJ-db-1', 'museum'), mekan('m22', 'ChIJ-google-2', 'restaurant'), mekan('m333', 'ChIJ-google-3', 'park')],
    stops: [durak('d1', 'g1', 'm1', 'a0'), durak('d2', 'g1', 'm22', 'a1'), durak('d3', 'g2', 'm333', 'a0')],
    stays: [],
    members: [
      { trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' },
      { trip_id: 't1', user_id: 'ayse', guest: false, display_name: 'Ayşe', role: 'member', joined_at: '2026-10-02T00:00:00Z' },
    ],
    profiles: [],
    oylar: [{ mekan: 'm1', kullanici: 'ayse' }],
    bacak_modlari: [],
    sehirler: [{ id: 's1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.7767, lng: 30.5206, ozet: null, geziler: [{ count: 1 }] }],
    yerler: [],
  };
}

const fetchSahte = jest.fn(async () => {
  throw new Error('ağ isteği beklenmiyordu');
});
const eskiFetch = globalThis.fetch;
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
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
  const r = render(<ProgramEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};

describe('#182 KK7: Plan sekmesi Google isteği doğurmaz', () => {
  it('açılış ve günler arasında gezinme: Edge Function ve fetch çağrılmaz; adlar DB / kategori, öneren, oy', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, queryByText, qc } = ciz();
    await waitFor(() => getByText('Sırayı düzenle'));
    await sakinles(qc);

    // KK1–KK2: 1. gün listesi — DB'deki ad, Google'da kalan ad yerine kategori; "Ayşe önerdi", "1 oy".
    expect(getByText('Eti Arkeoloji Müzesi')).toBeTruthy();
    expect(getByText('Restoran')).toBeTruthy();
    expect(getByText('Müze · 1 oy')).toBeTruthy();
    // Adı bilinmeyen mekanın alt satırı kategoriyi tekrar etmez.
    expect(getByText('Ayşe önerdi')).toBeTruthy();
    // KK3: şerit etiketi ve "Haritayı aç".
    expect(getByText(/09:30 – \d\d:\d\d · .* yürüme/)).toBeTruthy();
    expect(getByText('Haritayı aç')).toBeTruthy();

    // Günler arasında gezinme.
    fireEvent.press(getByText(gunEtiketi({ index: 2, date: tarihEkle(bas, 1) })));
    await waitFor(() => getByText('Park'));
    await sakinles(qc);
    expect(queryByText('Restoran')).toBeNull();
    fireEvent.press(getByText(gunEtiketi({ index: 3, date: tarihEkle(bas, 2) })));
    await waitFor(() => getByText(/Bu günde henüz durak yok/));
    await sakinles(qc);

    expect(sahte.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });
});
