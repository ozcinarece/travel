// #315 KK2: Google sonuçları gösteren çekmece başlığında atıf ("Sonuçlar: Google", UX kanvası YerEkle_Acilis).
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CekmeceSeridi } from '../OneriCekmecesi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ATIF = 'Sonuçlar: Google';

describe('Öneri çekmecesi Google atfı (#315 KK2)', () => {
  it('yarım halde başlıkta atıf var, ham anahtar yok', () => {
    const { getByText, queryByText } = render(<CekmeceSeridi sayi={14} hal="yari" onHal={() => {}} />);
    expect(getByText(ATIF)).toBeTruthy();
    expect(queryByText('yerler.atif')).toBeNull();
  });

  it('tam halde (harita kapalı) başlıkta atıf var', () => {
    const { getByText } = render(<CekmeceSeridi sayi={14} hal="tam" onHal={() => {}} tam={{ yerSayisi: 14, onFiltre: () => {}, cipler: <Text>çipler</Text> }} />);
    expect(getByText(ATIF)).toBeTruthy();
  });

  it('küçük halde harita göründüğü için atıf satırı yok', () => {
    const { queryByText } = render(<CekmeceSeridi sayi={14} hal="katli" onHal={() => {}} />);
    expect(queryByText(ATIF)).toBeNull();
  });
});
