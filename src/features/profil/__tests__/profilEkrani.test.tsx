// #205 KK5: Profil'de OSM atfı — "Hesabı sil"in altında, dokununca OSM telif sayfası açılır.
// #275 KK4 (kanvas 29d): Profil › Gezilerim · N (geçmiş seyahatler, Tekrar kur) ve Ayarlar sekmeleri; "‹ Keşfet" dönüşü.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { SeyahatOzet } from '@/lib/tipler';

import ProfilEkrani from '../../../app/(tabs)/profil';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: async () => ({ status: 'granted' }) }));
jest.mock('@/lib/izler', () => ({ sonHatayiOku: async () => null, sonHatayiSil: () => undefined }));
jest.mock('@/features/auth/giris', () => ({ cikis: jest.fn() }));
jest.mock('@/features/profil/sorgular', () => ({
  useProfil: () => ({ data: { name: 'Deneme', username: 'deneme', photo_url: null, map_visibility: 'friends' } }),
  useProfilGuncelle: () => ({ mutate: jest.fn() }),
  useProfilSayilari: () => ({ data: { seyahat: 1, gezilen: 2, sehir: 1 }, refetch: jest.fn() }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/seyahatler/durum', () => ({
  ...jest.requireActual<object>('@/features/seyahatler/durum'),
  useSeyahatDurumlari: () => ({ data: new Map([['eski', { trip_id: 'eski', gun: 3, planli_gun: 3, atanmamis: 0, gezilen: 12 }]]) }),
}));
jest.mock('@/features/davet/sorgular', () => ({ useSeyahattenAyril: () => ({ mutateAsync: jest.fn() }) }));
const uye = { user_id: 'ben', role: 'owner' };
const seyahat = (id: string, city_label: string, start_date: string | null, end_date: string | null) =>
  ({ id, name: null, city_label, start_date, end_date, tz: 'Europe/Istanbul', members: [uye, { ...uye, user_id: 'o', role: 'member' }], places: [{ count: 0 }], stays: [], hotel_place_id: null }) as unknown as SeyahatOzet;
let mockSeyahatler: SeyahatOzet[] = [];
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatler: () => ({ data: mockSeyahatler }),
  useSeyahatSil: () => ({ mutateAsync: jest.fn() }),
}));
let mockParametre: { sekme?: string } = {};
jest.mock('expo-router', () => {
  const { Fragment } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParametre,
    Link: Fragment,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  };
});

const { router: mockRouter } = jest.requireMock<{ router: Record<'push' | 'navigate' | 'back' | 'replace', jest.Mock> }>('expo-router');

let istemci: QueryClient | undefined;
// gcTime sonsuz: gözlemcisi kalkan sorgu zamanlayıcı kurmaz (jest açık kalmaz); test sonunda önbellek boşaltılır.
afterEach(() => {
  istemci?.clear();
  mockParametre = {};
  mockSeyahatler = [];
  jest.clearAllMocks();
});

const ciz = () => {
  istemci = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={istemci}>
      <ProfilEkrani />
    </QueryClientProvider>,
  );
};

describe('Profil OSM atfı', () => {
  it('metni gösterir ve telif sayfasını açar', async () => {
    const ac = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockParametre = { sekme: 'ayarlar' };
    const ekran = ciz();
    // Konum izni sorgusu ve son hata okuması bitsin: sonraki durum güncellemesi act() dışında kalmasın.
    await waitFor(() => expect(istemci?.isFetching()).toBe(0));
    const atif = await waitFor(() => ekran.getByRole('link', { name: 'Konum verisi: © OpenStreetMap katkıda bulunanlar' }));
    expect(ekran.getByText('© OpenStreetMap katkıda bulunanlar')).toBeTruthy();
    fireEvent.press(atif);
    expect(ac).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
  });
});

describe('Profil › Gezilerim (#275 KK4)', () => {
  it('açılışta Gezilerim seçili; yalnız geçmiş seyahatler, sayıyla; Tekrar kur sihirbazı açar', async () => {
    mockSeyahatler = [seyahat('eski', 'Eskişehir', '2026-10-01', '2026-10-03'), seyahat('gelecek', 'Bursa', '2099-01-01', '2099-01-02'), seyahat('taslak', 'İzmir', null, null)];
    const ekran = ciz();
    await waitFor(() => expect(istemci?.isFetching()).toBe(0));
    const sekme = ekran.getByRole('tab', { name: 'Gezilerim · 1' });
    expect(sekme.props.accessibilityState).toMatchObject({ selected: true });
    expect(ekran.getByText('Eskişehir')).toBeTruthy();
    expect(ekran.getByText('Ekim 2026 · 12 mekan gezildi · 2 kişi')).toBeTruthy();
    expect(ekran.queryByText('Bursa')).toBeNull();
    expect(ekran.queryByText('İzmir')).toBeNull();
    // Ayarlar satırları bu sekmede yok.
    expect(ekran.queryByText('Çıkış yap')).toBeNull();
    fireEvent.press(ekran.getByText('Tekrar kur'));
    expect(mockRouter.navigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ tekrar: 'eski' }) }));
  });

  it('geçmiş yoksa boş metin; Ayarlar sekmesine geçilir; ‹ Keşfet geri döner', async () => {
    const ekran = ciz();
    await waitFor(() => expect(istemci?.isFetching()).toBe(0));
    expect(ekran.getByRole('tab', { name: 'Gezilerim · 0' })).toBeTruthy();
    expect(ekran.getByText('Biten seyahatlerin burada durur.')).toBeTruthy();
    fireEvent.press(ekran.getByRole('tab', { name: 'Ayarlar' }));
    await waitFor(() => expect(ekran.getByText('Çıkış yap')).toBeTruthy());
    fireEvent.press(ekran.getByRole('button', { name: 'Keşfet' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
