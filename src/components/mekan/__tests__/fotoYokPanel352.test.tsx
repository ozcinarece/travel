// #352 KK2–KK3 (kanvas 29i · D): MekanPaneli rehber sorgusu beklerken ya da hata verince (çevrimdışında yeniden denemeler
// bitince) Google/hafif fotoğrafa inmez, D hali (foto-yok) gösterir.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';

import { MekanPaneli } from '../MekanPaneli';

type Sorgu = { data: unknown; isPending: boolean; isError: boolean };
let mockRehber: Sorgu = { data: undefined, isPending: true, isError: false };

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn(), hataBildir: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/icerik/Kalp', () => ({ Kalp: () => null }));
jest.mock('@/features/icerik/sorgular', () => ({ useYerRehberi: () => mockRehber }));
jest.mock('@/features/yerler/api', () => {
  const bos = { data: undefined, isPending: true, isError: false, isFetching: false, error: null, refetch: () => undefined };
  return {
    placesHatasi: () => null,
    usePlaceFoto: () => bos,
    useTamYer: () => bos,
    useYorumlar: () => bos,
    YorumSiniri: class extends Error {},
  };
});

const hafif = { place_id: 'p1', ad: 'Kale', puan: 4.5, puan_sayisi: 10, primary_type: 'tourist_attraction', foto_uri: 'https://ornek.test/f.jpg', foto_yazar: null, acik: null };

function ciz() {
  const r = render(
    <MekanPaneli
      placeId="p1"
      hafif={hafif as never}
      dakika={60}
      onSure={() => undefined}
      baglam="kesfet"
      icinde={false}
      onCta={() => undefined}
      onYolTarifi={() => undefined}
      onKapat={() => undefined}
    />,
  );
  const kok = r.UNSAFE_root.findAll((n) => typeof (n.props as { onLayout?: unknown }).onLayout === 'function')[0];
  act(() => {
    (kok.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
  });
  return r;
}

describe('MekanPaneli fotoğraf alanı (#352)', () => {
  beforeEach(() => {
    mockRehber = { data: undefined, isPending: true, isError: false };
  });

  it('KK3: rehber sorgusu beklerken hafif fotoğraf yerine D hali', () => {
    const { queryByTestId } = ciz();
    expect(queryByTestId('foto-yok')).toBeTruthy();
  });

  it('KK2: rehber sorgusu hata verince (çevrimdışı) de D hali kalır', () => {
    mockRehber = { data: undefined, isPending: false, isError: true };
    const { queryByTestId } = ciz();
    expect(queryByTestId('foto-yok')).toBeTruthy();
  });

  it('rehberli olmadığı anlaşılınca hafif fotoğraf görünür', () => {
    mockRehber = { data: null, isPending: false, isError: false };
    const { queryByTestId } = ciz();
    expect(queryByTestId('foto-yok')).toBeNull();
  });
});
