// #277: Keşfet akışı — kart (KK1, KK8), kaynak ve sıra (KK2, KK3), eylemler (KK4), "Kendi gezini kur" (KK5), bayrak (KK6),
// iskelet ve "Bağlanamadık" (KK7).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Share, StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';

import { ayrilmaEki } from '@/features/davet/katilim';
import { akisGezisi, akisSirasi, kartEtiketi, kesfetAkisiAcik, type AkisGezisi } from '@/features/icerik/kesfetAkisi';

import { Logo } from '@/components/ui/Logo';

import { Kalp } from '../Kalp';
import { KesfetAkisi } from '../KesfetAkisi';
import { rotaPlani } from '../KesfetKarti';

/**
 * #291 KK1: bir rota şeridinin en dar hali (pt): gün karosu 20 + 5 + halkalar (8 pt, aralıksız) + varsa 5 + "+N"
 * (Figtree 800 11 pt'de karakter başına ≈ 7 pt); günler arası 6, varsa "+N gün".
 */
function enDarRota(gunler: number[]): number {
  const plan = rotaPlani(gunler);
  const metin = (m: string) => m.length * 7;
  const gun = plan.gunler.map((g) => 20 + 5 + g.halka * 8 + (g.kalan > 0 ? 5 + metin(`+${g.kalan}`) : 0));
  const ek = plan.kalanGun > 0 ? [metin(`+${plan.kalanGun} gün`)] : [];
  const parcalar = [...gun, ...ek];
  return parcalar.reduce((a, b) => a + b, 0) + 6 * (parcalar.length - 1);
}

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

  it('#291 KK1 (29g · B): en çok 3 gün çizilir, fazlası "+N gün"; halka sınırı floor(12 ÷ çizilen gün), en çok 10', () => {
    const halkalar = (gunler: number[]) => rotaPlani(gunler).gunler.map((g) => [g.halka, g.kalan]);
    expect(halkalar([12])).toEqual([[10, 2]]);
    expect(halkalar([10, 10])).toEqual([[6, 4], [6, 4]]);
    expect(halkalar([10, 10, 10])).toEqual([[4, 6], [4, 6], [4, 6]]);
    // Kanvas örneği 12/10/4: 4 halka + "+8", 4 halka + "+6", 4 halka.
    expect(halkalar([12, 10, 4])).toEqual([[4, 8], [4, 6], [4, 0]]);
    // Sınır toplam günden değil çizilen günden: 4 × 7 → 3 gün × 4 halka + "+3", "+1 gün".
    const dort = rotaPlani([7, 7, 7, 7]);
    expect(dort.gunler.map((g) => [g.gun, g.halka, g.kalan])).toEqual([[1, 4, 3], [2, 4, 3], [3, 4, 3]]);
    expect(dort.kalanGun).toBe(1);
    const uzun = rotaPlani([4, 4, 4, 4, 4, 4]);
    expect(uzun.gunler.map((g) => [g.gun, g.halka, g.kalan])).toEqual([[1, 4, 0], [2, 4, 0], [3, 4, 0]]);
    expect(uzun.kalanGun).toBe(3);
    mockAkis = { data: [gezi('u', 'İstanbul', [10, 10, 10]), gezi('v', 'Bursa', [4, 4, 4, 4, 4, 4])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getAllByTestId('rota-halka')).toHaveLength(12 + 12);
    expect(screen.getAllByText('+6', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getByText('+3 gün', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('+3 gün')).toBeNull();
    // Rota etiketi gerçek sayıları söyler (çizilmeyen günler dahil).
    expect(screen.getByLabelText('Rota: 1. gün 10 durak, 2. gün 10 durak, 3. gün 10 durak')).toBeTruthy();
    expect(screen.getByLabelText(/6\. gün 4 durak$/)).toBeTruthy();
  });

  it('#291 KK1: 375 pt genişlikte 4×7, 6×4, 3×10 ve 12/10/4 şeridinin en dar hali karta sığar (komşu güne binmez)', () => {
    // Kart iç genişliği: 375 − 2×20 (akış kenarı) − 2×16 (kart iç boşluğu) − 2×1 (kenar çizgisi) = 301.
    for (const gunler of [[7, 7, 7, 7], [4, 4, 4, 4, 4, 4], [10, 10, 10], [12, 10, 4], [12], [10, 10]]) {
      expect(enDarRota(gunler)).toBeLessThanOrEqual(301);
    }
  });

  it('#291 KK1: halka hattı taşarsa kırpılır (overflow hidden)', () => {
    mockAkis = { data: [gezi('u', 'İstanbul', [12, 10, 4])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const hat = screen.getAllByTestId('rota-hat')[0];
    expect(StyleSheet.flatten(hat.props.style)).toEqual(expect.objectContaining({ overflow: 'hidden', flexGrow: 1 }));
  });

  it('#291 KK2: her gün önce kendi yerini alır (flexBasis auto), kalan yer gerçek durak sayısıyla paylaşılır', () => {
    mockAkis = { data: [gezi('u', 'İstanbul', [12, 10, 4])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const gunler = screen.getAllByTestId('rota-gun').map((g) => StyleSheet.flatten(g.props.style));
    expect(gunler.map((g) => g.flexGrow)).toEqual([12, 10, 4]);
    gunler.forEach((g) => expect(g).toEqual(expect.objectContaining({ flexBasis: 'auto', flexShrink: 1 })));
  });

  it('#291 KK3: "+N" Figtree 800, 11 px, #4A5274, ekran okuyucuya okunmaz; gün numarası en çok 1,3× büyür', () => {
    mockAkis = { data: [gezi('u', 'İstanbul', [12, 10, 4])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const arti = screen.getByText('+8', { includeHiddenElements: true });
    expect(StyleSheet.flatten(arti.props.style)).toEqual(expect.objectContaining({ fontFamily: 'Figtree_800ExtraBold', fontSize: 11, color: '#4a5274', flexShrink: 0 }));
    expect(arti.props.importantForAccessibility).toBe('no');
    expect(arti.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByText('1').props.maxFontSizeMultiplier).toBe(1.3);
    expect(arti.props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('#291 KK1: "+N gün" de en çok 1,3× büyür', () => {
    mockAkis = { data: [gezi('u', 'İstanbul', [4, 4, 4, 4, 4, 4])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    expect(screen.getByText('+3 gün', { includeHiddenElements: true }).props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('#291 KK4: Kalp de aç/kapa düğmesi — sabit "Kaydet", durum checked', () => {
    mockKayitli = [{ tur: 'yer', hedef_id: 'm1' }];
    const e = render(<Kalp tur="yer" hedefId="m1" />);
    const k = screen.getByRole('togglebutton');
    expect(k.props.accessibilityLabel).toBe('Kaydet');
    expect(k.props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(k);
    expect(mockKaydet).toHaveBeenCalledWith({ tur: 'yer', hedef_id: 'm1', kayitli: true });
    e.unmount();
    render(<Kalp tur="yer" hedefId="m2" />);
    expect(screen.getByRole('togglebutton').props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
  });

  it('#287 KK4 (kanvas 29g · C): yazı ölçeği 1,5 iken "Seyahatime al" ayrı satırda ve tam genişlikte; 1,0 iken tek satır', () => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    const olcek = (fontScale: number) => ({ width: 375, height: 812, scale: 2, fontScale });
    const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue(olcek(1.5));
    mockAkis = { data: [gezi('a', 'Bursa', [4, 3])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    const e = render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const al = screen.getByTestId('kesfet-al');
    const kalp = screen.getByRole('togglebutton');
    // Kalp + paylaş üst satırda (aynı satır kabı); "Seyahatime al" o satırın dışında, eylem kabının doğrudan çocuğu.
    expect(kalp.parent?.parent).not.toBe(al.parent);
    expect(StyleSheet.flatten(al.props.style)).toEqual(expect.objectContaining({ alignSelf: 'stretch', flexGrow: 0 }));
    spy.mockReturnValue(olcek(1));
    e.rerender(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const al1 = screen.getByTestId('kesfet-al');
    expect(StyleSheet.flatten(al1.props.style)).toEqual(expect.objectContaining({ flexGrow: 1, flexShrink: 1, flexBasis: 0 }));
    expect(StyleSheet.flatten(al1.props.style).alignSelf).toBeUndefined();
    spy.mockRestore();
  });

  it('#291 KK7 (29g · C): iki satırda aralık 12; kalp en az 44 ve satırla büyür; paylaş ve "Seyahatime al" iç boşluklu', () => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 2, fontScale: 2 });
    mockAkis = { data: [gezi('a', 'Bursa', [4, 3])], isPending: false, isError: false, isFetching: false, refetch: jest.fn() };
    render(<KesfetAkisi sehir={null} onYeni={jest.fn()} />);
    const kalp = screen.getByRole('togglebutton');
    const paylas = screen.getByLabelText('WhatsApp’ta paylaş');
    const al = screen.getByTestId('kesfet-al');
    const ks = StyleSheet.flatten(kalp.props.style);
    // Kalp ve paylaş aynı satırda; kalp sabit yükseklik almaz, satırla (paylaşın yazıyla büyüyen yüksekliğiyle) uzar.
    let satir = kalp.parent;
    while (satir && StyleSheet.flatten(satir.props.style)?.flexDirection !== 'row') satir = satir.parent;
    expect(satir && within(satir).queryByLabelText('WhatsApp’ta paylaş') !== null).toBe(true);
    expect(satir && within(satir).queryByTestId('kesfet-al') === null).toBe(true);
    expect(ks).toEqual(expect.objectContaining({ width: 56, minHeight: 44, alignSelf: 'stretch' }));
    expect(ks.height).toBeUndefined();
    expect(StyleSheet.flatten(paylas.props.style)).toEqual(expect.objectContaining({ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14 }));
    expect(StyleSheet.flatten(al.props.style)).toEqual(expect.objectContaining({ paddingHorizontal: 14, paddingVertical: 10 }));
    let kap = al.parent;
    while (kap && StyleSheet.flatten(kap.props.style)?.flexDirection !== 'column') kap = kap.parent;
    expect(StyleSheet.flatten(kap?.props.style).gap).toBe(12);
    spy.mockRestore();
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
