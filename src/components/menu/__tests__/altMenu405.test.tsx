// #405 KK1 · KK6 (kanvas `Ana_v6_Kesfet` · `Ana_v6_Seyahatlerim` alt menüsü): Keşfet · Seyahatlerim · Profil; seçili sekmede
// ikon Mandalina ve yazı Gece; #407 KK5: Arkadaşlar Seyahatlerim ile Profil arasında. Sekmeye dokununca `sekme_acildi` (meta: sekme) ve geçiş.
// #569 KK1 (`Ana_v9_*`): üç sekme — Keşfet · Gezilerim · Arkadaşlar; `profil` rotası menüde çizilmez.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { AltMenu, altMenuRenk } from '../AltMenu';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const mockOlay = jest.fn();
jest.mock('@/features/icerik/sorgular', () => ({ olayYaz: (...a: unknown[]) => mockOlay(...a) }));

const routes = [
  { key: 'k1', name: 'index', params: undefined },
  { key: 'k2', name: 'seyahatler', params: undefined },
  { key: 'k4', name: 'arkadaslar', params: undefined },
];

function ciz(index: number) {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  const props = { state: { index, routes }, navigation, descriptors: {}, insets: { top: 0, bottom: 0, left: 0, right: 0 } } as unknown as BottomTabBarProps;
  render(<AltMenu {...props} />);
  return navigation;
}

describe('#405 alt menü', () => {
  it('#569 KK1: 3 sekme (Profil yok), "Gezilerim"; seçili sekmede yazı Gece 700, ikon Mandalina', () => {
    ciz(1);
    expect(screen.getAllByRole('tab').map((n) => n.props.accessibilityLabel)).toEqual(['Keşfet', 'Gezilerim', 'Arkadaşlar']);
    expect(screen.queryByRole('tab', { name: 'Profil' })).toBeNull();
    expect(screen.getByText('Gezilerim')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Gezilerim' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Keşfet' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(altMenuRenk).toEqual({ secili: '#ff7a1a', pasif: '#8A91A3', cizgi: '#E4E7EE' });
  });

  it('KK6: başka sekmeye dokununca sekme_acildi ve geçiş; seçili sekmeye dokununca olay yok', () => {
    const navigation = ciz(0);
    fireEvent.press(screen.getByRole('tab', { name: 'Gezilerim' }));
    expect(mockOlay).toHaveBeenCalledWith('sekme_acildi', null, { sekme: 'seyahatlerim' });
    expect(navigation.navigate).toHaveBeenCalledWith('seyahatler', undefined);
    mockOlay.mockClear();
    fireEvent.press(screen.getByRole('tab', { name: 'Keşfet' }));
    expect(mockOlay).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('tab', { name: 'Arkadaşlar' }));
    expect(mockOlay).toHaveBeenCalledWith('sekme_acildi', null, { sekme: 'arkadaslar' });
    expect(navigation.navigate).toHaveBeenCalledWith('arkadaslar', undefined);
  });

  it('#569 KK1: Profil ekranı açıkken (gizli rota) hiçbir sekme seçili değil', () => {
    ciz(3);
    expect(screen.getAllByRole('tab').every((n) => n.props.accessibilityState.selected === false)).toBe(true);
  });
});
