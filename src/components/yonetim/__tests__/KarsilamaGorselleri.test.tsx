import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { TaslakBolum } from '@/features/yonetim/anaSayfa';

import { KarsilamaGorselleri } from '../anaSayfa/KarsilamaGorselleri';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const url = (n: number) => `https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/anasayfa/${n}.webp`;
const bolum: TaslakBolum = {
  id: 'k',
  tur: 'karsilama',
  baslik: 'Karşılama görselleri',
  sira: 7,
  acik: true,
  kaynak: 'elle',
  icerik: { kapaklar: [{ url: url(1), kaynak: 'kendi' }, { url: url(2) }] },
  baslangic_at: null,
  bitis_at: null,
};
const kapaklar = bolum.icerik.kapaklar!;

// #586 KK2 · KK3: satır özeti, sil (iki adım), atıf, açık/kapalı, telefon önizlemesi.
describe('KarsilamaGorselleri (#586)', () => {
  it('özet, sil onayı, atıf ve anahtar', () => {
    const onYaz = jest.fn();
    const onAcik = jest.fn();
    const e = render(<KarsilamaGorselleri bolum={bolum} kapaklar={kapaklar} onYukle={async () => {}} onYaz={onYaz} onAcik={onAcik} />);
    expect(e.getByText('2 / 8 görsel · uygulama her açılışta sıradakini gösterir')).toBeTruthy();
    fireEvent.press(e.getAllByText('Sil')[0]);
    expect(onYaz).not.toHaveBeenCalled();
    fireEvent.press(e.getByText('Silinsin mi?'));
    expect(onYaz).toHaveBeenLastCalledWith([{ url: url(2) }]);
    fireEvent.press(e.getAllByText('Atıf')[1]);
    fireEvent.changeText(e.getByLabelText('FOTOĞRAFIN YAZARI'), ' Ali ');
    fireEvent.press(e.getByText('Atfı kaydet'));
    expect(onYaz).toHaveBeenLastCalledWith([{ url: url(1), kaynak: 'kendi' }, { url: url(2), atif: { yazar: 'Ali' } }]);
    fireEvent.press(e.getByRole('switch'));
    expect(onAcik).toHaveBeenCalledWith(false);
  });

  it('satır yokken boş hal; Önizle kartı gösterir', () => {
    const e = render(<KarsilamaGorselleri bolum={null} kapaklar={[]} onYukle={async () => {}} onYaz={() => {}} onAcik={() => {}} />);
    expect(e.getByText("Görsel yok · uygulama Eskişehir'in kapağını gösterir")).toBeTruthy();
    expect(e.queryByRole('switch')).toBeNull();
    fireEvent.press(e.getByText('Önizle'));
    expect(e.getByTestId('karsilama-onizleme')).toBeTruthy();
    expect(e.getByText('Sıradaki rota neresi?')).toBeTruthy();
    expect(e.getByText('Yeni gezi oluştur')).toBeTruthy();
  });
});
