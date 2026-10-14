// #184: Sohbet ekranı ve Gezi sayfasının Sohbet kartı gerçek kancalarıyla çizilir. Supabase sahte: tablolar fikstürden, yazmalar
// (insert, upsert, rpc) kaydedilir; Edge Function çağrıları ve fetch sayılır.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelAn, yerelTarih } from '@/lib/zaman';

import GeziEkrani from '../../../app/seyahat/[id]/(sekmeler)/gezi';
import SohbetSekmesi from '../../../app/seyahat/[id]/(sekmeler)/sohbet';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
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

type Tablolar = Record<string, unknown[]>;
let mockTablolar: Tablolar = {};
const mockKayit = { invoke: [] as string[], rpc: [] as { ad: string; args: Record<string, unknown> }[], yaz: [] as { tablo: string; islem: string; satir: unknown }[] };
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
        if (ad === 'insert' || ad === 'upsert' || ad === 'update') {
          return (satir: unknown) => {
            mockKayit.yaz.push({ tablo, islem: ad, satir });
            return zincir;
          };
        }
        return () => zincir;
      },
    },
  );
  return zincir;
}
const mockDb: Record<string, string> = { 'ChIJ-kursunlu': 'Kurşunlu Külliyesi', 'ChIJ-cib': 'Hacı Baba Çibörek' };
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => mockSorgu(tablo),
    rpc: async (ad: string, args: Record<string, unknown>) => {
      mockKayit.rpc.push({ ad, args });
      if (ad === 'icerik_mekan_bilgileri') {
        const ids = ((args.p_place_ids as string[]) ?? []).filter((id) => mockDb[id]);
        return { data: ids.map((id) => ({ place_id: id, ad: mockDb[id], kategori: 'restaurant', lat: 39.77, lng: 30.52, kapak_url: null, foto_yol: null })), error: null };
      }
      if (ad === 'sohbet_okunmamis') return { data: 2, error: null };
      if (ad === 'sohbet_okundu' || ad === 'degisikligi_geri_al') return { data: null, error: null };
      return { data: null, error: { message: `beklenmeyen rpc ${ad}` } };
    },
    functions: {
      invoke: async (ad: string) => {
        mockKayit.invoke.push(ad);
        return { data: null, error: { message: 'Google isteği beklenmiyordu' } };
      },
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'yok' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  },
}));

const IST = 'Europe/Istanbul';
const bugun = yerelTarih(new Date(), IST);
const dun = tarihEkle(bugun, -1);
const an = (tarih: string, saat: number, dk = 0) => yerelAn(tarih, saat * 60 + dk, IST).toISOString();
const mesaj = (id: string, user_id: string, created_at: string, ek: Record<string, unknown> = {}) => ({
  id,
  trip_id: 't1',
  user_id,
  tur: 'metin',
  metin: '',
  place_id: null,
  oylama_id: null,
  foto_yolu: null,
  created_at,
  silindi_at: null,
  ...ek,
});

function fikstur(): Tablolar {
  const baslangic = tarihEkle(bugun, 10);
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
        end_date: tarihEkle(baslangic, 1),
        hotel_place_id: null,
        hotel_lat: null,
        hotel_lng: null,
        hotel_label: null,
        day_start: '09:00:00',
        day_end: '20:00:00',
        invite_token: 'davet123',
      },
    ],
    days: [1, 2].map((i) => ({ id: `g${i}`, trip_id: 't1', index: i, date: tarihEkle(baslangic, i - 1), start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null })),
    places: [
      { id: 'm1', trip_id: 't1', place_id: 'ChIJ-kursunlu', primary_type: 'mosque', lat: 39.78, lng: 30.52, google_fetched_at: '', default_minutes: 45, added_by: 'ben', note: null, created_at: '2026-10-01T00:00:00Z' },
      { id: 'm2', trip_id: 't1', place_id: 'ChIJ-cib', primary_type: 'restaurant', lat: 39.775, lng: 30.521, google_fetched_at: '', default_minutes: 45, added_by: 'ayse', note: null, created_at: '2026-10-02T00:00:00Z' },
    ],
    stops: [{ id: 'd1', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: 'a0', minutes: 45, arrived_at: null, arrived_by: null, completed_at: null, completed_by: null, auto_completed: false, skipped: false }],
    stays: [],
    members: [
      { trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' },
      { trip_id: 't1', user_id: 'ayse', guest: false, display_name: 'Ayşe', role: 'member', joined_at: '2026-10-02T00:00:00Z' },
      { trip_id: 't1', user_id: 'mert', guest: false, display_name: 'Mert', role: 'member', joined_at: '2026-10-03T00:00:00Z' },
    ],
    profiles: [],
    oylar: [],
    sehirler: [],
    yerler: [],
    geziler: [],
    // Sorgu sırası: yeniden eskiye.
    mesajlar: [
      mesaj('k5', 'ben', an(bugun, 9, 10), { metin: 'Çibörek 🙋‍♀️' }),
      mesaj('k4', 'ayse', an(bugun, 9, 5), { tur: 'oylama', metin: 'Cumartesi akşam için oylama açtım:', oylama_id: 'o1' }),
      mesaj('k3', 'ayse', an(bugun, 9, 0), { tur: 'mekan', metin: 'Çibörek için burayı buldum 👇', place_id: 'ChIJ-cib' }),
      mesaj('k2', 'ben', an(dun, 18, 52), { metin: 'Bence de. Otel seçelim mi?' }),
      mesaj('k1', 'mert', an(dun, 18, 40), { metin: 'Cuma akşamı Odunpazarı’nda kalalım bence.' }),
    ],
    oylamalar: [
      {
        id: 'o1',
        trip_id: 't1',
        soru: 'Çibörek mi, balık mı?',
        kapanis_at: an(tarihEkle(bugun, 1), 12),
        olusturan: 'ayse',
        created_at: an(bugun, 9, 5),
        oylama_secenekleri: [
          { id: 'c', oylama_id: 'o1', sira: 1, metin: 'Çibörek · Hacı Baba', place_id: 'ChIJ-cib' },
          { id: 'b', oylama_id: 'o1', sira: 2, metin: 'Balık', place_id: null },
        ],
        oylama_oylari: [
          { secenek_id: 'c', user_id: 'ayse' },
          { secenek_id: 'c', user_id: 'ben' },
        ],
      },
    ],
    mesaj_okuma: [
      { user_id: 'ayse', son_okunan_at: an(bugun, 23, 59) },
      { user_id: 'mert', son_okunan_at: an(bugun, 23, 59) },
    ],
    changes: [
      { id: 11, user_id: 'ayse', entity: 'harcamalar', entity_id: 'h1', field: null, old: null, new: { id: 'h1', tl_kurus: 55000, olusturan: 'ayse' }, at: an(bugun, 8) },
      { id: 10, user_id: 'mert', entity: 'stops', entity_id: 'd1', field: 'day_id', old: 'g1', new: 'g2', at: an(dun, 18, 30) },
    ],
    harcamalar: [
      {
        id: 'h1',
        trip_id: 't1',
        aciklama: 'Çibörek',
        tutar_kurus: 55000,
        para_birimi: 'TRY',
        tl_kurus: 55000,
        kategori: 'yemek',
        odeyen_id: 'ayse',
        stop_id: null,
        fis_yolu: null,
        olusturan: 'ayse',
        created_at: an(bugun, 8),
        updated_at: an(bugun, 8),
        harcama_paylari: [
          { user_id: 'ben', pay_kurus: 18334 },
          { user_id: 'ayse', pay_kurus: 18333 },
          { user_id: 'mert', pay_kurus: 18333 },
        ],
      },
    ],
    odesmeler: [],
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
  mockKayit.invoke = [];
  mockKayit.rpc = [];
  mockKayit.yaz = [];
  mockTablolar = fikstur();
});
afterEach(() => {
  while (acik.length) {
    const r = acik.pop()!;
    r.unmount();
    r.qc.clear();
  }
  globalThis.fetch = eskiFetch;
});

function ciz(ekran: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(ekran, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0), { timeout: 4000 });
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0), { timeout: 4000 });
};

describe('#184 Sohbet ekranı', () => {
  it('KK1–KK4: tarih ayraçları, balonlar, okundu, mekan kartı, oylama, gri sistem satırları; açılınca okundu — Google isteği yok', async () => {
    const { getByText, getAllByText, qc } = ciz(<SohbetSekmesi />);
    await waitFor(() => getByText('Çibörek mi, balık mı?'));
    await sakinles(qc);
    // Ad sorgusu (icerik_mekan_bilgileri) çizimden sonra gelir.
    await waitFor(() => getByText('Hacı Baba Çibörek'));
    expect(getByText('Dün')).toBeTruthy();
    expect(getByText('Bugün')).toBeTruthy();
    expect(getByText('Cuma akşamı Odunpazarı’nda kalalım bence.')).toBeTruthy();
    // Kendi mesajlarım: herkes okudu.
    expect(getAllByText(/· okundu$/)).toHaveLength(2);
    // KK2: mekan kartı adı DB'den, listede.
    expect(getByText('Hacı Baba Çibörek')).toBeTruthy();
    expect(getByText(/^Restoran/)).toBeTruthy();
    expect(getByText('Listede')).toBeTruthy();
    // KK3: oylama — sayılar, oy vermeyen, kapanış, kazanan mekan listede ama planda değil → Plana ekle.
    expect(getByText("Mert oy vermedi · yarın 12:00'de kapanır")).toBeTruthy();
    expect(getByText('Plana ekle')).toBeTruthy();
    // KK4: sistem satırları (changes) + KK5 harcama satırı "payın".
    expect(getByText(/Kurşunlu Külliyesi mekanını 2\. güne taşıdı/)).toBeTruthy();
    expect(getByText(/550 ₺ harcama ekledi · payın 183,34 ₺/)).toBeTruthy();
    // KK8: açılınca okundu.
    expect(mockKayit.rpc.some((r) => r.ad === 'sohbet_okundu')).toBe(true);
    expect(mockKayit.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('KK7: mesaj gönderilir; KK3: seçeneğe dokununca oy (tek oy, değiştirilebilir); KK4: sistem satırından Geri al', async () => {
    const { getByText, getByLabelText, qc } = ciz(<SohbetSekmesi />);
    await waitFor(() => getByText('Çibörek mi, balık mı?'));
    await sakinles(qc);
    fireEvent.changeText(getByLabelText('Mesaj yaz…'), '  Selam  ');
    fireEvent.press(getByLabelText('Gönder'));
    await waitFor(() => expect(mockKayit.yaz.some((y) => y.tablo === 'mesajlar')).toBe(true));
    expect(mockKayit.yaz.find((y) => y.tablo === 'mesajlar')).toEqual({ tablo: 'mesajlar', islem: 'insert', satir: { trip_id: 't1', tur: 'metin', metin: 'Selam' } });

    fireEvent.press(getByLabelText('Balık, 0 oy'));
    await waitFor(() => expect(mockKayit.yaz.some((y) => y.tablo === 'oylama_oylari')).toBe(true));
    expect(mockKayit.yaz.find((y) => y.tablo === 'oylama_oylari')).toEqual({ tablo: 'oylama_oylari', islem: 'upsert', satir: { oylama_id: 'o1', trip_id: 't1', secenek_id: 'b', user_id: 'ben' } });

    fireEvent.press(within(getByText(/Kurşunlu Külliyesi mekanını 2\. güne taşıdı/)).getByText('Geri al'));
    await waitFor(() => expect(mockKayit.rpc.some((r) => r.ad === 'degisikligi_geri_al')).toBe(true));
    expect(mockKayit.rpc.find((r) => r.ad === 'degisikligi_geri_al')!.args).toEqual({ c: 10 });
  });
});

describe('#184 KK10 Gezi sayfası Sohbet kartı', () => {
  it('açık oylama: soru, seçenek sayıları, "Oy ver", "Sohbete git · 2 yeni" — Google isteği yok', async () => {
    const { getByText, qc } = ciz(<GeziEkrani />);
    await waitFor(() => getByText('Sohbete git · 2 yeni'));
    await sakinles(qc);
    expect(getByText('Cumartesi akşam için oylama açtım:')).toBeTruthy();
    expect(getByText('Çibörek · Hacı Baba · 2')).toBeTruthy();
    expect(getByText('Balık · 0')).toBeTruthy();
    expect(getByText('Oy ver')).toBeTruthy();
    expect(mockKayit.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });
});
