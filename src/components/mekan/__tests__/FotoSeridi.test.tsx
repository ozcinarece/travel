import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';

import type { TamYer } from '@/features/yerler/api';

import { FotoSeridi } from '../MekanPaneli';

// Yalnız hangi küçük resimlerin URI istediğini sayıyoruz (ad tanımlıysa istek açık).
const mockIstenen = new Set<string>();
jest.mock('@/features/yerler/api', () => ({
  ...(jest.requireActual('@/features/yerler/api') as object),
  usePlaceFoto: (ad: string | undefined) => {
    if (ad) mockIstenen.add(ad);
    return { data: null, isPending: false, isError: false };
  },
  useTamYer: () => ({ data: null, isPending: false, isError: false }),
  useYorumlar: () => ({ data: undefined, isPending: false, isError: false }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn(), hataBildir: jest.fn() }));

const yer: TamYer = {
  place_id: 'p1',
  ad: 'Mekan',
  lat: 0,
  lng: 0,
  primary_type: 'cafe',
  puan: 4.5,
  puan_sayisi: 100,
  acik: null,
  kapanis: null,
  acilis: null,
  saatler: [],
  bugun: null,
  adres: null,
  ozet: null,
  foto_uri: 'https://ornek/ilk.jpg',
  fotolar: Array.from({ length: 10 }, (_, i) => ({ ad: `places/p1/photos/${i}`, yazar: null })),
  google_maps_uri: null,
};

/** React Native sentetik olayı gibi: işleyici dönünce havuza iade edilir, `nativeEvent` null olur. */
function havuzlanmisOlay(x: number) {
  return { nativeEvent: { contentOffset: { x } } as { contentOffset: { x: number } } | null };
}

// #85 KK2/KK4 yeniden üretim: 10 fotoğraflı şerit, art arda kaydırma olayları (görünen 5 → 8 → 10); olay nesneleri
// işleyiciden sonra null'lanır (havuzlama). Eski kod `e.nativeEvent`'i güncelleyicide (render'da) okuyup patlıyordu.
describe('FotoSeridi (#85)', () => {
  beforeEach(() => mockIstenen.clear());

  it('başta yalnız görünür + 1 komşu istenir; kaydırma sonrası 10/10; havuzlanmış olaylar hata üretmez', () => {
    const { getByTestId } = render(<FotoSeridi yer={yer} onAc={() => {}} />);
    // 750 px genişlik (jest pencere), 128 px kare: başta 7 kare → ilk foto hazır URI'yle, 6 istek.
    expect(mockIstenen.size).toBeGreaterThanOrEqual(5);
    expect(mockIstenen.size).toBeLessThan(10);
    const serit = getByTestId('foto-seridi');
    const o1 = havuzlanmisOlay(300);
    const o2 = havuzlanmisOlay(640);
    const o3 = havuzlanmisOlay(900);
    // Art arda üç olay tek toplu güncellemede: ilki eager hesaplanır, ikinci ve üçüncü güncelleyici render'a ertelenir.
    // İşleyiciler döndükten sonra olaylar havuza iade edilir (nativeEvent null); render act bitince çalışır.
    expect(() =>
      act(() => {
        serit.props.onScroll(o1);
        serit.props.onScroll(o2);
        serit.props.onScroll(o3);
        o1.nativeEvent = null;
        o2.nativeEvent = null;
        o3.nativeEvent = null;
      }),
    ).not.toThrow();
    // 9 kare istenir (ilk kare hazır URI ile gelir, hook'u kapalı).
    expect(mockIstenen.size).toBe(9);
    for (let i = 0; i < 10; i++) expect(getByTestId(`foto-kare-${i}`)).toBeTruthy();
  });
});
