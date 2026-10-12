import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { TaslakBolum } from '@/features/yonetim/anaSayfa';

import { BolumSatiri } from '../anaSayfa/BolumSatiri';

const bolum: TaslakBolum = { id: 'b1', tur: 'serit', baslik: 'Önerilen geziler', sira: 2, acik: true, kaynak: 'elle', icerik: { gezi_idler: ['g1'] }, baslangic_at: null, bitis_at: null };
const secenekler = { geziler: [{ id: 'g1', baslik: 'Bursa' }, { id: 'g2', baslik: 'İzmir' }], yerler: [], sehirler: [] };

// #109 KK3: satır — başlık · tür, özet, anahtar (açık/kapalı), Düzenle → içerik; içerikten çıkarma.
describe('BolumSatiri (#109 KK3)', () => {
  it('anahtar ve düzenleyici', () => {
    const onGuncelle = jest.fn();
    const onAcKapa = jest.fn();
    const { getByText, getByRole, rerender, getByLabelText } = render(
      <BolumSatiri bolum={bolum} indeks={0} secenekler={secenekler} acik={false} onAcKapa={onAcKapa} onGuncelle={onGuncelle} onSil={() => {}} onBirak={() => {}} />,
    );
    expect(getByText('· yatay şerit', { exact: false })).toBeTruthy();
    expect(getByText('Bursa (sıra: elle)')).toBeTruthy();
    const anahtar = getByRole('switch');
    expect(anahtar.props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(anahtar);
    expect(onGuncelle).toHaveBeenCalledWith({ acik: false });
    fireEvent.press(getByRole('button', { name: 'Düzenle' }));
    expect(onAcKapa).toHaveBeenCalled();
    rerender(<BolumSatiri bolum={bolum} indeks={0} secenekler={secenekler} acik onAcKapa={onAcKapa} onGuncelle={onGuncelle} onSil={() => {}} onBirak={() => {}} />);
    fireEvent.press(getByLabelText('Bursa içerikten çıkar'));
    expect(onGuncelle).toHaveBeenLastCalledWith({ icerik: { gezi_idler: [] } });
  });
});
