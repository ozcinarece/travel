import { describe, expect, it } from '@jest/globals';

import { aktifMi, gunSayisi, kacinciGun, yerelTarih, yerelAn } from '../zaman';

const roma = { start_date: '2026-10-12', end_date: '2026-10-15', tz: 'Europe/Rome' };

describe('yerelTarih', () => {
  it('seyahat diliminin takvim gününü verir, cihazınkini değil', () => {
    // 22:30 UTC: Roma'da ertesi gün 00:30, New York'ta aynı gün 18:30.
    const an = new Date('2026-10-11T22:30:00Z');
    expect(yerelTarih(an, 'Europe/Rome')).toBe('2026-10-12');
    expect(yerelTarih(an, 'America/New_York')).toBe('2026-10-11');
  });
});

describe('aktifMi', () => {
  it('ilk ve son gün dahil aktiftir', () => {
    expect(aktifMi(roma, new Date('2026-10-12T08:00:00Z'))).toBe(true);
    expect(aktifMi(roma, new Date('2026-10-15T20:00:00Z'))).toBe(true);
  });

  it('dönüşten sonraki gün Roma saatiyle başlayınca aktif değildir', () => {
    // 15 Ekim 22:30 UTC = 16 Ekim 00:30 Roma
    expect(aktifMi(roma, new Date('2026-10-15T22:30:00Z'))).toBe(false);
  });

  it('tarihsiz seyahat aktif olmaz', () => {
    expect(aktifMi({ start_date: null, end_date: null, tz: 'Europe/Rome' })).toBe(false);
  });
});

describe('gunSayisi', () => {
  it('iki uç dahil sayar', () => {
    expect(gunSayisi('2026-10-12', '2026-10-15')).toBe(4);
    expect(gunSayisi('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('yaz saati geçişinde kaymaz', () => {
    // Avrupa'da saatler 25 Ekim 2026'da geri alınır.
    expect(gunSayisi('2026-10-24', '2026-10-26')).toBe(3);
  });

  it('tarihsiz seyahat 1 günle başlar', () => {
    expect(gunSayisi(null, null)).toBe(1);
  });
});

describe('kacinciGun', () => {
  it('aktif seyahatte gün numarasını verir', () => {
    expect(kacinciGun(roma, new Date('2026-10-13T10:00:00Z'))).toBe(2);
  });

  it('aralık dışında null döner', () => {
    expect(kacinciGun(roma, new Date('2026-10-20T10:00:00Z'))).toBeNull();
  });
});

describe('yerelAn', () => {
  it('seyahat dilimindeki tarih + dakikayı UTC ana çevirir', () => {
    // Roma yaz saati (UTC+2): 2026-07-10 10:30 → 08:30Z.
    expect(yerelAn('2026-07-10', 630, 'Europe/Rome').toISOString()).toBe('2026-07-10T08:30:00.000Z');
    // İstanbul (UTC+3): 2026-10-05 00:10 → 04 Eki 21:10Z (gün sınırı).
    expect(yerelAn('2026-10-05', 10, 'Europe/Istanbul').toISOString()).toBe('2026-10-04T21:10:00.000Z');
    // Batı yarımküre: New York (UTC-4): 2026-10-05 23:50 → 06 Eki 03:50Z.
    expect(yerelAn('2026-10-05', 1430, 'America/New_York').toISOString()).toBe('2026-10-06T03:50:00.000Z');
  });
});
