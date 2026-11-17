// #290 KK8 (kanvas 25c · 29c): açık mavi (#C9D2F2) zeminde baş harf Lacivert (#152A6B); kart içi yüzlerde Figtree 800, 12 px.
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { renk } from '@/theme';

const harfStili = (arkaPlan: string, kucukHarf = false) => {
  const e = render(<Avatar ad="Mert" boyut={28} arkaPlan={arkaPlan} kucukHarf={kucukHarf} />);
  return StyleSheet.flatten(e.getByText('M').props.style);
};

describe('Avatar baş harf rengi ve yazısı', () => {
  it('#C9D2F2 zeminde #152A6B; diğer zeminler değişmedi', () => {
    expect(harfStili(renk.anaAcik).color).toBe('#152a6b');
    expect(harfStili(renk.ana).color).toBe(renk.zemin);
    expect(harfStili(renk.vurgu).color).toBe(renk.metin);
    expect(harfStili(renk.yuzey).color).toBe(renk.metin);
  });

  it('kucukHarf: Figtree 800, 12 px; verilmezse Archivo, boyutun %40ı', () => {
    expect(harfStili(renk.anaAcik, true)).toEqual(expect.objectContaining({ fontFamily: 'Figtree_800ExtraBold', fontSize: 12 }));
    expect(harfStili(renk.anaAcik)).toEqual(expect.objectContaining({ fontSize: 28 * 0.4 }));
  });
});
