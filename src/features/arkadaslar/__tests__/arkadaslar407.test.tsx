// #407 Arkadaşlar sekmesi (kanvas `Ana_v6_Arkadaslar`): kişi satırı + "Davet et" (KK1), akış kartı (KK2), ♥ (KK3b), boş hal (KK4).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ArkadaslarEkrani from '@/app/(tabs)/(menu)/arkadaslar';
import type { Arkadas, ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { gecenZaman } from '@/features/arkadaslar/zaman';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockDurum = { kisiler: [] as Arkadas[], akis: [] as ArkadasPaylasimi[], hata: false };
const mockBegen = jest.fn();
const sorgu = (data: unknown) => ({ data: mockDurum.hata ? undefined : data, isError: mockDurum.hata, isFetching: false, isRefetching: false, refetch: jest.fn() });
jest.mock('@/features/arkadaslar/sorgular', () => ({
  useArkadaslarim: () => sorgu(mockDurum.kisiler),
  useArkadasPaylasimlari: () => sorgu(mockDurum.akis),
  useBegeni: () => ({ mutate: (...a: unknown[]) => mockBegen(...a) }),
}));

const paylasim = (p: Partial<ArkadasPaylasimi> = {}): ArkadasPaylasimi => ({
  id: '11111111-1111-4111-8111-111111111111',
  paylasan: 'A',
  paylasan_ad: 'Ayşe',
  sehir: 'Bursa',
  ad: null,
  olusturuldu: new Date(Date.now() - 2 * 86_400_000 - 60_000).toISOString(),
  gun_sayisi: 2,
  durak_sayisi: 9,
  kisi_sayisi: 3,
  kisi_kip: 'gezdi',
  begeni_sayisi: 0,
  begendim: false,
  ...p,
});

beforeEach(() => {
  mockDurum.kisiler = [
    { user_id: 'A', ad: 'Ayşe Yılmaz', foto: null },
    { user_id: 'M', ad: 'Mert', foto: null },
  ];
  mockDurum.akis = [];
  mockDurum.hata = false;
  jest.clearAllMocks();
});

describe('#407 Arkadaşlar', () => {
  it('KK1 ve KK4: kişiler (yalnız ilk ad) ve sonda "Davet et"; paylaşım yoksa tek cümle', () => {
    render(<ArkadaslarEkrani />);
    expect(screen.getByRole('header').props.children).toBe('Arkadaşlar');
    expect(screen.getByText('Ayşe')).toBeTruthy();
    expect(screen.queryByText(/Yılmaz/)).toBeNull();
    expect(screen.getByText('Mert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Davet et' })).toBeTruthy();
    expect(screen.getByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeTruthy();
  });

  it('KK2: kart "{Ad} {şehir} gezisini paylaştı · zaman", özet; dokununca alıcı ekranı kimlikle açılır', () => {
    mockDurum.akis = [paylasim()];
    render(<ArkadaslarEkrani />);
    expect(screen.getByText('Bursa gezisini paylaştı', { exact: false })).toBeTruthy();
    expect(screen.getByText('2 gün önce')).toBeTruthy();
    expect(screen.getByText('2 gün · 9 durak · 3 kişi gezdi')).toBeTruthy();
    expect(screen.queryByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Ayşe, Bursa gezisi. Açar' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/r/g/[token]', params: { token: '11111111-1111-4111-8111-111111111111' } });
  });

  it('KK3b: ♥ beğenir, beğenilmişse geri alır', () => {
    mockDurum.akis = [paylasim(), paylasim({ id: '22222222-2222-4222-8222-222222222222', begendim: true, begeni_sayisi: 1 })];
    render(<ArkadaslarEkrani />);
    fireEvent.press(screen.getByTestId('arkadas-begen-11111111-1111-4111-8111-111111111111'));
    expect(mockBegen).toHaveBeenCalledWith({ id: '11111111-1111-4111-8111-111111111111', begen: true });
    expect(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222'));
    expect(mockBegen).toHaveBeenLastCalledWith({ id: '22222222-2222-4222-8222-222222222222', begen: false });
  });

  it('hata halinde ham hata yok, "Tekrar dene"', () => {
    mockDurum.hata = true;
    render(<ArkadaslarEkrani />);
    expect(screen.getByText('Arkadaşların yüklenemedi.')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('geçen zaman', () => {
    const an = new Date('2026-11-26T12:00:00Z');
    expect(gecenZaman('2026-11-26T11:30:00Z', an)).toBe('az önce');
    expect(gecenZaman('2026-11-26T07:00:00Z', an)).toBe('5 saat önce');
    expect(gecenZaman('2026-11-24T11:00:00Z', an)).toBe('2 gün önce');
    expect(gecenZaman('2026-11-19T11:00:00Z', an)).toBe('1 hafta önce');
    expect(gecenZaman('2026-09-20T11:00:00Z', an)).toBe('2 ay önce');
  });
});
