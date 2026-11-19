import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { IlOneri } from '@/features/yonetim/ilOneri';

import { IlOneriTablosu } from '../il/IlOneriTablosu';

const satir = (id: string, sira: number, gorunur = true): IlOneri => ({
  id,
  il_slug: 'bolu',
  sira,
  ad: `Yer ${sira}`,
  kategori: 'doga',
  amaclar: ['doga'],
  ilce: 'Mudurnu',
  merkeze_km: 31,
  neden: 'Göl kıyısında yürüyüş',
  place_id: null,
  gorunur,
});

// #401 KK4: satır — sıra, ad, ilçe, km, neden; görünürlük anahtarı; ⋯ ile neden, amaç ve iki adımlı silme.
describe('IlOneriTablosu (#401 KK4)', () => {
  it('satır, anahtar ve ⋯', () => {
    const onDegis = jest.fn();
    const onSil = jest.fn();
    const { getByText, getAllByText, getAllByRole, getByRole } = render(
      <IlOneriTablosu satirlar={[satir('a', 1), satir('b', 2, false)]} onDegis={onDegis} onTasi={() => {}} onSil={onSil} />,
    );
    expect(getByText('Yer 1')).toBeTruthy();
    expect(getAllByText('31 km')).toHaveLength(2);
    const anahtarlar = getAllByRole('switch');
    expect(anahtarlar[1].props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(anahtarlar[0]);
    expect(onDegis).toHaveBeenCalledWith('a', { gorunur: false });

    fireEvent.press(getByRole('button', { name: 'Yer 1: neden, amaçlar, sil' }));
    fireEvent.press(getByRole('button', { name: 'Sil' }));
    expect(onSil).not.toHaveBeenCalled();
    fireEvent.press(getByRole('button', { name: 'Sil · emin misin?' }));
    expect(onSil).toHaveBeenCalledWith('a');
  });
});
