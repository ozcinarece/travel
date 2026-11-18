// #300 KK3 (kanvas 29h · B): BO amaç çoklu seçimi.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { amacDegistir } from '@/features/yonetim/amac';

import { AmacSecimi } from '../amac/AmacSecimi';

describe('amacDegistir', () => {
  it('açar, kapatır; sıra amac_listesi sırası, tekrarsız, listede olmayan düşer', () => {
    expect(amacDegistir([], 'cocuklu')).toEqual(['cocuklu']);
    expect(amacDegistir(['cocuklu'], 'kultur_tarih')).toEqual(['kultur_tarih', 'cocuklu']);
    expect(amacDegistir(['kultur_tarih', 'cocuklu'], 'kultur_tarih')).toEqual(['cocuklu']);
    expect(amacDegistir(['eski', 'lezzet', 'lezzet'], 'doga')).toEqual(['lezzet', 'doga']);
  });
});

describe('AmacSecimi', () => {
  it('6 çip sabit sırayla; seçili olan aria-pressed ve ✓; dokununca yeni liste', () => {
    const onDegis = jest.fn();
    const { getByTestId, getByText } = render(<AmacSecimi secili={['yavas']} onDegis={onDegis} />);
    expect(getByText('Amaç')).toBeTruthy();
    expect(getByText('Birden çok seçilebilir. Keşfet çipleri ve 5 soruda plan bunu kullanır.')).toBeTruthy();
    expect(getByTestId('amac-yavas').props['aria-pressed']).toBe(true);
    expect(getByTestId('amac-lezzet').props['aria-pressed']).toBe(false);
    expect(getByTestId('amac-yavas').props.accessibilityState?.selected).toBeUndefined();
    expect(getByText('Yavaş ve keyifli')).toBeTruthy();
    fireEvent.press(getByTestId('amac-cocuklu'));
    expect(onDegis).toHaveBeenLastCalledWith(['yavas', 'cocuklu']);
    fireEvent.press(getByTestId('amac-yavas'));
    expect(onDegis).toHaveBeenLastCalledWith([]);
  });

  it('gezide boş hal uyarısı; yerde ya da seçim varken yok', () => {
    const uyari = "Amaç seçilmedi: bu gezi yalnız Sana göre'de görünür.";
    expect(render(<AmacSecimi secili={[]} onDegis={() => {}} bosUyari />).queryByText(uyari)).toBeTruthy();
    expect(render(<AmacSecimi secili={['gece']} onDegis={() => {}} bosUyari />).queryByText(uyari)).toBeNull();
    expect(render(<AmacSecimi secili={[]} onDegis={() => {}} />).queryByText(uyari)).toBeNull();
  });
});
