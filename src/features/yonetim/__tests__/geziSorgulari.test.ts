import { describe, expect, it, jest } from '@jest/globals';

import { alanlariAl, yerdenDurak } from '../geziSorgulari';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// #107 KK4: Google'dan seçilen mekan → durak satırı (place_id, ad, kategori, konum otomatik; süre kategori varsayılanı, 15–480).
describe('yerdenDurak (#107 KK4)', () => {
  const yer = { place_id: 'ChIJ1', ad: 'Kurşunlu Cami', lat: 39.77, lng: 30.52, primary_type: 'mosque', tz: null, puan: 4.6, puan_sayisi: 3100, acik: null, ulke_kodu: 'TR' };

  it('alanlar Google verisinden; sıra verilen', () => {
    const d = yerdenDurak('gun1', 4, yer);
    expect(d).toMatchObject({ gezi_gun_id: 'gun1', sira: 4, place_id: 'ChIJ1', ad: 'Kurşunlu Cami', kategori: 'mosque', lat: 39.77, lng: 30.52 });
    expect(d.sure_dk).toBeGreaterThanOrEqual(15);
    expect(d.sure_dk).toBeLessThanOrEqual(480);
    // Puan / yorum saklanmaz (PRD §7).
    expect(d).not.toHaveProperty('puan');
  });

  it('uzun ad DB sınırına (120) kırpılır; kategorisiz yer de eklenir', () => {
    const d = yerdenDurak('g', 1, { ...yer, ad: 'x'.repeat(200), primary_type: null });
    expect(d.ad).toHaveLength(120);
    expect(d.kategori).toBeNull();
  });

  it('otomatik kayıt yalnız editör alanlarını taşır', () => {
    const alanlar = alanlariAl({ ...{ baslik: 'A', slug: 'a', sehir_id: 's', ozet: null, yazar_ad: null, yazi_md: '', kapak_url: null, yayin: false, yayin_at: null }, ...({ gun_sayisi: 2 } as object) } as never);
    expect(Object.keys(alanlar).sort()).toEqual(['baslik', 'kapak_url', 'ozet', 'sehir_id', 'slug', 'yayin', 'yayin_at', 'yazar_ad', 'yazi_md']);
  });
});
