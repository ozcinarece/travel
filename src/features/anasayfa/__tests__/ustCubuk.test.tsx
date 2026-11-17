// #275 (kanvas 29a): alt menü yok — ana ekranın üst çubuğunda Ara · ♥ Kaydettiklerim · Profil, altta yüzen [+ Yeni seyahat];
// seyahat silinip dönülünce kısa bildirim.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { SERIT_YUKSEKLIK } from '@/components/anasayfa/SeyahatSeridi';

import { SERIT_IPUCU_ANAHTARI } from '@/features/anasayfa/serit';
import type { Kisiler } from '@/features/harcama/metin';
import { acilisKarariniKapat } from '@/lib/acilis';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import AnaSayfa from '../../../app/(tabs)/index';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: { name: 'Ece Ö', photo_url: null } }) }));
let mockSeyahatler: SeyahatOzet[] = [];
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: mockSeyahatler, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }) }));
// #291 KK6: ana ekran Keşfet akışı sorgusunu da tutar (yenileme için).
let mockAkisAcik = false;
const mockAkis = { data: [] as unknown[], isPending: false, isError: false, isFetching: false, refetch: jest.fn(async () => ({ isError: false, data: [] as unknown[] })) };
jest.mock('@/features/icerik/kesfetAkisi', () => ({
  ...jest.requireActual<object>('@/features/icerik/kesfetAkisi'),
  kesfetAkisiAcik: () => mockAkisAcik,
  useKesfetAkisi: () => mockAkis,
}));
jest.mock('@/features/icerik/sorgular', () => ({ useGeziler: () => ({ data: [], refetch: jest.fn() }) }));
jest.mock('@/features/davet/sorgular', () => ({
  bekleyenDavetiOku: async () => null,
  bekleyenDavetiSil: async () => undefined,
  useDavetKarsilama: () => ({ data: null, isError: false }),
  useDavetKarsilandi: () => async () => undefined,
}));
// #276 2b: şerit ve 29c verisi (Supabase sorguları) testte elle verilir; saf hesaplar ve ipucu (AsyncStorage) gerçek.
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

describe('Ana ekran üst çubuk ve yüzen düğme (#275 KK2–KK3)', () => {
  it('Ara, Kaydettiklerim ve Profil sırayla; dokununca kendi ekranlarına gider', async () => {
    const ekran = render(<AnaSayfa />);
    const ara = await waitFor(() => ekran.getByRole('button', { name: 'Ara' }));
    fireEvent.press(ara);
    expect(router.push).toHaveBeenLastCalledWith('/ara');
    fireEvent.press(ekran.getByRole('button', { name: 'Kaydettiklerim' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/kaydettiklerim');
    fireEvent.press(ekran.getByRole('button', { name: 'Profil' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/profil');
  });

  it('yüzen [+ Yeni seyahat] sihirbazı açar', async () => {
    const ekran = render(<AnaSayfa />);
    fireEvent.press(await waitFor(() => ekran.getByRole('button', { name: 'Yeni seyahat' })));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
  });

  it('#291 KK6: aşağı çekip yenileme Keşfet akışını da çeker; veri varken hata verirse kartlar kalır ve bir kez "Güncellenemedi"', async () => {
    mockAkisAcik = true;
    const ekran = render(<AnaSayfa />);
    const yenile = () => ekran.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh as () => Promise<unknown>;
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    mockAkis.refetch.mockClear();
    await act(() => yenile()());
    expect(mockAkis.refetch).toHaveBeenCalledTimes(1);
    expect(ekran.queryByText('Güncellenemedi')).toBeNull();
    mockAkis.refetch.mockResolvedValueOnce({ isError: true, data: [{}] });
    await act(() => yenile()());
    expect(ekran.getAllByText('Güncellenemedi')).toHaveLength(1);
    // Hiç veri yokken hata: akışın kendi "Bağlanamadık" hali gösterir; kısa bildirim çıkmaz.
    ekran.unmount();
    const ikinci = render(<AnaSayfa />);
    await waitFor(() => expect(ikinci.getByRole('button', { name: 'Ara' })).toBeTruthy());
    mockAkis.refetch.mockResolvedValueOnce({ isError: true, data: undefined as unknown as unknown[] });
    await act(() => ikinci.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh());
    expect(ikinci.queryByText('Güncellenemedi')).toBeNull();
    mockAkisAcik = false;
  });

  it('#291 KK6: akış bayrağı kapalıyken yenileme akışı çekmez', async () => {
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    mockAkis.refetch.mockClear();
    await act(() => ekran.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh());
    expect(mockAkis.refetch).not.toHaveBeenCalled();
  });

  it('silindi parametresiyle gelince "Seyahat silindi" bildirimi', async () => {
    mockParametre = { bildirim: 'silindi' };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahat silindi')).toBeTruthy());
    mockParametre = {};
  });
});

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
  members: [],
  places: [{ count: 2 }],
});
const adlar: Record<string, string> = { a: 'Ayşe', m: 'Mert' };
const harcamaKisileri: Kisiler = { ad: (id) => adlar[id] ?? id, renk: () => '#152a6b', foto: () => null, uyeIdleri: ['a', 'm'] };
const dagit = { tur: 'dagit', mekanIdleri: ['m1', 'm2'], otelYok: false };

describe('Seyahat şeridi ve gezi bitti (#276 2b · KK3 · KK4 · KK-ek4, kanvas 29b · 29c · 29f)', () => {
  beforeEach(async () => {
    // Bu testlerde açılış kuralı işlemez (Gezi'ye yönlendirme ayrı testte).
    acilisKarariniKapat();
    router.push.mockClear();
    mockBorc = null;
    mockAdim = null;
    await AsyncStorage.setItem(SERIT_IPUCU_ANAHTARI, '1');
  });

  it('yaklaşan seyahat: altta şerit "N GÜN SONRA · Şehir" + Sıradaki adım; dokununca seyahat açılır; yüzen düğme yok, [+] var', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    const serit = await waitFor(() => ekran.getByRole('button', { name: '4 GÜN SONRA, Eskişehir, Sıradaki adım: 2 mekanı güne dağıt' }));
    expect(ekran.getByText('Sıradaki adım: 2 mekanı güne dağıt')).toBeTruthy();
    fireEvent.press(serit);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]', params: { id: 'Eskişehir' } });
    // [+] ikonlu kare düğme (etiket "Yeni seyahat"), yazılı yüzen düğme değil.
    expect(ekran.queryByText('Yeni seyahat')).toBeNull();
    fireEvent.press(ekran.getByRole('button', { name: 'Yeni seyahat' }));
    expect(router.push).toHaveBeenLastCalledWith('/(tabs)/yeni');
  });

  it('planlanan seyahat (tarihsiz ya da > 14 gün): rozet yok, yalnız şehir ve Sıradaki adım', async () => {
    mockSeyahatler = [sy('Bursa', gun(30), gun(32))];
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Bursa, Sıradaki adım: 2 mekanı güne dağıt' })).toBeTruthy());
    expect(ekran.queryByText(/GÜN SONRA/)).toBeNull();
  });

  it('adım yoksa şeritte tarih satırı', async () => {
    mockSeyahatler = [sy('İzmir', gun(2), gun(3))];
    mockAdim = null;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText(/2 gün · 2 mekan$/)).toBeTruthy());
  });

  it('yeni biten + açık borç: üstte "Harcamaları kapat" (kişi kişi tutar, yalnız Bakiyeler); şerit yok', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    mockBorc = { transfer: 2, benimNet: 41000, karsilar: [{ id: 'a', tutar: 25000 }, { id: 'm', tutar: 16000 }], kisiler: harcamaKisileri };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Harcamaları kapat')).toBeTruthy());
    expect(ekran.getByText('ESKİŞEHİR GEZİSİ · BİTTİ')).toBeTruthy();
    expect(ekran.getByText('+410 ₺')).toBeTruthy();
    expect(ekran.getByText('Ayşe')).toBeTruthy();
    expect(ekran.getByText('Mert')).toBeTruthy();
    expect(ekran.queryByText('Hatırlat')).toBeNull();
    fireEvent.press(ekran.getByRole('button', { name: 'Bakiyeler' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/seyahat/[id]/bakiyeler', params: { id: 'Eskişehir' } });
    // 29c: şerit yok, yüzen "+ Yeni seyahat" var.
    expect(ekran.queryByRole('button', { name: /^Bursa/ })).toBeNull();
    expect(ekran.getByText('Yeni seyahat')).toBeTruthy();
  });

  it('KK-ek4: yeni biten seyahatte gösterecek kart yoksa planlanan seyahatin şeridi', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    mockBorc = { transfer: 0, benimNet: 0, karsilar: [], kisiler: harcamaKisileri };
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Bursa, Sıradaki adım: 2 mekanı güne dağıt' })).toBeTruthy());
    expect(ekran.queryByText('Harcamaları kapat')).toBeNull();
  });

  it('#289 inceleme 1: yeni biten seyahatin borcu geç gelirse önce şerit, ilk seyahat kartı ve ipucu çizilmez; bayrak tüketilmez', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    mockBorc = undefined;
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText(/Merhaba/)).toBeTruthy());
    await new Promise((r) => setTimeout(r, 20));
    expect(ekran.queryByRole('button', { name: /^Bursa/ })).toBeNull();
    expect(ekran.queryByText('Seyahatin burada')).toBeNull();
    expect(ekran.queryByText('Harcamaları kapat')).toBeNull();
    expect(ekran.queryByText('Yeni seyahat')).toBeNull();
    expect(ekran.queryByText(/İlk seyahatini kur|Yeni bir seyahat kur/)).toBeNull();
    expect(await AsyncStorage.getItem(SERIT_IPUCU_ANAHTARI)).toBeNull();
    // Borç gelir, açık borç bende: doğrudan 29c kartı; şerit hiç çizilmemiş olur.
    mockBorc = { transfer: 1, benimNet: -25000, karsilar: [{ id: 'a', tutar: -25000 }], kisiler: harcamaKisileri };
    ekran.rerender(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Harcamaları kapat')).toBeTruthy());
    expect(ekran.queryByRole('button', { name: /^Bursa/ })).toBeNull();
    expect(await AsyncStorage.getItem(SERIT_IPUCU_ANAHTARI)).toBeNull();
  });

  it('#289 inceleme 3: yalnız başkaları arasında açık transfer varsa kart yok, planlanan seyahatin şeridi', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3)), sy('Bursa', gun(30), gun(32))];
    // Ayşe → Mert açık; benim net bakiyem 0.
    mockBorc = { transfer: 1, benimNet: 0, karsilar: [], kisiler: harcamaKisileri };
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Bursa, Sıradaki adım: 2 mekanı güne dağıt' })).toBeTruthy());
    expect(ekran.queryByText('Harcamaları kapat')).toBeNull();
  });

  it('#289 inceleme 2: listenin alt boşluğu ana çubuk yüksekliğiyle büyür (şerit + 16, yoksa yüzen düğme + 16)', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: /^4 GÜN SONRA, Eskişehir/ })).toBeTruthy());
    const kap = ekran.UNSAFE_getByType(ScrollView);
    // Testteki güvenli alan altı 0: şerit 24 + SERIT_YUKSEKLIK + 16.
    expect(StyleSheet.flatten(kap.props.contentContainerStyle).paddingBottom).toBe(24 + SERIT_YUKSEKLIK + 16);
  });

  it('29f: şerit ilk göründüğünde bir kez "Seyahatin burada"; Tamam kapatır ve bir daha çıkmaz', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    const ilk = render(<AnaSayfa />);
    await waitFor(() => expect(ilk.getByText('Seyahatin burada')).toBeTruthy());
    fireEvent.press(ilk.getByRole('button', { name: 'Tamam' }));
    expect(ilk.queryByText('Seyahatin burada')).toBeNull();
    await waitFor(async () => expect(await AsyncStorage.getItem(SERIT_IPUCU_ANAHTARI)).toBe('1'));
    ilk.unmount();
    const ikinci = render(<AnaSayfa />);
    await waitFor(() => expect(ikinci.getByRole('button', { name: /^4 GÜN SONRA, Eskişehir/ })).toBeTruthy());
    await new Promise((r) => setTimeout(r, 20));
    expect(ikinci.queryByText('Seyahatin burada')).toBeNull();
  });

  it('29f: şeride dokununca ipucu da kapanır', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahatin burada')).toBeTruthy());
    // #290 KK7: ipucu iOS'ta modal; şerit ekran okuyucudan gizli ama dokunulabilir.
    fireEvent.press(ekran.getByLabelText(/^4 GÜN SONRA, Eskişehir/, { includeHiddenElements: true }));
    expect(ekran.queryByText('Seyahatin burada')).toBeNull();
    await waitFor(async () => expect(await AsyncStorage.getItem(SERIT_IPUCU_ANAHTARI)).toBe('1'));
  });
});

describe('#290 şerit ve gezi bitti kartı takibi (kanvas 29g · A, 29c, 29f)', () => {
  beforeEach(async () => {
    acilisKarariniKapat();
    router.push.mockClear();
    mockBorc = null;
    mockAdim = null;
    mockParametre = {};
    await AsyncStorage.setItem(SERIT_IPUCU_ANAHTARI, '1');
  });

  it('KK1: borçluyken sağda "Borcun" ve kırmızı tutar; satırda "Ayşe’ye 250 ₺ henüz ödenmedi"', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3))];
    mockBorc = { transfer: 1, benimNet: -25000, karsilar: [{ id: 'a', tutar: 25000 }], kisiler: harcamaKisileri };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Borcun')).toBeTruthy());
    expect(ekran.queryByText('Sana borçlular')).toBeNull();
    expect(StyleSheet.flatten(ekran.getByText('−250 ₺').props.style).color).toBe('#d93a2b');
    expect(ekran.getByText('Ayşe')).toBeTruthy();
    expect(ekran.getByText(/’ye 250 ₺/)).toBeTruthy();
    expect(ekran.getByText('henüz ödenmedi')).toBeTruthy();
  });

  it('KK1: birden çok alacaklıda en çok 2 ad + "+N kişi", en çok 2 avatar', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3))];
    const kisiler: Kisiler = { ...harcamaKisileri, ad: (id) => ({ a: 'Ayşe', m: 'Mert', c: 'Can' })[id] ?? id };
    mockBorc = { transfer: 3, benimNet: -50000, karsilar: [{ id: 'a', tutar: 25000 }, { id: 'm', tutar: 16000 }, { id: 'c', tutar: 9000 }], kisiler };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Borcun')).toBeTruthy());
    expect(ekran.getByText('Mert')).toBeTruthy();
    expect(ekran.getByText(/’e 160 ₺/)).toBeTruthy();
    expect(ekran.queryByText('Can')).toBeNull();
    expect(ekran.getByText(/\+1 kişi/)).toBeTruthy();
    expect(ekran.getAllByLabelText(/^(Ayşe|Mert|Can)$/)).toHaveLength(2);
  });

  it('KK2: kart logonun ve üst düğmelerin hemen altında (aralık 16); selam ve arama altında', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3))];
    mockBorc = { transfer: 1, benimNet: 41000, karsilar: [{ id: 'a', tutar: 41000 }], kisiler: harcamaKisileri };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Harcamaları kapat')).toBeTruthy());
    const metin = JSON.stringify(ekran.toJSON(), (k, v) => (k === 'refreshControl' ? undefined : v));
    expect(metin.indexOf('Profil')).toBeLessThan(metin.indexOf('Harcamaları kapat'));
    expect(metin.indexOf('Harcamaları kapat')).toBeLessThan(metin.indexOf('Merhaba'));
    expect(metin.indexOf('Harcamaları kapat')).toBeLessThan(metin.indexOf('Şehir, gezi ya da yer ara'));
    const kap = ekran.UNSAFE_getByType(ScrollView);
    expect(StyleSheet.flatten(kap.props.contentContainerStyle).gap).toBe(20);
    let kart = ekran.getByText('Harcamaları kapat').parent;
    while (kart && StyleSheet.flatten(kart.props.style)?.marginTop !== -4) kart = kart.parent;
    expect(kart).toBeTruthy();
  });

  it('KK3: şerit en az 64 ve içerikle büyür; rozet, ad ve alt satır en çok 1,3×; rozet kutusu en az 20', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    const serit = await waitFor(() => ekran.getByRole('button', { name: /^4 GÜN SONRA, Eskişehir/ }));
    const ss = StyleSheet.flatten(serit.props.style);
    expect(ss.minHeight).toBe(64);
    expect(ss.height).toBeUndefined();
    const rozet = ekran.getByText('4 GÜN SONRA');
    expect(rozet.props.maxFontSizeMultiplier).toBe(1.3);
    expect(ekran.getByText('Eskişehir').props.maxFontSizeMultiplier).toBe(1.3);
    expect(ekran.getByText('Sıradaki adım: 2 mekanı güne dağıt').props.maxFontSizeMultiplier).toBe(1.3);
    let rozetKutu = rozet.parent;
    while (rozetKutu && StyleSheet.flatten(rozetKutu.props.style)?.paddingHorizontal !== 7) rozetKutu = rozetKutu.parent;
    const rs = StyleSheet.flatten(rozetKutu?.props.style);
    expect(rs.minHeight).toBe(20);
    expect(rs.height).toBeUndefined();
  });

  it('KK3: şerit büyük yazıda uzarsa liste alt boşluğu ölçülen yüksekliğe göre', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    mockAdim = dagit;
    const ekran = render(<AnaSayfa />);
    const serit = await waitFor(() => ekran.getByRole('button', { name: /^4 GÜN SONRA, Eskişehir/ }));
    fireEvent(serit.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 80 } } });
    const kap = ekran.UNSAFE_getByType(ScrollView);
    await waitFor(() => expect(StyleSheet.flatten(kap.props.contentContainerStyle).paddingBottom).toBe(24 + 80 + 16));
  });

  it('KK4: adım yüklenirken tarih satırı gösterilir (satır sayısı değişmez)', async () => {
    mockSeyahatler = [sy('İzmir', gun(2), gun(3))];
    mockAdim = undefined;
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText(/2 gün · 2 mekan$/)).toBeTruthy());
  });

  it('KK6: ipucu açıkken kısa bildirim ipucunun üst kenarının 8 px üstünde (üst üste binmez)', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockParametre = { bildirim: 'silindi' };
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahatin burada')).toBeTruthy());
    const balon = ekran.getByTestId('serit-ipucu');
    fireEvent(balon, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 290, height: 150 } } });
    const ipucuAlt = StyleSheet.flatten(balon.props.style).bottom as number;
    expect(ipucuAlt).toBe(24 + 64 + 14);
    const bildirimAlt = () => {
      let v = ekran.getByText('Seyahat silindi', { includeHiddenElements: true }).parent;
      while (v && StyleSheet.flatten(v.props.style)?.bottom === undefined) v = v.parent;
      return StyleSheet.flatten(v?.props.style).bottom as number;
    };
    await waitFor(() => expect(bildirimAlt()).toBe(ipucuAlt + 150 + 8));
    // İpucu kapanınca bildirim şeridin üstüne iner.
    fireEvent.press(ekran.getByRole('button', { name: 'Tamam' }));
    await waitFor(() => expect(bildirimAlt()).toBe(24 + SERIT_YUKSEKLIK + 12));
  });

  it('KK6: aynı geçişte önce ipucu, sonra şerit ölçülse de bildirim ipucunun 8 px üstünde', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockParametre = { bildirim: 'silindi' };
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahatin burada')).toBeTruthy());
    const balon = ekran.getByTestId('serit-ipucu');
    const kap = ekran.getByTestId('serit-kap', { includeHiddenElements: true });
    // Büyük yazıda şerit 80'e uzar; iki ölçü tek act içinde, önce ipucu sonra şerit sırasıyla gelir.
    act(() => {
      fireEvent(balon, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 290, height: 150 } } });
      fireEvent(kap, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 335, height: 80 } } });
    });
    const bildirimAlt = () => {
      let v = ekran.getByText('Seyahat silindi', { includeHiddenElements: true }).parent;
      while (v && StyleSheet.flatten(v.props.style)?.bottom === undefined) v = v.parent;
      return StyleSheet.flatten(v?.props.style).bottom as number;
    };
    await waitFor(() => expect(bildirimAlt()).toBe(24 + 80 + 14 + 150 + 8));
  });

  it('KK7: ipucu tek öğe olarak okunur (başlık + metin); "Tamam" ayrı düğme', async () => {
    await AsyncStorage.removeItem(SERIT_IPUCU_ANAHTARI);
    mockSeyahatler = [sy('Eskişehir', gun(4), gun(6))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Seyahatin burada')).toBeTruthy());
    const metin = ekran.getByLabelText(/^Seyahatin burada\. Keşfet’te gezinirken/);
    expect(metin.props.accessible).toBe(true);
    expect(ekran.getByRole('button', { name: 'Tamam' })).toBeTruthy();
    // iOS'ta balon açıkken arkası (üst çubuk) ekran okuyucudan gizli.
    expect(ekran.getByTestId('serit-ipucu').props.accessibilityViewIsModal).toBe(true);
    expect(ekran.queryByRole('button', { name: 'Ara' })).toBeNull();
  });

  it('KK10: şerit yokken liste alt boşluğu yüzen düğme + 56 + 16', async () => {
    mockSeyahatler = [sy('Eskişehir', gun(-5), gun(-3))];
    mockBorc = { transfer: 1, benimNet: 41000, karsilar: [{ id: 'a', tutar: 41000 }], kisiler: harcamaKisileri };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByText('Yeni seyahat')).toBeTruthy());
    const kap = ekran.UNSAFE_getByType(ScrollView);
    expect(StyleSheet.flatten(kap.props.contentContainerStyle).paddingBottom).toBe(28 + 56 + 16);
  });
});
