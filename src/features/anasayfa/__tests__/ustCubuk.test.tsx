// #275 (kanvas 29a): alt menü yok — ana ekranın üst çubuğunda Ara · ♥ Kaydettiklerim · Profil, altta yüzen [+ Yeni seyahat];
// seyahat silinip dönülünce kısa bildirim.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    fireEvent.press(ekran.getByRole('button', { name: /^4 GÜN SONRA, Eskişehir/ }));
    expect(ekran.queryByText('Seyahatin burada')).toBeNull();
    await waitFor(async () => expect(await AsyncStorage.getItem(SERIT_IPUCU_ANAHTARI)).toBe('1'));
  });
});
