import { describe, expect, it, jest } from '@jest/globals';

import type { SeyahatOzet } from '@/lib/tipler';

import { baslangicHedefi, farkliSehir, varsayilanHedef } from '../yerEkle';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const sy = (id: string, city_label: string): SeyahatOzet => ({ id, city_label, name: null, start_date: null, end_date: null }) as unknown as SeyahatOzet;

describe('#583 Seyahatime al varsayılan hedef', () => {
  const adaylar = [sy('bolu', 'Bolu, Türkiye'), sy('ist', 'İstanbul')];

  it('KK1: aynı şehirde seyahat yoksa "Yeni seyahat" (null); başka şehirdeki ilk seyahate düşülmez', () => {
    const ilk = varsayilanHedef([adaylar[0]], 'İstanbul')?.id ?? null;
    expect(ilk).toBeNull();
    expect(baslangicHedefi([adaylar[0]], ilk)).toBeNull();
    expect(baslangicHedefi(adaylar, undefined)).toBeNull();
  });

  it('KK1: aynı şehirdeki seyahat ya da açıkça seçilen seyahat seçili gelir; listede olmayan kimlik "Yeni seyahat"', () => {
    expect(baslangicHedefi(adaylar, varsayilanHedef(adaylar, 'İstanbul')?.id)).toBe('ist');
    expect(baslangicHedefi(adaylar, 'bolu')).toBe('bolu');
    expect(baslangicHedefi(adaylar, 'silinmis')).toBeNull();
  });

  it('KK2: başka şehirdeki seyahat "Farklı şehir" alır; aynı şehir ve şehri bilinmeyen içerik almaz', () => {
    expect(farkliSehir(adaylar[0], 'İstanbul')).toBe(true);
    expect(farkliSehir(adaylar[1], 'istanbul')).toBe(false);
    expect(farkliSehir(adaylar[0], null)).toBe(false);
    expect(farkliSehir(adaylar[0], ' ')).toBe(false);
  });
});
