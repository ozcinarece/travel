// #589 (#587 küçükleri): "Seyahatime al" hedef çip şeridi — KK1 seçili çip açılışta görünür alana gelir ("Yeni seyahat"
// seçiliyse sona), KK2 çiplerin ekran okuyucu etiketi "·" ayırıcısız "{ad}, {tarih}, farklı şehir".
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { hedefCipEtiketi, seritKaydirma } from '@/features/icerik/hedefSeridi';
import type { SeyahatOzet } from '@/lib/tipler';

import { HedefSeridi } from '../HedefSeridi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const sy = (id: string, name: string, city_label: string, start_date: string | null = null, end_date: string | null = null) =>
  ({ id, name, city_label, start_date, end_date }) as unknown as SeyahatOzet;

const SEYAHATLER = [
  sy('a', 'Bolu Gezisi', 'Bolu', '2026-12-12', '2026-12-14'),
  sy('b', 'Kapadokya Hafta Sonu', 'Nevşehir'),
  sy('c', 'Eskişehir Gezisi', 'Eskişehir', '2027-01-03', '2027-01-05'),
];

const proto = ScrollView.prototype as unknown as { scrollTo: jest.Mock; scrollToEnd: jest.Mock };
const katman = (x: number, width: number) => ({ nativeEvent: { layout: { x, y: 0, width, height: 44 } } });

describe('#589 KK1: seçili çip açılışta görünür', () => {
  beforeEach(() => {
    proto.scrollTo.mockClear();
    proto.scrollToEnd.mockClear();
  });

  it('saf kural: "Yeni seyahat" → son; dışarı taşan çip → sağ kenarı görünecek kadar; görünen çip → kaydırma yok', () => {
    expect(seritKaydirma(true, { genislik: null, cip: null, icerikHazir: false })).toEqual({ tur: 'bekle' });
    expect(seritKaydirma(true, { genislik: 390, cip: null, icerikHazir: true })).toEqual({ tur: 'son' });
    expect(seritKaydirma(false, { genislik: 390, cip: null, icerikHazir: true })).toEqual({ tur: 'bekle' });
    // İçerik ölçülmeden kaydırılmaz (Android'de kırpılmasın).
    expect(seritKaydirma(false, { genislik: 390, cip: { x: 520, genislik: 180 }, icerikHazir: false })).toEqual({ tur: 'bekle' });
    expect(seritKaydirma(false, { genislik: 390, cip: { x: 20, genislik: 200 }, icerikHazir: true })).toEqual({ tur: 'gerekmez' });
    // 520 + 180 + 20 kenar = 720 → 720 − 390 = 330.
    expect(seritKaydirma(false, { genislik: 390, cip: { x: 520, genislik: 180 }, icerikHazir: true })).toEqual({ tur: 'x', x: 330 });
  });

  it('şeridin sonundaki seyahat seçiliyse açılışta oraya kaydırılır; sıra değişmez', () => {
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId="c" sehirAdi="Eskişehir" onSec={jest.fn()} />);
    const serit = screen.getByTestId('hedef-seridi');
    fireEvent(serit, 'layout', katman(0, 390));
    fireEvent(screen.getByRole('button', { selected: true }), 'layout', katman(520, 180));
    expect(proto.scrollTo).not.toHaveBeenCalled();
    fireEvent(serit, 'contentSizeChange', 740, 44);
    expect(proto.scrollTo).toHaveBeenCalledTimes(1);
    expect(proto.scrollTo).toHaveBeenCalledWith({ x: 330, animated: false });
    // Yalnız bir kez: sonraki ölçümler şeridi oynatmaz.
    fireEvent(serit, 'layout', katman(0, 390));
    expect(proto.scrollTo).toHaveBeenCalledTimes(1);
    const sira = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? 'yeni');
    expect(sira).toEqual(['Bolu Gezisi, 12–14 Aralık, farklı şehir', 'Kapadokya Hafta Sonu, farklı şehir', 'Eskişehir Gezisi, 3–5 Ocak', 'yeni']);
  });

  it('"Yeni seyahat" seçiliyse içerik ölçülünce sona, animasyonsuz kaydırılır', () => {
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId={null} sehirAdi="Eskişehir" onSec={jest.fn()} />);
    fireEvent(screen.getByTestId('hedef-seridi'), 'contentSizeChange', 800, 44);
    expect(proto.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(proto.scrollTo).not.toHaveBeenCalled();
  });

  it('görünen ilk çip seçiliyse kaydırma yok', () => {
    const onSec = jest.fn();
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId="a" sehirAdi="Eskişehir" onSec={onSec} />);
    const serit = screen.getByTestId('hedef-seridi');
    fireEvent(serit, 'layout', katman(0, 390));
    fireEvent(screen.getByRole('button', { selected: true }), 'layout', katman(20, 220));
    fireEvent(serit, 'contentSizeChange', 740, 44);
    expect(proto.scrollTo).not.toHaveBeenCalled();
    expect(proto.scrollToEnd).not.toHaveBeenCalled();
  });

  it('ölçüm bitmeden kullanıcı dokunursa sonraki ölçümler şeridi kaydırmaz', () => {
    const onSec = jest.fn();
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId={null} sehirAdi="Eskişehir" onSec={onSec} />);
    fireEvent.press(screen.getByRole('button', { name: /Kapadokya/ }));
    expect(onSec).toHaveBeenCalledWith('b');
    const serit = screen.getByTestId('hedef-seridi');
    fireEvent(serit, 'layout', katman(0, 390));
    fireEvent(serit, 'contentSizeChange', 740, 44);
    expect(proto.scrollTo).not.toHaveBeenCalled();
    expect(proto.scrollToEnd).not.toHaveBeenCalled();
  });

  it('seçim ölçüm bitmeden değişirse (liste arkada yenilendi) yeni seçili çipin yerine kaydırılır', () => {
    const onSec = jest.fn();
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId="a" sehirAdi="Eskişehir" onSec={onSec} />);
    const butonlar = screen.getAllByRole('button');
    fireEvent(butonlar[0], 'layout', katman(20, 220));
    fireEvent(butonlar[2], 'layout', katman(520, 180));
    fireEvent(screen.getByTestId('hedef-seridi'), 'layout', katman(0, 390));
    screen.rerender(<HedefSeridi seyahatler={SEYAHATLER} hedefId="c" sehirAdi="Eskişehir" onSec={onSec} />);
    expect(proto.scrollTo).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId('hedef-seridi'), 'contentSizeChange', 740, 44);
    expect(proto.scrollTo).toHaveBeenCalledWith({ x: 330, animated: false });
  });
});

describe('#589 KK2: ekran okuyucu etiketi', () => {
  it('"·" okunmaz; tarih ve "farklı şehir" yalnız varsa', () => {
    expect(hedefCipEtiketi('Bolu Gezisi', '12–14 Aralık', true)).toBe('Bolu Gezisi, 12–14 Aralık, farklı şehir');
    expect(hedefCipEtiketi('Bolu Gezisi', '12–14 Aralık', false)).toBe('Bolu Gezisi, 12–14 Aralık');
    expect(hedefCipEtiketi('Bolu Gezisi', null, true)).toBe('Bolu Gezisi, farklı şehir');
    expect(hedefCipEtiketi('Bolu Gezisi', null, false)).toBe('Bolu Gezisi');
  });

  it('çipte görünen metin aynı kalır; etiket ayırıcısız', () => {
    render(<HedefSeridi seyahatler={SEYAHATLER} hedefId="c" sehirAdi="Eskişehir" onSec={jest.fn()} />);
    expect(screen.getByText('Bolu Gezisi · 12–14 Aralık')).toBeTruthy();
    expect(screen.getAllByTestId('farkli-sehir')).toHaveLength(2);
    for (const b of screen.getAllByRole('button')) expect(b.props.accessibilityLabel ?? '').not.toContain('·');
    expect(screen.getByRole('button', { name: 'Eskişehir Gezisi, 3–5 Ocak', selected: true })).toBeTruthy();
  });
});
