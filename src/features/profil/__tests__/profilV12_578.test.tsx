// #578 Profil v12 (kanvas `Profil_v12_Arkadas` · `Profil_v12_Kendi`): harita verisi (KK2), gitmek istenen iller (KK4),
// rozetler (KK5), gizlilik (KK6), "{Ad} ile gezi planla" (KK7) ve Google'a istek olmaması.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { geziAltMetni, geziOlusturParametreleri, ProfilV12 } from '@/components/profil/ProfilV12';
import { ILLER, istekSirasi, rozetListesi, type ProfilGezisi, type ProfilOzeti } from '@/features/profil/profilV12';
import type { Sehir } from '@/lib/tipler';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
let mockOzet: ProfilOzeti | null = null;
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(async () => ({ data: mockOzet, error: null })),
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));
jest.mock('@/features/icerik/sorgular', () => ({ useSehirler: () => ({ data: [{ id: 'sehir-mugla', ad: 'Muğla' }] }) }));
jest.mock('@/features/profil/sorgular', () => ({ useProfilGuncelle: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/baglanti', () => ({ useCevrimdisi: () => false }));
jest.mock('@/components/paylasim/PaylasimCekmecesi', () => ({ PaylasimCekmecesi: () => null }));

const { router: mockRouter } = jest.requireMock<{ router: Record<'push' | 'navigate', jest.Mock> }>('expo-router');
const { supabase: mockSupabase } = jest.requireMock<{ supabase: { rpc: jest.Mock; from: jest.Mock; functions: { invoke: jest.Mock } } }>('@/lib/supabase');

const gezi = (p: Partial<ProfilGezisi>): ProfilGezisi => ({
  id: 'g1',
  sehir: 'Bolu',
  ad: null,
  start_date: '2026-11-07',
  end_date: '2026-11-08',
  tz: 'Europe/Istanbul',
  gun_sayisi: 2,
  durak_sayisi: 5,
  kisi_sayisi: 3,
  bitti: true,
  uyesiyim: false,
  kisiler: [
    { harf: 'E', foto: null },
    { harf: 'M', foto: null },
  ],
  ...p,
});

const arkadas: ProfilOzeti = {
  id: 'deniz',
  ad: 'Deniz Kaya',
  foto: null,
  kendi: false,
  gizlilik: null,
  harita_acik: true,
  gidilen: [6, 14, 34, 35, 41, 48, 61],
  istek: [61, 36, 48],
  benim_istek: [36, 48, 31],
  yol_arkadasi: 6,
  rozetler: { lezzet: 12, doga: 5, ekip: 3, planci: 4 },
  geziler: [gezi({}), gezi({ id: 'g2', sehir: 'Datça', gun_sayisi: 4, start_date: '2026-10-03', end_date: '2026-10-06', uyesiyim: true, kisiler: [{ harf: 'A', foto: null }] })],
};

const kendi: ProfilOzeti = {
  ...arkadas,
  id: 'ece',
  ad: 'Ece Özçınar',
  kendi: true,
  gizlilik: 'friends',
  istek: [36, 48, 31],
  benim_istek: null,
  rozetler: { lezzet: 12, doga: 5, kultur: 1, ekip: 3, planci: 4 },
  geziler: [gezi({ id: 'g3', sehir: 'Kapadokya', bitti: false, start_date: '2099-01-10', end_date: '2099-01-11' }), gezi({ id: 'g4', sehir: 'Eskişehir', gun_sayisi: 6 })],
};

let istemci: QueryClient | undefined;
afterEach(() => {
  istemci?.clear();
  mockOzet = null;
  jest.clearAllMocks();
});

const ciz = (o: ProfilOzeti, sunucu: ProfilOzeti | null = o) => {
  mockOzet = sunucu;
  istemci = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={istemci}>
      <ProfilV12 kisi={o.id} />
    </QueryClientProvider>,
  );
};

describe('#578 KK2 harita verisi', () => {
  it('81 il, plaka 1–81, her biri bir SVG yolu', () => {
    expect(ILLER).toHaveLength(81);
    expect(ILLER.map((i) => i.plaka)).toEqual(Array.from({ length: 81 }, (_, i) => i + 1));
    expect(ILLER.every((i) => /^M /.test(i.d) && i.ad.length > 0)).toBe(true);
    expect(ILLER.find((i) => i.plaka === 34)?.ad).toBe('İstanbul');
  });
});

describe('#578 KK4 · KK5 yardımcılar', () => {
  it('arkadaşın profilinde ortak iller önce gelir', () => {
    expect(istekSirasi([61, 36, 48], [48, 36])).toEqual([
      { plaka: 36, ortak: true },
      { plaka: 48, ortak: true },
      { plaka: 61, ortak: false },
    ]);
    expect(istekSirasi([61, 36], null).every((i) => !i.ortak)).toBe(true);
  });

  it('kazanılan rozetler gerçek sayıyla; kazanılmamışlar yalnız kendi profilinde ve en sonda', () => {
    const sayilar = { lezzet: 12, doga: 5, kultur: 1, ekip: 3, planci: 4 };
    expect(rozetListesi(sayilar, true).map((r) => [r.ad, r.kazanildi, r.alt])).toEqual([
      ['lezzet', true, '12 yöresel durak'],
      ['doga', true, '5 doğa rotası'],
      ['ekip', true, 'Aynı ekiple 3 gezi'],
      ['planci', true, '4 geziyi kurdu'],
      ['kultur', false, 'Henüz yok'],
    ]);
    expect(rozetListesi({ lezzet: 12, ekip: 2 }, false).map((r) => r.ad)).toEqual(['lezzet']);
  });

  it('gezi oluşturma: rehberli şehir seçili, değilse aranmış; il ve arkadaş parametresi geçer', () => {
    const sehirler = [{ id: 'sehir-mugla', ad: 'Muğla' }] as Sehir[];
    expect(geziOlusturParametreleri(sehirler, { plaka: 48, arkadas: 'deniz' })).toMatchObject({ sehir: 'sehir-mugla', il: '48', arkadas: 'deniz' });
    const p = geziOlusturParametreleri(sehirler, { plaka: 36 });
    expect(p).toMatchObject({ metin: 'Kars', il: '36' });
    expect(p).not.toHaveProperty('arkadas');
    expect(geziOlusturParametreleri(sehirler, { arkadas: 'deniz' })).toEqual({ n: expect.any(String), arkadas: 'deniz' });
  });

  it('gezi satırı: geçmişte ay, yaklaşanda seyahatin saat dilimine göre kalan gün', () => {
    const an = new Date('2026-11-27T22:30:00Z'); // İstanbul'da 28 Kasım 01:30
    expect(geziAltMetni(gezi({ start_date: '2026-11-07' }), an)).toBe('Kasım');
    expect(geziAltMetni(gezi({ bitti: false, start_date: '2026-11-30', end_date: '2026-12-01' }), an)).toBe('2 gün kaldı');
    expect(geziAltMetni(gezi({ bitti: false, start_date: '2026-11-27', end_date: '2026-11-29' }), an)).toBe('Bugün · 2. gün');
  });
});

describe('#578 arkadaşın profili (`Profil_v12_Arkadas`)', () => {
  it('ad, il sayısı, harita, ortak çipler önde, yalnız kazanılan rozetler, altta "{Ad} ile gezi planla"; Google\'a istek yok', async () => {
    const e = ciz(arkadas);
    await waitFor(() => expect(e.getByText('Deniz Kaya')).toBeTruthy());
    expect(e.getByText('7 il · 6 yol arkadaşı')).toBeTruthy();
    expect(e.getByText('/ 81 il')).toBeTruthy();
    expect(e.getByTestId('il-34-gidilen')).toBeTruthy();
    expect(e.getByTestId('il-36-istek')).toBeTruthy();
    // Muğla ve Trabzon hem gittiği hem istediği: turuncu.
    expect(e.getByTestId('il-48-gidilen')).toBeTruthy();
    expect(e.getByTestId('il-1-bos')).toBeTruthy();
    expect(e.getByText('Gittiği')).toBeTruthy();
    expect(e.getByText('Gitmek istediği yerler')).toBeTruthy();
    expect(e.getAllByText('İKİNİZ DE')).toHaveLength(2);
    const cipler = e.getAllByTestId(/^istek-/).map((c) => c.props.testID);
    expect(cipler).toEqual(['istek-36', 'istek-48', 'istek-61']);
    expect(e.queryByText('+ Ekle')).toBeNull();
    expect(e.queryByText('Düzenle')).toBeNull();
    expect(e.getByText('Rozetler')).toBeTruthy();
    expect(e.queryByText('Henüz yok')).toBeNull();
    expect(e.getByText('Gezileri')).toBeTruthy();
    expect(e.getByText('Bolu · 2 gün')).toBeTruthy();
    // "Rotayı al" yalnız izleyenin de üyesi olduğu gezide.
    expect(e.getAllByText('Rotayı al')).toHaveLength(1);

    fireEvent.press(e.getByTestId('istek-48'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ sehir: 'sehir-mugla', il: '48', arkadas: 'deniz' }) });
    fireEvent.press(e.getByText('Deniz ile gezi planla'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: { n: expect.any(String), arkadas: 'deniz' } });
    fireEvent.press(e.getByText('Rotayı al'));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: { tekrar: 'g2', n: expect.any(String) } });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('profil_ozeti', { p_kisi: 'deniz' });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('KK6: harita kapalıysa harita ve geziler yok', async () => {
    const e = ciz({ ...arkadas, harita_acik: false, gidilen: null, geziler: [] });
    await waitFor(() => expect(e.getByText('Deniz Kaya')).toBeTruthy());
    expect(e.getByText('6 yol arkadaşı')).toBeTruthy();
    expect(e.queryByTestId('profil-harita')).toBeNull();
    expect(e.queryByText('Gezileri')).toBeNull();
    expect(e.getByText('Deniz ile gezi planla')).toBeTruthy();
  });

  it('birlikte gezmediğin kişi: profil yok', async () => {
    const e = ciz(arkadas, null);
    await waitFor(() => expect(e.getByText('Bu profili göremiyorsun.')).toBeTruthy());
  });
});

describe('#578 kendi profilin (`Profil_v12_Kendi`)', () => {
  it('Düzenle, gizlilik satırı, + Ekle, kazanılmamış rozet en sonda soluk; sabit düğme yok', async () => {
    const e = ciz(kendi);
    await waitFor(() => expect(e.getByText('Ece Özçınar')).toBeTruthy());
    expect(e.getByText('Düzenle')).toBeTruthy();
    expect(e.getByText('Gittiğin')).toBeTruthy();
    expect(e.getByText('Gitmek istediğin')).toBeTruthy();
    expect(e.getByText('Haritanı arkadaşların görüyor · Değiştir')).toBeTruthy();
    expect(e.getByText('Gitmek istediğin yerler')).toBeTruthy();
    expect(e.getByText('+ Ekle')).toBeTruthy();
    expect(e.queryByText('İKİNİZ DE')).toBeNull();
    expect(e.getByText('Rozetlerin')).toBeTruthy();
    const rozetler = e.getAllByTestId(/^rozet-/).map((r) => r.props.testID);
    expect(rozetler).toEqual(['rozet-lezzet', 'rozet-doga', 'rozet-ekip', 'rozet-planci', 'rozet-kultur-yok']);
    expect(e.getByTestId('rozet-kultur-yok')).toHaveStyle({ opacity: 0.38 });
    expect(e.getByText('Gezilerin')).toBeTruthy();
    expect(e.getByText('Aç')).toBeTruthy();
    expect(e.getByText('Paylaş')).toBeTruthy();
    expect(e.queryByTestId('profil-planla')).toBeNull();

    fireEvent.press(e.getByText('Düzenle'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/ayarlar');
    fireEvent.press(e.getByTestId('istek-36'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/yeni', params: expect.objectContaining({ metin: 'Kars', il: '36' }) });
    expect(mockRouter.push.mock.calls.at(-1)?.[0]).not.toHaveProperty('params.arkadas');
    fireEvent.press(e.getByText('Tümü'));
    expect(mockRouter.navigate).toHaveBeenLastCalledWith('/(tabs)/seyahatler');
  });
});
