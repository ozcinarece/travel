import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import type { Ozet } from '@/features/yonetim/genelBakis';

import { EnCokTablosu } from '../genel/EnCokTablosu';
import { KpiKarti } from '../genel/KpiKarti';
import { yRenk } from '../tema';

const satirlar: Ozet['en_cok_alinan'] = [
  { id: 'g1', baslik: "Odunpazarı'ndan Porsuk'a", sehir: 'Eskişehir', gun_sayisi: 2, goruntu: 1240, alindi: 96, kalp: 210 },
  { id: 'g2', baslik: "Bursa'da üç gün", sehir: 'Bursa', gun_sayisi: 3, goruntu: 0, alindi: 2, kalp: 0 },
];

// #110 KK1 / KK3: kart (değişim + alt satır) ve en çok alınan geziler tablosu.
describe('genel bakış parçaları (#110)', () => {
  it('KPI kartı: artış yeşil, düşüş turuncu', () => {
    const { getByText, rerender } = render(<KpiKarti kart={{ anahtar: 'k', baslik: 'Kullanıcı', deger: '1.284', degisim: 8.08, alt: 'son 7 gün +96' }} />);
    expect(getByText('1.284')).toBeTruthy();
    expect(getByText('+8,1%', { exact: false }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: yRenk.basari })]));
    rerender(<KpiKarti kart={{ anahtar: 'k', baslik: 'Seyahat', deger: '642', degisim: -5, alt: 'bu hafta 2' }} />);
    expect(getByText('−5%', { exact: false }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: yRenk.hata })]));
  });
  it('tablo: aralık başlığı, şehir · gün, oran', () => {
    const { getByText } = render(<EnCokTablosu gun={7} satirlar={satirlar} />);
    expect(getByText('En çok alınan geziler · 7 gün')).toBeTruthy();
    expect(getByText('Eskişehir · 2 gün')).toBeTruthy();
    expect(getByText('8%')).toBeTruthy();
    expect(getByText('1.240')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
  });
  it('tablo boşken açıklama', () => {
    expect(render(<EnCokTablosu gun={30} satirlar={[]} />).getByText('Bu aralıkta alınan gezi yok.')).toBeTruthy();
  });
});
