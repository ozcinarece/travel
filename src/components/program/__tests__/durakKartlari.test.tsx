// #168 inceleme 3: uzun ad 3 satır, "Varışta kapalı" hiç kesilmez (büyük yazıda da), ··· / Sonra: etiketlerinde ad, ··· 44 px dokunma.
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { DurakKarti } from '@/features/program/durakKarti';
import { renk } from '@/theme';

import { DurakKartlari } from '../DurakKartlari';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));
jest.mock('@/features/yerler/api', () => ({ useOnizleme: () => ({ data: undefined }) }));
jest.mock('@/features/icerik/sorgular', () => ({ useYerRehberi: () => ({ data: undefined }) }));

const UZUN = 'Bursa Kent Müzesi ve Tarihi Kişiler Balmumu Heykeller Müzesi';
const kart = (id: string, sira: number, ek: Partial<DurakKarti> = {}): DurakKarti => ({
  durakId: id,
  mekanId: `m${id}`,
  placeId: `p${id}`,
  konum: { lat: 40.18, lng: 29.06 },
  sira,
  numara: sira,
  ad: `Durak ${id}`,
  kategori: 'Müze',
  dakika: 60,
  varisDk: 600 + sira * 60,
  ayrilisDk: 660 + sira * 60,
  puan: null,
  yorum: null,
  durum: null,
  tamamlandi: false,
  gelis: null,
  varildi: null,
  acik: true,
  ...ek,
});

const ciz = (kartlar: DurakKarti[], gezi = false) =>
  render(
    <DurakKartlari
      kartlar={kartlar}
      seciliDurakId={kartlar[0].durakId}
      gezi={gezi}
      tz="Europe/Istanbul"
      konum={null}
      gunRenk="#2c64f5"
      onSec={() => undefined}
      onRehber={() => undefined}
      onYolTarifi={() => undefined}
      onMenu={() => undefined}
      onKapat={() => undefined}
    />,
  );

describe('#168 durak kartı — inceleme 3', () => {
  it('uzun ad 3 satıra kadar', () => {
    const { getByText } = ciz([kart('1', 1, { ad: UZUN })]);
    expect(getByText(UZUN).props.numberOfLines).toBe(3);
  });

  it('"Varışta kapalı" ayrı metin: satır sınırı yok, büyük yazıda kesilmez; kategori kısalır, uyarı alt satıra iner', () => {
    const { getByTestId, getByText } = ciz([kart('1', 1, { acik: false, kategori: 'Tarihi Yapı ve Anıt Mezar Kompleksi' })]);
    const uyari = getByTestId('durak-acik');
    expect(uyari.props.children).toBe('Varışta kapalı');
    expect(uyari.props.numberOfLines).toBeUndefined();
    expect(uyari.props.maxFontSizeMultiplier).toBeUndefined();
    expect(StyleSheet.flatten(uyari.props.style).color).toBe(renk.uyari);
    const kategori = getByText(/Tarihi Yapı ve Anıt Mezar Kompleksi/);
    expect(kategori.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(kategori.parent?.parent?.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });

  it('··· ve Sonra: etiketlerinde mekan adı; ··· 40 px + hitSlop 2 = 44 px', () => {
    const kartlar = [kart('1', 1, { durum: 'siradaki' }), kart('2', 2, { ad: 'Cam Müzesi' })];
    const { getByLabelText } = ciz(kartlar, true);
    const diger = getByLabelText('Diğer seçenekler: Durak 1');
    expect(diger.props.hitSlop).toBe(2);
    expect(getByLabelText('Sonraki durak: Cam Müzesi')).toBeTruthy();
  });

  it('12c-C: atlanan kartın foto zemini Buz, numara kenarı tema token\'ı', () => {
    const { UNSAFE_root } = ciz([kart('1', 1, { numara: null, durum: 'atlandi', varisDk: null, ayrilisDk: null, acik: null })]);
    const stil = (w: number) =>
      UNSAFE_root.findAll((n) => (n.type as unknown) === 'View' && StyleSheet.flatten(n.props.style)?.width === w).map((n) => StyleSheet.flatten(n.props.style));
    expect(stil(60)[0]).toMatchObject({ height: 60, backgroundColor: renk.yuzey });
    expect(stil(34)[0]).toMatchObject({ borderStyle: 'dashed', borderColor: renk.yerTutucu });
  });
});
