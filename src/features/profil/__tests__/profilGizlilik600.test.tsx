// #600 (Ürün, PR inceleme): Ayarlar'da değişen harita gizliliği Profil v12'ye yansır (`useProfilGuncelle` profil özetini de
// geçersiz kılar); arkadaş haritasını "yalnız ben"e çektiyse istekler, rozetler ve yol arkadaşı sayısı görünmez.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProfilV12 } from '@/components/profil/ProfilV12';
import type { ProfilOzeti } from '@/features/profil/profilV12';
import type { HaritaGizliligi } from '@/lib/tipler';

import AyarlarEkrani from '../../../app/ayarlar';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: async () => ({ status: 'granted' }) }));
jest.mock('@/lib/izler', () => ({ sonHatayiOku: async () => null, sonHatayiSil: () => undefined }));
jest.mock('@/features/auth/giris', () => ({ cikis: jest.fn() }));
jest.mock('@/features/icerik/sorgular', () => ({ useSehirler: () => ({ data: [] }) }));
jest.mock('@/lib/baglanti', () => ({ useCevrimdisi: () => false }));
jest.mock('@/components/paylasim/PaylasimCekmecesi', () => ({ PaylasimCekmecesi: () => null }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ece' } }, hazir: true, hesapli: true }) }));
jest.mock('expo-router', () => {
  const { Fragment } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    Link: Fragment,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  };
});

// Sunucu: tek kullanıcının gizlilik ayarı; profil satırı ve profil özeti ondan okunur.
let mockGizlilik: HaritaGizliligi = 'friends';
let mockOzet: ProfilOzeti | null = null;
jest.mock('@/lib/supabase', () => {
  const profil = () => ({ id: 'ece', name: 'Ece Özçınar', username: 'ece', photo_url: null, map_visibility: mockGizlilik });
  const zincir = (): Record<string, unknown> => {
    const z: Record<string, unknown> = {};
    z.select = () => z;
    z.eq = () => z;
    z.update = (d: { map_visibility?: HaritaGizliligi }) => {
      if (d.map_visibility) mockGizlilik = d.map_visibility;
      return z;
    };
    z.single = async () => ({ data: profil(), error: null });
    z.maybeSingle = async () => ({ data: profil(), error: null });
    return z;
  };
  return {
    supabase: {
      from: () => zincir(),
      rpc: jest.fn(async () => ({ data: mockOzet ?? { ...mockKendiOzet(), gizlilik: mockGizlilik }, error: null })),
      functions: { invoke: jest.fn() },
    },
  };
});

const mockKendiOzet = (): ProfilOzeti => ({
  id: 'ece',
  ad: 'Ece Özçınar',
  foto: null,
  kendi: true,
  gizlilik: 'friends',
  harita_acik: true,
  gidilen: [6, 34],
  istek: [36],
  benim_istek: null,
  yol_arkadasi: 2,
  rozetler: { lezzet: 3 },
  geziler: [],
});

let istemci: QueryClient | undefined;
afterEach(() => {
  istemci?.clear();
  mockGizlilik = 'friends';
  mockOzet = null;
  jest.clearAllMocks();
});
const yeniIstemci = () =>
  (istemci = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } }));

describe('#600 madde 1: Ayarlar → Profil gizlilik', () => {
  it('Ayarlar\'da "Sadece ben" seçilince Profil satırı "yalnız sen" der', async () => {
    const qc = yeniIstemci();
    const profil = render(
      <QueryClientProvider client={qc}>
        <ProfilV12 kisi="ece" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(profil.getByText('Haritanı arkadaşların görüyor · Değiştir')).toBeTruthy());

    const ayarlar = render(
      <QueryClientProvider client={qc}>
        <AyarlarEkrani />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ayarlar.getByText('Arkadaşlarım')).toBeTruthy());
    fireEvent.press(ayarlar.getByText('Haritanı kimler görsün'));
    fireEvent.press(ayarlar.getByText('Sadece ben'));

    await waitFor(() => expect(profil.getByText('Haritanı yalnız sen görüyorsun · Değiştir')).toBeTruthy());
    expect(mockGizlilik).toBe('me');
  });
});

describe('#600 madde 2: arkadaşın haritası "yalnız ben"', () => {
  it('yalnız ad, foto ve "{Ad} ile gezi planla"; istekler, rozetler, yol arkadaşı sayısı yok', async () => {
    mockOzet = {
      ...mockKendiOzet(),
      id: 'deniz',
      ad: 'Deniz Kaya',
      kendi: false,
      gizlilik: null,
      harita_acik: false,
      gidilen: null,
      istek: [],
      benim_istek: [36],
      yol_arkadasi: null,
      rozetler: {},
    };
    const qc = yeniIstemci();
    const e = render(
      <QueryClientProvider client={qc}>
        <ProfilV12 kisi="deniz" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(e.getByText('Deniz Kaya')).toBeTruthy());
    expect(e.queryByText(/yol arkadaşı/)).toBeNull();
    expect(e.queryByTestId('profil-harita')).toBeNull();
    expect(e.queryByText('Gitmek istediği yerler')).toBeNull();
    expect(e.queryAllByTestId(/^rozet-/)).toHaveLength(0);
    expect(e.queryByText('Rozetler')).toBeNull();
    expect(e.getByText('Deniz ile gezi planla')).toBeTruthy();
  });
});
