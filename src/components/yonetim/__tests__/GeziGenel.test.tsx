import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { GeziAlanlari } from '@/features/yonetim/gezi';

import { GeziGenel } from '../gezi/GeziGenel';

const taslak: GeziAlanlari = {
  baslik: "Odunpazarı'ndan Porsuk'a iki gün",
  slug: 'odunpazarindan-porsuka-iki-gun',
  sehir_id: 's1',
  ozet: null,
  yazar_ad: 'Ece',
  yazi_md: '',
  kapak_url: null,
  yayin: true,
  yayin_at: '2099-10-20T06:00:00.000Z',
};
const sehirler = [{ id: 's1', ad: 'Eskişehir', slug: 'eskisehir', lat: 39.7, lng: 30.5, yayin: true }];

// BekleyenTasarim21 ekran 4: durum menüsü, planlı yayın (İstanbul), gezi/ önekli slug, okuma otomatik.
describe('GeziGenel (kanvas ekran 4)', () => {
  it('planlıda turuncu tarih + saat ve "uygulamada … görünür"; slug öneki ve otomatik notu', () => {
    const { getByText, getByLabelText } = render(<GeziGenel taslak={taslak} sehirler={sehirler} degistir={() => {}} slugHatasi={false} />);
    expect(getByText('YAYIN TARİHİ')).toBeTruthy();
    expect(getByText('20 Eki 2099')).toBeTruthy();
    expect(getByText('09:00')).toBeTruthy();
    expect(getByText('Uygulamada 20 Eki 09:00’da görünür (İstanbul)')).toBeTruthy();
    expect(getByText('gezi/')).toBeTruthy();
    expect(getByText('otomatik · düzenle')).toBeTruthy();
    expect(getByText('1 dk · otomatik')).toBeTruthy();
    expect(getByLabelText('SLUG · bağlantı').props.value).toBe('odunpazarindan-porsuka-iki-gun');
  });

  it('durum menüsü: Taslak yalnız sen · Planlı tarihte açılır · Yayında hemen; seçim alanlara çevrilir', () => {
    const degistir = jest.fn();
    const { getByRole, getByText, queryByText } = render(<GeziGenel taslak={taslak} sehirler={sehirler} degistir={degistir} slugHatasi={false} />);
    expect(queryByText('yalnız sen')).toBeNull();
    fireEvent.press(getByRole('button', { name: 'DURUM' }));
    expect(getByText('yalnız sen')).toBeTruthy();
    expect(getByText('tarihte açılır')).toBeTruthy();
    expect(getByText('hemen')).toBeTruthy();
    fireEvent.press(getByText('yalnız sen'));
    expect(degistir).toHaveBeenCalledWith({ yayin: false, yayin_at: taslak.yayin_at }, true);
    expect(queryByText('yalnız sen')).toBeNull();
  });

  it('slug çakışması kırmızı satır', () => {
    const { getByText } = render(<GeziGenel taslak={{ ...taslak, yayin: false }} sehirler={sehirler} degistir={() => {}} slugHatasi />);
    expect(getByText('Bu slug başka bir gezide')).toBeTruthy();
  });
});
