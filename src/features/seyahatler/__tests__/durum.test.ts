import { describe, expect, it, jest } from '@jest/globals';

import { durumCipleri, geriSayim, kisiMetni } from '../durum';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const sy = { start_date: '2026-10-16', end_date: '2026-10-19', tz: 'Europe/Istanbul', hotel_place_id: null, stays: [{ count: 0 }] };
const d = { trip_id: 't', gun: 4, planli_gun: 3, atanmamis: 2, gezilen: 0 };

describe('seyahat durum çipleri (#144 KK1)', () => {
  it('yüzde yok: planlı gün bilgi, atanmamış ve otel yok uyarı', () => {
    expect(durumCipleri(sy, d)).toEqual([
      { anahtar: 'planli', metin: '3 / 4 gün planlandı', uyari: false },
      { anahtar: 'atanmamis', metin: '2 mekan güne atanmadı', uyari: true },
      { anahtar: 'otel', metin: 'Otel yok', uyari: true },
    ]);
  });
  it('otel varsa ve hepsi atanmışsa yalnız bilgi; tarihsiz (TASLAK) seyahatte çip yok', () => {
    expect(durumCipleri({ ...sy, stays: [{ count: 1 }] }, { ...d, atanmamis: 0 }).map((c) => c.anahtar)).toEqual(['planli']);
    expect(durumCipleri({ ...sy, stays: undefined, hotel_place_id: 'h' }, { ...d, atanmamis: 0 }).map((c) => c.anahtar)).toEqual(['planli']);
    expect(durumCipleri({ ...sy, start_date: null }, d)).toEqual([]);
    expect(durumCipleri(sy, undefined)).toEqual([]);
  });
  it('geri sayım: N GÜN SONRA / YARIN / BUGÜN · N. GÜN; tarihsizde yok', () => {
    expect(geriSayim(sy, new Date('2026-10-12T09:00:00Z'))).toBe('4 GÜN SONRA');
    expect(geriSayim(sy, new Date('2026-10-15T09:00:00Z'))).toBe('YARIN');
    expect(geriSayim(sy, new Date('2026-10-17T09:00:00Z'))).toBe('BUGÜN · 2. GÜN');
    expect(geriSayim({ ...sy, start_date: null }, new Date('2026-10-12T09:00:00Z'))).toBeNull();
  });
  it('kişi metni', () => {
    expect(kisiMetni(1)).toBe('sadece sen');
    expect(kisiMetni(3)).toBe('3 kişi');
  });
});
