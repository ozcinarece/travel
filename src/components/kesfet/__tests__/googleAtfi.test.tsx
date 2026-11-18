// #315 KK2 + #342: Google sonuçları gösteren çekmecede atıf ("Google Maps", kanvas 9b/9c). Yarım halde başlık satırının
// altında, tam halde çiplerin altında; "Listende" modunda da (kartlar Google'dan gelen ad ve puanı gösterir).
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { CekmeceSeridi } from '../OneriCekmecesi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ATIF = 'Google Maps';
const tam = { yerSayisi: 14, onFiltre: () => {}, cipler: <Text>çipler</Text> };
const listeYalniz = { sayi: 5, yalniz: true, onPress: () => {} };

describe('Öneri çekmecesi Google atfı (#315 KK2, #342)', () => {
  it('yarım halde atıf var, ham anahtar yok', () => {
    const { getByText, queryByText } = render(<CekmeceSeridi sayi={14} hal="yari" onHal={() => {}} />);
    expect(getByText(ATIF)).toBeTruthy();
    expect(queryByText('yerler.atif')).toBeNull();
  });

  it('atıf stili Google kuralında: 12 px, ağırlık 400, #5E5E5E, tek satır', () => {
    const { getByText } = render(<CekmeceSeridi sayi={14} hal="yari" onHal={() => {}} />);
    const atif = getByText(ATIF);
    const stil = StyleSheet.flatten(atif.props.style);
    expect(stil.fontSize).toBe(12);
    expect(stil.fontFamily).toBe('Figtree_400Regular');
    expect(String(stil.color).toLowerCase()).toBe('#5e5e5e');
    expect(atif.props.numberOfLines).toBe(1);
  });

  it('tam halde (harita kapalı) atıf var', () => {
    const { getByText } = render(<CekmeceSeridi sayi={14} hal="tam" onHal={() => {}} tam={tam} />);
    expect(getByText(ATIF)).toBeTruthy();
  });

  it('yarım + Listende modunda atıf var', () => {
    const { getByText } = render(<CekmeceSeridi sayi={14} hal="yari" onHal={() => {}} liste={listeYalniz} />);
    expect(getByText(ATIF)).toBeTruthy();
  });

  it('tam + Listende modunda atıf var', () => {
    const { getByText } = render(<CekmeceSeridi sayi={14} hal="tam" onHal={() => {}} tam={tam} liste={listeYalniz} />);
    expect(getByText(ATIF)).toBeTruthy();
  });

  it('küçük halde harita göründüğü için atıf satırı yok', () => {
    const { queryByText } = render(<CekmeceSeridi sayi={14} hal="katli" onHal={() => {}} />);
    expect(queryByText(ATIF)).toBeNull();
  });
});
