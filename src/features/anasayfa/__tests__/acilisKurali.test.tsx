// #276 KK2 · KK5: gezi günündeki kullanıcı açılışta bir kez doğrudan Gezi sayfasına iner; davet akışı önce gelir.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';

import { acilisKarariniSifirla } from '@/lib/acilis';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import AnaSayfa from '../../../app/(tabs)/index';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { name: 'Ece Ö', photo_url: null } }) }));
let mockSeyahatler: SeyahatOzet[] = [];
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: mockSeyahatler, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }) }));
jest.mock('@/features/icerik/sorgular', () => ({ useGeziler: () => ({ data: [], refetch: jest.fn() }) }));
let mockDavet: string | null = null;
jest.mock('@/features/davet/sorgular', () => ({
  bekleyenDavetiOku: async () => mockDavet,
  bekleyenDavetiSil: async () => undefined,
  useDavetKarsilama: () => ({ data: null, isError: false }),
  useDavetKarsilandi: () => async () => undefined,
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
const { router } = jest.requireMock<{ router: Record<'push' | 'replace', jest.Mock> }>('expo-router');

const bugun = yerelTarih(new Date(), 'Europe/Istanbul');
const gun = (n: number) => new Date(Date.parse(`${bugun}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sy = (id: string, start: string | null, end: string | null): SeyahatOzet => ({
  id,
  name: null,
  city_label: id,
  start_date: start,
  end_date: end,
  tz: 'Europe/Istanbul',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
  places: [{ count: 0 }],
});
const geziye = (id: string) => ({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id } });

describe('Açılış kuralı (#276 KK2)', () => {
  beforeEach(() => {
    acilisKarariniSifirla();
    router.push.mockClear();
    router.replace.mockClear();
    mockDavet = null;
  });

  it('gezi günündeyse doğrudan o seyahatin Gezi sayfası açılır (yaklaşan olsa da aktif önce)', async () => {
    mockSeyahatler = [sy('yakin', gun(3), gun(5)), sy('aktif', gun(-1), gun(1))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(geziye('aktif')));
  });

  it('aynı oturumda ana ekran yeniden kurulsa da tekrar seyahate atmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    const ilk = render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    ilk.unmount();
    const ikinci = render(<AnaSayfa />);
    await waitFor(() => expect(ikinci.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('yaklaşan, planlanan ya da biten seyahatte Keşfet açık kalır', async () => {
    mockSeyahatler = [sy('yakin', gun(3), gun(5)), sy('taslak', null, null), sy('bitti', gun(-4), gun(-2))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/seyahat/[id]/(sekmeler)/gezi' }));
  });

  it('KK5: bekleyen davet varsa önce davet akışı; gezi sayfasına atılmaz', async () => {
    mockDavet = 'tok';
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/r/[token]', params: { token: 'tok' } }));
    expect(router.push).not.toHaveBeenCalled();
  });
});
