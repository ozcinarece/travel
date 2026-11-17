// #275 (kanvas 29a): alt menü yok — ana ekranın üst çubuğunda Ara · ♥ Kaydettiklerim · Profil, altta yüzen [+ Yeni seyahat];
// seyahat silinip dönülünce kısa bildirim.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AnaSayfa from '../../../app/(tabs)/index';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { name: 'Ece Ö', photo_url: null } }) }));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: [], isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }) }));
jest.mock('@/features/icerik/sorgular', () => ({ useGeziler: () => ({ data: [], refetch: jest.fn() }) }));
jest.mock('@/features/davet/sorgular', () => ({
  bekleyenDavetiOku: async () => null,
  bekleyenDavetiSil: async () => undefined,
  useDavetKarsilama: () => ({ data: null, isError: false }),
  useDavetKarsilandi: () => async () => undefined,
}));
let mockParametre: { bildirim?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParametre,
}));
const { router } = jest.requireMock<{ router: Record<'push', jest.Mock> }>('expo-router');

describe('Ana ekran üst çubuk ve yüzen düğme (#275 KK2–KK3)', () => {
  it('Ara, Kaydettiklerim ve Profil sırayla; dokununca kendi ekranlarına gider', async () => {
    const ekran = render(<AnaSayfa />);
    const ara = await waitFor(() => ekran.getByRole('button', { name: 'Ara' }));
    fireEvent.press(ara);
    expect(router.push).toHaveBeenLastCalledWith('/ara');
    fireEvent.press(ekran.getByRole('button', { name: 'Kaydettiklerim' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/kaydettiklerim');
    fireEvent.press(ekran.getByRole('button', { name: 'Profil' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/profil');
  });

  it('yüzen [+ Yeni seyahat] sihirbazı açar', async () => {
    const ekran = render(<AnaSayfa />);
    fireEvent.press(await waitFor(() => ekran.getByRole('button', { name: 'Yeni seyahat' })));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
  });

  it('silindi parametresiyle gelince "Seyahat silindi" bildirimi', async () => {
    mockParametre = { bildirim: 'silindi' };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahat silindi')).toBeTruthy());
    mockParametre = {};
  });
});
