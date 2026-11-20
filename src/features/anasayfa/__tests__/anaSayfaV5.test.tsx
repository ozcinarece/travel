// #361 ana sayfa v5 (UX önerileri kanvası, Ana_v5_Yok · Ana_v5_Var · Ana_v5_Bitti · Ana_v5_Amaclar): üst satır (KK2),
// Planlamaya devam (KK3), gezi bitti (KK4), yerel arama (KK5), ölçüm (KK8). #406 (`Ana_v6_Kesfet`): raflar ve banner.
// #275/#276/#290'dan kalan davranışlar (silindi bildirimi, yenileme, borç kartı) burada da sınanır.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import type { Kisiler } from '@/features/harcama/metin';
import { acilisKarariniKapat } from '@/lib/acilis';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import AnaSayfa from '../../../app/(tabs)/(menu)/index';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { name: 'Ece Ö', photo_url: null } }) }));
let mockSeyahatler: SeyahatOzet[] = [];
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: mockSeyahatler, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }) }));
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
jest.mock('@/lib/anaSayfa', () => ({ useAnaSayfaBolumleri: () => ({ data: mockBolumler, refetch: jest.fn(async () => ({})) }) }));
const mockOlayYaz = jest.fn();
const mockSehirler = [
  { id: 's-esk', ad: 'Eskişehir', slug: 'eskisehir', gezi_sayisi: 3 },
  { id: 's-van', ad: 'Van', slug: 'van', gezi_sayisi: 0 },
];
jest.mock('@/features/icerik/sorgular', () => ({
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
let mockBorc: unknown = null;
let mockAdim: unknown = null;
jest.mock('@/features/anasayfa/serit', () => ({
  ...jest.requireActual<object>('@/features/anasayfa/serit'),
  useAcikBorc: (sy: unknown) => (sy ? mockBorc : null),
  useSeritAdimi: (sy: unknown) => (sy ? mockAdim : undefined),
}));
let mockParametre: { bildirim?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParametre,
  useFocusEffect: () => undefined,
}));
const { router } = jest.requireMock<{ router: Record<'push', jest.Mock> }>('expo-router');

const bugun = yerelTarih(new Date(), 'Europe/Istanbul');
const gun = (n: number) => new Date(Date.parse(`${bugun}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sy = (id: string, start: string | null, end: string | null): SeyahatOzet => ({
  id,
  name: null,
  city_label: id,
  start_date: start,
  end_date: end,
  tz: 'Europe/Istanbul',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [
    { user_id: 'ben', role: 'owner', display_name: 'Ece Ö', guest: false },
    { user_id: 'm', role: 'member', display_name: 'Mert', guest: false },
  ],
  places: [{ count: 2 }],
});
const adlar: Record<string, string> = { a: 'Ayşe', m: 'Mert' };
const harcamaKisileri: Kisiler = { ad: (id) => adlar[id] ?? id, renk: () => '#152a6b', foto: () => null, uyeIdleri: ['a', 'm'] };
const dagit = { tur: 'dagit', mekanIdleri: ['m1', 'm2'], otelYok: false };
const kaydettiklerim = async (e: ReturnType<typeof render>) => waitFor(() => e.getByRole('button', { name: 'Kaydettiklerim' }));

beforeEach(async () => {
  acilisKarariniKapat();
  router.push.mockClear();
  mockOlayYaz.mockClear();
  mockSeyahatler = [];
  mockBorc = null;
  mockAdim = null;
  mockParametre = {};
  mockAkis.data = [];
  mockBolumler = undefined;
  mockAkis.isPending = false;
  mockAkis.isError = false;
});

describe('#361 KK2 üst satır', () => {
  it('♥ Kaydettiklerim, "+ Seyahat" sihirbaz; profil dairesi yok (#405 KK3); ayrı Ara ikonu yok', async () => {
    mockAkis.data = [gezi('g1', ['lezzet'])];
    const e = render(<AnaSayfa />);
    fireEvent.press(await kaydettiklerim(e));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/kaydettiklerim');
    fireEvent.press(e.getByRole('button', { name: 'Yeni seyahat' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
    expect(e.getByText('Seyahat')).toBeTruthy();
    expect(e.queryByRole('button', { name: 'Profil' })).toBeNull();
    expect(e.queryByRole('button', { name: 'Ara' })).toBeNull();
    // Eski ana sayfa öğeleri yok (KK1).
    expect(e.queryByText(/Merhaba/)).toBeNull();
    expect(e.queryByText('Nereye gidelim?')).toBeNull();
  });
});

describe('#361 KK3 · KK4 üst satır', () => {
  it('yaklaşan seyahat: ad, turuncu Sıradaki adım, "N gün kaldı · kişiler"; dokununca seyahat ve planlamaya_devam', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    mockAdim = dagit;
    const e = render(<AnaSayfa />);
    const satir = await waitFor(() => e.getByTestId('planlamaya-devam'));
    expect(within(satir).getByText('Sıradaki adım: 2 mekanı güne dağıt')).toBeTruthy();
    expect(within(satir).getByText('4 gün kaldı · Ece, Mert')).toBeTruthy();
    fireEvent.press(satir);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]', params: { id: 'Eskişehir' } });
    expect(mockOlayYaz).toHaveBeenCalledWith('planlamaya_devam', 'Eskişehir');
  });

  it('adım yoksa tarih satırı', async () => {
    mockSeyahatler = [sy('İzmir', gun(2), gun(3))];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText(/2 gün · 2 mekan$/)).toBeTruthy());
  });

  it('gezi günü satır yok', async () => {
    mockSeyahatler = [sy('Bursa', gun(0), gun(2))];
    const e = render(<AnaSayfa />);
    await kaydettiklerim(e);
    expect(e.queryByTestId('planlamaya-devam')).toBeNull();
  });

  it('yeni biten + açık borç: "Harcamaları kapat" kartı; Planlamaya devam yok', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    mockBorc = { transfer: 1, benimNet: -25000, karsilar: [{ id: 'a', tutar: 25000 }], kisiler: harcamaKisileri };
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('ESKİŞEHİR GEZİSİ · BİTTİ')).toBeTruthy());
    expect(e.getByText('Borcun')).toBeTruthy();
    expect(e.queryByTestId('planlamaya-devam')).toBeNull();
  });

  it('yeni bitende kart yoksa (yalnız başkaları arasında transfer) planlanan seyahatin satırı', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    mockBorc = { transfer: 1, benimNet: 0, karsilar: [], kisiler: harcamaKisileri };
    mockAdim = dagit;
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByTestId('planlamaya-devam')).toBeTruthy());
    expect(e.queryByText('Harcamaları kapat')).toBeNull();
  });
});

describe('#361 KK5 arama', () => {
  beforeEach(() => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['doga'], 'İzmir')];
  });

  it('önce eşleşen hazır geziler, sonra rehberli şehir satırı; şehir satırı sihirbazı o şehirle açar', async () => {
    const e = render(<AnaSayfa />);
    fireEvent.changeText(await waitFor(() => e.getByLabelText('Şehir ya da gezi ara')), 'eskiş');
    const sonuc = e.getByTestId('ana-arama-sonuc');
    expect(within(sonuc).getByText('Eskişehir gezisi g1')).toBeTruthy();
    expect(within(sonuc).queryByText('İzmir gezisi g2')).toBeNull();
    fireEvent.press(within(sonuc).getByText(/için seyahat kur/));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ sehir: 's-esk' }) });
    expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'sehir', sehir_slug: 'eskisehir' });
  });

  it('rehberli olmayan metin: "“{metin}” için seyahat kur" sihirbazı metinle açar; yazılan metin ölçüme yazılmaz', async () => {
    const e = render(<AnaSayfa />);
    fireEvent.changeText(await waitFor(() => e.getByLabelText('Şehir ya da gezi ara')), 'Mardin');
    fireEvent.press(e.getByText('“Mardin” için seyahat kur'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ metin: 'Mardin' }) });
    expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'metin' });
    expect(JSON.stringify(mockOlayYaz.mock.calls)).not.toContain('Mardin');
  });

  it('Ana_v5_Ayrinti §3: "için seyahat kur" satırı gezilerden önce, sonra "Hazır geziler · N"', async () => {
    const e = render(<AnaSayfa />);
    fireEvent.changeText(await waitFor(() => e.getByLabelText('Şehir ya da gezi ara')), 'eskiş');
    const metinler = within(e.getByTestId('ana-arama-sonuc'))
      .getAllByText(/için seyahat kur|Hazır geziler|Eskişehir gezisi g1/)
      .map((x) => ([x.props.children] as unknown[]).flat(3).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
    expect(metinler[0]).toContain('için seyahat kur');
    expect(metinler[1]).toContain('Hazır geziler · 1');
    expect(metinler[2]).toContain('Eskişehir gezisi g1');
  });

  it('eşleşen gezi yoksa "Hazır geziler" başlığı yok; × aramayı temizler', async () => {
    const e = render(<AnaSayfa />);
    const kutu = await waitFor(() => e.getByLabelText('Şehir ya da gezi ara'));
    expect(e.queryByRole('button', { name: 'Aramayı temizle' })).toBeNull();
    fireEvent.changeText(kutu, 'Mardin');
    expect(e.queryByText(/Hazır geziler/)).toBeNull();
    fireEvent.press(e.getByRole('button', { name: 'Aramayı temizle' }));
    expect(e.queryByTestId('ana-arama-sonuc')).toBeNull();
    expect(e.getByLabelText('Şehir ya da gezi ara').props.value).toBe('');
  });

  it('kutu odaktayken 2 px Gece kenar', async () => {
    const e = render(<AnaSayfa />);
    const kutu = await waitFor(() => e.getByLabelText('Şehir ya da gezi ara'));
    const kenar = () => StyleSheet.flatten(e.getByTestId('ana-arama-kutu').props.style) as { borderWidth: number; borderColor: string };
    expect(kenar().borderWidth).toBe(1);
    fireEvent(kutu, 'focus');
    expect(kenar()).toMatchObject({ borderWidth: 2, borderColor: '#152a6b' });
    fireEvent(kutu, 'blur');
    expect(kenar().borderWidth).toBe(1);
  });

  it('geziler yüklenemezse arama yalnız "için seyahat kur" satırını gösterir', async () => {
    mockAkis.data = undefined;
    mockAkis.isError = true;
    const e = render(<AnaSayfa />);
    fireEvent.changeText(await waitFor(() => e.getByLabelText('Şehir ya da gezi ara')), 'eskiş');
    const sonuc = e.getByTestId('ana-arama-sonuc');
    expect(within(sonuc).getByText(/için seyahat kur/)).toBeTruthy();
    expect(within(sonuc).queryByText(/Hazır geziler/)).toBeNull();
  });

  it('arama sonuçtan bir şey seçmeden temizlenirse ana_ara sonuc=yok', async () => {
    const e = render(<AnaSayfa />);
    const kutu = await waitFor(() => e.getByLabelText('Şehir ya da gezi ara'));
    fireEvent.changeText(kutu, 'Mardin');
    fireEvent.changeText(kutu, '');
    await waitFor(() => expect(mockOlayYaz).toHaveBeenCalledWith('ana_ara', null, { sonuc: 'yok' }));
    expect(e.queryByTestId('ana-arama-sonuc')).toBeNull();
  });
});

const raf = (id: string, sira: number, baslik: string, icerik: object) => ({ id, tur: 'raf', baslik, sira, kaynak: 'elle', icerik, baslangic_at: null, bitis_at: null });
const banner = (icerik: object) => ({ id: 'b1', tur: 'banner', baslik: "Kapadokya'da balon sabahı", sira: 1, kaynak: 'elle', icerik, baslangic_at: null, bitis_at: null });

describe('#406 raflar ve banner (Ana_v6_Kesfet)', () => {
  it('KK1: amaç sekmeleri ve tek sütun liste yok; yayında raf yokken 3+ gezili amaçlar raf olur', async () => {
    mockAkis.data = [gezi('g1', ['lezzet', 'doga']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet']), gezi('g4', ['doga'])];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Lezzet için')).toBeTruthy());
    expect(e.queryByRole('tab')).toBeNull();
    // Doğa'nın 2 gezisi var: raf yok.
    expect(e.queryByText('Doğa için')).toBeNull();
    expect(e.getByTestId('raf-amac:lezzet')).toBeTruthy();
    expect(e.getAllByText('7 durak · Eskişehir')).toHaveLength(3);
    expect(e.UNSAFE_getAllByType(ScrollView).some((x) => x.props.horizontal)).toBe(true);
  });

  it('KK3: yayındaki raflar sırayla; 3 gezisi olmayan raf görünmez; elle raf verilen sırayla', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', []), gezi('g3', [], 'Bursa'), gezi('g4', ['lezzet'])];
    mockBolumler = [
      raf('r1', 1, 'Hafta sonu kaçamakları', { raf_turu: 'elle', gezi_idler: ['g3', 'g1', 'yok', 'g2'] }),
      raf('r2', 2, 'Lezzet için', { raf_turu: 'amac', amac: 'lezzet' }),
    ];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Hafta sonu kaçamakları')).toBeTruthy());
    expect(e.queryByText('Lezzet için')).toBeNull();
    const kartlar = within(e.getByTestId('raf-r1')).getAllByRole('button').map((b) => b.props.accessibilityLabel).filter((x: string) => / gezisi /.test(x));
    expect(kartlar.map((x: string) => x.split(',')[0])).toEqual(['Bursa gezisi g3', 'Eskişehir gezisi g1', 'Eskişehir gezisi g2']);
  });

  it('kart 236 px, kapak 160; ♥ 30 px daire; dokununca gezi ve raf_kart_acildi; Tümü raf listesini açar', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet'])];
    const e = render(<AnaSayfa />);
    const kalp = (await waitFor(() => e.getAllByRole('togglebutton', { name: 'Kaydet' })))[0];
    expect(StyleSheet.flatten(within(kalp).UNSAFE_getAllByType(View)[0].props.style)).toMatchObject({ width: 30, height: 30, borderRadius: 15 });
    fireEvent.press(e.getByRole('button', { name: 'Eskişehir gezisi g2, 7 durak · Eskişehir' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/gezi/[slug]', params: { slug: 'g2' } });
    expect(mockOlayYaz).toHaveBeenCalledWith('raf_kart_acildi', 'g2', { raf: 'amac:lezzet', raf_turu: 'amac' });
    fireEvent.press(e.getByRole('button', { name: 'Lezzet için: tümü' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/geziler', params: { raf: 'amac:lezzet' } });
  });

  it('KK2: tek banner raflardan önce; "N hazır gezi ›"; dokununca hedef raf ve banner_acildi', async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['lezzet'])];
    mockBolumler = [
      banner({ ust_yazi: 'Bu kış', hedef: { tur: 'raf', id: 'r2' } }),
      { ...banner({ hedef: { tur: 'raf', id: 'r2' } }), id: 'b2', baslik: 'İkinci', sira: 2 },
      raf('r2', 3, 'Lezzet için', { raf_turu: 'amac', amac: 'lezzet' }),
    ];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByTestId('ana-banner')).toBeTruthy());
    expect(e.getByText('Bu kış')).toBeTruthy();
    expect(e.getByText('3 hazır gezi ›')).toBeTruthy();
    expect(e.queryByText('İkinci')).toBeNull();
    fireEvent.press(e.getByRole('button', { name: "Bu kış, Kapadokya'da balon sabahı, 3 hazır gezi" }));
    expect(mockOlayYaz).toHaveBeenCalledWith('banner_acildi', 'b1', { hedef: 'raf' });
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/geziler', params: { raf: 'r2' } });
  });

  it('KK2: hedefi yayında olmayan banner gösterilmez', async () => {
    mockAkis.data = [gezi('g1', ['lezzet'])];
    mockBolumler = [banner({ hedef: { tur: 'gezi', id: 'kalkmis' } })];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Hazır geziler')).toBeTruthy());
    expect(e.queryByTestId('ana-banner')).toBeNull();
  });
});

describe('Ana_v5_Ayrinti §4 boş hal ve yükleniyor', () => {
  it('yayında gezi yoksa "Henüz hazır gezi yok" ve + Seyahat sihirbazı açar', async () => {
    const e = render(<AnaSayfa />);
    const bos = await waitFor(() => e.getByTestId('ana-bos'));
    expect(within(bos).getByText('Henüz hazır gezi yok')).toBeTruthy();
    expect(within(bos).getByText('Kendi seyahatini kurabilirsin.')).toBeTruthy();
    fireEvent.press(within(bos).getByRole('button', { name: 'Yeni seyahat' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
  });

  it('geziler yüklenirken gösterge ekran okuyucu etiketi taşır; boş hal görünmez', async () => {
    mockAkis.data = undefined;
    mockAkis.isPending = true;
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByLabelText('Geziler yükleniyor')).toBeTruthy());
    expect(e.queryByTestId('ana-bos')).toBeNull();
  });
});

describe('Kalan davranışlar', () => {
  it('#291 KK6: aşağı çekip yenileme gezileri de çeker; veri varken hata verirse bir kez "Güncellenemedi"', async () => {
    const e = render(<AnaSayfa />);
    await kaydettiklerim(e);
    const yenile = () => e.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh as () => Promise<unknown>;
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
