// #569 ana sayfa v9 (UX önerileri kanvası, "Ana sayfa v9 · ONAYLI": `Ana_v9_GeziOncesi` · `_GeziSirasi` · `_GeziYok`): üst
// kısım (KK1), seyahat kartı ve kaydırma (KK2), gezi öncesi (KK3) ve sırası (KK4) kartları, gezisi olmayan kart (KK5), "+ Yeni
// gezi oluştur" bağlantısı (KK6), arama (KK7), raflar (KK8). #361 · #406'dan kalan davranışlar (arama ölçümü, raf ölçümü,
// yenileme, silindi bildirimi) burada da sınanır.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { acilisKarariniKapat } from '@/lib/acilis';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import AnaSayfa from '../../../app/(tabs)/(menu)/index';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { name: 'Ece Ö', photo_url: null } }) }));
let mockSeyahatler: SeyahatOzet[] | undefined = [];
let mockSeyahatHata = false;
const mockSeyahatRefetch = jest.fn();
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatler: () => ({
    data: mockSeyahatler,
    isPending: mockSeyahatler === undefined && !mockSeyahatHata,
    isError: mockSeyahatHata,
    isFetching: false,
    isRefetching: false,
    refetch: mockSeyahatRefetch,
  }),
}));
type G = { id: string; slug: string; baslik: string; ozet: string | null; kapak_url: string | null; gun_sayisi: number; mekan_sayisi: number; amaclar: string[]; sehirler: { ad: string; slug: string }; gunDuraklari: number[] };
const gezi = (id: string, amaclar: string[], sehir = 'Eskişehir', kapak: string | null = null): G => ({
  id,
  slug: id,
  baslik: `${sehir} gezisi ${id}`,
  ozet: `${id} özeti`,
  kapak_url: kapak,
  gun_sayisi: 2,
  mekan_sayisi: 9,
  amaclar,
  sehirler: { ad: sehir, slug: sehir.toLocaleLowerCase('tr') },
  gunDuraklari: [4, 3],
});
const mockAkis = { data: [] as G[] | undefined, isPending: false, isError: false, isFetching: false, refetch: jest.fn(async () => ({ isError: false, data: [] as unknown[] })) };
jest.mock('@/features/icerik/kesfetAkisi', () => ({
  ...jest.requireActual<object>('@/features/icerik/kesfetAkisi'),
  useKesfetAkisi: () => mockAkis,
}));
let mockBolumler: unknown[] | undefined = undefined;
let mockBolumlerBekliyor = false;
jest.mock('@/lib/anaSayfa', () => ({ useAnaSayfaBolumleri: () => ({ data: mockBolumler, isPending: mockBolumlerBekliyor, refetch: jest.fn(async () => ({})) }) }));
const mockOlayYaz = jest.fn();
const ESK_KAPAK = 'https://upload.wikimedia.org/esk.jpg';
const mockSehirler = [
  { id: 's-esk', ad: 'Eskişehir', slug: 'eskisehir', gezi_sayisi: 3, kapak_url: ESK_KAPAK, kapak_atif: { yazar: 'Ali Veli', lisans: 'CC BY-SA 4.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:E.jpg' } },
  { id: 's-van', ad: 'Van', slug: 'van', gezi_sayisi: 0, kapak_url: null, kapak_atif: null },
];
jest.mock('@/features/icerik/sorgular', () => ({
  sehirEslestir: jest.requireActual<{ sehirEslestir: unknown }>('@/features/icerik/sorgular').sehirEslestir,
  useSehirler: () => ({ data: mockSehirler }),
  useKaydedilenler: () => ({ data: [] }),
  useKaydet: () => ({ mutate: jest.fn() }),
  olayYaz: (...a: unknown[]) => mockOlayYaz(...a),
}));
jest.mock('@/features/davet/sorgular', () => ({
  bekleyenDavetiOku: async () => null,
  bekleyenDavetiSil: async () => undefined,
  useDavetKarsilama: () => ({ data: null, isError: false }),
  useDavetKarsilandi: () => async () => undefined,
}));
let mockPaylasimlar: unknown[] = [];
jest.mock('@/features/arkadaslar/sorgular', () => ({ useArkadasPaylasimlari: () => ({ data: mockPaylasimlar, refetch: jest.fn(async () => ({})) }) }));
let mockOkunmamis = 0;
jest.mock('@/features/sohbet/sorgular', () => ({ useOkunmamis: () => ({ data: mockOkunmamis }) }));
// KK4: "Sıradaki" satırı Gezi sayfasının hesabıyla kendi bileşeninde (`siradakiSatiri.test.tsx`); burada yalnız yerleşim.
jest.mock('@/components/anasayfa/SiradakiSatiri', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    SiradakiSatiri: ({ seyahatId, onMetin }: { seyahatId: string; onMetin?: (m: string | null) => void }) => {
      const metin = `Sıradaki: ${seyahatId} durağı · 14:30`;
      useEffect(() => onMetin?.(metin), [metin, onMetin]);
      return <Text testID="kart-siradaki">{metin}</Text>;
    },
  };
});
let mockParametre: { bildirim?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParametre,
  useFocusEffect: () => undefined,
}));
const { router } = jest.requireMock<{ router: Record<'push' | 'navigate', jest.Mock> }>('expo-router');

const bugun = yerelTarih(new Date(), 'Europe/Istanbul');
const gun = (n: number) => new Date(Date.parse(`${bugun}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sy = (id: string, start: string | null, end: string | null, sehir = id): SeyahatOzet => ({
  id,
  name: `${id} Gezisi`,
  city_label: sehir,
  start_date: start,
  end_date: end,
  tz: 'Europe/Istanbul',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [
    { user_id: 'm', role: 'member', display_name: 'Mert', guest: false },
    { user_id: 'ben', role: 'owner', display_name: 'Ece Ö', guest: false },
    { user_id: 'a', role: 'member', display_name: 'Ayşe', guest: false },
  ],
  places: [{ count: 2 }],
});
const profil = async (e: ReturnType<typeof render>) => waitFor(() => e.getByRole('button', { name: 'Profil' }));
const duz = (st: unknown) => StyleSheet.flatten(st as never) as Record<string, unknown>;

beforeEach(async () => {
  acilisKarariniKapat();
  router.push.mockClear();
  router.navigate.mockClear();
  mockOlayYaz.mockClear();
  mockSeyahatler = [];
  mockSeyahatHata = false;
  mockSeyahatRefetch.mockClear();
  mockParametre = {};
  mockAkis.data = [];
  mockBolumler = undefined;
  mockBolumlerBekliyor = false;
  mockAkis.isPending = false;
  mockAkis.isError = false;
  mockPaylasimlar = [];
  mockOkunmamis = 0;
});

describe('#569 KK1 üst kısım', () => {
  it('logo solda, profil yuvarlağı sağda (36 pt, Mandalina, baş harf) Profil ekranını açar; ♥ ve "+ Seyahat" yok', async () => {
    const e = render(<AnaSayfa />);
    const dugme = await profil(e);
    expect(e.getByRole('image', { name: 'Tripmate' })).toBeTruthy();
    expect(within(dugme).getByText('E')).toBeTruthy();
    expect(duz(within(dugme).getByLabelText('Ece Ö').props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ff7a1a' });
    fireEvent.press(dugme);
    expect(router.navigate).toHaveBeenLastCalledWith('/(tabs)/profil');
    expect(e.queryByText('Seyahat')).toBeNull();
  });

  it('♥ Kaydettiklerim (tasarım bekliyor) profilin solunda, eski görünümüyle; Kaydettiklerim açılır', async () => {
    const e = render(<AnaSayfa />);
    await profil(e);
    const kalp = e.getByRole('button', { name: 'Kaydettiklerim' });
    expect(duz(kalp.props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });
    const sira = e.UNSAFE_root.findAll((n) => typeof n.type === 'string' && (n.props.accessibilityLabel === 'Kaydettiklerim' || n.props.testID === 'ana-profil')).map((n) => n.props.accessibilityLabel ?? n.props.testID);
    expect(sira).toEqual(['Kaydettiklerim', 'Profil']);
    fireEvent.press(kalp);
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/kaydettiklerim');
  });
});

describe('#569 KK2 · KK3 gezi öncesi kart', () => {
  it('214 pt, köşe 20; şehrin BO kapağı ve atfı sağ üstte; "N gün kaldı · K kişi"; yüzler (ben önce) ve "Aç"; dokununca Gezi', async () => {
    mockSeyahatler = [sy('Esk', gun(2), gun(4), 'Eskişehir')];
    const e = render(<AnaSayfa />);
    const kart = await waitFor(() => e.getByTestId('seyahat-karti-Esk'));
    expect(duz(kart.props.style)).toMatchObject({ height: 214, borderRadius: 20, overflow: 'hidden' });
    expect(within(kart).getByTestId('kart-kapak').props.source).toEqual([{ uri: ESK_KAPAK }]);
    expect(within(kart).getByText('Esk Gezisi')).toBeTruthy();
    expect(within(kart).getByText('2 gün kaldı · 3 kişi')).toBeTruthy();
    expect(within(kart).getByText('Aç')).toBeTruthy();
    expect(within(kart).getAllByText(/^[EMA]$/, { includeHiddenElements: true }).map((x) => x.props.children)).toEqual(['E', 'M', 'A']);
    expect(within(kart).getByText('Foto: Ali Veli')).toBeTruthy();
    expect(duz(within(kart).getByTestId('kapak-atfi').props.style)).toMatchObject({ right: 0, top: 0, paddingRight: 12, paddingTop: 10, minHeight: 44, minWidth: 44 });
    fireEvent.press(within(kart).getByRole('button', { name: 'Esk Gezisi, 2 gün kaldı · 3 kişi' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'Esk' } });
    // Tek kartta tam genişlik (750 − 32), sayfa noktası yok.
    expect(duz(kart.props.style).width).toBe(750 - 32);
    expect(e.queryByTestId('sayfa-noktalari')).toBeNull();
  });

  it('şehrin kapağı yoksa yer tutucu (Google fotoğrafı yok); tarihsiz seyahatte yalnız "K kişi"', async () => {
    mockSeyahatler = [sy('Van', null, null)];
    const e = render(<AnaSayfa />);
    const kart = await waitFor(() => e.getByTestId('seyahat-karti-Van'));
    expect(within(kart).queryByTestId('kart-kapak')).toBeNull();
    expect(within(kart).getByTestId('seyahat-kapagi')).toBeTruthy();
    expect(within(kart).getByText('3 kişi')).toBeTruthy();
  });

  it('birden çok seyahat yana kayar: sıradakinin ucu görünür, altında sayfa noktaları kaydırmayla değişir', async () => {
    mockSeyahatler = [sy('Bir', gun(3), gun(4)), sy('Iki', gun(20), gun(22)), sy('Eski', gun(-30), gun(-28))];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByTestId('seyahat-karti-Bir')).toBeTruthy());
    expect(e.getByTestId('seyahat-karti-Iki')).toBeTruthy();
    // Biten seyahat kartta yok.
    expect(e.queryByTestId('seyahat-karti-Eski')).toBeNull();
    const genislik = 750 - 32 - 40;
    expect(duz(e.getByTestId('seyahat-karti-Bir').props.style).width).toBe(genislik);
    const kaydirici = e.getByTestId('seyahat-kartlari');
    expect(kaydirici.props.snapToInterval).toBe(genislik + 10);
    const noktalar = () => e.getByTestId('sayfa-noktalari').props.accessibilityLabel;
    expect(noktalar()).toBe('1. seyahat, toplam 2');
    fireEvent.scroll(kaydirici, { nativeEvent: { contentOffset: { x: genislik + 10, y: 0 } } });
    expect(noktalar()).toBe('2. seyahat, toplam 2');
  });
});

describe('#569 KK6 "+ Yeni gezi oluştur" bağlantısı', () => {
  it('gezi öncesinde kartın altında, sihirbazı açar', async () => {
    mockSeyahatler = [sy('Bir', gun(3), gun(4))];
    const e = render(<AnaSayfa />);
    fireEvent.press(await waitFor(() => e.getByTestId('ana-yeni-gezi')));
    // #574 KK1: her girişte yeni `n` → "Nasıl bir gezi?" temiz açılır.
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: { n: expect.any(String) } });
    const ilk = (router.push as jest.Mock).mock.calls.at(-1)![0] as { params: { n: string } };
    fireEvent.press(e.getByTestId('ana-yeni-gezi'));
    const ikinci = (router.push as jest.Mock).mock.calls.at(-1)![0] as { params: { n: string } };
    expect(ikinci.params.n).not.toBe(ilk.params.n);
    expect(within(e.getByTestId('ana-yeni-gezi')).getByText('Yeni gezi oluştur')).toBeTruthy();
  });

  it('gezi sırasında yok', async () => {
    mockSeyahatler = [sy('Bursa', gun(-1), gun(1)), sy('Bir', gun(3), gun(4))];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByTestId('seyahat-karti-Bursa')).toBeTruthy());
    expect(e.queryByTestId('ana-yeni-gezi')).toBeNull();
  });
});

describe('#569 KK4 gezi sırasındaki kart', () => {
  it('"Bugün N. gün", ad, Sıradaki satırı; Sohbet (okunmamış rozeti) ve Harcama hapları; karta dokununca Gezi', async () => {
    mockSeyahatler = [sy('Bursa', gun(-2), gun(1))];
    mockOkunmamis = 2;
    const e = render(<AnaSayfa />);
    const kart = await waitFor(() => e.getByTestId('seyahat-karti-Bursa'));
    expect(within(kart).getByText('Bugün 3. gün')).toBeTruthy();
    expect(within(kart).getByText('Sıradaki: Bursa durağı · 14:30')).toBeTruthy();
    const sohbet = within(kart).getByRole('button', { name: 'Sohbet, 2 okunmamış mesaj' });
    expect(within(sohbet).getByText('2')).toBeTruthy();
    fireEvent.press(sohbet);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/sohbet', params: { id: 'Bursa' } });
    fireEvent.press(within(kart).getByRole('button', { name: 'Harcama' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/harcama', params: { id: 'Bursa' } });
    fireEvent.press(within(kart).getByRole('button', { name: 'Bursa Gezisi, Bugün 3. gün, Sıradaki: Bursa durağı · 14:30' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'Bursa' } });
    expect(within(kart).queryByText('Aç')).toBeNull();
  });

  it('okunmamış yoksa rozet yok', async () => {
    mockSeyahatler = [sy('Bursa', gun(0), gun(1))];
    const e = render(<AnaSayfa />);
    const sohbet = await waitFor(() => e.getByRole('button', { name: 'Sohbet' }));
    expect(within(sohbet).queryByText(/^\d+$/)).toBeNull();
  });
});

describe('#569 KK5 gezisi olmayan', () => {
  it('"Sıradaki rota neresi?", alt satır ve turuncu tam genişlik "+ Yeni gezi oluştur" sihirbazı açar; görsel Eskişehir kapağı', async () => {
    mockSeyahatler = [sy('Eski', gun(-30), gun(-28))];
    const e = render(<AnaSayfa />);
    const kart = await waitFor(() => e.getByTestId('seyahat-karti-yok'));
    expect(within(kart).getByText('Sıradaki rota neresi?')).toBeTruthy();
    expect(within(kart).getByText('Arkadaşlarını çağır, planı birlikte çıkar')).toBeTruthy();
    expect(within(kart).getByTestId('kart-kapak').props.source).toEqual([{ uri: ESK_KAPAK }]);
    const dugme = within(kart).getByRole('button', { name: 'Yeni gezi oluştur' });
    expect(duz(dugme.props.style)).toMatchObject({ height: 48, borderRadius: 24, backgroundColor: '#ff7a1a' });
    fireEvent.press(dugme);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: { n: expect.any(String) } });
    // KK6: bağlantı yalnız gezi öncesinde.
    expect(e.queryByTestId('ana-yeni-gezi')).toBeNull();
  });

  it('seyahat listesi okunamazsa "Sıradaki rota neresi?" yok; hata satırı ve Tekrar dene', async () => {
    mockSeyahatHata = true;
    mockSeyahatler = undefined;
    const e = render(<AnaSayfa />);
    const hata = await waitFor(() => e.getByTestId('ana-seyahat-hata'));
    expect(within(hata).getByText('Seyahatler yüklenemedi.')).toBeTruthy();
    fireEvent.press(within(hata).getByRole('button', { name: 'Tekrar dene' }));
    expect(mockSeyahatRefetch).toHaveBeenCalled();
    expect(e.queryByTestId('seyahat-karti-yok')).toBeNull();
  });

  it('#586 bekler: BO karşılama görseli varsa o (Eskişehir yerine); bölümler gelene kadar yer tutucu', async () => {
    const KARSILAMA = 'https://x.supabase.co/storage/v1/object/public/icerik/anasayfa/k1.webp';
    mockBolumler = [{ id: 'k', tur: 'karsilama', baslik: '', sira: 0, kaynak: 'elle', icerik: { kapaklar: [{ url: KARSILAMA, atif: { yazar: 'Tripmate' } }] }, baslangic_at: null, bitis_at: null }];
    mockBolumlerBekliyor = true;
    const e = render(<AnaSayfa />);
    const kart = await waitFor(() => e.getByTestId('seyahat-karti-yok'));
    expect(within(kart).queryByTestId('kart-kapak')).toBeNull();
    mockBolumlerBekliyor = false;
    e.rerender(<AnaSayfa />);
    await waitFor(() => expect(within(e.getByTestId('seyahat-karti-yok')).getByTestId('kart-kapak').props.source).toEqual([{ uri: KARSILAMA }]));
    expect(within(e.getByTestId('seyahat-karti-yok')).getByText('Foto: Tripmate')).toBeTruthy();
  });

  it('seyahat listesi gelmeden kart alanı çizilmez', async () => {
    mockSeyahatler = undefined;
    const e = render(<AnaSayfa />);
    await profil(e);
    expect(e.queryByTestId('seyahat-karti-yok')).toBeNull();
  });
});

describe('#569 KK7 arama', () => {
  beforeEach(() => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['doga'], 'İzmir')];
  });

  it('"Nereye gitmek istersin?" (52 pt, #F6F7FA); şehirden "… için gezi kur" sihirbazı o şehirle açar', async () => {
    const e = render(<AnaSayfa />);
    const kutu = await waitFor(() => e.getByLabelText('Nereye gitmek istersin?'));
    expect(kutu.props.placeholder).toBe('Nereye gitmek istersin?');
    expect(duz(e.getByTestId('ana-arama-kutu').props.style)).toMatchObject({ height: 52, borderRadius: 26, backgroundColor: '#F6F7FA' });
    fireEvent.changeText(kutu, 'eskiş');
    const sonuc = e.getByTestId('ana-arama-sonuc');
    expect(within(sonuc).getByText('Eskişehir gezisi g1')).toBeTruthy();
    expect(within(sonuc).queryByText('İzmir gezisi g2')).toBeNull();
    fireEvent.press(within(sonuc).getByText(/için gezi kur/));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ sehir: 's-esk' }) });
    expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'sehir', sehir_slug: 'eskisehir' });
  });

  it('rehberli olmayan metin: "“{metin}” için gezi kur"; yazılan metin ölçüme yazılmaz', async () => {
    const e = render(<AnaSayfa />);
    fireEvent.changeText(await waitFor(() => e.getByLabelText('Nereye gitmek istersin?')), 'Mardin');
    fireEvent.press(e.getByText('“Mardin” için gezi kur'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ metin: 'Mardin' }) });
    expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'metin' });
    expect(JSON.stringify(mockOlayYaz.mock.calls)).not.toContain('Mardin');
  });

  it('× temizler; odakta 2 px Gece kenar; sonuçtan bir şey seçmeden temizlenirse ana_ara sonuc=yok', async () => {
    const e = render(<AnaSayfa />);
    const kutu = await waitFor(() => e.getByLabelText('Nereye gitmek istersin?'));
    const stil = () => duz(e.getByTestId('ana-arama-kutu').props.style);
    expect(stil().borderWidth).toBeUndefined();
    fireEvent(kutu, 'focus');
    expect(stil()).toMatchObject({ borderWidth: 2, borderColor: '#152a6b' });
    fireEvent(kutu, 'blur');
    fireEvent.changeText(kutu, 'Mardin');
    fireEvent.press(e.getByRole('button', { name: 'Aramayı temizle' }));
    expect(e.queryByTestId('ana-arama-sonuc')).toBeNull();
    await waitFor(() => expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'yok' }));
  });
});

const raf = (id: string, sira: number, baslik: string, icerik: object) => ({ id, tur: 'raf', baslik, sira, kaynak: 'elle', icerik, baslangic_at: null, bitis_at: null });
const paylasim = (id: string, paylasan: string, ad: string, sehir: string, gun_sayisi: number) => ({
  id,
  paylasan,
  paylasan_ad: ad,
  foto: null,
  sehir,
  ad: null,
  olusturuldu: '2026-11-20T10:00:00Z',
  gun_sayisi,
  durak_sayisi: 8,
  kisi_sayisi: 2,
  kisi_kip: 'gezdi',
  begendim: false,
});

describe('#569 KK8 raflar', () => {
  it('ilk raf "Arkadaşlarının rotaları": şehir ve "Ad · N gün"; kart paylaşımı, Tümü Arkadaşlar sekmesini açar', async () => {
    mockPaylasimlar = [paylasim('p1', 'u-a', 'Ayşe Kaya', 'Mardin', 3), paylasim('p2', 'u-m', 'Mert', 'Safranbolu', 2)];
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet'])];
    const e = render(<AnaSayfa />);
    const rafArk = await waitFor(() => e.getByTestId('raf-arkadaslar'));
    expect(within(rafArk).getByText('Arkadaşlarının rotaları')).toBeTruthy();
    expect(within(rafArk).getByText('Mardin')).toBeTruthy();
    expect(within(rafArk).getByText('Ayşe · 3 gün')).toBeTruthy();
    fireEvent.press(within(rafArk).getByRole('button', { name: 'Mardin, Ayşe · 3 gün' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/r/g/[token]', params: { token: 'p1' } });
    fireEvent.press(within(rafArk).getByRole('button', { name: 'Arkadaşlarının rotaları, tümünü gör' }));
    expect(router.navigate).toHaveBeenLastCalledWith('/(tabs)/arkadaslar');
    // Sıra: arkadaş rafı, sonra BO rafı.
    const ids = e.UNSAFE_root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string' && /^raf-(arkadaslar|amac:)/.test(n.props.testID)).map((n) => n.props.testID as string);
    expect(ids[0]).toBe('raf-arkadaslar');
    expect(ids).toContain('raf-amac:lezzet');
  });

  it('arkadaş paylaşımı yoksa raf gizli', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet'])];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Lezzet için')).toBeTruthy());
    expect(e.queryByTestId('raf-arkadaslar')).toBeNull();
  });

  it('BO rafları kategori başlığıyla sırayla (21/800); 150×186 kart, başlık kapakta; dokununca gezi ve raf_kart_acildi; çip ve ♥ yok', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', []), gezi('g3', [], 'Bursa'), gezi('g4', ['lezzet'])];
    mockBolumler = [
      raf('r1', 1, 'Hafta sonu kaçamakları', { raf_turu: 'elle', gezi_idler: ['g3', 'g1', 'yok', 'g2'] }),
      raf('r2', 2, 'Lezzet için', { raf_turu: 'amac', amac: 'lezzet' }),
    ];
    const e = render(<AnaSayfa />);
    const r1 = await waitFor(() => e.getByTestId('raf-r1'));
    expect(duz(within(r1).getByRole('header').props.style)).toMatchObject({ fontSize: 21, fontFamily: 'Figtree_800ExtraBold' });
    expect(within(r1).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Bursa gezisi g3', 'Eskişehir gezisi g1', 'Eskişehir gezisi g2']);
    expect(duz(e.getByTestId('raf-kart-g3').props.style)).toMatchObject({ width: 150, height: 186, borderRadius: 16 });
    // 3'ten az gezili raf yok.
    expect(e.queryByText('Lezzet için')).toBeNull();
    fireEvent.press(e.getByRole('button', { name: 'Eskişehir gezisi g1' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/gezi/[slug]', params: { slug: 'g1' } });
    expect(mockOlayYaz).toHaveBeenCalledWith('raf_kart_acildi', 'g1', { raf: 'r1', raf_turu: 'elle' });
    expect(e.queryByRole('togglebutton')).toBeNull();
    expect(e.queryByRole('tab')).toBeNull();
  });

  it('bölümler gelene kadar raf alanında gösterge', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet'])];
    mockBolumlerBekliyor = true;
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByLabelText('Geziler yükleniyor')).toBeTruthy());
    expect(e.queryByText('Lezzet için')).toBeNull();
  });
});

describe('Kalan davranışlar', () => {
  it('#291 KK6: aşağı çekip yenileme gezileri de çeker; veri varken hata verirse bir kez "Güncellenemedi"', async () => {
    const e = render(<AnaSayfa />);
    await profil(e);
    const yenile = () => e.UNSAFE_getAllByType(ScrollView)[0].props.refreshControl.props.onRefresh as () => Promise<unknown>;
    mockAkis.refetch.mockClear();
    await act(() => yenile()());
    expect(mockAkis.refetch).toHaveBeenCalledTimes(1);
    mockAkis.refetch.mockResolvedValueOnce({ isError: true, data: [{}] });
    await act(() => yenile()());
    expect(e.getAllByText('Güncellenemedi')).toHaveLength(1);
  });

  it('silindi parametresiyle gelince "Seyahat silindi" bildirimi', async () => {
    mockParametre = { bildirim: 'silindi' };
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Seyahat silindi')).toBeTruthy());
  });
});
