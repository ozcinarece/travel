// #183: Harcamalar sekmesi (KK1–KK3), Harcama ekle formu (KK4: paylar ve yuvarlama), Bakiyeler (KK6: ödeşme) ve Gezi sayfası
// (KK8 özet kartı, KK9 8. adım) gerçek kancalarıyla çizilir. Supabase sahte: tablolar fikstürden; yazmalar (rpc, insert) kaydedilir;
// Edge Function çağrıları ve fetch sayılır — bu ekranların hiçbiri Google'a gitmez.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { paraMetni } from '@/features/harcama/hesap';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';

import BakiyelerEkrani from '../../../app/seyahat/[id]/bakiyeler';
import GeziEkrani from '../../../app/seyahat/[id]/(sekmeler)/gezi';
import HarcamaSekmesi from '../../../app/seyahat/[id]/(sekmeler)/harcama';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
// Geri hapı harita bileşeniyle aynı dosyada; yerel harita modülü jest'te yok.
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
const mockKayit = { invoke: [] as string[], rpc: [] as { ad: string; args: Record<string, unknown> }[], ekle: [] as { tablo: string; satir: unknown }[] };
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
        if (ad === 'insert') {
          return (satir: unknown) => {
            mockKayit.ekle.push({ tablo, satir });
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
    from: (tablo: string) => mockSorgu(tablo),
    rpc: async (ad: string, args: Record<string, unknown>) => {
      mockKayit.rpc.push({ ad, args });
      if (ad === 'harcama_kaydet') return { data: 'yeni-harcama', error: null };
      if (ad === 'icerik_mekan_bilgileri') return { data: [], error: null };
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
const pay = (user_id: string, pay_kurus: number) => ({ user_id, pay_kurus });
const harcama = (id: string, aciklama: string, tl: number, odeyen: string, paylar: { user_id: string; pay_kurus: number }[], created_at: string, kategori = 'yemek') => ({
  id,
  trip_id: 't1',
  aciklama,
  tutar_kurus: tl,
  para_birimi: 'TRY',
  tl_kurus: tl,
  kategori,
  odeyen_id: odeyen,
  stop_id: null,
  fis_yolu: null,
  olusturan: odeyen,
  created_at,
  updated_at: created_at,
  harcama_paylari: paylar,
});

/** Üç kişi (Ece = ben, sahip; Ayşe; Mert). Ece 550'yi üçe, Mert 90'ı üçe böldü → Ayşe Ece'ye borçlu, Mert de. */
function fikstur(baslangic: string, gunAdedi = 3): Tablolar {
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
        end_date: tarihEkle(baslangic, gunAdedi - 1),
        hotel_place_id: null,
        hotel_lat: null,
        hotel_lng: null,
        hotel_label: null,
        day_start: '09:00:00',
        day_end: '20:00:00',
        invite_token: 'davet123',
      },
    ],
    days: Array.from({ length: gunAdedi }, (_, i) => ({ id: `g${i + 1}`, trip_id: 't1', index: i + 1, date: tarihEkle(baslangic, i), start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null })),
    places: [],
    stops: [],
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
    harcamalar: [
      harcama('h1', 'Tramvay', 9000, 'mert', [pay('ben', 3000), pay('ayse', 3000), pay('mert', 3000)], '2026-10-17T11:00:00Z', 'ulasim'),
      harcama('h2', 'Çibörek öğle yemeği', 55000, 'ben', [pay('ben', 18334), pay('ayse', 18333), pay('mert', 18333)], '2026-10-17T09:30:00Z'),
      harcama('h3', 'Kahve', 18000, 'ben', [pay('ben', 18000)], '2026-10-16T08:00:00Z'),
    ],
    odesmeler: [],
    odeme_bilgileri: [{ user_id: 'ayse', iban: 'TR330006100519786457841326' }],
    changes: [],
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
  mockKayit.ekle = [];
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
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};
const googleYok = () => {
  expect(mockKayit.invoke).toEqual([]);
  expect(fetchSahte).not.toHaveBeenCalled();
};

describe('#183 Harcamalar sekmesi', () => {
  it('KK1–KK2: toplam, kişi başı, senin durumun + kime ne; günlere göre liste, satır özeti ve payın', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), 10));
    const { getByText, getAllByText, qc } = ciz(<HarcamaSekmesi />);
    await waitFor(() => getByText('Toplam · 3 kişi'));
    await sakinles(qc);
    expect(getByText('820 ₺')).toBeTruthy();
    expect(getByText('kişi başı 273 ₺')).toBeTruthy();
    // Ece: 550 + 180 ödedi; payları 30 + 183,34 + 180 → +336,66. Ayşe 213,33, Mert 123,33 borçlu (sadeleştirilmiş).
    expect(getByText('+336,66 ₺')).toBeTruthy();
    expect(getByText('Ayşe 213,33 · Mert 123,33')).toBeTruthy();
    expect(getByText('Tümü · 3')).toBeTruthy();
    expect(getByText('Benim · 2')).toBeTruthy();
    expect(getByText('CUMARTESİ 17')).toBeTruthy();
    expect(getByText('Mert ödedi · 3\'e eşit')).toBeTruthy();
    expect(getByText('sen ödedin · yalnız sen')).toBeTruthy();
    expect(getByText('payın 183,34 ₺')).toBeTruthy();
    expect(getAllByText('payın 30 ₺')).toHaveLength(1);
    // Filtre: Benim → yalnız Ece'nin ödedikleri.
    fireEvent.press(getByText('Benim · 2'));
    await waitFor(() => expect(() => getByText('Tramvay')).toThrow());
    googleYok();
  });

  it('KK4: "+ Harcama" → 100 ₺ üçe eşit; kuruş farkı ödeyene; harcama_kaydet payları ₺ toplamına eşit', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), 10));
    const { getByText, getByLabelText, getAllByText, qc } = ciz(<HarcamaSekmesi />);
    await waitFor(() => getByText('Toplam · 3 kişi'));
    await sakinles(qc);
    fireEvent.press(getByLabelText('Harcama ekle'));
    await waitFor(() => getByLabelText('Tutar'));
    fireEvent.changeText(getByLabelText('Tutar'), '100');
    fireEvent.changeText(getByLabelText('Açıklama (ör. Tramvay)'), 'Müze');
    fireEvent.press(getByText('Bilet'));
    await waitFor(() => expect(getAllByText('33,34 ₺')).toHaveLength(1));
    expect(getAllByText('33,33 ₺')).toHaveLength(2);
    // Mert bölüşümden çıkar → ikiye.
    fireEvent.press(getByLabelText('Mert bölüşümde'));
    await waitFor(() => expect(getAllByText('50 ₺')).toHaveLength(2));
    fireEvent.press(getByText('Kaydet'));
    await waitFor(() => expect(mockKayit.rpc.some((r) => r.ad === 'harcama_kaydet')).toBe(true));
    const args = mockKayit.rpc.find((r) => r.ad === 'harcama_kaydet')!.args;
    expect(args).toMatchObject({ p_trip_id: 't1', p_id: null, p_aciklama: 'Müze', p_tutar_kurus: 10000, p_para_birimi: 'TRY', p_tl_kurus: 10000, p_kategori: 'bilet', p_odeyen: 'ben', p_stop_id: null });
    expect(args.p_paylar).toEqual([
      { user_id: 'ben', pay_kurus: 5000 },
      { user_id: 'ayse', pay_kurus: 5000 },
    ]);
    googleYok();
  });

  it('KK5: döviz — 45 € × 36,25 = 1.631,25 ₺; paylar ₺ üzerinden', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), 10));
    const { getByText, getByLabelText, qc } = ciz(<HarcamaSekmesi />);
    await waitFor(() => getByText('Toplam · 3 kişi'));
    await sakinles(qc);
    fireEvent.press(getByLabelText('Harcama ekle'));
    await waitFor(() => getByLabelText('Tutar'));
    fireEvent.changeText(getByLabelText('Tutar'), '45');
    fireEvent.press(getByLabelText('Para birimi'));
    fireEvent.press(getByText('€ EUR'));
    fireEvent.changeText(getByLabelText('1 EUR kaç ₺'), '36,25');
    await waitFor(() => getByText(`≈ ${paraMetni(163125)}`));
    fireEvent.press(getByText('Kaydet'));
    await waitFor(() => expect(mockKayit.rpc.some((r) => r.ad === 'harcama_kaydet')).toBe(true));
    const args = mockKayit.rpc.find((r) => r.ad === 'harcama_kaydet')!.args as { p_paylar: { pay_kurus: number }[] };
    expect(args).toMatchObject({ p_tutar_kurus: 4500, p_para_birimi: 'EUR', p_tl_kurus: 163125 });
    expect(args.p_paylar.reduce((a, p) => a + p.pay_kurus, 0)).toBe(163125);
  });
});

describe('#183 KK6 Bakiyeler', () => {
  it('kişi kartları, sadeleştirilmiş "Kim kime"; alan kişi "Ödendi işaretle" → ödeşme kaydı', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), 10));
    const { getByText, getAllByText, qc } = ciz(<BakiyelerEkrani />);
    await waitFor(() => getByText('Kim kime'));
    await sakinles(qc);
    expect(getByText('−213,33 ₺')).toBeTruthy();
    expect(getAllByText('sana')).toHaveLength(2);
    fireEvent.press(getAllByText('Ödendi işaretle')[0]);
    await waitFor(() => expect(mockKayit.ekle).toHaveLength(1));
    expect(mockKayit.ekle[0]).toEqual({ tablo: 'odesmeler', satir: { trip_id: 't1', kimden: 'ayse', kime: 'ben', tl_kurus: 21333 } });
    googleYok();
  });
});

describe('#183 Gezi sayfası', () => {
  it('KK8: plan modunda özet kartı (toplam, Sana borçlular) — Google isteği yok', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), 10));
    const { getByText, qc } = ciz(<GeziEkrani />);
    await waitFor(() => getByText('Toplam harcama'));
    await sakinles(qc);
    expect(getByText('820 ₺')).toBeTruthy();
    expect(getByText('Sana borçlular')).toBeTruthy();
    expect(getByText('+336,66 ₺')).toBeTruthy();
    googleYok();
  });

  it('KK9 · KK7: gezi bitti ve açık borç var → "Harcamaları kapat" ve uygulama içi hatırlatma', async () => {
    mockTablolar = fikstur(tarihEkle(yerelTarih(new Date(), IST), -5));
    const { getByText, qc } = ciz(<GeziEkrani />);
    await waitFor(() => getByText('Gezi bitti · harcamaları kapat'));
    await sakinles(qc);
    expect(getByText('2 transferle herkes ödeşir')).toBeTruthy();
    expect(getByText('Gezi bitti · kim kime ne borçlu')).toBeTruthy();
    expect(getByText('Sana borçlular: Ayşe 213,33 ₺ · Mert 123,33 ₺')).toBeTruthy();
    googleYok();
  });
});
