// #275 (kanvas 21, PR #281 inceleme): alt menü kalkınca Kaydettiklerim'de başlığın üstünde "‹ Keşfet" hapı var; dokununca geri döner.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KaydettiklerimEkrani from '../../../app/(tabs)/kaydettiklerim';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/icerik/GeziAl', () => ({ GeziAlYukleyici: () => null }));
jest.mock('@/features/icerik/fotolar', () => ({ useIcerikCanli: () => ({ data: undefined }) }));
jest.mock('@/features/icerik/sorgular', () => ({
  useKaydedilenler: () => ({ data: [] }),
  useKaydet: () => ({ mutate: jest.fn() }),
  useGezilerIle: () => ({ data: [], isSuccess: true }),
  useYerlerIle: () => ({ data: [], isSuccess: true }),
  icerikPlaceId: jest.fn(),
}));
jest.mock('@/features/icerik/yerEkle', () => ({ hedefSeyahatler: () => [], varsayilanHedef: () => null, useYerleriEkle: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: [] }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const { router: mockRouter } = jest.requireMock<{ router: Record<'back', jest.Mock> }>('expo-router');

describe('Kaydettiklerim üst satırı', () => {
  it('başlığın üstünde ‹ Keşfet hapı; dokununca geri döner', () => {
    render(<KaydettiklerimEkrani />);
    expect(screen.getByRole('header', { name: 'Kaydettiklerim' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keşfet' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
