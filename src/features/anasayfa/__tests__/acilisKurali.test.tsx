// #276 KK2 · KK5 · KK-ek3 · KK-ek5 · KK-ek6: gezi günündeki kullanıcı açılışta bir kez doğrudan Gezi sayfasına iner; davet akışı önce gelir.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { acilisKarariAcik, acilisKarariniSifirla, kesfeteDon } from '@/lib/acilis';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';

import AnaSayfa from '../../../app/(tabs)/index';
import DavetEkrani from '../../../app/r/[token]';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
type Sorgu = { data?: unknown; isPending: boolean; isError: boolean };
let mockProfil: Sorgu = { data: { name: 'Ece Ö', photo_url: null }, isPending: false, isError: false };
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => mockProfil }));
let mockSeyahatler: SeyahatOzet[] = [];
let mockListe: Sorgu | null = null;
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahatler: () => ({ ...(mockListe ?? { data: mockSeyahatler, isPending: false, isError: false }), isRefetching: false, refetch: jest.fn() }),
}));
let mockDavet: string | null = null;
jest.mock('@/features/davet/sorgular', () => ({
  bekleyenDavetiOku: async () => mockDavet,
  bekleyenDavetiSil: async () => undefined,
  useDavetKarsilama: () => ({ data: null, isError: false }),
  useDavetKarsilandi: () => async () => undefined,
  // #276 KK-ek6: /r/[token] ekranı için (davet geçersiz: özet boş geldi).
  DAVET_KANALI: 'app',
  bekleyenDavetiYaz: async () => undefined,
  useDavetOzeti: () => ({ data: null, isPending: false, isError: false, refetch: jest.fn() }),
  useDavetleKatil: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/features/auth/giris', () => ({
  appleKullanilabilir: async () => false,
  appleIleGiris: jest.fn(),
  googleIleGiris: jest.fn(),
  iptalMi: () => false,
}));
// #276 2b: şerit ve 29c verisi (Supabase sorguları) testte elle verilir; saf hesaplar ve ipucu (AsyncStorage) gerçek.
let mockBorc: unknown = null;
let mockAdim: unknown = null;
jest.mock('@/features/anasayfa/serit', () => ({
  ...jest.requireActual<object>('@/features/anasayfa/serit'),
  useAcikBorc: (sy: unknown) => (sy ? mockBorc : null),
  useSeritAdimi: (sy: unknown) => (sy ? mockAdim : undefined),
}));
// #291 KK6: ana ekran Keşfet akışı sorgusunu da tutar (yenileme için).
let mockAkisAcik = false;
const mockAkis = { data: [] as unknown[], isPending: false, isError: false, isFetching: false, refetch: jest.fn(async () => ({ isError: false, data: [] as unknown[] })) };
jest.mock('@/features/icerik/kesfetAkisi', () => ({
  ...jest.requireActual<object>('@/features/icerik/kesfetAkisi'),
  kesfetAkisiAcik: () => mockAkisAcik,
  useKesfetAkisi: () => mockAkis,
}));
jest.mock('@/features/icerik/sorgular', () => ({ useGeziler: () => ({ data: [], refetch: jest.fn() }), olayYaz: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), dismissTo: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: () => ({ token: 'x' }),
  // Ana ekran kendiliğinden odak kaybetmez; temizleyici unmount'ta ya da `odakKaybet()` ile (başka ekran açıldı) çalışır.
  useFocusEffect: (cb: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(() => {
      const temizle = cb();
      let calisti = false;
      const bir = () => {
        if (calisti) return;
        calisti = true;
        temizle?.();
      };
      mockOdakTemizleyicileri.push(bir);
      return bir;
    }, [cb]),
}));
const mockOdakTemizleyicileri: (() => void)[] = [];
const odakKaybet = () => act(() => mockOdakTemizleyicileri.splice(0).forEach((f) => f()));
const { router } = jest.requireMock<{ router: Record<'push' | 'replace' | 'dismissTo', jest.Mock> }>('expo-router');

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
  places: [{ count: 0 }],
});
const geziye = (id: string) => ({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id, acilis: '1' } });

describe('Açılış kuralı (#276 KK2)', () => {
  beforeEach(() => {
    acilisKarariniSifirla();
    router.push.mockClear();
    router.replace.mockClear();
    mockDavet = null;
    mockListe = null;
    mockProfil = { data: { name: 'Ece Ö', photo_url: null }, isPending: false, isError: false };
  });

  it('gezi günündeyse doğrudan o seyahatin Gezi sayfası açılır (yaklaşan olsa da aktif önce)', async () => {
    mockSeyahatler = [sy('yakin', gun(3), gun(5)), sy('aktif', gun(-1), gun(1))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(geziye('aktif')));
  });

  it('aynı oturumda ana ekran yeniden kurulsa da tekrar seyahate atmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    const ilk = render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    ilk.unmount();
    const ikinci = render(<AnaSayfa />);
    await waitFor(() => expect(ikinci.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('yaklaşan, planlanan ya da biten seyahatte Keşfet açık kalır', async () => {
    mockSeyahatler = [sy('yakin', gun(3), gun(5)), sy('taslak', null, null), sy('bitti', gun(-4), gun(-2))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/seyahat/[id]/(sekmeler)/gezi' }));
  });

  it('KK5: bekleyen davet varsa önce davet akışı; gezi sayfasına atılmaz', async () => {
    mockDavet = 'tok';
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/r/[token]', params: { token: 'tok' } }));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('davetle katılan, "‹ Keşfet" ile ana ekran yeniden kurulunca Gezi\'ye atılmaz (#283 inceleme 2 · 1)', async () => {
    mockDavet = 'tok';
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    const ilk = render(<AnaSayfa />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/r/[token]', params: { token: 'tok' } }));
    ilk.unmount();
    // Katılım bitti (bekleyen davet silindi); "‹ Keşfet" ana ekranı sıfırdan kurar.
    mockDavet = null;
    const ikinci = render(<AnaSayfa />);
    await waitFor(() => expect(ikinci.getByRole('button', { name: 'Ara' })).toBeTruthy(), { timeout: 3000 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('aktif seyahat yokken bayrak tüketilmez (#283 inceleme 2 · 5)', async () => {
    mockSeyahatler = [sy('yakin', gun(3), gun(5))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(acilisKarariAcik()).toBe(true);
  });

  it('liste hatasında bayrak tüketilmez; bağlantı gelip liste yüklenince kural işler (#283 inceleme 2 · 3)', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    mockListe = { data: undefined, isPending: false, isError: true };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
    expect(acilisKarariAcik()).toBe(true);
    mockListe = null;
    ekran.rerender(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(geziye('aktif')));
  });

  it('karar verilmemişken liste beklenirken Keşfet görünmez; en çok 1,5 sn sonra Keşfet (#283 inceleme 2 · 2)', async () => {
    mockListe = { data: undefined, isPending: true, isError: false };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(router.replace).not.toHaveBeenCalled());
    expect(ekran.queryByRole('button', { name: 'Ara' })).toBeNull();
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy(), { timeout: 3000 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('profil yüklenmeden karar verilmez: önce Gezi\'ye push, sonra karşılama replace\'i olmaz (#283 inceleme 2 · 2)', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    mockProfil = { data: undefined, isPending: true, isError: false };
    const ekran = render(<AnaSayfa />);
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).not.toHaveBeenCalled();
    mockProfil = { data: { name: 'Ece Ö', photo_url: null }, isPending: false, isError: false };
    ekran.rerender(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(geziye('aktif')));
  });

  it('KK-ek5: liste 1,5 sn\'den sonra gelirse Keşfet\'teki kullanıcı Gezi\'ye taşınmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    mockListe = { data: undefined, isPending: true, isError: false };
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy(), { timeout: 3000 });
    expect(acilisKarariAcik()).toBe(false);
    // Liste 2. saniyede gelir: aktif seyahat var ama otomatik geçiş yok.
    await act(() => new Promise((r) => setTimeout(r, 500)));
    mockListe = null;
    ekran.rerender(<AnaSayfa />);
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('KK-ek6: /r/x ile soğuk açılış → davet geçersiz → "Ana sayfa" → Keşfet; Gezi\'ye atılmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(1))];
    const davet = render(<DavetEkrani />);
    fireEvent.press(await davet.findByRole('button', { name: 'Ana sayfaya git' }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(acilisKarariAcik()).toBe(false);
    davet.unmount();
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('Ön plana geliş (#276 KK-ek3)', () => {
  const dinleyiciler: ((d: AppStateStatus) => void)[] = [];
  const onPlanaGel = () => act(() => dinleyiciler.forEach((d) => d('active')));
  let abonelik: ReturnType<typeof jest.spyOn>;
  const simdi = Date.now();

  beforeEach(() => {
    acilisKarariniSifirla();
    router.push.mockClear();
    mockDavet = null;
    mockListe = null;
    mockProfil = { data: { name: 'Ece Ö', photo_url: null }, isPending: false, isError: false };
    dinleyiciler.length = 0;
    abonelik = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, d: (x: AppStateStatus) => void) => {
      dinleyiciler.push(d);
      return { remove: () => undefined };
    }) as never);
    // Yalnız saat sahte: zamanlayıcılar gerçek kalır (waitFor ve 1,5 sn gösterge çalışsın).
    jest.useFakeTimers({
      now: simdi,
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    abonelik.mockRestore();
  });

  it('gece arka planda kalan uygulama gezi sabahı aktife gelince Gezi\'ye iner', async () => {
    // Akşam: seyahat yarın başlıyor (yaklaşan), Keşfet açık.
    mockSeyahatler = [sy('gezi', gun(1), gun(3))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(ekran.getByRole('button', { name: 'Ara' })).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
    // Ertesi sabah ön plana gelir.
    jest.setSystemTime(simdi + 86_400_000);
    onPlanaGel();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(geziye('gezi')));
  });

  it('dün Gezi\'ye inmiş, bugün ön plana gelince yeniden iner; aynı gün "‹ Keşfet"e dönen tekrar atılmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(2))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    // Aynı gün ön plana gelir: atılmaz.
    onPlanaGel();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).toHaveBeenCalledTimes(1);
    // Ertesi gün: kural yeniden işler.
    jest.setSystemTime(simdi + 86_400_000);
    onPlanaGel();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
    // Kullanıcı o gün "‹ Keşfet"e kendisi döner (bayrak bugün kapanır); aynı gün tekrar ön plana gelince atılmaz. Dönüş Gezi
    // sayfasındaki düğmenin gerçek yolundan (`kesfeteDon`) geçer.
    kesfeteDon(undefined);
    expect(router.dismissTo).toHaveBeenLastCalledWith('/(tabs)');
    onPlanaGel();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('başka ekrandayken (Keşfet odakta değil) ön plana gelince yönlendirme yok', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(2))];
    render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    // Kullanıcı Keşfet'ten Profil'e geçti; ertesi gün uygulama ön plana gelir.
    odakKaybet();
    jest.setSystemTime(simdi + 86_400_000);
    onPlanaGel();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('KK-ek7: ön plana geliş olmadan aktif seyahat değişirse (aşağı çekip yenileme) Gezi\'ye atılmaz', async () => {
    mockSeyahatler = [sy('aktif', gun(-1), gun(2))];
    const ekran = render(<AnaSayfa />);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    // Aynı gün bir kez ön plana gelmiş (sayaç > 0), atılmamış.
    onPlanaGel();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).toHaveBeenCalledTimes(1);
    // Gece yarısı geçti; kullanıcı Keşfet'te aşağı çekip yeniler: liste yeni bir aktif seyahatle (en geç başlayan) gelir.
    jest.setSystemTime(simdi + 86_400_000);
    mockSeyahatler = [sy('aktif', gun(-1), gun(2)), sy('kisa', gun(1), gun(1))];
    ekran.rerender(<AnaSayfa />);
    await new Promise((r) => setTimeout(r, 50));
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
