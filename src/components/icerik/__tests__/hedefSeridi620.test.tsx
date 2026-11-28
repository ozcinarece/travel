// #620 (#619 küçükleri): hedef çip etiketinde tarih ekran okuyucuya okunur biçimde verilir; çipte görünen metin değişmez.
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { hedefCipEtiketi, hedefCipTarihi } from '@/features/icerik/hedefSeridi';
import type { SeyahatOzet } from '@/lib/tipler';

import { HedefSeridi } from '../HedefSeridi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('#620 KK1: okunur tarih', () => {
  it('aynı ay: "12 ile 14 Aralık arası"', () => {
    expect(hedefCipTarihi('2026-12-12', '2026-12-14')).toBe('12 ile 14 Aralık arası');
  });

  it('farklı ay (yıl dönümü dahil): "28 Aralık ile 2 Ocak arası"', () => {
    expect(hedefCipTarihi('2026-12-28', '2027-01-02')).toBe('28 Aralık ile 2 Ocak arası');
    expect(hedefCipTarihi('2026-10-28', '2026-11-02')).toBe('28 Ekim ile 2 Kasım arası');
  });

  it('tek gün: yalnız tarih', () => {
    expect(hedefCipTarihi('2026-12-12', '2026-12-12')).toBe('12 Aralık');
  });

  it('etikette "–" ve ay kısaltması yok', () => {
    const e = hedefCipEtiketi('Kış Tatili', hedefCipTarihi('2026-12-28', '2027-01-02'), true);
    expect(e).toBe('Kış Tatili, 28 Aralık ile 2 Ocak arası, farklı şehir');
    expect(e).not.toMatch(/–|Ara\b|Oca\b/);
  });

  it('çipte görünen metin değişmez, etiket okunur', () => {
    const sy = { id: 'k', name: 'Kış Tatili', city_label: 'Bolu', start_date: '2026-12-28', end_date: '2027-01-02' } as unknown as SeyahatOzet;
    render(<HedefSeridi seyahatler={[sy]} hedefId="k" sehirAdi="Bolu" onSec={jest.fn()} />);
    expect(screen.getByText('Kış Tatili · 28 Ara 2026 – 2 Oca 2027')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kış Tatili, 28 Aralık ile 2 Ocak arası', selected: true })).toBeTruthy();
  });
});
