import { describe, expect, it, jest } from '@jest/globals';

import type { SeyahatOzet } from '@/lib/tipler';

import { geziGunOzeti } from '../gezi';
import { ayniSehir, hedefSeyahatler, varsayilanHedef } from '../yerEkle';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('gezi gün özeti (#143 KK2)', () => {
  it('bacak süresi kuş uçuşu × 1,3 ÷ 4,5 km/sa; toplam = durak süreleri + yürüyüş', () => {
    // ~0,01° enlem ≈ 1112 m → 1446 m yürüyüş ≈ 19 dk.
    const o = geziGunOzeti([
      { lat: 39.76, lng: 30.52, sure_dk: 60 },
      { lat: 39.77, lng: 30.52, sure_dk: 45 },
      { lat: 39.77, lng: 30.52, sure_dk: 50 },
    ]);
    expect(o.bacakDk).toEqual([19, 1]);
    expect(o.toplamDk).toBe(60 + 45 + 50 + 19 + 1);
    expect(Math.round(o.yuruyusM)).toBe(1446);
  });
  it('tek durakta yürüyüş yok', () => {
    expect(geziGunOzeti([{ lat: 1, lng: 1, sure_dk: 30 }])).toEqual({ toplamDk: 30, yuruyusM: 0, bacakDk: [] });
  });
});

const sy = (id: string, city_label: string, start_date: string | null, end_date: string | null): SeyahatOzet =>
  ({ id, name: null, city_label, start_date, end_date, tz: 'Europe/Istanbul', hotel_place_id: null, created_at: '2026-01-01', members: [], places: [] }) as SeyahatOzet;

describe('hedef seyahat (#143 KK3)', () => {
  const an = new Date('2026-10-13T09:00:00Z');
  it('aynı şehir: etiketin ilk parçası, büyük-küçük harf duyarsız (tr)', () => {
    expect(ayniSehir('Eskişehir, Türkiye', 'Eskişehir')).toBe(true);
    expect(ayniSehir('ESKİŞEHİR', 'eskişehir')).toBe(true);
    expect(ayniSehir('İzmir', 'Eskişehir')).toBe(false);
  });
  it('aynı şehirdeki en yakın tarihli seyahat; o şehirde yoksa null', () => {
    jest.useFakeTimers().setSystemTime(an);
    const liste = [sy('uzak', 'Eskişehir', '2026-12-01', '2026-12-03'), sy('tarihsiz', 'Eskişehir', null, null), sy('yakin', 'Eskişehir', '2026-10-16', '2026-10-19'), sy('izmir', 'İzmir', '2026-10-14', '2026-10-15'), sy('gecmis', 'Eskişehir', '2026-09-01', '2026-09-02')];
    const adaylar = hedefSeyahatler(liste);
    expect(adaylar.map((s) => s.id)).toEqual(['izmir', 'yakin', 'uzak', 'tarihsiz']);
    expect(varsayilanHedef(adaylar, 'Eskişehir')?.id).toBe('yakin');
    expect(varsayilanHedef(adaylar, 'Bursa')).toBeNull();
    jest.useRealTimers();
  });
});
