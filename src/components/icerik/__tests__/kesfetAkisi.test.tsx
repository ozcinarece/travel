// #277: Keşfet akışı — kart (KK1, KK8), kaynak ve sıra (KK2, KK3), eylemler (KK4), "Kendi gezini kur" (KK5), bayrak (KK6),
// iskelet ve "Bağlanamadık" (KK7).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { Path } from 'react-native-svg';

import { ayrilmaEki } from '@/features/davet/katilim';
import { akisGezisi, akisSirasi, kartEtiketi, kesfetAkisiAcik, type AkisGezisi } from '@/features/icerik/kesfetAkisi';

import { Logo } from '@/components/ui/Logo';

import { KesfetAkisi } from '../KesfetAkisi';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const mockKaydet = jest.fn();
let mockKayitli: { tur: string; hedef_id: string }[] = [];
jest.mock('@/features/icerik/sorgular', () => ({
  useKaydet: () => ({ mutate: mockKaydet }),
  useKaydedilenler: () => ({ data: mockKayitli }),
}));
type Sorgu = { data?: AkisGezisi[]; isPending: boolean; isError: boolean; isFetching: boolean; refetch: jest.Mock };
let mockAkis: Sorgu;
jest.mock('@/features/icerik/kesfetAkisi', () => ({
  ...jest.requireActual<object>('@/features/icerik/kesfetAkisi'),
  useKesfetAkisi: () => mockAkis,
}));
jest.mock('@/components/icerik/GeziAl', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { GeziAlYukleyici: ({ slug }: { slug: string }) => <Text>{`al:${slug}`}</Text> };
});
const { router } = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router');

const gezi = (id: string, sehir: string, gunDuraklari: number[], ozet: string | null = 'Odunpazarı’nda sabah, Porsuk kıyısında akşam.'): AkisGezisi => ({
  id,
  sehir_id: `s-${sehir}`,
  baslik: `${sehir} gezisi ${id}`,
  slug: `slug-${id}`,
  kapak_url: null,
  ozet,
  yazi_md: null,
  yazar_ad: null,
  gun_sayisi: gunDuraklari.length,
  mekan_sayisi: gunDuraklari.reduce((a, b) => a + b, 0),
  sira: null,
  created_at: '2026-11-01T00:00:00Z',
  sehirler: { ad: sehir, slug: sehir.toLowerCase() },
  gunDuraklari,
});

const liste = [gezi('a', 'Bursa', [4, 3]), gezi('b', 'Eskişehir', [5, 5, 4]), gezi('c', 'İzmir', [6]), gezi('d', 'Eskişehir', [7])];

beforeEach(() => {
  mockAkis = { data: liste, isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
  mockKayitli = [];
  mockKaydet.mockClear();
  router.push.mockClear();
});

describe('saf yardımcılar', () => {
  it('KK2: günler sıraya dizilir, her günün durak sayısı alınır; ham gömme karta taşınmaz', () => {
    const g = akisGezisi({ ...gezi('x', 'Bursa', []), gezi_gunleri: [{ sira: 2, gezi_duraklari: [{ count: 3 }] }, { sira: 1, gezi_duraklari: [{ count: 5 }] }, { sira: 3 }] } as never);
    expect(g.gunDuraklari).toEqual([5, 3, 0]);
    expect('gezi_gunleri' in g).toBe(false);
  });

  it('KK3: yaklaşan şehrin gezileri önde, sıra her iki grupta korunur; şehir yoksa sıra aynen', () => {
    const { sehirGezileri, digerleri } = akisSirasi(liste, 'Eskişehir, Türkiye');
    expect(sehirGezileri.map((g) => g.id)).toEqual(['b', 'd']);
    expect(digerleri.map((g) => g.id)).toEqual(['a', 'c']);
    expect(akisSirasi(liste, null).digerleri.map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('KK8: ekran okuyucu etiketi', () => {
    expect(kartEtiketi(liste[1])).toBe('Eskişehir, 3 gün, 14 durak, Tripmate gezisi');
  });

  it('ayrılma eki', () => {
    expect(['Eskişehir', 'Bursa', 'İzmir', 'Kapadokya', 'Muş', 'Safranbolu'].map(ayrilmaEki)).toEqual(["Eskişehir'den", "Bursa'dan", "İzmir'den", "Kapadokya'dan", "Muş'tan", "Safranbolu'dan"]);
  });

  it('KK6: bayrak varsayılan kapalı; yalnız "1" açar', () => {
    const eski = process.env.EXPO_PUBLIC_KESFET_AKISI;
    delete process.env.EXPO_PUBLIC_KESFET_AKISI;
    expect(kesfetAkisiAcik()).toBe(false);
    process.env.EXPO_PUBLIC_KESFET_AKISI = '1';
    expect(kesfetAkisiAcik()).toBe(true);
    process.env.EXPO_PUBLIC_KESFET_AKISI = eski;
  });
});

describe('<KesfetAkisi />', () => {
  it('KK1 · KK3 · KK8: yaklaşan şehir başlığı, o şehrin kartları önde; kart başlığı, rota şeridi, not, 3 eylem', () => {
    render(<KesfetAkisi sehir="Eskişehir" onYeni={jest.fn()} />);
    expect(screen.getByText('GİDECEĞİN ŞEHİR')).toBeTruthy();
    expect(screen.getByText("Eskişehir'den geziler")).toBeTruthy();
    const kartlar = screen.getAllByLabelText(/Tripmate gezisi$/).map((k) => k.props.accessibilityLabel);
    expect(kartlar).toEqual(['Eskişehir, 3 gün, 14 durak, Tripmate gezisi', 'Eskişehir, 1 gün, 7 durak, Tripmate gezisi', 'Bursa, 2 gün, 7 durak, Tripmate gezisi', 'İzmir, 1 gün, 6 durak, Tripmate gezisi']);
    expect(screen.getByText('Eskişehir · 3 gün · 14 durak')).toBeTruthy();
    expect(screen.getByLabelText('Rota: 1. gün 5 durak, 2. gün 5 durak, 3. gün 4 durak')).toBeTruthy();
    expect(screen.getAllByText('Odunpazarı’nda sabah, Porsuk kıyısında akşam.')).toHaveLength(4);
    expect(screen.getAllByLabelText('Kaydet')).toHaveLength(4);
    expect(screen.getAllByLabelText('WhatsApp’ta paylaş')).toHaveLength(4);
    expect(screen.getAllByText('Seyahatime al')).toHaveLength(4);
  });

  it('yaklaşan seyahat yoksa ya da o şehrin gezisi yoksa "Geziler" başlığı', () => {
    render(<KesfetAkisi sehir="Ankara" onYeni={jest.fn()} />);
    expect(screen.getByText('Geziler')).toBeTruthy();
    expect(screen.queryByText('GİDECEĞİN ŞEHİR')).toBeNull();
  });

  it('KK4: ♥ Kaydet kaydedilenlere yazar; WhatsApp sistem paylaş sayfasını gezi linkiyle açar; Seyahatime al alt sayfayı açar; karta dokununca gezi', () => {
    const paylas = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    fireEvent.press(screen.getAllByLabelText('Kaydet')[0]);
    expect(mockKaydet).toHaveBeenCalledWith({ tur: 'gezi', hedef_id: 'a', kayitli: false });
    fireEvent.press(screen.getAllByLabelText('WhatsApp’ta paylaş')[0]);
    expect(paylas).toHaveBeenCalledWith({ message: expect.stringMatching(/^Bursa gezisi a · .*gezi\/slug-a$/) });
    fireEvent.press(screen.getAllByText('Seyahatime al')[1]);
    expect(screen.getByText('al:slug-b')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('İzmir, 1 gün, 6 durak, Tripmate gezisi'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/gezi/[slug]', params: { slug: 'slug-c' } });
    paylas.mockRestore();
  });

  it('#287 KK3: kalp aç/kapa düğmesi — "Kaydet" + checked (selected değil); dokununca kaldırır', () => {
    mockKayitli = [{ tur: 'gezi', hedef_id: 'a' }];
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const kalpler = screen.getAllByLabelText('Kaydet');
    expect(kalpler).toHaveLength(4);
    kalpler.forEach((k) => {
      expect(k.props.accessibilityRole).toBe('togglebutton');
      expect(k.props.accessibilityState?.selected).toBeUndefined();
    });
    expect(kalpler.map((k) => k.props.accessibilityState?.checked)).toEqual([true, false, false, false]);
    fireEvent.press(kalpler[0]);
    expect(mockKaydet).toHaveBeenCalledWith({ tur: 'gezi', hedef_id: 'a', kayitli: true });
  });

  it('#287 KK2: kart rozetindeki 20 px logo kanvastaki gibi kesik çizgi (7 4.5); başka yerde 24 altı kesiksiz kalır', () => {
    const rozet = render(<Logo boyut={20} koyuZemin kesik />);
    expect(rozet.UNSAFE_getByType(Path).props.strokeDasharray).toBe('7 4.5');
    rozet.unmount();
    const kucuk = render(<Logo boyut={20} koyuZemin />);
    expect(kucuk.UNSAFE_getByType(Path).props.strokeDasharray).toBeUndefined();
    kucuk.unmount();
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.UNSAFE_getAllByType(Path).filter((p) => p.props.strokeDasharray === '7 4.5')).toHaveLength(4);
  });

  it('#287 KK1: veri varken yenileme hata verirse kartlar ekranda kalır, "Bağlanamadık" çıkmaz', () => {
    const e = render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getAllByLabelText(/Tripmate gezisi$/)).toHaveLength(4);
    mockAkis = { data: liste, isPending: false, isError: true, isFetching: false, refetch: jest.fn() };
    e.rerender(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getAllByLabelText(/Tripmate gezisi$/)).toHaveLength(4);
    expect(screen.queryByText('Bağlanamadık')).toBeNull();
  });

  it('#287 KK4: 10 durağa kadar her durak bir halka; 10’dan fazlaysa en çok 8 halka + "+N"', () => {
    mockAkis = { data: [gezi('u', 'Bursa', [12]), gezi('v', 'İzmir', [10])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getAllByTestId('rota-halka')).toHaveLength(8 + 10);
    expect(screen.getByText('+4')).toBeTruthy();
    expect(screen.getByLabelText('Rota: 1. gün 12 durak')).toBeTruthy();
  });

  it('KK5: akışın sonunda "Kendi gezini kur"; Başla yeni seyahat sihirbazını açar', () => {
    const onYeni = jest.fn();
    render(<KesfetAkisi sehir={null} onYeni={onYeni} />);
    expect(screen.getByText('Kendi gezini kur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Kendi gezini kur: başla'));
    expect(onYeni).toHaveBeenCalled();
  });

  it('KK7: yüklenirken iskelet kartlar; hata/çevrimdışında "Bağlanamadık" ve Tekrar dene', () => {
    mockAkis = { data: undefined, isPending: true, isError: false, isFetching: true, refetch: jest.fn() };
    const e = render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getAllByLabelText('Geziler yükleniyor')).toHaveLength(2);
    const refetch = jest.fn();
    mockAkis = { data: undefined, isPending: false, isError: true, isFetching: false, refetch };
    e.rerender(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getByText('Bağlanamadık')).toBeTruthy();
    fireEvent.press(screen.getByText('Tekrar dene'));
    expect(refetch).toHaveBeenCalled();
  });
});
