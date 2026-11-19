// #387 KK5: Yer ekle (Keşfet) ekranında ✓ (panelden "Listeden çıkar") → 5 sn "Geri al" bandı → Geri al: mekan, durak ve oy
// duruyor (silme isteği hiç gitmiyor); ✓ → 5 sn → silme bir kez gidiyor. Düzen #317 testiyle aynı (kesfetHata317.test.tsx).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { kesfetDurumunuSifirla } from '@/features/yerler/kesfetDurumu';
import { hafifOnbellek, type HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';

import KesfetEkrani from '../../../app/seyahat/[id]/(sekmeler)/kesfet';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
let mockCevrimdisi = false;
jest.mock('@/lib/baglanti', () => ({
  useCevrimdisi: () => mockCevrimdisi,
  agHatasi: (e: unknown) => (e as { message?: string } | null)?.message === 'TypeError: Network request failed',
}));
let mockParametre: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParametre,
  useGlobalSearchParams: () => ({}),
}));

// Harita: pinler dokunulabilir satırlar (kimlik + tür).
jest.mock('@/components/harita/Harita', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Harita: ({ pinler, onPinBas }: { pinler: { id: string; tur: string }[]; onPinBas: (id: string) => void }) => (
      <View>
        {pinler.map((p) => (
          <Pressable key={p.id} testID={`pin-${p.id}`} onPress={() => onPinBas(p.id)}>
            <Text>{p.tur}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
// Mekan paneli: yalnız CTA (ekle / çıkar) ve meşgul hali.
jest.mock('@/components/mekan/MekanPaneli', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MekanPaneli: ({ icinde, mesgul, onCta, onKapat }: { icinde: boolean; mesgul: boolean; onCta: () => void; onKapat: () => void }) => (
      <>
        <Pressable testID="panel-cta" onPress={onCta} accessibilityState={{ busy: mesgul }}>
          <Text>{icinde ? 'cikar' : 'ekle'}</Text>
        </Pressable>
        <Pressable testID="panel-kapat" onPress={onKapat}>
          <Text>kapat</Text>
        </Pressable>
      </>
    ),
  };
});

// Arama: öneri listesi ve seçim (places-full) taklit edilir; seçim hatası testte ayarlanır.
let mockAramaSonuclari: { place_id: string; ana: string; ikincil: string }[] = [];
let mockSecimHatasi: unknown = null;
jest.mock('@/features/yerler/api', () => {
  const gercek = jest.requireActual<typeof import('@/features/yerler/api')>('@/features/yerler/api');
  return {
    ...gercek,
    useOneriler: () => ({ data: mockAramaSonuclari, isFetching: false, isError: false, error: null }),
    aramaSecimi: async () => {
      throw mockSecimHatasi ?? new Error('seçim beklenmiyordu');
    },
  };
});
const ONERI: HafifYer = { place_id: 'ChIJ-oneri-1', ad: 'Eti Arkeoloji Müzesi', lat: 39.78, lng: 30.48, primary_type: 'museum', tz: null, puan: 4.6, puan_sayisi: 900, acik: null, ulke_kodu: 'TR' };
let mockYakin = { hata: false, sinir: false };
// Liste kimliği sabit (ekran liste değişince çekmece durumunu sıfırlar).
const mockYerler = [ONERI];
const mockArananlar: never[] = [];
jest.mock('@/features/yerler/kesfetYukleme', () => ({
  useKesfetOnerileri: () => ({
    yerler: mockYerler,
    yukleniyor: false,
    hata: mockYakin.hata,
    sinir: mockYakin.sinir,
    sehirAlani: null,
    arananlar: mockArananlar,
    genisAlan: null,
    alanAraniyor: false,
    alandaAra: () => undefined,
  }),
  kesfetSayaci: { istek: 0, hata: 0 },
}));

// Supabase: tablolar fikstürden; `places` eklemesi bekletilebilir / hata verebilir; `olaylar` eklemesi kaydedilir.
const mockTablolar: Record<string, unknown[]> = {};
const mockEkleme: { hata: unknown; bekle: Promise<void> | null } = { hata: null, bekle: null };
const mockOlaylar: unknown[] = [];
const mockSilinen: { tablo: string; id: unknown }[] = [];
jest.mock('@/lib/supabase', () => {
  const zincir = (tablo: string): unknown =>
    new Proxy(
      {},
      {
        get(_h, ad) {
          if (ad === 'then') return (coz: (v: unknown) => unknown) => Promise.resolve({ data: mockTablolar[tablo] ?? [], error: null }).then(coz);
          if (ad === 'single' || ad === 'maybeSingle')
            return () => ({ then: (coz: (v: unknown) => unknown) => Promise.resolve({ data: (mockTablolar[tablo] ?? [])[0] ?? null, error: null }).then(coz) });
          if (ad === 'delete')
            return () => ({
              eq: (_k: string, v: unknown) => {
                mockSilinen.push({ tablo, id: v });
                return Promise.resolve({ error: null });
              },
            });
          if (ad === 'insert')
            return async (satir: unknown) => {
              if (tablo === 'olaylar') {
                mockOlaylar.push(satir);
                return { error: null };
              }
              if (mockEkleme.bekle) await mockEkleme.bekle;
              return { error: mockEkleme.hata };
            };
          return () => zincir(tablo);
        },
      },
    );
  return {
    supabase: {
      from: (tablo: string) => zincir(tablo),
      rpc: async () => ({ data: [], error: null }),
      functions: { invoke: async () => ({ data: null, error: { message: 'Google isteği beklenmiyordu' } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => undefined,
    },
  };
});

function fikstur() {
  Object.assign(mockTablolar, {
    trips: [{ id: 't1', name: 'Eskişehir Gezisi', city_label: 'Eskişehir', country_code: 'TR', lat: 39.7767, lng: 30.5206, tz: 'Europe/Istanbul', start_date: null, end_date: null, invite_token: 'd' }],
    stays: [],
    places: [{ id: 'm1', trip_id: 't1', place_id: ONERI.place_id, primary_type: 'museum', lat: ONERI.lat, lng: ONERI.lng, default_minutes: 60, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' }],
    days: [{ id: 'g1', trip_id: 't1', index: 1 }],
    stops: [{ id: 'd1', trip_id: 't1', day_id: 'g1', place_ref: 'm1', order_key: 'a', skipped: false }],
    members: [{ trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' }],
    profiles: [],
    sehirler: [],
  });
}

// Gerçek ağ isteği yok (açık soket jest'i kapatmaz).
const eskiFetch = globalThis.fetch;
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error('ağ isteği beklenmiyordu');
  }) as unknown as typeof fetch;
  hafifOnbellek.temizle();
  for (const k of Object.keys(mockTablolar)) delete mockTablolar[k];
  fikstur();
  mockEkleme.hata = null;
  mockEkleme.bekle = null;
  mockOlaylar.length = 0;
  mockSilinen.length = 0;
  mockCevrimdisi = false;
  mockYakin = { hata: false, sinir: false };
  mockParametre = {};
  mockAramaSonuclari = [];
  mockSecimHatasi = null;
  kesfetDurumunuSifirla();
});
afterEach(async () => {
  while (acik.length) {
    const r = acik.pop()!;
    r.unmount();
    // Yolda kalan (yeniden denenen) sorgular durdurulur; yoksa bitince 24 sa'lik gc zamanlayıcısı jest'i açık tutar.
    await r.qc.cancelQueries();
    r.qc.clear();
  }
  globalThis.fetch = eskiFetch;
});

function ciz() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<KesfetEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}



describe('#387 Keşfet: ✓ geri alınabilir', () => {
  it('✓ → bant "{ad} 1. günden de çıktı" → Geri al: silme isteği gitmez, pin listede kalır', async () => {
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    jest.useFakeTimers();
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByText(`${ONERI.ad} 1. günden de çıktı`)).toBeTruthy();
    // Bant açıkken pin öneriye döner (listede sayılmaz).
    expect(screen.getByTestId(`pin-o:${ONERI.place_id}`)).toBeTruthy();
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    act(() => jest.advanceTimersByTime(6000));
    jest.useRealTimers();
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(await screen.findByTestId(`pin-m:${ONERI.place_id}`)).toBeTruthy();
    expect(mockSilinen).toEqual([]);
  });

  it('✓ → 5 sn → mekan bir kez silinir', async () => {
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    jest.useFakeTimers();
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    act(() => jest.advanceTimersByTime(4900));
    expect(mockSilinen).toEqual([]);
    act(() => jest.advanceTimersByTime(200));
    jest.useRealTimers();
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'places', id: 'm1' }]));
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
  });

  it('bant açıkken aynı mekan yeniden eklenirse çıkarma geri alınır (ekleme isteği de gitmez)', async () => {
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    expect(within(screen.getByTestId('panel-cta')).getByText('ekle')).toBeTruthy();
    fireEvent.press(screen.getByTestId('panel-cta'));
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(mockOlaylar).toHaveLength(0);
    expect(mockSilinen).toEqual([]);
  });

  it('bant açıkken ekrandan çıkılırsa silinir', async () => {
    const { unmount } = ciz();
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    unmount();
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'places', id: 'm1' }]));
  });
});
