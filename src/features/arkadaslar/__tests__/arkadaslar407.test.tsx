// #407 Arkadaşlar sekmesi (kanvas `Ana_v6_Arkadaslar`): kişi satırı + "Davet et" (KK1), akış kartı (KK2), ♥ (KK3b), boş hal (KK4).
// #533 incelemesi: davet seyahate, boş kişi metni, kartın tamamı, yenileme hatası, ♥ hatası.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ArkadaslarEkrani from '@/app/(tabs)/(menu)/arkadaslar';
import type { Arkadas, ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { gecenZaman } from '@/features/arkadaslar/zaman';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/davet/ProfilOnayi', () => ({ ProfilOnayi: () => null }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'B' } }, hazir: true, hesapli: true }) }));
const mockDurum = { kisiler: [] as Arkadas[], akis: [] as ArkadasPaylasimi[], hata: false, veriKalir: false, seyahatler: [] as unknown[] };
const mockBegen = jest.fn();
const sorgu = (data: unknown) => ({
  data: mockDurum.hata && !mockDurum.veriKalir ? undefined : data,
  isError: mockDurum.hata,
  isFetching: false,
  isRefetching: false,
  refetch: jest.fn(),
});
jest.mock('@/features/arkadaslar/sorgular', () => ({
  useArkadaslarim: () => sorgu(mockDurum.kisiler),
  useArkadasPaylasimlari: () => sorgu(mockDurum.akis),
  useBegeni: () => ({ mutate: (...a: unknown[]) => mockBegen(...a) }),
  useOdaktaTazele: () => undefined,
}));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: mockDurum.seyahatler }) }));
const mockPaylas = jest.fn(async (..._a: unknown[]) => 'paylasildi');
jest.mock('@/features/davet/paylas', () => ({ davetiPaylas: (...a: unknown[]) => mockPaylas(...a) }));
jest.mock('@/features/davet/sorgular', () => ({ profilOnayiVerildiMi: async () => true, profilOnayiniYaz: async () => undefined }));
const mockSeyahatSatiri = { id: 'T1', name: null, city_label: 'Bursa', invite_token: 'abcd1234' };
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mockSeyahatSatiri, error: null }) }) }) }) },
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
  foto: null,
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
  mockDurum.veriKalir = false;
  mockDurum.seyahatler = [];
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

  it('#578 KK1: kişinin yüzüne dokununca profili açılır', () => {
    render(<ArkadaslarEkrani />);
    fireEvent.press(screen.getByRole('button', { name: 'Mert' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/kisi/[id]', params: { id: 'M' } });
  });

  it('KK2: kart "{Ad} {şehir} gezisini paylaştı · zaman", özet; dokununca alıcı ekranı kimlikle açılır', () => {
    mockDurum.akis = [paylasim()];
    render(<ArkadaslarEkrani />);
    expect(screen.getByText('Bursa gezisini paylaştı', { exact: false })).toBeTruthy();
    expect(screen.getByText('2 gün önce')).toBeTruthy();
    expect(screen.getByText('2 gün · 9 durak · 3 kişi gezdi', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Ayşe Bursa gezisini paylaştı, 2 gün önce. 2 gün · 9 durak · 3 kişi gezdi' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/r/g/[token]', params: { token: '11111111-1111-4111-8111-111111111111' } });
  });

  it('KK3b: ♥ beğenir, beğenilmişse geri alır', () => {
    mockDurum.akis = [paylasim(), paylasim({ id: '22222222-2222-4222-8222-222222222222', begendim: true })];
    render(<ArkadaslarEkrani />);
    fireEvent.press(screen.getByTestId('arkadas-begen-11111111-1111-4111-8111-111111111111'));
    expect(mockBegen).toHaveBeenCalledWith({ id: '11111111-1111-4111-8111-111111111111', begen: true }, expect.anything());
    expect(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('arkadas-begen-22222222-2222-4222-8222-222222222222'));
    expect(mockBegen).toHaveBeenLastCalledWith({ id: '22222222-2222-4222-8222-222222222222', begen: false }, expect.anything());
  });

  it('hata halinde ham hata yok, "Tekrar dene"', () => {
    mockDurum.hata = true;
    render(<ArkadaslarEkrani />);
    expect(screen.getByText('Arkadaşların yüklenemedi.')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('#533 6: kişi yoksa "Bir seyahate arkadaşını davet edince burada görünür."', () => {
    mockDurum.kisiler = [];
    render(<ArkadaslarEkrani />);
    expect(screen.getByText('Bir seyahate arkadaşını davet edince burada görünür.')).toBeTruthy();
    expect(screen.queryByText('Arkadaşların gezilerini paylaşınca burada görünür.')).toBeNull();
  });

  it('#533 7: başlık, kapak ve özet aynı ekranı açar; ♥ açmaz', () => {
    mockDurum.akis = [paylasim()];
    render(<ArkadaslarEkrani />);
    const hedef = { pathname: '/r/g/[token]', params: { token: '11111111-1111-4111-8111-111111111111' } };
    fireEvent.press(screen.getByTestId('arkadas-kapak-11111111-1111-4111-8111-111111111111', { includeHiddenElements: true }));
    fireEvent.press(screen.getByTestId('arkadas-ozet-11111111-1111-4111-8111-111111111111', { includeHiddenElements: true }));
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenLastCalledWith(hedef);
    fireEvent.press(screen.getByTestId('arkadas-begen-11111111-1111-4111-8111-111111111111'));
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('#533 9: veri varken yenileme hatası listeyi silmez', () => {
    mockDurum.akis = [paylasim()];
    mockDurum.hata = true;
    mockDurum.veriKalir = true;
    render(<ArkadaslarEkrani />);
    expect(screen.queryByText('Arkadaşların yüklenemedi.')).toBeNull();
    expect(screen.getByText('Bursa gezisini paylaştı', { exact: false })).toBeTruthy();
  });

  it('#533 9: ♥ hata verirse genel uyarı', () => {
    const uyari = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockDurum.akis = [paylasim()];
    render(<ArkadaslarEkrani />);
    fireEvent.press(screen.getByTestId('arkadas-begen-11111111-1111-4111-8111-111111111111'));
    const secenek = mockBegen.mock.calls[0][1] as { onError: () => void };
    secenek.onError();
    expect(uyari).toHaveBeenCalledWith('Bir şeyler ters gitti', expect.any(String));
    uyari.mockRestore();
  });

  it('#533 5: "Davet et" seyahat yoksa Yeni seyahat sihirbazını açar, varsa seyahatin davetini paylaşır', async () => {
    render(<ArkadaslarEkrani />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Davet et' })));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/yeni');
    expect(mockPaylas).not.toHaveBeenCalled();

    const bugun = new Date().toISOString().slice(0, 10);
    mockDurum.seyahatler = [{ id: 'T1', name: null, city_label: 'Bursa', start_date: bugun, end_date: bugun, tz: 'Europe/Istanbul' }];
    mockPush.mockClear();
    render(<ArkadaslarEkrani />);
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: 'Davet et' }).at(-1)!));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPaylas).toHaveBeenCalledWith(mockSeyahatSatiri);
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
