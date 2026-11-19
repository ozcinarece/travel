// #405 KK2 · KK5 (kanvas `Ana_v6_Seyahatlerim`): Seyahatlerim sekmesi — YAKLAŞAN (en yakını büyük kapakla), GEÇMİŞ, boş hal.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { SeyahatOzet } from '@/lib/tipler';

import SeyahatlerimEkrani from '../../../app/(tabs)/(menu)/seyahatler';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: async () => ({ status: 'granted' }) }));
jest.mock('@/lib/izler', () => ({ sonHatayiOku: async () => null, sonHatayiSil: () => undefined }));
jest.mock('@/features/auth/giris', () => ({ cikis: jest.fn() }));
jest.mock('@/features/profil/sorgular', () => ({
  useProfil: () => ({ data: { name: 'Deneme', username: 'deneme', photo_url: null, map_visibility: 'friends' } }),
  useProfilGuncelle: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/anasayfa/serit', () => ({
  ...jest.requireActual<object>('@/features/anasayfa/serit'),
  useSeritAdimi: () => ({ tur: 'otel' }),
}));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/seyahatler/durum', () => ({
  ...jest.requireActual<object>('@/features/seyahatler/durum'),
  useSeyahatDurumlari: () => ({ data: new Map([['eski', { trip_id: 'eski', gun: 3, planli_gun: 3, atanmamis: 0, gezilen: 12 }]]) }),
}));
jest.mock('@/features/davet/sorgular', () => ({ useSeyahattenAyril: () => ({ mutateAsync: jest.fn() }) }));
const uye = { user_id: 'ben', role: 'owner', display_name: 'Ece Ö' };
const seyahat = (id: string, city_label: string, start_date: string | null, end_date: string | null) =>
  ({ id, name: null, city_label, start_date, end_date, tz: 'Europe/Istanbul', members: [uye, { ...uye, user_id: 'o', role: 'member', display_name: 'Ayşe K' }], places: [{ count: 0 }], stays: [], hotel_place_id: null }) as unknown as SeyahatOzet;
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
      <SeyahatlerimEkrani />
    </QueryClientProvider>,
  );
};

describe('Seyahatlerim (#405 KK2)', () => {
  it('YAKLAŞAN: en yakını büyük kapakla (kalan, tarih · gün · durak, sıradaki adım), diğerleri satır; GEÇMİŞ: ay · gün · kişi; Tekrar kur', async () => {
    mockSeyahatler = [
      seyahat('eski', 'Eskişehir', '2026-09-01', '2026-09-02'),
      seyahat('gelecek', 'Bursa', '2099-01-12', '2099-01-14'),
      seyahat('sonraki', 'Mardin', '2099-03-01', '2099-03-02'),
      seyahat('taslak', 'İzmir', null, null),
    ];
    const ekran = ciz();
    await waitFor(() => expect(istemci?.isFetching()).toBe(0));
    expect(ekran.getByRole('header', { name: 'Seyahatlerim' })).toBeTruthy();
    const metinler = ekran.getAllByText(/./).map((n) => ([] as unknown[]).concat(n.props.children).join(''));
    const konumlar = ['YAKLAŞAN', 'Bursa', 'Mardin', 'İzmir', 'GEÇMİŞ', 'Eskişehir'].map((m) => metinler.indexOf(m));
    expect(konumlar.every((k) => k >= 0)).toBe(true);
    expect(konumlar).toEqual([...konumlar].sort((a, b) => a - b));
    const kart = ekran.getByTestId('seyahatlerim-buyuk-kart');
    expect(kart.props.accessibilityLabel).toMatch(/gün kaldı, Bursa, 12–14 Ocak · 3 gün · 0 durak, Sıradaki adım/);
    expect(ekran.getByText('1–2 Mart · 2 gün · 0 durak')).toBeTruthy();
    expect(ekran.getByText('Taslak · tarih yok')).toBeTruthy();
    expect(ekran.getByText('Eylül · 2 gün · Ayşe ile')).toBeTruthy();
    fireEvent.press(ekran.getByText('Mardin'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/seyahat/[id]', params: { id: 'sonraki' } });
    fireEvent.press(ekran.getByText('Tekrar kur'));
    expect(mockRouter.navigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ tekrar: 'eski' }) }));
    fireEvent.press(ekran.getByRole('button', { name: 'Yeni seyahat' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/yeni');
  });

  it('KK5: seyahat yoksa tek satır yazı ve "+ Seyahat"', async () => {
    const ekran = ciz();
    await waitFor(() => expect(istemci?.isFetching()).toBe(0));
    expect(ekran.getByText('Henüz seyahatin yok.')).toBeTruthy();
    expect(ekran.getByRole('button', { name: 'Yeni seyahat' })).toBeTruthy();
    expect(ekran.queryByText('YAKLAŞAN')).toBeNull();
  });
});
