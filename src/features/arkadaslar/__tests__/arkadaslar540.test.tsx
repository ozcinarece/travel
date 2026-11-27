// #540 (#533 incelemesi): misafire doğru cümle (KK1), ekran okuyucu etiketleri (KK2).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import ArkadaslarEkrani from '@/app/(tabs)/(menu)/arkadaslar';
import type { Arkadas, ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/davet/ProfilOnayi', () => ({ ProfilOnayi: () => null }));
const mockOturum = { hesapli: true };
jest.mock('@/lib/oturum', () => ({
  useOturum: () => ({ session: { user: { id: 'B', is_anonymous: !mockOturum.hesapli } }, hazir: true, hesapli: mockOturum.hesapli }),
}));
const mockDurum = { kisiler: [] as Arkadas[], akis: [] as ArkadasPaylasimi[] };
const sorgu = (data: unknown) => ({ data, isError: false, isFetching: false, isRefetching: false, refetch: jest.fn() });
jest.mock('@/features/arkadaslar/sorgular', () => ({
  useArkadaslarim: () => sorgu(mockDurum.kisiler),
  useArkadasPaylasimlari: () => sorgu(mockDurum.akis),
  useBegeni: () => ({ mutate: jest.fn() }),
  useOdaktaTazele: () => undefined,
}));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: [] }) }));
jest.mock('@/features/davet/paylas', () => ({ davetiPaylas: jest.fn() }));
jest.mock('@/features/davet/sorgular', () => ({ profilOnayiVerildiMi: async () => true, profilOnayiniYaz: async () => undefined }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const MISAFIR = 'Hesap açınca arkadaşlarının paylaştıklarını burada görürsün.';

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
  foto: null,
  begendim: false,
  ...p,
});

beforeEach(() => {
  mockOturum.hesapli = true;
  mockDurum.kisiler = [{ user_id: 'A', ad: 'Ayşe Yılmaz', foto: null }];
  mockDurum.akis = [];
});

describe('#540', () => {
  it('KK1: misafir oturumda boş akış cümlesi yerine hesap cümlesi', () => {
    mockOturum.hesapli = false;
    render(<ArkadaslarEkrani />);
    expect(screen.getByText(MISAFIR)).toBeTruthy();
    expect(screen.queryByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeNull();
  });

  it('KK1: misafirin kişisi yoksa da hesap cümlesi', () => {
    mockOturum.hesapli = false;
    mockDurum.kisiler = [];
    render(<ArkadaslarEkrani />);
    expect(screen.getByText(MISAFIR)).toBeTruthy();
    expect(screen.queryByText('Bir seyahate arkadaşını davet edince burada görünür.')).toBeNull();
  });

  it('KK1: hesaplı kullanıcı eski boş cümleyi görür', () => {
    render(<ArkadaslarEkrani />);
    expect(screen.queryByText(MISAFIR)).toBeNull();
    expect(screen.getByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeTruthy();
  });

  it('KK2: kart etiketi "{ad} {şehir} gezisini paylaştı, {zaman}. {özet}", ipucu "Geziyi açar"', () => {
    mockDurum.akis = [paylasim()];
    render(<ArkadaslarEkrani />);
    const kart = screen.getByRole('button', { name: 'Ayşe Bursa gezisini paylaştı, 2 gün önce. 2 gün · 9 durak · 3 kişi gezdi' });
    expect(kart.props.accessibilityHint).toBe('Geziyi açar');
  });

  it('KK2: ♥ beğenilmemişken "Beğen", beğenilmişken "Beğeniyi geri al"', () => {
    mockDurum.akis = [paylasim(), paylasim({ id: '22222222-2222-4222-8222-222222222222', begendim: true })];
    render(<ArkadaslarEkrani />);
    expect(screen.getByTestId('arkadas-begen-11111111-1111-4111-8111-111111111111').props.accessibilityLabel).toBe('Beğen');
    expect(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222').props.accessibilityLabel).toBe('Beğeniyi geri al');
    expect(screen.getAllByRole('button', { name: 'Beğeniyi geri al' })).toHaveLength(1);
    expect(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222').props.accessibilityState?.selected).toBeUndefined();
  });
});
