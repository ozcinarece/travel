// #275 → #395 (UX önerileri kanvası, `Sayfa_v5_Kaydettiklerim`): ‹ geri, başlık, altı çizili sekmeler; Geziler'de ana sayfa
// kartı (Seyahatime al yok), Yerler'de sade satır; ♥ → kayıttan çıkar + "Geri al"; boş halde "Keşfet'e göz at".
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, ActivityIndicator, Platform } from 'react-native';

import KaydettiklerimEkrani from '../../../app/(tabs)/kaydettiklerim';

type Kayit = { tur: 'gezi' | 'yer'; hedef_id: string };
const mockVeri = {
  kayitlar: [] as Kayit[],
  geziler: [] as object[],
  yerler: [] as object[],
  mutate: jest.fn(),
  // #411: gezi sorgusunun hali; undefined = başarılı.
  geziSorgu: undefined as undefined | { data?: object[]; isPending?: boolean; isError?: boolean; error?: unknown },
  refetch: jest.fn(),
};

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ hataBildir: jest.fn() }));
jest.mock('@/features/icerik/fotolar', () => ({ useIcerikCanli: () => ({ data: undefined }) }));
jest.mock('@/features/icerik/sorgular', () => ({
  useKaydedilenler: () => ({ data: mockVeri.kayitlar }),
  useKaydet: () => ({ mutate: mockVeri.mutate }),
  useGezilerIle: () => (mockVeri.geziSorgu ? { refetch: mockVeri.refetch, ...mockVeri.geziSorgu } : { data: mockVeri.geziler, isSuccess: true }),
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
    mockVeri.geziSorgu = undefined;
    mockVeri.mutate.mockClear();
    jest.clearAllMocks();
  });

  it('‹ geri dokununca geri döner; başlık ve iki sekme (sayılı)', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }, { tur: 'yer', hedef_id: 'y1' }];
    mockVeri.geziler = [GEZI];
    mockVeri.yerler = [YER];
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
  it('#410 inceleme 1: Kaydettiklerim\'de gezi ♥ "Kaydedilenlerden kaldır" diye okunur', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziler = [GEZI];
    render(<KaydettiklerimEkrani />);
    expect(screen.getByTestId('kart-kalp').props.accessibilityLabel).toBe('Kaydedilenlerden kaldır');
    expect(screen.queryByRole('togglebutton', { name: 'Kaydet' })).toBeNull();
  });

  it.each(['ios', 'android'] as const)("#410 inceleme 2: %s'ta Kaldırıldı · Geri al duyurulur, canlı bölge yok, 5 sn kalır", (os) => {
    jest.useFakeTimers();
    const eski = Platform.OS;
    Platform.OS = os;
    const duyuru = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
      mockVeri.geziler = [GEZI];
      render(<KaydettiklerimEkrani />);
      fireEvent.press(screen.getByTestId('kart-kalp'));
      expect(duyuru).toHaveBeenCalledTimes(1);
      expect(duyuru).toHaveBeenCalledWith('Kaldırıldı. Geri al');
      expect(screen.UNSAFE_root.findAll((n) => n.props.accessibilityLiveRegion !== undefined && typeof n.type === 'string')).toHaveLength(0);
      act(() => jest.advanceTimersByTime(4500));
      expect(screen.getByRole('button', { name: 'Geri al' })).toBeTruthy();
      act(() => jest.advanceTimersByTime(600));
      expect(screen.queryByRole('button', { name: 'Geri al' })).toBeNull();
    } finally {
      Platform.OS = eski;
      duyuru.mockRestore();
      jest.useRealTimers();
    }
  });

  it('#410 inceleme 2: art arda iki kaldırmada ikisi de duyurulur (metin aynı olsa da)', () => {
    const eski = Platform.OS;
    Platform.OS = 'android';
    const duyuru = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
      mockVeri.geziler = [GEZI];
      render(<KaydettiklerimEkrani />);
      fireEvent.press(screen.getByTestId('kart-kalp'));
      fireEvent.press(screen.getByTestId('kart-kalp'));
      expect(duyuru.mock.calls.filter(([m]) => m === 'Kaldırıldı. Geri al')).toHaveLength(2);
    } finally {
      Platform.OS = eski;
      duyuru.mockRestore();
    }
  });

  it('#410 inceleme 3: sekme sayısı yüklenen öğelerden (yayından kalkmış gezi sayılmaz); yer satırı "kategori · şehir"', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }, { tur: 'gezi', hedef_id: 'kalkmis' }, { tur: 'yer', hedef_id: 'y1' }];
    mockVeri.geziler = [GEZI];
    mockVeri.yerler = [YER];
    render(<KaydettiklerimEkrani />);
    expect(screen.getByRole('tab', { name: 'Geziler · 1' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Yerler · 1' }));
    expect(screen.getByText(/ · Eskişehir$/)).toBeTruthy();
  });

  // #411: yükleme ve hata hali; boş ekran kalmaz.
  it('#411 KK1: ilk yüklemede gösterge, boş hal yok', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziSorgu = { data: undefined, isPending: true };
    render(<KaydettiklerimEkrani />);
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText('Beğendiğin gezilere kalp bırak')).toBeNull();
  });

  it('#411 KK2: hata metni ve Tekrar dene; ham hata gösterilmez, Sentry\'ye gider', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziSorgu = { data: undefined, isError: true, error: new Error('JWT expired ham metin') };
    render(<KaydettiklerimEkrani />);
    expect(screen.getByText('Kaydettiklerin yüklenemedi.')).toBeTruthy();
    expect(screen.queryByText(/JWT/)).toBeNull();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    const { hataBildir } = jest.requireMock<{ hataBildir: jest.Mock }>('@/lib/hataRaporu');
    expect(hataBildir).toHaveBeenCalledWith(expect.any(Error), 'kaydettiklerim-yukle');
    fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(mockVeri.refetch).toHaveBeenCalled();
  });

  it('#411 KK2: ağ hatasında "Bağlantı yok"', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziSorgu = { data: undefined, isError: true, error: new TypeError('Network request failed') };
    render(<KaydettiklerimEkrani />);
    expect(screen.getByText('Bağlantı yok. Bağlanınca tekrar dene.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeTruthy();
  });

  it('#411 KK3: önbellekte veri varken hata satırı listenin üstünde, liste görünür', () => {
    mockVeri.kayitlar = [{ tur: 'gezi', hedef_id: 'g1' }];
    mockVeri.geziSorgu = { data: [GEZI], isError: true, error: new Error('x') };
    render(<KaydettiklerimEkrani />);
    expect(screen.getByText('Kaydettiklerin yüklenemedi.')).toBeTruthy();
    expect(screen.getByText('Eskişehir’de üç gün')).toBeTruthy();
  });
});
