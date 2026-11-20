// #401 KK5 (`Ekran07cIlOnerileri` A–B): sihirbazda il listesi — Hepsi + dolu kategori sekmeleri, sıra `sira`, satırda
// "Kategori · İlçe · N km" ve neden, ✓ / +, "Yakındaki diğer yerler" kapalıyken Google'a istek yok.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AdimIlOnerileri } from '@/components/sihirbaz/AdimIlOnerileri';
import type { IlYeri } from '@/features/icerik/ilOnerileri';
import { t } from '@/i18n';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/sihirbaz/SecimHaritasi', () => ({ SecimHaritasi: () => null }));
const mockEkle = jest.fn(async (_: unknown) => undefined);
jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanEkle: () => ({ mutateAsync: mockEkle }),
  useMekanSil: () => ({ mutateAsync: jest.fn(async () => undefined) }),
}));
const mockGoogle = jest.fn((..._a: unknown[]) => ({ data: [] as unknown[], isPending: false, isError: false }));
jest.mock('@/features/sihirbaz/onerilenler', () => ({
  ...jest.requireActual<object>('@/features/sihirbaz/onerilenler'),
  useGoogleListesi: (...a: unknown[]) => mockGoogle(...a),
}));
jest.mock('@/features/icerik/ilOnerileri', () => ({
  ...jest.requireActual<object>('@/features/icerik/ilOnerileri'),
  useIlFotolari: () => ({ data: {} }),
}));

const yer = (sira: number, ad: string, kategori: IlYeri['kategori'], ilce: string, km: number | null, neden: string | null): IlYeri => ({
  id: `y${sira}`,
  sira,
  ad,
  kategori,
  ilce,
  merkeze_km: km,
  neden,
  place_id: `p${sira}`,
  primary_type: null,
  lat: 40.7,
  lng: 31.6,
});
const YERLER = [
  yer(2, 'Yedigöller Milli Parkı', 'doga', 'Mengen', 26, 'Orman içinde birbirine akan yedi göl'),
  yer(1, 'Abant Gölü', 'doga', 'Mudurnu', 31, 'Göl kıyısını dolaşan 7 km’lik yol'),
  yer(3, 'Gölcük Tabiat Parkı', 'doga', 'Merkez', 4, null),
  yer(4, 'Mudurnu Arasta Çarşısı', 'carsi', 'Mudurnu', 45, null),
];
const SEYAHAT = { id: 't1', name: 'Bolu', city_label: 'Bolu', lat: 40.73, lng: 31.6 } as never;
const HAVUZ = [{ id: 'm1', place_id: 'p1', primary_type: null, lat: 40.7, lng: 31.6, default_minutes: 90 }] as never;

describe('#401 sihirbaz il listesi', () => {
  it('Hepsi + dolu kategoriler; sıra sira; alt satır ve neden; listede ✓', () => {
    render(<AdimIlOnerileri seyahat={SEYAHAT} yerler={YERLER} havuz={HAVUZ} onTut={jest.fn()} onHata={jest.fn()} onAc={jest.fn()} />);
    const sekmeler = screen.getAllByRole('tab').map((s) => s.props.accessibilityLabel);
    expect(sekmeler).toEqual(['Hepsi', 'Doğa', 'Çarşı']);
    const adlar = screen.getAllByText(/Abant Gölü|Yedigöller|Gölcük|Arasta/).map((n) => n.props.children);
    expect(adlar).toEqual(['Abant Gölü', 'Yedigöller Milli Parkı', 'Gölcük Tabiat Parkı', 'Mudurnu Arasta Çarşısı']);
    expect(screen.getByText('Doğa · Mudurnu · 31 km')).toBeTruthy();
    expect(screen.getByText('Doğa · Merkez')).toBeTruthy();
    expect(screen.getByText('Orman içinde birbirine akan yedi göl')).toBeTruthy();
    expect(screen.getByLabelText(t('ilOneri.listende', { ad: 'Abant Gölü' }))).toBeTruthy();
    expect(screen.getByLabelText(t('ilOneri.ekle', { ad: 'Yedigöller Milli Parkı' }))).toBeTruthy();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('sekme listeyi süzer', () => {
    render(<AdimIlOnerileri seyahat={SEYAHAT} yerler={YERLER} havuz={HAVUZ} onTut={jest.fn()} onHata={jest.fn()} onAc={jest.fn()} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Çarşı' }));
    expect(screen.getByText('Mudurnu Arasta Çarşısı')).toBeTruthy();
    expect(screen.queryByText('Abant Gölü')).toBeNull();
  });

  it('+ listeye ekler', async () => {
    const onTut = jest.fn();
    render(<AdimIlOnerileri seyahat={SEYAHAT} yerler={YERLER} havuz={HAVUZ} onTut={onTut} onHata={jest.fn()} onAc={jest.fn()} />);
    fireEvent.press(screen.getByLabelText(t('ilOneri.ekle', { ad: 'Yedigöller Milli Parkı' })));
    await screen.findByText('Yedigöller Milli Parkı');
    expect(mockEkle).toHaveBeenCalledWith(expect.objectContaining({ place_id: 'p2', lat: 40.7, lng: 31.6 }));
  });

  it('Yakındaki diğer yerler kapalı başlar (Google isteği yok); açılınca sekmenin kümesi istenir', () => {
    mockGoogle.mockClear();
    render(<AdimIlOnerileri seyahat={SEYAHAT} yerler={YERLER} havuz={HAVUZ} onTut={jest.fn()} onHata={jest.fn()} onAc={jest.fn()} />);
    expect(mockGoogle.mock.calls.every((c) => c[3] === false)).toBe(true);
    expect(screen.getByText(t('ilOneri.googleAtif'))).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Doğa' }));
    fireEvent.press(screen.getByText(t('ilOneri.yakindaki')));
    expect(mockGoogle).toHaveBeenLastCalledWith('t1', 'park', { lat: 40.73, lng: 31.6 }, true);
  });
});
