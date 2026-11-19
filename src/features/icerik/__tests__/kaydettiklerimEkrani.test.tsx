// #275 → #395 (UX önerileri kanvası, `Sayfa_v5_Kaydettiklerim`): ‹ geri, başlık, altı çizili sekmeler; Geziler'de ana sayfa
// kartı (Seyahatime al yok), Yerler'de sade satır; ♥ → kayıttan çıkar + "Geri al"; boş halde "Keşfet'e göz at".
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KaydettiklerimEkrani from '../../../app/(tabs)/kaydettiklerim';

type Kayit = { tur: 'gezi' | 'yer'; hedef_id: string };
const mockVeri = {
  kayitlar: [] as Kayit[],
  geziler: [] as object[],
  yerler: [] as object[],
  mutate: jest.fn(),
};

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/icerik/fotolar', () => ({ useIcerikCanli: () => ({ data: undefined }) }));
jest.mock('@/features/icerik/sorgular', () => ({
  useKaydedilenler: () => ({ data: mockVeri.kayitlar }),
  useKaydet: () => ({ mutate: mockVeri.mutate }),
  useGezilerIle: () => ({ data: mockVeri.geziler, isSuccess: true }),
  useYerlerIle: () => ({ data: mockVeri.yerler, isSuccess: true }),
  icerikPlaceId: jest.fn(),
}));
jest.mock('@/features/icerik/yerEkle', () => ({ hedefSeyahatler: () => [], varsayilanHedef: () => null, useYerleriEkle: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: [] }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const { router: mockRouter } = jest.requireMock<{ router: Record<'back' | 'navigate' | 'push', jest.Mock> }>('expo-router');

const GEZI = { id: 'g1', slug: 'eskisehirde-uc-gun', baslik: 'Eskişehir’de üç gün', ozet: 'Müzeler, Sazova ve Porsuk', kapak_url: null, gun_sayisi: 3, mekan_sayisi: 20, amaclar: ['doga'], sehirler: { ad: 'Eskişehir' } };
const YER = { id: 'y1', sehir_id: 's1', ad: 'Sazova Parkı', kategori: 'park', lat: 39.7, lng: 30.4, sehirler: { ad: 'Eskişehir', slug: 'eskisehir', lat: 39.7, lng: 30.5 } };

describe('Kaydettiklerim v5 (#395)', () => {
  beforeEach(() => {
    mockVeri.kayitlar = [];
    mockVeri.geziler = [];
    mockVeri.yerler = [];
    mockVeri.mutate.mockClear();
    jest.clearAllMocks();
  });

  it('‹ geri dokununca geri döner; başlık ve iki sekme (sayılı)', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }, { tur: 'yer', hedef_id: 'y1' }];
    render(<KaydettiklerimEkrani />);
    expect(screen.getByRole('header', { name: 'Kaydettiklerim' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Geziler · 1', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Yerler · 1', selected: false })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Geri' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('KK2 · KK4: gezi ana sayfa kartıyla, Seyahatime al yok; kapaksızda amaç kapağı; ♥ kayıttan çıkarır, Geri al geri getirir', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziler = [GEZI];
    render(<KaydettiklerimEkrani />);
    expect(screen.getByText('Eskişehir’de üç gün')).toBeTruthy();
    expect(screen.getByTestId('amac-kapagi-doga', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Seyahatime al')).toBeNull();
    fireEvent.press(screen.getByTestId('kart-kalp'));
    expect(mockVeri.mutate).toHaveBeenLastCalledWith({ tur: 'gezi', hedef_id: 'g1', kayitli: true });
    fireEvent.press(screen.getByRole('button', { name: 'Geri al' }));
    expect(mockVeri.mutate).toHaveBeenLastCalledWith({ tur: 'gezi', hedef_id: 'g1', kayitli: false });
  });

  it('KK3 · KK4: yer sade satır (56 px kutu, ad, kategori, ♥); ♥ kayıttan çıkarır', () => {
    mockVeri.kayitlar = [{ tur: 'yer', hedef_id: 'y1' }];
    mockVeri.yerler = [YER];
    render(<KaydettiklerimEkrani />);
    fireEvent.press(screen.getByRole('tab', { name: 'Yerler · 1' }));
    expect(screen.getByText('Sazova Parkı')).toBeTruthy();
    expect(screen.getByTestId('kategori-ikonu')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Kaydedilenlerden kaldır' }));
    expect(mockVeri.mutate).toHaveBeenLastCalledWith({ tur: 'yer', hedef_id: 'y1', kayitli: true });
    expect(screen.getByRole('button', { name: 'Geri al' })).toBeTruthy();
  });

  it("KK5: boş halde tek satır yazı ve Keşfet'e göz at bağlantısı", () => {
    render(<KaydettiklerimEkrani />);
    expect(screen.getByText('Beğendiğin gezilere kalp bırak')).toBeTruthy();
    fireEvent.press(screen.getByRole('link', { name: "Keşfet'e göz at" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)');
  });
});
