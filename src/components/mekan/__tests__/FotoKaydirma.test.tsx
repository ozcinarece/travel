import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';

import type { TamYer } from '@/features/yerler/api';

import { FotoKaydirma } from '../MekanPaneli';

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

// #142 KK1 (#85 dersiyle): 10 fotoğraflı kaydırma, sayfa genişliği 390. Başta yalnız 0 (hazır URI) ve komşusu 1 istenir;
// 3. sayfaya kayınca 2–4; havuzlanmış olaylar (işleyiciden sonra null) hata üretmez.
describe('FotoKaydirma (#142)', () => {
  beforeEach(() => mockIstenen.clear());

  it('yalnız görünen sayfa ve komşuları istenir; sayaç "1 / 10"', () => {
    const { getByTestId, getByText } = render(<FotoKaydirma yer={yer} genislik={390} onAc={() => {}} />);
    expect([...mockIstenen]).toEqual(['places/p1/photos/1']);
    expect(getByText('1 / 10')).toBeTruthy();
    const kaydirma = getByTestId('foto-kaydirma');
    const o1 = havuzlanmisOlay(390 * 3);
    expect(() =>
      act(() => {
        kaydirma.props.onMomentumScrollEnd(o1);
        o1.nativeEvent = null;
      }),
    ).not.toThrow();
    expect([...mockIstenen].sort()).toEqual(['places/p1/photos/1', 'places/p1/photos/2', 'places/p1/photos/3', 'places/p1/photos/4']);
    expect(getByText('4 / 10')).toBeTruthy();
    for (let i = 0; i < 10; i++) expect(getByTestId(`foto-sayfa-${i}`)).toBeTruthy();
  });
});
