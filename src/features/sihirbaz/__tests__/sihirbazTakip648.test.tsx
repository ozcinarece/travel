// #648 sihirbaz takibi 2: ipucu sınırı söyler, pasif gün okunur tarihle "seçilemez" (KK1); "bugün" şehrin saatiyle (KK2);
// "Bu şehre seyahat kur"da yeniden deneme kaydedilen yerleri ekler, ikinci kez eklemez (KK3); #647 KK4 ekran testi (KK4).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AdimNeZaman, gunEtiketi } from '@/components/sihirbaz/AdimNeZaman';
import { t } from '@/i18n';

import SihirbazEkrani from '../../../app/(tabs)/yeni';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const mockSehir = { place_id: 'p-bolu', ad: 'Bolu', ikincil: '', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR' };
const mockKars = { place_id: 'p-kars', ad: 'Kars', ikincil: '', lat: 40.6, lng: 43.1, tz: 'Europe/Istanbul', country_code: 'TR' };
let mockKaynakSehir: typeof mockSehir = mockSehir;
const mockKopyala = jest.fn<(k: string, h: string) => Promise<number>>();
jest.mock('@/features/sihirbaz/girisler', () => ({
  seyahatiKopyala: (k: string, h: string) => mockKopyala(k, h),
  useTekrarKaynagi: (id?: string) => ({ data: id ? { id: 'kaynak', sehir: mockKaynakSehir, ad: 'Bolu gezisi' } : undefined }),
  useIcerikSehirSecimi: () => ({ data: mockSehir }),
  yeniGirisNo: () => '1',
}));
const mockOlustur = jest.fn<() => Promise<string>>(async () => 'yeni');
const mockBos = { data: undefined };
const mockMut = { mutate: jest.fn(), mutateAsync: jest.fn(async () => undefined), isPending: false };
const mockSehriKur = { mutateAsync: jest.fn<() => Promise<void>>(async () => undefined), isPending: false };
const mockTarihKur = { mutateAsync: jest.fn<(a: { seyahatId: string; secim: unknown }) => Promise<void>>(async () => undefined), isPending: false };
const mockGunKur = jest.fn<(id: string, n: number) => Promise<void>>(async () => undefined);
const mockYerEkle = { mutateAsync: jest.fn<(a: { seyahatId: string; yerler: { place_id: string | null }[] }) => Promise<void>>(async () => undefined), isPending: false };
let mockMekanlar: { id: string; place_id: string }[] = [];
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
  useMekanlar: (id?: string) => (id ? { data: mockMekanlar } : mockBos),
  useMekanEkle: () => mockMut,
  useMekanSil: () => mockMut,
  useMekanGuncelle: () => mockMut,
}));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { onboarding_done_at: 'x' } }), useProfilGuncelle: () => mockMut }));
const mockKaydedilenler = [
  { id: 'y1', kategori: 'museum', lat: 40.7, lng: 31.6, sehirler: { ad: 'Bolu' } },
  { id: 'y2', kategori: 'park', lat: 40.71, lng: 31.61, sehirler: { ad: 'Bolu' } },
];
let mockYerlerGeldi = true;
const mockYerVerisi = () => (mockYerlerGeldi ? mockKaydedilenler : undefined);
jest.mock('@/features/icerik/sorgular', () => ({
  icerikPlaceId: async (y: { id: string }) => `pid-${y.id}`,
  olayYaz: jest.fn(),
  sehirEslestir: () => null,
  useSehirler: () => ({ data: [] }),
  useYerlerIle: (idler: string[]) => ({ data: idler.length ? mockYerVerisi() : [] }),
}));
jest.mock('@/features/arkadaslar/sorgular', () => ({ useArkadaslarim: () => ({ data: [] }) }));
jest.mock('@/features/davet/uygulamaIci', () => ({ useDavetGonder: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/icerik/yerEkle', () => ({ useYerleriEkle: () => mockYerEkle }));
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
  mockParams = {};
  mockKaynakSehir = mockSehir;
  mockMekanlar = [];
  mockYerlerGeldi = true;
  mockOlustur.mockImplementation(async () => 'yeni');
  mockGunKur.mockImplementation(async () => undefined);
  mockSehriKur.mutateAsync.mockImplementation(async () => undefined);
  mockYerEkle.mutateAsync.mockImplementation(async () => undefined);
});
afterEach(() => {
  jest.useRealTimers();
});

const ortak = { onAralik: jest.fn(), tarihsizGun: null, onTarihsizGun: jest.fn() };
/** Saat ilerletmeden yalnız "şimdi"yi sabitler (render ve testing-library zamanlayıcıları gerçek kalır). */
const simdi = (iso: string) =>
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'] });

describe('#648 KK1 sınır yazsın', () => {
  it('dönüş beklenirken ipucu "Dönüş günü? En çok 60 gün."', () => {
    render(<AdimNeZaman {...ortak} aralik={{ gidis: '2099-01-10', donus: null }} enCokGun={60} />);
    expect(screen.getByText('Dönüş günü? En çok 60 gün.')).toBeTruthy();
  });

  it('çekmecenin 30 günlük sınırı da ipucunda', () => {
    render(<AdimNeZaman {...ortak} aralik={{ gidis: '2099-01-10', donus: null }} enCokGun={30} />);
    expect(screen.getByText('Dönüş günü? En çok 30 gün.')).toBeTruthy();
  });

  it('gün hücresi okunur tarihle okunur; pasif gün "seçilemez" der, ISO tarih okunmaz', () => {
    render(<AdimNeZaman {...ortak} aralik={{ gidis: '2099-01-01', donus: null }} enCokGun={1} />);
    expect(gunEtiketi('2099-01-01', false)).toBe('1 Ocak Perşembe');
    expect(gunEtiketi('2099-01-02', true)).toBe('2 Ocak Cuma, seçilemez');
    expect(screen.getByLabelText('1 Ocak Perşembe').props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.getByLabelText('2 Ocak Cuma, seçilemez').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByLabelText('2099-01-02')).toBeNull();
  });
});

describe('#648 KK2 "bugün" şehrin saatiyle', () => {
  it('cihaz UTC 23:30 → İstanbul ertesi gün: dünkü (UTC) gün geçmiş', () => {
    simdi('2027-01-14T23:30:00Z');
    render(<AdimNeZaman {...ortak} aralik={null} />);
    // Varsayılan dilim İstanbul: bugün 15 Ocak.
    expect(screen.getByTestId('gun-2027-01-14').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('gun-2027-01-15').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('verilen dilim kullanılır (UTC: bugün hâlâ 14 Ocak)', () => {
    simdi('2027-01-14T23:30:00Z');
    render(<AdimNeZaman {...ortak} aralik={null} tz="UTC" />);
    expect(screen.getByTestId('gun-2027-01-14').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('sihirbaz seyahat yokken seçilen şehrin dilimini verir', async () => {
    simdi('2027-01-15T03:30:00Z');
    mockKaynakSehir = { ...mockSehir, tz: 'America/Los_Angeles' };
    mockParams = { tekrar: 'kaynak', n: '1' };
    render(<SihirbazEkrani />);
    // Los Angeles'ta 14 Ocak 19:30; İstanbul'da 15 Ocak olurdu.
    expect((await screen.findByTestId('gun-2027-01-14')).props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('#648 KK3 "Bu şehre seyahat kur" yeniden denemesi', () => {
  const kurVeDusur = async () => {
    mockParams = { sehir: 's-bolu', yerler: 'y1,y2', n: '1' };
    mockGunKur.mockRejectedValueOnce(new Error('ağ'));
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.devam')));
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunArttir')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nezaman.tarihHata'))).toBeTruthy();
    expect(mockYerEkle.mutateAsync).not.toHaveBeenCalled();
  };

  it('ilk kurulum düşünce yeniden deneme kaydedilen yerleri ekler; sonraki Devam ikinci kez eklemez', async () => {
    await kurVeDusur();
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockYerEkle.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mockYerEkle.mutateAsync).toHaveBeenCalledWith({ seyahatId: 'yeni', yerler: [expect.objectContaining({ place_id: 'pid-y1' }), expect.objectContaining({ place_id: 'pid-y2' })] });
    expect(mockOlustur).toHaveBeenCalledTimes(1);
    // 3. adımdan geri dönüp yeniden Devam: yerler bir daha eklenmez.
    fireEvent.press(screen.getByLabelText(t('sihirbaz.geri')));
    fireEvent.press(await screen.findByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockTarihKur.mutateAsync).toHaveBeenCalled());
    expect(mockYerEkle.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('listede zaten olan yer tekrar eklenmez', async () => {
    // Yer listeye başka yoldan (ör. Keşfet) girmiş: yeniden deneme onu atlar.
    mockMekanlar = [{ id: 'm1', place_id: 'pid-y1' }];
    await kurVeDusur();
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockYerEkle.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mockYerEkle.mutateAsync).toHaveBeenCalledWith({ seyahatId: 'yeni', yerler: [expect.objectContaining({ place_id: 'pid-y2' })] });
  });
});

describe('#648 KK3 kaydedilen yerler henüz gelmediyse', () => {
  it('yeniden deneme planı silmez, "bilgiler gelmedi" der; yerler gelince ekler', async () => {
    mockYerlerGeldi = false;
    mockParams = { sehir: 's-bolu', yerler: 'y1,y2', n: '1' };
    mockGunKur.mockRejectedValueOnce(new Error('ağ'));
    const ekran = render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.devam')));
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.gunArttir')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await screen.findByText(t('sihirbaz.nezaman.tarihHata'));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nereye.veriBekleniyor'))).toBeTruthy();
    expect(screen.queryByText(t('sihirbaz.nezaman.hata'))).toBeNull();
    expect(mockYerEkle.mutateAsync).not.toHaveBeenCalled();
    mockYerlerGeldi = true;
    ekran.rerender(<SihirbazEkrani />);
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockYerEkle.mutateAsync).toHaveBeenCalledTimes(1));
  });
});

describe('#648 KK4 (#647 KK4) şehir değişimi yarıda düşerse, ekran', () => {
  it('liste boş görünür, ikinci Devam onay sormadan şehri yeniden yazar', async () => {
    mockParams = { tekrar: 'kaynak', n: '1' };
    // Taslak kurulur (kopya düşer, taslak kalır); listede bir yer var.
    mockKopyala.mockRejectedValueOnce(new Error('ağ'));
    mockMekanlar = [{ id: 'm1', place_id: 'pid-eski' }];
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText(t('sihirbaz.nezaman.atla')));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await screen.findByText(t('sihirbaz.nezaman.hata'));
    fireEvent.press(screen.getByLabelText(t('sihirbaz.geri')));
    fireEvent.press(await screen.findByText('kars-sec'));
    // İlk Devam: 1 yer var → onay sorulur.
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nereye.sehirDegisti', { n: 1 }))).toBeTruthy();
    // Onaydan sonra yerler silinir, şehir yazılamaz.
    mockSehriKur.mutateAsync.mockImplementationOnce(async () => {
      mockMekanlar = [];
      throw new Error('ağ');
    });
    fireEvent.press(screen.getByText(t('sihirbaz.nereye.sehirDegistiDevam')));
    expect(await screen.findByText(t('sihirbaz.nereye.sehirHata'))).toBeTruthy();
    // Liste artık boş: aynı Devam onay sormadan aynı çağrıyı yapar.
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockSehriKur.mutateAsync).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(t('sihirbaz.nereye.sehirDegisti', { n: 1 }))).toBeNull();
    expect(mockSehriKur.mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ seyahatId: 'yeni', sehir: mockKars, yerleriCikar: true }));
    // Şehir yazıldı: Ne zaman adımı açılır, yeni seyahat açılmaz.
    expect(await screen.findByText(t('sihirbaz.nezaman.baslik'))).toBeTruthy();
    expect(mockOlustur).toHaveBeenCalledTimes(1);
  });
});
