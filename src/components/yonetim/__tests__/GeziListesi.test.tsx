import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import type { YonetimGeziOzeti } from '@/features/yonetim/geziSorgulari';

import { GeziListesi } from '../gezi/GeziListesi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ozet = (id: string, baslik: string, sehir: string, yayin: boolean, yayin_at: string | null): YonetimGeziOzeti => ({
  id,
  baslik,
  slug: id,
  sehir_id: sehir,
  gun_sayisi: 2,
  mekan_sayisi: 3,
  yayin,
  yayin_at,
  updated_at: '2026-10-12T00:00:00Z',
  sehirler: { ad: sehir === 's1' ? 'Eskişehir' : 'İzmir' },
});

// #107 KK1: liste — durum rozetleri (Yayında · Taslak · Planlı), seçim, "+ Yeni gezi", Filtre (arama).
describe('GeziListesi (#107 KK1)', () => {
  const geziler = [
    ozet('g1', "Odunpazarı'ndan Porsuk'a", 's1', true, '2026-01-01T00:00:00Z'),
    ozet('g2', 'İzmir kıyısı', 's2', false, null),
    ozet('g3', 'Antalya eski şehir', 's1', true, '2999-01-01T00:00:00Z'),
  ];

  it('rozetler, seçim ve yeni gezi', () => {
    const onSec = jest.fn();
    const onYeni = jest.fn();
    const { getByText, getByRole } = render(<GeziListesi geziler={geziler} sehirler={[]} seciliId="g2" onSec={onSec} onYeni={onYeni} yeniMesgul={false} />);
    expect(getByText('Yayında')).toBeTruthy();
    expect(getByText('Taslak')).toBeTruthy();
    expect(getByText('Planlı')).toBeTruthy();
    expect(getByText('İzmir · 2 gün')).toBeTruthy();
    fireEvent.press(getByText('Antalya eski şehir'));
    expect(onSec).toHaveBeenCalledWith('g3');
    fireEvent.press(getByRole('button', { name: '+ Yeni gezi' }));
    expect(onYeni).toHaveBeenCalled();
  });

  it('Filtre → arama başlığa göre süzer', () => {
    const { getByRole, getByLabelText, queryByText } = render(<GeziListesi geziler={geziler} sehirler={[]} seciliId={undefined} onSec={() => {}} onYeni={() => {}} yeniMesgul={false} />);
    fireEvent.press(getByRole('button', { name: 'Filtre' }));
    fireEvent.changeText(getByLabelText('Gezi ara'), 'izmir');
    expect(queryByText('İzmir kıyısı')).toBeTruthy();
    expect(queryByText('Antalya eski şehir')).toBeNull();
  });
});
