// #574 KK1 · KK-ek1 · KK-ek2: `/(tabs)/yeni` girişleri. Parametresiz giriş (ana sayfa "Yeni gezi oluştur", Gezilerim "+") ve
// şehirle gelen giriş "Nasıl bir gezi?"yi açar; "Kendi rotanı kur" sihirbazı şehir dolu, 2. adımdan açar, 1. adımda geri
// "Nasıl bir gezi?"ye döner. Profil v12'nin iki parametresi (`il`, `arkadas`): rehberli il seçili, değilse Nereye'de aranmış.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { geziOlusturParametreleri } from '@/components/profil/ProfilV12';
import { t } from '@/i18n';

import YeniEkrani from '../../../app/(tabs)/yeni';

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
const { router: mockRouter } = jest.requireMock<{ router: { back: jest.Mock } }>('expo-router');

// "Nasıl bir gezi?" ekranı: aldığı giriş ve "Kendi rotanı kur" dokunuşları gözlenir (ekranın kendisi geziKur574'te).
jest.mock('@/components/geziKur/GeziKurEkrani', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GeziKurEkrani: (p: { sehirId?: string; arkadas?: string; onKendiRota: (g: unknown) => void }) => (
      <>
        <T>{`kur:${p.sehirId ?? '-'}:${p.arkadas ?? '-'}`}</T>
        <P onPress={() => p.onKendiRota({ sehirId: 's-mugla' })}>
          <T>kendi-sehirle</T>
        </P>
        <P onPress={() => p.onKendiRota({ metin: 'Kars' })}>
          <T>kendi-metinle</T>
        </P>
      </>
    ),
  };
});

const mockSehirler = [
  { id: 's-mugla', ad: 'Muğla', slug: 'mugla', kapak_url: null, lat: 37.2, lng: 28.4 },
  { id: 's-esk', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.8, lng: 30.5 },
];
const mockSecim = { place_id: 'p-mugla', ad: 'Muğla', ikincil: '', lat: 37.2, lng: 28.4, tz: 'Europe/Istanbul', country_code: 'TR' };
jest.mock('@/features/sihirbaz/girisler', () => ({
  ...jest.requireActual<object>('@/features/sihirbaz/girisler'),
  seyahatiKopyala: jest.fn(),
  useTekrarKaynagi: () => ({ data: undefined }),
  useIcerikSehirSecimi: (k?: { id: string }) => ({ data: k ? { ...mockSecim, ad: k.id === 's-mugla' ? 'Muğla' : 'Eskişehir' } : undefined }),
}));
const mockBos = { data: undefined };
const mockMut = { mutate: jest.fn(), mutateAsync: jest.fn(async () => undefined), isPending: false };
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatOlustur: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSeyahatAdiKaydet: () => mockMut,
  useSeyahat: () => mockBos,
}));
jest.mock('@/features/gunler/sorgular', () => ({ useGunler: () => mockBos, useDuraklar: () => mockBos }));
jest.mock('@/features/mekanlar/sorgular', () => ({ useMekanlar: () => mockBos, useMekanEkle: () => mockMut, useMekanSil: () => mockMut, useMekanGuncelle: () => mockMut }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { onboarding_done_at: 'x' } }), useProfilGuncelle: () => mockMut }));
jest.mock('@/features/icerik/sorgular', () => ({
  icerikPlaceId: async () => null,
  olayYaz: jest.fn(),
  sehirEslestir: () => null,
  useSehirler: () => ({ data: mockSehirler }),
  useYerlerIle: () => ({ data: [] }),
}));
jest.mock('@/features/icerik/yerEkle', () => ({ useYerleriEkle: () => mockMut }));
jest.mock('@/features/icerik/ilOnerileri', () => ({ ilSlugu: () => null, useIlYerleri: () => mockBos }));
jest.mock('@/features/sihirbaz/planUygula', () => ({ ...jest.requireActual<object>('@/features/sihirbaz/planUygula'), usePlaniUygula: () => mockMut }));
jest.mock('@/features/sihirbaz/taslak', () => ({ ...jest.requireActual<object>('@/features/sihirbaz/taslak'), useTaslakSehri: () => mockMut, useTaslakTarihi: () => mockMut }));
jest.mock('@/components/mekan/MekanPaneli', () => ({ MekanPaneli: () => null }));
jest.mock('@/components/sihirbaz/AdimIlOnerileri', () => ({ AdimIlOnerileri: () => null }));
jest.mock('@/components/sihirbaz/AdimOnerilenler', () => ({ AdimOnerilenler: () => null }));
jest.mock('@/components/sihirbaz/PlanCubugu', () => ({ PlanCubugu: () => null }));
jest.mock('@/components/sihirbaz/AdimNereye', () => {
  const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return { AdimNereye: (p: { ilkSorgu?: string; sehir: { ad: string } | null }) => <T>{`nereye:${p.ilkSorgu ?? '-'}:${p.sehir?.ad ?? '-'}`}</T> };
});
jest.mock('@/components/sihirbaz/AdimNeZaman', () => {
  const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return { AdimNeZaman: () => <T>nezaman-adimi</T> };
});

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
});

describe('#574 KK1 giriş', () => {
  it('parametresiz giriş (ana sayfa "Yeni gezi oluştur", Gezilerim "+") "Nasıl bir gezi?"yi açar; eski sihirbaz açılmaz', () => {
    render(<YeniEkrani />);
    expect(screen.getByText('kur:-:-')).toBeTruthy();
    expect(screen.queryByText(/^nereye:/)).toBeNull();
  });

  it('ana sayfa aramasından şehirle gelinirse şehir kutusu dolu açılır', () => {
    mockParams = { sehir: 's-esk', n: '1' };
    render(<YeniEkrani />);
    expect(screen.getByText('kur:s-esk:-')).toBeTruthy();
  });

  it('"Kendi rotanı kur" sihirbazı şehir dolu, 2. adımdan açar; geri 1. adıma, oradan "Nasıl bir gezi?"ye döner', () => {
    render(<YeniEkrani />);
    fireEvent.press(screen.getByText('kendi-sehirle'));
    expect(screen.getByText('nezaman-adimi')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(t('sihirbaz.geri')));
    expect(screen.getByText('nereye:-:Muğla')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(t('sihirbaz.kapat')));
    expect(screen.queryByText(/^nereye:/)).toBeNull();
    expect(screen.getByText('kur:-:-')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('rehberli olmayan şehirde "Kendi rotanı kur" yazılanı Nereye\'de aranmış açar', () => {
    render(<YeniEkrani />);
    fireEvent.press(screen.getByText('kendi-metinle'));
    expect(screen.getByText('nereye:Kars:-')).toBeTruthy();
  });
});

describe('#574 KK-ek1 · KK-ek2 Profil v12 girişleri (`il`, `arkadas`)', () => {
  it('rehberli il + arkadaş: şehir seçili ve kişi yol arkadaşı olarak gelir', () => {
    mockParams = geziOlusturParametreleri(mockSehirler, { plaka: 48, arkadas: 'u-deniz' });
    expect(mockParams).toMatchObject({ sehir: 's-mugla', il: '48', arkadas: 'u-deniz' });
    render(<YeniEkrani />);
    expect(screen.getByText('kur:s-mugla:u-deniz')).toBeTruthy();
  });

  it('rehberli olmayan il + arkadaş: Nereye\'de aranmış gelir (bugünkü davranış)', () => {
    mockParams = geziOlusturParametreleri(mockSehirler, { plaka: 36, arkadas: 'u-deniz' });
    expect(mockParams).toMatchObject({ metin: 'Kars', il: '36', arkadas: 'u-deniz' });
    render(<YeniEkrani />);
    expect(screen.getByText('nereye:Kars:-')).toBeTruthy();
  });

  it('yalnız arkadaş: "Nasıl bir gezi?" boş şehirle, kişi seçili', () => {
    mockParams = geziOlusturParametreleri(mockSehirler, { arkadas: 'u-deniz' });
    render(<YeniEkrani />);
    expect(screen.getByText('kur:-:u-deniz')).toBeTruthy();
  });
});
