// #361 ana sayfa v5 (UX önerileri kanvası, Ana_v5_Yok · Ana_v5_Var · Ana_v5_Bitti · Ana_v5_Amaclar): üst satır (KK2),
// Planlamaya devam (KK3), gezi bitti (KK4), yerel arama (KK5), amaç sekmeleri (KK6), tek kart türü (KK7), ölçüm (KK8).
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
  mockAkis.isPending = false;
  mockAkis.isError = false;
});

describe('#361 KK2 üst satır', () => {
  it('♥ Kaydettiklerim, "+ Seyahat" sihirbaz, profil; ayrı Ara ikonu yok', async () => {
    mockAkis.data = [gezi('g1', ['lezzet'])];
    const e = render(<AnaSayfa />);
    fireEvent.press(await kaydettiklerim(e));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/kaydettiklerim');
    fireEvent.press(e.getByRole('button', { name: 'Yeni seyahat' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
    expect(e.getByText('Seyahat')).toBeTruthy();
    fireEvent.press(e.getByRole('button', { name: 'Profil' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/profil');
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

describe('#361 KK6 · KK7 sekmeler ve kartlar', () => {
  it("2'den az dolu amaçta sekme satırı yok; liste tek sütun, alt satır veriden", async () => {
    mockAkis.data = [gezi('g1', ['lezzet']), gezi('g2', ['lezzet']), gezi('g3', ['doga'])];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getByText('Eskişehir gezisi g1')).toBeTruthy());
    expect(e.queryByRole('tab')).toBeNull();
    expect(e.getAllByText('2 gün · 7 durak · Tripmate rehberi')).toHaveLength(3);
  });

  it('dolu amaçlar sekme olur; sekme seçince liste süzülür, kapaksız kart o amacın tonunda', async () => {
    mockAkis.data = [gezi('g1', ['lezzet', 'doga']), gezi('g2', ['doga', 'lezzet']), gezi('g3', ['kultur_tarih'])];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getAllByRole('tab')).toHaveLength(3));
    expect(e.getAllByRole('tab').map((x) => within(x).getByText(/.+/).props.children)).toEqual(['Hepsi', 'Lezzet', 'Doğa']);
    // "Hepsi": ilk amacın tonu.
    expect(e.getByTestId('amac-kapagi-lezzet', { includeHiddenElements: true })).toBeTruthy();
    expect(e.getByTestId('amac-kapagi-kultur_tarih', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(e.getByText('Doğa'));
    expect(e.queryByText('Eskişehir gezisi g3')).toBeNull();
    expect(e.getAllByTestId('amac-kapagi-doga', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('Ana_v5_Ayrinti §1: sekmede kısa ad (Kültür, Yavaş); en çok 4 amaç + Hepsi; sekme 44 px', async () => {
    mockAkis.data = [
      gezi('g1', ['kultur_tarih', 'yavas', 'lezzet', 'doga', 'cocuklu']),
      gezi('g2', ['kultur_tarih', 'yavas', 'lezzet', 'doga', 'cocuklu']),
    ];
    const e = render(<AnaSayfa />);
    await waitFor(() => expect(e.getAllByRole('tab')).toHaveLength(5));
    expect(e.getAllByRole('tab').map((x) => within(x).getByText(/.+/).props.children)).toEqual(['Hepsi', 'Kültür', 'Lezzet', 'Doğa', 'Yavaş']);
    expect(StyleSheet.flatten(e.getAllByRole('tab')[0].props.style)).toMatchObject({ height: 44 });
    expect(e.queryByText('Kültür ve tarih')).toBeNull();
  });

  it('Ana_v5_Ayrinti §2: kart ♥ beyaz dairede; boş Lacivert çizgi, kayıtlı Mandalina dolgu', async () => {
    mockAkis.data = [gezi('g1', ['lezzet'], 'Eskişehir', 'https://ornek/kapak.jpg')];
    const e = render(<AnaSayfa />);
    const kalp = await waitFor(() => e.getByRole('togglebutton', { name: 'Kaydet' }));
    const daire = StyleSheet.flatten(kalp.props.children ? within(kalp).UNSAFE_getByType(View).props.style : {}) as Record<string, unknown>;
    expect(daire).toMatchObject({ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)' });
    expect(within(kalp).UNSAFE_getByType(Svg).props).toMatchObject({ fill: 'none', stroke: '#0e1430', strokeWidth: 2.2 });
  });

  it('karta dokununca gezi sayfası ve ana_kart_acildi', async () => {
    mockAkis.data = [gezi('g1', ['lezzet'])];
    const e = render(<AnaSayfa />);
    fireEvent.press(await waitFor(() => e.getByText('Eskişehir gezisi g1')));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/gezi/[slug]', params: { slug: 'g1' } });
    expect(mockOlayYaz).toHaveBeenCalledWith('ana_kart_acildi', 'g1', { kaynak: 'liste', amac: null });
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
