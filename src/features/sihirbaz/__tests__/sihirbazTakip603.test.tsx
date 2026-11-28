// #603 sihirbaz takibi: gün kurma düşerse tarih uyarısı (KK1), şehir kaydı sürerken ikinci Devam yok sayılır (KK2),
// takvim 60 günden uzununu seçtirmez (KK3).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { donusSinirDisi, TARIH_EN_COK_GUN } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';

import SihirbazEkrani from '../../../app/(tabs)/yeni';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ tekrar: 'kaynak', n: '1' }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const mockSehir = { place_id: 'p-bolu', ad: 'Bolu', ikincil: '', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR' };
const mockKars = { place_id: 'p-kars', ad: 'Kars', ikincil: '', lat: 40.6, lng: 43.1, tz: 'Europe/Istanbul', country_code: 'TR' };
const mockKopyala = jest.fn<(k: string, h: string) => Promise<number>>();
jest.mock('@/features/sihirbaz/girisler', () => ({
  seyahatiKopyala: (k: string, h: string) => mockKopyala(k, h),
  useTekrarKaynagi: () => ({ data: { id: 'kaynak', sehir: mockSehir, ad: 'Bolu gezisi' } }),
  useIcerikSehirSecimi: () => ({ data: undefined }),
}));
const mockOlustur = jest.fn<() => Promise<string>>(async () => 'yeni');
const mockBos = { data: undefined };
const mockMut = { mutate: jest.fn(), mutateAsync: jest.fn(async () => undefined), isPending: false };
const mockSehriKur = { mutateAsync: jest.fn<() => Promise<void>>(async () => undefined), isPending: false };
const mockTarihKur = { mutateAsync: jest.fn<(a: { seyahatId: string; secim: unknown }) => Promise<void>>(async () => undefined), isPending: false };
const mockGunKur = jest.fn<(id: string, n: number) => Promise<void>>(async () => undefined);
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatOlustur: () => ({ mutateAsync: mockOlustur, isPending: false }),
  useSeyahatAdiKaydet: () => mockMut,
  useSeyahat: (id?: string) =>
    id ? { data: { id, name: 'Bolu gezisi', city_label: 'Bolu', city_place_id: 'p-bolu', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR', start_date: null, end_date: null } } : mockBos,
}));
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: (id?: string) => (id ? { data: [{ id: 'g1' }] } : mockBos),
  useDuraklar: (id?: string) => (id ? { data: [] } : mockBos),
}));
jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanlar: (id?: string) => (id ? { data: [] } : mockBos),
  useMekanEkle: () => mockMut,
  useMekanSil: () => mockMut,
  useMekanGuncelle: () => mockMut,
}));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { onboarding_done_at: 'x' } }), useProfilGuncelle: () => mockMut }));
jest.mock('@/features/icerik/sorgular', () => ({
  icerikPlaceId: async () => null,
  olayYaz: jest.fn(),
  sehirEslestir: () => null,
  useSehirler: () => ({ data: [] }),
  useYerlerIle: () => ({ data: [] }),
}));
jest.mock('@/features/arkadaslar/sorgular', () => ({ useArkadaslarim: () => ({ data: [] }) }));
jest.mock('@/features/davet/uygulamaIci', () => ({ useDavetGonder: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/icerik/yerEkle', () => ({ useYerleriEkle: () => mockMut }));
jest.mock('@/features/icerik/ilOnerileri', () => ({ ilSlugu: () => null, useIlYerleri: () => mockBos }));
jest.mock('@/features/sihirbaz/planUygula', () => ({ ...jest.requireActual<object>('@/features/sihirbaz/planUygula'), usePlaniUygula: () => mockMut, usePlanOnizlemeOnceligi: () => undefined }));
jest.mock('@/features/sihirbaz/taslak', () => ({
  ...jest.requireActual<object>('@/features/sihirbaz/taslak'),
  tarihsizGunleriKur: (id: string, n: number) => mockGunKur(id, n),
  useTaslakSehri: () => mockSehriKur,
  useTaslakTarihi: () => mockTarihKur,
}));
jest.mock('@/components/mekan/MekanPaneli', () => ({ MekanPaneli: () => null }));
jest.mock('@/components/sihirbaz/AdimIlOnerileri', () => ({ AdimIlOnerileri: () => null }));
jest.mock('@/components/sihirbaz/AdimOnerilenler', () => ({ AdimOnerilenler: () => null }));
jest.mock('@/components/sihirbaz/PlanCubugu', () => ({ PlanCubugu: () => null }));
jest.mock('@/components/sihirbaz/AdimNereye', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AdimNereye: ({ onSehir }: { onSehir: (s: typeof mockKars) => void }) => (
      <P onPress={() => onSehir(mockKars)}>
        <T>kars-sec</T>
      </P>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOlustur.mockImplementation(async () => 'yeni');
  mockGunKur.mockImplementation(async () => undefined);
  mockSehriKur.mutateAsync.mockImplementation(async () => undefined);
});

describe('#603 KK1 gün kurma düşerse doğru metin', () => {
  it('seyahat oluştu, günler kurulamadı → tarih uyarısı; ikinci Devam yeni seyahat açmaz', async () => {
    mockGunKur.mockRejectedValueOnce(new Error('ağ'));
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunArttir')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nezaman.tarihHata'))).toBeTruthy();
    expect(screen.queryByText(t('sihirbaz.nezaman.hata'))).toBeNull();
    expect(mockOlustur).toHaveBeenCalledTimes(1);
    expect(mockGunKur).toHaveBeenCalledWith('yeni', 3);
    expect(mockKopyala).not.toHaveBeenCalled();
    // İkinci Devam aynı taslağın günlerini kurar; yeni seyahat açılmaz.
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockTarihKur.mutateAsync).toHaveBeenCalledWith({ seyahatId: 'yeni', secim: { tur: 'tarihsiz', gun: 3 } }));
    expect(mockOlustur).toHaveBeenCalledTimes(1);
  });

  it('seyahat oluşmadan düşerse bugünkü metin kalır', async () => {
    mockOlustur.mockRejectedValueOnce(new Error('ağ'));
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nezaman.hata'))).toBeTruthy();
    expect(mockGunKur).not.toHaveBeenCalled();
  });
});

describe('#603 KK2 şehir kaydı sürerken çift dokunuş', () => {
  it('ikinci "Devam et" şehri ikinci kez yazmaz', async () => {
    // Taslak kurulur (kopya düşer, taslak kalır), sonra 1. adıma dönülüp şehir değiştirilir.
    mockKopyala.mockRejectedValueOnce(new Error('ağ'));
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunAzalt')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await screen.findByText(t('sihirbaz.nezaman.hata'));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.geri')));
    fireEvent.press(await screen.findByText('kars-sec'));
    mockSehriKur.mutateAsync.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockSehriKur.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mockSehriKur.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ seyahatId: 'yeni', sehir: mockKars, yerleriCikar: true }));
  });
});

describe('#603 KK3 60 gün sınırı', () => {
  it('dönüş beklenirken 60. günden sonrası sınır dışı', () => {
    const a = { gidis: '2027-01-01', donus: null };
    expect(TARIH_EN_COK_GUN).toBe(60);
    expect(donusSinirDisi(a, '2027-03-01')).toBe(false); // 60. gün
    expect(donusSinirDisi(a, '2027-03-02')).toBe(true); // 61. gün
    expect(donusSinirDisi(a, '2026-12-20')).toBe(false); // gidişten önce: yeni gidiş olur
    expect(donusSinirDisi({ gidis: '2027-01-01', donus: '2027-01-03' }, '2027-06-01')).toBe(false); // aralık tamam: yeni gidiş
    expect(donusSinirDisi(null, '2027-06-01')).toBe(false);
  });

  it('takvimde 61. gün pasif, dokunuş seçim yapmaz', () => {
    const bugun = new Date();
    const gidis = `${bugun.getFullYear() + 1}-01-01`;
    const onAralik = jest.fn();
    // Sınır görünen ayın içinde kalsın diye 1 gün (60 günlük sınırın kendisi yukarıdaki saf testte).
    render(<AdimNeZaman aralik={{ gidis, donus: null }} onAralik={onAralik} tarihsizGun={null} onTarihsizGun={jest.fn()} enCokGun={1} />);
    const ikinci = screen.getByTestId(`gun-${bugun.getFullYear() + 1}-01-02`);
    expect(ikinci.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(ikinci);
    expect(onAralik).not.toHaveBeenCalled();
    // Gidiş günü seçilebilir kalır (aynı güne ikinci dokunuş seçimi sıfırlar).
    expect(screen.getByTestId(`gun-${gidis}`).props.accessibilityState).toMatchObject({ disabled: false });
  });
});
