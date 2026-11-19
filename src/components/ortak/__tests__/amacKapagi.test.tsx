// #361 KK7: kapaksız kart — amaca göre zemin/tepe/daire (kanvas Ana_v5_Amaclar), gri kutu yok.
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { amacTonlari } from '@/theme';

import { AMAC_IKON_YOLLARI, AmacKapagi } from '../AmacKapagi';

describe('#361 AmacKapagi', () => {
  it('her ton için ikon yolu var', () => {
    expect(Object.keys(AMAC_IKON_YOLLARI).sort()).toEqual(Object.keys(amacTonlari).sort());
  });
  it('dairenin rengi amacın dairesi (Doğa #16703C)', () => {
    render(<AmacKapagi ton="doga" />);
    const kutu = screen.getByTestId('amac-kapagi-doga', { includeHiddenElements: true });
    const daire = kutu.children.find((c) => typeof c !== 'string' && StyleSheet.flatten(c.props.style)?.backgroundColor === '#16703C');
    expect(daire).toBeTruthy();
  });
});
