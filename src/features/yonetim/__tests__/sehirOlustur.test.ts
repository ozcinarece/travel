import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { sehirOlustur } from '../sehirSorgulari';

const mockEklenen: Record<string, unknown>[] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (satir: Record<string, unknown>) => {
        mockEklenen.push(satir);
        return { select: () => ({ single: async () => ({ data: { id: 'yeni-sehir' }, error: null }) }) };
      },
    }),
  },
}));

// #197 KK2: BO "+ Şehir" — seçici şehri şehir modunda alır (Google kimliği, saat dilimi, ülke kodu); ek istek olmadan yazılır.
describe('sehirOlustur (#197)', () => {
  beforeEach(() => {
    mockEklenen.length = 0;
  });
  it('seçilen şehrin kimliği, saat dilimi ve ülke kodu satıra girer; taslak açılır', async () => {
    await sehirOlustur({ place_id: 'ChIJ_eskisehir_1', ad: 'Eskişehir', lat: 39.77, lng: 30.52, tz: 'Europe/Istanbul', ulke_kodu: 'TR' });
    expect(mockEklenen[0]).toEqual({ ad: 'Eskişehir', slug: 'eskisehir', lat: 39.77, lng: 30.52, yayin: false, place_id: 'ChIJ_eskisehir_1', tz: 'Europe/Istanbul', ulke_kodu: 'TR' });
  });
  it('kimliksiz seçim de açılır (alanlar boş; hat sonra doldurur)', async () => {
    await sehirOlustur({ ad: 'Bursa', lat: 40.19, lng: 29.06 });
    expect(mockEklenen[0]).toEqual(expect.objectContaining({ place_id: null, tz: null, ulke_kodu: null }));
  });
});
