// #205 KK5: Profil'de OSM atfı — "Hesabı sil"in altında, dokununca OSM telif sayfası açılır.
import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

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
jest.mock('expo-router', () => {
  const { Fragment } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    Link: Fragment,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  };
});

describe('Profil OSM atfı', () => {
  it('metni gösterir ve telif sayfasını açar', async () => {
    const ac = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const istemci = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ekran = render(
      <QueryClientProvider client={istemci}>
        <ProfilEkrani />
      </QueryClientProvider>,
    );
    const atif = await waitFor(() => ekran.getByRole('link', { name: 'Konum verisi: © OpenStreetMap katkıda bulunanlar' }));
    expect(ekran.getByText('© OpenStreetMap katkıda bulunanlar')).toBeTruthy();
    fireEvent.press(atif);
    expect(ac).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
  });
});
