// #317 KK5: Yer ekle (Keşfet) ekran testi — ekleme hatası, 429 ve çevrimdışı hali; hata her halde (çekmece tam, panel açık)
// hata katmanında görünür (KK1). İyimser ekleme (KK3) ve `yer_eklendi` kaynağı (KK4) da sınanır.
// Ekran gerçek kancalarıyla çizilir; harita (yerel modül), mekan paneli (places-full) ve öneri yükleyicisi taklit edilir.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { kesfetDurumunuAl, kesfetDurumunuSifirla } from '@/features/yerler/kesfetDurumu';
import { hafifOnbellek, type HafifYer } from '@/features/yerler/api';
import { HATA_KATMANI } from '@/components/harita/HaritaEkrani';
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
}));

// Supabase: tablolar fikstürden; `places` eklemesi bekletilebilir / hata verebilir; `olaylar` eklemesi kaydedilir.
const mockTablolar: Record<string, unknown[]> = {};
const mockEkleme: { hata: unknown; bekle: Promise<void> | null } = { hata: null, bekle: null };
const mockOlaylar: unknown[] = [];
jest.mock('@/lib/supabase', () => {
  const zincir = (tablo: string): unknown =>
    new Proxy(
      {},
      {
        get(_h, ad) {
          if (ad === 'then') return (coz: (v: unknown) => unknown) => Promise.resolve({ data: mockTablolar[tablo] ?? [], error: null }).then(coz);
          if (ad === 'single' || ad === 'maybeSingle')
            return () => ({ then: (coz: (v: unknown) => unknown) => Promise.resolve({ data: (mockTablolar[tablo] ?? [])[0] ?? null, error: null }).then(coz) });
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
    places: [],
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
  mockCevrimdisi = false;
  mockYakin = { hata: false, sinir: false };
  mockParametre = {};
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

const hataKatmani = async () => within(await screen.findByTestId('harita-hata'));

describe('#317 Yer ekle: hatalar ve iyimser ekleme', () => {
  it('KK3 + KK1: ekleme iyimser — pin hemen tik alır; hata olunca geri döner, hata panel açıkken görünür', async () => {
    let birak!: () => void;
    mockEkleme.bekle = new Promise((c) => (birak = c));
    mockEkleme.hata = { code: '42501', message: 'izin yok' };
    ciz();
    const pin = await screen.findByTestId(`pin-o:${ONERI.place_id}`);
    fireEvent.press(pin);
    fireEvent.press(await screen.findByTestId('panel-cta'));
    // Sunucu cevabı gelmeden pin listede (dolu) ve panel "çıkar" halinde, meşgul.
    await screen.findByTestId(`pin-m:${ONERI.place_id}`);
    expect(screen.getByTestId('panel-cta').props.accessibilityState.busy).toBe(true);
    await act(async () => birak());
    // Hata: pin öneriye döner, hata katmanı panel açıkken de görünür.
    await screen.findByTestId(`pin-o:${ONERI.place_id}`);
    expect(screen.queryByTestId(`pin-m:${ONERI.place_id}`)).toBeNull();
    expect((await hataKatmani()).getByText(t('kesfet.ekleHata'))).toBeTruthy();
    expect(screen.getByTestId('panel-cta')).toBeTruthy();
    expect(mockOlaylar).toHaveLength(0);
  });

  it('KK4: başarılı eklemede yer_eklendi, kaynak = pin', async () => {
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await waitFor(() => expect(mockOlaylar).toHaveLength(1));
    expect(mockOlaylar[0]).toMatchObject({ tur: 'yer_eklendi', hedef_id: null, meta: { seyahat: 't1', place_id: ONERI.place_id, kaynak: 'pin' } });
    expect(screen.queryByTestId('harita-hata')).toBeNull();
  });

  it('KK2: ekran yeniden kurulunca aramadan seçilen yerin pini geri gelir', async () => {
    const aranan: HafifYer = { ...ONERI, place_id: 'ChIJ-arama-1', ad: 'Yılmaz Büyükerşen Balmumu Heykeller Müzesi' };
    const d = kesfetDurumunuAl('t1');
    d.aramaSonucu = aranan;
    d.secim = { place_id: aranan.place_id, kaynak: 'arama' };
    ciz();
    expect(await screen.findByTestId(`pin-o:${aranan.place_id}`)).toBeTruthy();
  });

  it('KK1: 429 (günlük sınır) çekmece tam halde de hata katmanında görünür', async () => {
    mockYakin = { hata: true, sinir: true };
    mockParametre = { cekmece: 'rehber' };
    ciz();
    expect(await (await hataKatmani()).findByText(t('yerler.gunlukSinir'))).toBeTruthy();
  });

  it('KK1: çevrimdışında tek uyarı "Bağlantı yok" (öneri hatası onun yerine)', async () => {
    mockCevrimdisi = true;
    mockYakin = { hata: true, sinir: false };
    ciz();
    expect(await (await hataKatmani()).findByText(t('geziSayfasi.cevrimdisi.baglantiYok'))).toBeTruthy();
    expect(screen.queryByText(t('kesfet.oneriHata'))).toBeNull();
  });

  it('KK1: eklemede ağ hatası "Bağlantı yok" der', async () => {
    mockEkleme.hata = { message: 'TypeError: Network request failed', code: '' };
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    expect(await (await hataKatmani()).findByText(t('geziSayfasi.cevrimdisi.baglantiYok'))).toBeTruthy();
  });
});

describe('#317 inceleme: hata kutusu takılmaları', () => {
  it('1: ekleme hatası panel kapanınca kalkar', async () => {
    mockEkleme.hata = { code: '42501', message: 'izin yok' };
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    expect(await (await hataKatmani()).findByText(t('kesfet.ekleHata'))).toBeTruthy();
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await waitFor(() => expect(screen.queryByTestId('harita-hata')).toBeNull());
  });

  it('1: 429 panel kapanınca kalkar', async () => {
    mockYakin = { hata: true, sinir: true };
    ciz();
    expect(await (await hataKatmani()).findByText(t('yerler.gunlukSinir'))).toBeTruthy();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-kapat'));
    await waitFor(() => expect(screen.queryByTestId('harita-hata')).toBeNull());
  });

  it('1: "Bağlantı yok" panel kapanınca kalmaz, yalnız bağlantı dönünce kalkar', async () => {
    mockCevrimdisi = true;
    const r = ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-kapat'));
    expect((await hataKatmani()).getByText(t('geziSayfasi.cevrimdisi.baglantiYok'))).toBeTruthy();
    mockCevrimdisi = false;
    r.rerender(<KesfetEkrani />);
    await waitFor(() => expect(screen.queryByTestId('harita-hata')).toBeNull());
  });

  it('2: arama sonuçları açıkken hata katmanı gizlenir', async () => {
    mockYakin = { hata: true, sinir: true };
    ciz();
    await hataKatmani();
    fireEvent.changeText(screen.getByLabelText(t('kesfet.ara')), 'Odun');
    await waitFor(() => expect(screen.queryByTestId('harita-hata')).toBeNull());
    expect(screen.queryByText(t('yerler.gunlukSinir'))).toBeNull();
  });

  it('2: arama açıkken "Bağlantı yok" sonuç listesinin altında', async () => {
    mockCevrimdisi = true;
    ciz();
    await hataKatmani();
    fireEvent.changeText(screen.getByLabelText(t('kesfet.ara')), 'Odun');
    const alt = await screen.findByTestId('sonuc-alti-hata');
    expect(within(alt).getByText(t('geziSayfasi.cevrimdisi.baglantiYok'))).toBeTruthy();
    expect(screen.queryByTestId('harita-hata')).toBeNull();
  });

  it('3: iOS ekran okuyucusuna kutu göründüğünde duyurulur', async () => {
    const eskiOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const duyur = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    try {
      mockYakin = { hata: true, sinir: true };
      ciz();
      await hataKatmani();
      await waitFor(() => expect(duyur).toHaveBeenCalledWith(t('yerler.gunlukSinir')));
    } finally {
      duyur.mockRestore();
      Object.defineProperty(Platform, 'OS', { value: eskiOS, configurable: true });
    }
  });

  it('4: hata katmanı alt sayfanın (elevation 12) üstünde', async () => {
    mockYakin = { hata: true, sinir: true };
    ciz();
    await hataKatmani();
    const stil = StyleSheet.flatten(screen.getByTestId('harita-hata').props.style);
    expect(HATA_KATMANI).toBeGreaterThan(12);
    expect(stil.zIndex).toBe(HATA_KATMANI);
    expect(stil.elevation).toBe(HATA_KATMANI);
  });
});

