// #581 Ürün değişiklik isteği: "Tekrar kur"da kopya düşerse ikinci Devam kopyayı yeniden dener ve Program'ı açar
// (boş taslakla 3. adıma düşülmez). Ayrıca kayıt sürerken üstteki "‹" pasif.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler, Pressable, Text } from 'react-native';

import { AdimKabugu } from '@/components/sihirbaz/AdimKabugu';
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
const { router: mockRouter } = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router');

const mockSehir = { place_id: 'p-bolu', ad: 'Bolu', ikincil: '', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR' };
const mockKopyala = jest.fn<(k: string, h: string) => Promise<number>>();
jest.mock('@/features/sihirbaz/girisler', () => ({
  seyahatiKopyala: (k: string, h: string) => mockKopyala(k, h),
  useTekrarKaynagi: () => ({ data: { id: 'kaynak', sehir: mockSehir, ad: 'Bolu gezisi' } }),
  useIcerikSehirSecimi: () => ({ data: undefined }),
}));
const mockOlustur = jest.fn(async () => 'yeni');
const mockTarih = { mutateAsync: jest.fn<() => Promise<void>>(async () => undefined), isPending: false };
const mockBos = { data: undefined };
const mockMut = { mutate: jest.fn(), mutateAsync: jest.fn(async () => undefined), isPending: false };
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatOlustur: () => ({ mutateAsync: mockOlustur, isPending: false }),
  useSeyahatAdiKaydet: () => mockMut,
  // Seyahat kurulduktan sonra taslak, seçilen tarihlerle gelir (tarih değişmedi → yalnız kopya yeniden denenir).
  useSeyahat: (id?: string) =>
    id ? { data: { id, name: 'Bolu gezisi', city_label: 'Bolu', city_place_id: 'p-bolu', lat: 40.7, lng: 31.6, tz: 'Europe/Istanbul', country_code: 'TR', start_date: '2026-12-10', end_date: '2026-12-11' } } : mockBos,
}));
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: (id?: string) => (id ? { data: [{ id: 'g1' }, { id: 'g2' }] } : mockBos),
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
jest.mock('@/features/icerik/yerEkle', () => ({ useYerleriEkle: () => mockMut }));
jest.mock('@/features/icerik/ilOnerileri', () => ({ ilSlugu: () => null, useIlYerleri: () => mockBos }));
jest.mock('@/features/sihirbaz/planUygula', () => ({ ...jest.requireActual<object>('@/features/sihirbaz/planUygula'), usePlaniUygula: () => mockMut }));
jest.mock('@/features/sihirbaz/taslak', () => ({
  ...jest.requireActual<object>('@/features/sihirbaz/taslak'),
  useTaslakSehri: () => mockMut,
  useTaslakTarihi: () => mockTarih,
}));
jest.mock('@/components/mekan/MekanPaneli', () => ({ MekanPaneli: () => null }));
jest.mock('@/components/sihirbaz/AdimIlOnerileri', () => ({ AdimIlOnerileri: () => null }));
jest.mock('@/components/sihirbaz/AdimOnerilenler', () => ({ AdimOnerilenler: () => null }));
jest.mock('@/components/sihirbaz/PlanCubugu', () => ({ PlanCubugu: () => null }));
jest.mock('@/components/sihirbaz/AdimNereye', () => ({ AdimNereye: () => null }));
jest.mock('@/components/sihirbaz/AdimNeZaman', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AdimNeZaman: ({ onAralik }: { onAralik: (a: { gidis: string; donus: string }) => void }) => (
      <>
        <P onPress={() => onAralik({ gidis: '2026-12-10', donus: '2026-12-11' })}>
          <T>tarih-sec</T>
        </P>
        <P onPress={() => onAralik({ gidis: '2026-12-20', donus: '2026-12-21' })}>
          <T>tarih-degistir</T>
        </P>
      </>
    ),
  };
});

describe('#581 Tekrar kur: kopya yeniden denenir', () => {
  it('kopya bir kez düşer; ikinci Devam planı kopyalar ve Program açılır', async () => {
    mockKopyala.mockRejectedValueOnce(new Error('ağ')).mockResolvedValueOnce(4);
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText('tarih-sec'));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    expect(await screen.findByText(t('sihirbaz.nezaman.hata'))).toBeTruthy();
    expect(mockOlustur).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: 'yeni' } }));
    // Yeni seyahat açılmadı; kopya aynı taslağa yeniden yapıldı.
    expect(mockOlustur).toHaveBeenCalledTimes(1);
    expect(mockKopyala).toHaveBeenCalledTimes(2);
    expect(mockKopyala).toHaveBeenLastCalledWith('kaynak', 'yeni');
  });
});

describe('#581 kayıt sürerken geri pasif', () => {
  it('tarih kaydedilirken Android geri tuşu yutulur, "‹" pasif', async () => {
    const dinleyiciler: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_o, f) => {
      dinleyiciler.push(f);
      return { remove: () => undefined };
    });
    mockKopyala.mockRejectedValueOnce(new Error('ağ'));
    render(<SihirbazEkrani />);
    fireEvent.press(await screen.findByText('tarih-sec'));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await screen.findByText(t('sihirbaz.nezaman.hata'));
    // Taslak var; tarih değişti → kayıt sürüyor (bitmeyen istek).
    mockTarih.mutateAsync.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.press(screen.getByText('tarih-degistir'));
    fireEvent.press(screen.getByText(t('sihirbaz.devam')));
    await waitFor(() => expect(screen.getByLabelText(t('sihirbaz.geri')).props.accessibilityState).toMatchObject({ disabled: true }));
    expect(dinleyiciler[dinleyiciler.length - 1]({} as never)).toBe(true);
    expect(screen.getByText('tarih-sec')).toBeTruthy();
    expect(mockTarih.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('geriPasif iken "‹" dokunuşu yutulur', () => {
    const onGeri = jest.fn();
    render(
      <AdimKabugu adim="nezaman" baslik="B" onGeri={onGeri} geriPasif>
        <Pressable>
          <Text>i</Text>
        </Pressable>
      </AdimKabugu>,
    );
    const dugme = screen.getByLabelText(t('sihirbaz.geri'));
    fireEvent.press(dugme);
    expect(onGeri).not.toHaveBeenCalled();
    expect(dugme.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
