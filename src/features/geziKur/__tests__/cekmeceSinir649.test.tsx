// #649 KK1/KK3: "Bunu seç" çekmecesinde sınır rotanın kaynağına göre (hazır gezi 30, arkadaş rotası 60 gün). Sınırın son günü
// seçilebilir, bir sonraki gün geçmiş gün gibi pasif; tarihsiz sayaç da aynı sınırda durur.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { cekmeceEnCokGun, cekmeceSecimi, HAZIR_GEZI_EN_COK_GUN } from '@/features/geziKur/geziKur';
import { TARIH_EN_COK_GUN } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { tarihEkle } from '@/lib/takvim';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const yil = new Date().getFullYear() + 1;
const gidis = `${yil}-01-01`;

/** Çekmecedeki gibi: takvim hesaplanan dönüşü gösterir, sınır gerçek seçimden (yalnız gidiş) hesaplanır. */
function takvim(enCok: number, onAralik = jest.fn()) {
  render(
    <AdimNeZaman
      aralik={{ gidis, donus: `${yil}-01-03` }}
      sinirAraligi={{ gidis, donus: null }}
      enCokGun={enCok}
      onAralik={onAralik}
      tarihsizGun={null}
      onTarihsizGun={jest.fn()}
      ozetSatiri={null}
    />,
  );
  return onAralik;
}
const durum = (gun: string) => screen.getByLabelText(gun).props.accessibilityState as { disabled: boolean };

describe('#649 KK1 saf: sınır kaynağa göre', () => {
  it('hazır gezi 30, arkadaş rotası 60', () => {
    expect(HAZIR_GEZI_EN_COK_GUN).toBe(30);
    expect(cekmeceEnCokGun('gezi')).toBe(30);
    expect(cekmeceEnCokGun('arkadas')).toBe(TARIH_EN_COK_GUN);
    expect(TARIH_EN_COK_GUN).toBe(60);
  });

  it('tarihsiz gün sayısı ve hesaplanan dönüş sınırı aşmaz', () => {
    expect(cekmeceSecimi(null, 45, 3, 30)).toEqual({ tur: 'tarihsiz', gun: 30 });
    expect(cekmeceSecimi(null, 45, 3, 60)).toEqual({ tur: 'tarihsiz', gun: 45 });
    expect(cekmeceSecimi(null, 99, 3)).toEqual({ tur: 'tarihsiz', gun: 60 });
    expect(cekmeceSecimi({ gidis, donus: null }, null, 40, 30)).toEqual({ tur: 'tarihli', gidis, donus: `${yil}-01-30` });
  });
});

describe('#649 KK1/KK3 hazır gezi: takvim 30 gün', () => {
  it('30. gün seçilebilir, 31. gün pasif ve dokunuş seçim yapmaz', () => {
    const onAralik = takvim(HAZIR_GEZI_EN_COK_GUN);
    expect(durum(`${yil}-01-30`)).toMatchObject({ disabled: false });
    fireEvent.press(screen.getByLabelText(`${yil}-01-30`));
    expect(onAralik).toHaveBeenCalledTimes(1);
    expect(durum(`${yil}-01-31`)).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText(`${yil}-01-31`));
    expect(onAralik).toHaveBeenCalledTimes(1);
  });
});

describe('#649 KK1/KK3 arkadaş rotası: takvim 60 gün', () => {
  it('60. gün seçilebilir, 61. gün pasif; 31. gün açık', () => {
    const onAralik = takvim(TARIH_EN_COK_GUN);
    expect(durum(`${yil}-01-31`)).toMatchObject({ disabled: false });
    // 60. gün artık yılda 29 Şubat, değilse 1 Mart: tarihten hesaplanır, görünen ay oraya kaydırılır.
    const son = tarihEkle(gidis, TARIH_EN_COK_GUN - 1);
    const sonraki = tarihEkle(gidis, TARIH_EN_COK_GUN);
    for (let i = 1; i < Number(son.slice(5, 7)); i++) fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.sonrakiAy')));
    expect(durum(son)).toMatchObject({ disabled: false });
    fireEvent.press(screen.getByLabelText(son));
    expect(onAralik).toHaveBeenCalledTimes(1);
    if (sonraki.slice(5, 7) !== son.slice(5, 7)) fireEvent.press(screen.getByLabelText(t('sihirbaz.nezaman.sonrakiAy')));
    expect(durum(sonraki)).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText(sonraki));
    expect(onAralik).toHaveBeenCalledTimes(1);
  });
});

describe('#649 KK1/KK3 tarihsiz sayaç', () => {
  const sayac = (n: number, enCok: number) => {
    const onTarihsizGun = jest.fn();
    render(<AdimNeZaman aralik={null} onAralik={jest.fn()} tarihsizGun={n} onTarihsizGun={onTarihsizGun} enCokGun={enCok} />);
    return { arti: screen.getByLabelText(t('sihirbaz.nezaman.gunArttir')), onTarihsizGun };
  };

  it('hazır gezide 29 → 30 olur, 30\'da "+" pasif', () => {
    const a = sayac(29, 30);
    expect(a.arti.props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(a.arti);
    expect(a.onTarihsizGun).toHaveBeenCalledWith(30);
    screen.unmount();
    const b = sayac(30, 30);
    expect(b.arti.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('arkadaş rotasında 30\'da "+" açık, 60\'ta pasif', () => {
    expect(sayac(30, 60).arti.props.accessibilityState).toMatchObject({ disabled: false });
    screen.unmount();
    expect(sayac(60, 60).arti.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
