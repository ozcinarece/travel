// #569 ana sayfa v9 saf kuralları: kart kümesi ve ölçüsü (KK2), kalan gün `trips.tz` ile (KK3), "Bugün N. gün" ve Sıradaki
// metni (KK4), kapak sırası (KK2) ve yedek görsel (KK5), yüzler.
import { describe, expect, it, jest } from '@jest/globals';

import { siniflandir } from '@/features/seyahatler/siniflandir';
import type { SeyahatOzet } from '@/lib/tipler';

import { bugunSatiri, geziOncesiAlt, gorunenKart, kartGenisligi, kartSeyahatleri, kartYuzleri, seyahatKapagi, siradakiMetni, yedekKapak } from '../v9';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const uye = (user_id: string, display_name: string) => ({ user_id, role: 'member' as const, display_name, guest: false });
const sy = (id: string, start: string | null, end: string | null, tz = 'Europe/Istanbul', city_label = id): SeyahatOzet => ({
  id,
  name: null,
  city_label,
  start_date: start,
  end_date: end,
  tz,
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [uye('ben', 'Ece'), uye('m', 'Mert')],
  places: [{ count: 0 }],
});

describe('KK2 kart kümesi ve ölçüsü', () => {
  it('süren seyahat önce, sonra yaklaşan ve tarihsiz; biten yok', () => {
    const an = new Date('2026-11-27T10:00:00Z');
    const liste = [sy('uzak', '2026-12-20', '2026-12-22'), sy('biten', '2026-11-20', '2026-11-22'), sy('taslak', null, null), sy('yakin', '2026-11-30', '2026-12-01'), sy('suren', '2026-11-26', '2026-11-28')];
    expect(kartSeyahatleri(siniflandir(liste, an)).map((s) => s.id)).toEqual(['suren', 'yakin', 'uzak', 'taslak']);
  });

  it('tek kartta tam genişlik, birden çokta sıradakinin ucu (390 pt: 358 / 318); görünen kart kaydırmadan', () => {
    expect(kartGenisligi(390, 1)).toBe(358);
    expect(kartGenisligi(390, 2)).toBe(318);
    expect(gorunenKart(0, 318, 3)).toBe(0);
    expect(gorunenKart(328, 318, 3)).toBe(1);
    expect(gorunenKart(5000, 318, 3)).toBe(2);
    expect(gorunenKart(400, 358, 1)).toBe(0);
  });
});

describe('KK3 · KK4 satırlar (trips.tz)', () => {
  it('"N gün kaldı · K kişi" seyahatin diliminde; başlangıç günü "Bugün"; tarihsizde yalnız kişi', () => {
    // 27 Kasım 23:30 UTC: İstanbul'da 28 Kasım, Los Angeles'ta 27 Kasım.
    const an = new Date('2026-11-27T23:30:00Z');
    expect(geziOncesiAlt(sy('a', '2026-11-30', '2026-12-01'), an)).toBe('2 gün kaldı · 2 kişi');
    expect(geziOncesiAlt(sy('a', '2026-11-30', '2026-12-01', 'America/Los_Angeles'), an)).toBe('3 gün kaldı · 2 kişi');
    expect(geziOncesiAlt(sy('a', '2026-11-28', '2026-12-01'), an)).toBe('Bugün · 2 kişi');
    expect(geziOncesiAlt(sy('a', null, null), an)).toBe('2 kişi');
  });

  it('"Bugün N. gün" yalnız süren seyahatte; dilim seyahatin', () => {
    const an = new Date('2026-11-27T23:30:00Z');
    expect(bugunSatiri(sy('a', '2026-11-26', '2026-11-29'), an)).toBe('Bugün 3. gün');
    expect(bugunSatiri(sy('a', '2026-11-26', '2026-11-29', 'America/Los_Angeles'), an)).toBe('Bugün 2. gün');
    expect(bugunSatiri(sy('a', '2026-11-30', '2026-12-01'), an)).toBeNull();
  });

  it('Sıradaki: saat varsa "durak · saat", yoksa yalnız durak', () => {
    expect(siradakiMetni('Uçhisar Kalesi', '14:30')).toBe('Sıradaki: Uçhisar Kalesi · 14:30');
    expect(siradakiMetni('Müze', null)).toBe('Sıradaki: Müze');
  });

  it('yüzler: ben önce, en çok 3, adsız üye yok', () => {
    const uyeler = [uye('m', 'Mert'), uye('x', '  '), uye('ben', 'Ece'), uye('a', 'Ayşe'), uye('z', 'Zeynep')];
    expect(kartYuzleri(uyeler, 'ben').map((y) => y.ad)).toEqual(['Ece', 'Mert', 'Ayşe']);
  });
});

describe('KK2 · KK5 kapak', () => {
  const sehirler = [
    { id: 's1', ad: 'Eskişehir', slug: 'eskisehir', lat: 39.7767, lng: 30.5206, kapak_url: 'https://x/esk.jpg', kapak_atif: { yazar: 'Ali', lisans: 'CC BY 4.0' } },
    { id: 's2', ad: 'İzmir', slug: 'izmir', lat: 38.42, lng: 27.14, kapak_url: null, kapak_atif: null },
    { id: 's3', ad: 'İstanbul', slug: 'istanbul', lat: 41.01, lng: 28.98, kapak_url: 'https://x/ist.jpg', kapak_atif: null },
    { id: 's4', ad: 'Nevşehir', slug: 'nevsehir', lat: 38.62, lng: 34.71, kapak_url: 'https://x/nev.jpg', kapak_atif: null },
  ];
  it('seyahatin kendi kapağı önce; yoksa şehrin BO kapağı (ad, Türkçe küçük harf); ikisi de yoksa null', () => {
    expect(seyahatKapagi({ city_label: 'Eskişehir', kapak_url: 'https://x/kendi.jpg', kapak_atif: { yazar: 'Tripmate' } }, sehirler)).toEqual({ url: 'https://x/kendi.jpg', atif: { yazar: 'Tripmate', lisans: null, kaynak_url: null } });
    expect(seyahatKapagi({ city_label: 'ESKİŞEHİR' }, sehirler)?.url).toBe('https://x/esk.jpg');
    expect(seyahatKapagi({ city_label: 'İzmir' }, sehirler)).toBeNull();
    expect(seyahatKapagi({ city_label: 'Van' }, sehirler)).toBeNull();
    expect(seyahatKapagi({ city_label: 'Eskişehir' }, undefined)).toBeNull();
  });

  it('sehirEslestir yedeği: aksansız ad ("Istanbul", "Eskisehir") ve merkeze 25 km ("Kapadokya" → Nevşehir)', () => {
    expect(seyahatKapagi({ city_label: 'Istanbul' }, sehirler)?.url).toBe('https://x/ist.jpg');
    expect(seyahatKapagi({ city_label: 'Eskisehir', lat: null, lng: null }, sehirler)?.url).toBe('https://x/esk.jpg');
    expect(seyahatKapagi({ city_label: 'Kapadokya', lat: 38.64, lng: 34.83 }, sehirler)?.url).toBe('https://x/nev.jpg');
    expect(seyahatKapagi({ city_label: 'Kapadokya', lat: null, lng: null }, sehirler)).toBeNull();
  });

  it('gezisi olmayan kartın yedeği Eskişehir kapağı', () => {
    expect(yedekKapak(sehirler)).toEqual({ url: 'https://x/esk.jpg', atif: { yazar: 'Ali', lisans: 'CC BY 4.0', kaynak_url: null } });
    expect(yedekKapak([])).toBeNull();
  });
});
