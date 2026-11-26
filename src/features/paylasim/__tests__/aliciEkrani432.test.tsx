// #432 2/3b: linki açan arkadaşın ekranı (`/r/g/{token}`, kanvas `Sos_v6_Alici` · `Sos_v6_Kapali`). Başlık ve "Ayşe
// paylaştı", adı olmayan durak "Durak 3" + tür, "Haritada gör" basınca izin sorulur (sınır doluysa gri satır), girişsiz
// "Seyahatime al" linki saklayıp girişe gider, girişli "Seyahatime al" yeni seyahate geçer; kapalı ve bilinmeyen link.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n';

import PaylasimEkrani from '@/app/r/g/[token]';

import { durakSatiri, type PaylasimOzeti } from '../alici';

const TOKEN = 'A'.repeat(24);
const mockOturum = { hesapli: false };
const mockSorgu = { data: null as PaylasimOzeti, isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
const mockIzin = jest.fn(async (_t: string) => true);
const mockAl = jest.fn(async (_t: string) => 'YENI');
const mockBekleyen = jest.fn(async (_t: string) => undefined);
const mockBekleyenSil = jest.fn(async () => undefined);
const mockOlay = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => mockOturum }));
jest.mock('@/lib/acilis', () => ({ acilisKarariniKapat: jest.fn() }));
jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
jest.mock('@/features/icerik/sorgular', () => ({ olayYaz: (...a: unknown[]) => mockOlay(...a) }));
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockRouter.push(...a), replace: (...a: unknown[]) => mockRouter.replace(...a) },
  useLocalSearchParams: () => ({ token: 'A'.repeat(24) }) }));
jest.mock('@/features/paylasim/alici', () => {
  const gercek = jest.requireActual<typeof import('../alici')>('../alici');
  return {
    ...gercek,
    usePaylasimOzeti: () => mockSorgu,
    haritaIzniAl: (tk: string) => mockIzin(tk),
    bekleyenPaylasimiYaz: (tk: string) => mockBekleyen(tk),
    bekleyenPaylasimiSil: () => mockBekleyenSil(),
    usePaylasimdanAl: () => ({ mutateAsync: (tk: string) => mockAl(tk), isPending: false }),
  };
});

const acik: PaylasimOzeti = {
  kapali: false,
  id: 'P1',
  paylasan: 'Ayşe',
  ad: null,
  sehir: 'Eskişehir',
  gun_sayisi: 2,
  durak_sayisi: 3,
  kisi_sayisi: 3,
  gunler: [
    {
      gun: 1,
      duraklar: [
        { ad: 'Kurşunlu Külliyesi', tur: 'museum', dakika: 45, lat: 39.77, lng: 30.52 },
        { ad: null, tur: 'cafe', dakika: 60, lat: 39.78, lng: 30.51 },
      ],
    },
    { gun: 2, duraklar: [{ ad: 'Atlıhan', tur: 'market', dakika: 30, lat: null, lng: null }] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOturum.hesapli = false;
  mockSorgu.data = acik;
  mockSorgu.isPending = false;
  mockSorgu.isError = false;
  mockIzin.mockImplementation(async () => true);
  mockAl.mockImplementation(async () => 'YENI');
});

describe('#432 2/3b alıcı ekranı', () => {
  it('başlık, "Ayşe paylaştı", özet satırı ve durak satırları (adsız durak "Durak 2" + tür)', () => {
    render(<PaylasimEkrani />);
    expect(screen.getByText(t('paylasim.paylasti', { ad: 'Ayşe' }))).toBeTruthy();
    expect(screen.getByText('Eskişehir gezisi')).toBeTruthy();
    expect(screen.getByText(`${t('paylasim.gun', { n: 2 })} · ${t('paylasim.durak', { n: 3 })} · ${t('paylasim.kisi', { n: 3 })}`)).toBeTruthy();
    expect(screen.getByText('Kurşunlu Külliyesi')).toBeTruthy();
    expect(screen.getByText(t('paylasim.durakNo', { n: 2 }))).toBeTruthy();
    expect(screen.getByText(t('paylasim.girisNot'))).toBeTruthy();
  });

  it('#517 KK3–KK4: plandaki gezi "gidiyor"; tek kişilik seyahatte kişi sayısı yok', () => {
    mockSorgu.data = { ...acik, kisi_kip: 'gidiyor' } as PaylasimOzeti;
    const { rerender } = render(<PaylasimEkrani />);
    expect(screen.getByText(`${t('paylasim.gun', { n: 2 })} · ${t('paylasim.durak', { n: 3 })} · ${t('paylasim.kisiGidiyor', { n: 3 })}`)).toBeTruthy();
    mockSorgu.data = { ...acik, kisi_sayisi: 1, kisi_kip: 'gezdi' } as PaylasimOzeti;
    rerender(<PaylasimEkrani />);
    expect(screen.getByText(`${t('paylasim.gun', { n: 2 })} · ${t('paylasim.durak', { n: 3 })}`)).toBeTruthy();
  });

  it('gün çipi listeyi değiştirir', () => {
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.gunCip', { n: 2 })));
    expect(screen.getByText('Atlıhan')).toBeTruthy();
    expect(screen.queryByText('Kurşunlu Külliyesi')).toBeNull();
  });

  it('girişli açılışta paylasim_acildi olayı bir kez yazılır, "Giriş yapınca…" görünmez', () => {
    mockOturum.hesapli = true;
    const { rerender } = render(<PaylasimEkrani />);
    rerender(<PaylasimEkrani />);
    expect(mockOlay).toHaveBeenCalledTimes(1);
    expect(mockOlay).toHaveBeenCalledWith('paylasim_acildi', 'P1');
    expect(screen.queryByText(t('paylasim.girisNot'))).toBeNull();
  });

  it('girişsiz açılışta olay yazılmaz', () => {
    render(<PaylasimEkrani />);
    expect(mockOlay).not.toHaveBeenCalled();
  });

  it('#515 inceleme 1: girişten sonra bu ekrana dönünce bekleyen link silinir (girişsizken silinmez)', () => {
    const { rerender } = render(<PaylasimEkrani />);
    expect(mockBekleyenSil).not.toHaveBeenCalled();
    mockOturum.hesapli = true;
    rerender(<PaylasimEkrani />);
    expect(mockBekleyenSil).toHaveBeenCalledTimes(1);
  });

  it('#515 inceleme 2: logo dokunulabilir; girişliyi ana sayfaya, girişsizi girişe götürür', () => {
    const { unmount } = render(<PaylasimEkrani />);
    const logo = screen.getByRole('link', { name: t('paylasim.logoEtiket') });
    fireEvent.press(logo);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/giris');
    unmount();
    mockOturum.hesapli = true;
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByRole('link', { name: t('paylasim.logoEtiket') }));
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/(tabs)');
  });

  it('#515 inceleme 2: kapalı link ekranında da logo ana sayfa bağlantısı', () => {
    mockSorgu.data = { kapali: true };
    render(<PaylasimEkrani />);
    expect(screen.getByRole('link', { name: t('paylasim.logoEtiket') })).toBeTruthy();
  });

  it('harita yalnız "Haritada gör"e basınca izin sorar; izin varsa harita açılır', async () => {
    render(<PaylasimEkrani />);
    expect(mockIzin).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(t('paylasim.haritadaGor')));
    await waitFor(() => expect(screen.getByTestId('paylasim-harita')).toBeTruthy());
    expect(mockIzin).toHaveBeenCalledWith(TOKEN);
  });

  it('günlük sınır doluysa düğmenin yerine gri satır çıkar', async () => {
    mockIzin.mockImplementation(async () => false);
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.haritadaGor')));
    await waitFor(() => expect(screen.getByText(t('paylasim.haritaYok'))).toBeTruthy());
    expect(screen.queryByTestId('paylasim-harita')).toBeNull();
  });

  it('girişsiz "Seyahatime al": link saklanır, giriş açılır, seyahat kurulmaz', async () => {
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.seyahatimeAl')));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/giris'));
    expect(mockBekleyen).toHaveBeenCalledWith(TOKEN);
    expect(mockAl).not.toHaveBeenCalled();
  });

  it('girişli "Seyahatime al": yeni seyahatin Gezi sayfasına geçer', async () => {
    mockOturum.hesapli = true;
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.seyahatimeAl')));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'YENI' } }));
  });

  it('"Seyahatime al" hata verirse hata kutusu; link bu arada kapandıysa kapalı ekranı', async () => {
    mockOturum.hesapli = true;
    mockAl.mockImplementationOnce(async () => {
      throw new Error('ag');
    });
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.seyahatimeAl')));
    await waitFor(() => expect(screen.getByText(t('paylasim.alHata'))).toBeTruthy());
    mockAl.mockImplementationOnce(async () => {
      throw Object.assign(new Error('kapali'), { code: 'P0002' });
    });
    fireEvent.press(screen.getByText(t('paylasim.seyahatimeAl')));
    await waitFor(() => expect(screen.getByText(t('paylasim.kapaliBaslik'))).toBeTruthy());
  });

  it('kapalı link: "Bu paylaşım kapatıldı" + "Hazır gezilere bak" (girişsiz girişe)', () => {
    mockSorgu.data = { kapali: true };
    render(<PaylasimEkrani />);
    expect(screen.getByText(t('paylasim.kapaliBaslik'))).toBeTruthy();
    fireEvent.press(screen.getByText(t('paylasim.hazirGeziler')));
    expect(mockRouter.replace).toHaveBeenCalledWith('/giris');
  });

  it('bilinmeyen link: "Bu link açılmıyor"; girişli kullanıcı hazır gezilere gider', () => {
    mockOturum.hesapli = true;
    mockSorgu.data = null;
    render(<PaylasimEkrani />);
    expect(screen.getByText(t('paylasim.gecersizBaslik'))).toBeTruthy();
    expect(screen.getByText(t('paylasim.gecersizMetin'))).toBeTruthy();
    fireEvent.press(screen.getByText(t('paylasim.hazirGeziler')));
    expect(mockRouter.replace).toHaveBeenCalledWith('/geziler');
  });

  it('özet alınamazsa "Bağlanamadık" + Tekrar dene', () => {
    mockSorgu.isError = true;
    render(<PaylasimEkrani />);
    fireEvent.press(screen.getByText(t('paylasim.tekrarDene')));
    expect(mockSorgu.refetch).toHaveBeenCalled();
  });
});

describe('durakSatiri', () => {
  it('adı olan durak: tür · süre; adsız: "Durak N" + tür', () => {
    expect(durakSatiri({ ad: 'Kurşunlu', tur: 'museum', dakika: 45, lat: null, lng: null }, 1)).toEqual({ ust: 'Kurşunlu', alt: 'Müze · 45 dk' });
    expect(durakSatiri({ ad: null, tur: 'cafe', dakika: 60, lat: null, lng: null }, 3)).toEqual({ ust: 'Durak 3', alt: 'Kafe' });
  });
});
