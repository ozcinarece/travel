import { describe, expect, it } from '@jest/globals';

import { ayIzgarasi, ayKaydir, haftaGunu, kisaTarih, tarihAraligi, tarihEkle } from '@/lib/takvim';

describe('takvim', () => {
  it('gün ekler ve ay/yıl sınırını aşar', () => {
    expect(tarihEkle('2026-10-31', 1)).toBe('2026-11-01');
    expect(tarihEkle('2026-12-31', 1)).toBe('2027-01-01');
    expect(tarihEkle('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('hafta günü Pazartesi=0', () => {
    expect(haftaGunu('2026-10-12')).toBe(0); // Pazartesi
    expect(haftaGunu('2026-10-18')).toBe(6); // Pazar
  });

  it('ay ızgarası Pazartesi başlar, 7 katı hücre', () => {
    const ekim = ayIzgarasi(2026, 10); // 1 Ekim 2026 Perşembe
    expect(ekim.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(ekim.length % 7).toBe(0);
    expect(ekim.filter(Boolean).length).toBe(31);
  });

  it('ay kaydırma yıl döndürür', () => {
    expect(ayKaydir(2026, 12, 1)).toEqual({ yil: 2027, ay: 1 });
    expect(ayKaydir(2026, 1, -1)).toEqual({ yil: 2025, ay: 12 });
  });

  it('kısa tarih ve aralık metinleri', () => {
    expect(kisaTarih('2026-10-12')).toBe('12 Eki, Pzt');
    expect(tarihAraligi('2026-10-12', '2026-10-15')).toBe('12–15 Ekim');
    expect(tarihAraligi('2026-10-28', '2026-11-02')).toBe('28 Eki – 2 Kas');
    expect(tarihAraligi('2026-12-30', '2027-01-02')).toBe('30 Ara 2026 – 2 Oca 2027');
    expect(tarihAraligi('2026-10-12', '2026-10-12')).toBe('12 Ekim');
  });
});
