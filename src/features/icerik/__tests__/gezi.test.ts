import { describe, expect, it, jest } from '@jest/globals';

import type { SeyahatOzet } from '@/lib/tipler';

import { geziGunCizgileri, geziGunOzeti } from '../gezi';
import { rotaHaritasi, type GeziRotaBacagi } from '../geziRota';
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
    expect(geziGunOzeti([{ lat: 1, lng: 1, sure_dk: 30 }])).toEqual({ toplamDk: 30, yuruyusM: 0, bacakDk: [], bacakMod: [], kestirim: false });
  });
  it('kestirimde özet "~" ile (kestirim: true)', () => {
    expect(geziGunOzeti([{ lat: 39.76, lng: 30.52, sure_dk: 60 }, { lat: 39.77, lng: 30.52, sure_dk: 45 }]).kestirim).toBe(true);
  });
});

// #192: gerçek yol (gezi_rota_onbellek) varsa süre / mesafe / çizgi ondan.
const A = { id: 'A', lat: 39.76, lng: 30.52, sure_dk: 60 };
const B = { id: 'B', lat: 39.765, lng: 30.52, sure_dk: 45 };
const C = { id: 'C', lat: 39.8, lng: 30.6, sure_dk: 30 };
const bacak = (kimden: string, kime: string, ek: Partial<GeziRotaBacagi> = {}): GeziRotaBacagi => ({
  kimden_durak_id: kimden,
  kime_durak_id: kime,
  mod: 'WALK',
  polyline: kodla([
    { lat: 39.76, lng: 30.52 },
    { lat: 39.7625, lng: 30.5205 },
    { lat: 39.765, lng: 30.52 },
  ]),
  saniye: 840,
  metre: 980,
  arac_saniye: null,
  arac_metre: null,
  arac_polyline: null,
  fetched_at: '2026-10-14T08:00:00Z',
  ...ek,
});

describe('gezi gerçek yol (#192 KK3–KK4)', () => {
  it('gerçek süreler: yürüyüş saniyesi, 40 dk\'yı aşan bacak araç süresiyle; yürüyüş mesafesi yalnız yürünen bacaklardan; "~" yok', () => {
    const rotalar = rotaHaritasi([bacak('A', 'B'), bacak('B', 'C', { mod: 'DRIVE', saniye: 3000, metre: 4200, arac_saniye: 600, arac_metre: 5100 })]);
    const o = geziGunOzeti([A, B, C], rotalar);
    expect(o.bacakDk).toEqual([14, 10]);
    expect(o.bacakMod).toEqual(['WALK', 'DRIVE']);
    expect(o.yuruyusM).toBe(980);
    expect(o.toplamDk).toBe(60 + 45 + 30 + 14 + 10);
    expect(o.kestirim).toBe(false);
  });
  it('bir bacak eksikse o bacak kestirimde, özet "~" ile', () => {
    const o = geziGunOzeti([A, B, C], rotaHaritasi([bacak('A', 'B')]));
    expect(o.bacakDk[0]).toBe(14);
    expect(o.kestirim).toBe(true);
    expect(o.yuruyusM).toBeGreaterThan(980);
  });
  it('çizgiler: gerçek yürüyüş yolu düz; araç bacağı kesik; yolu olmayan bacak ince kesik kuş uçuşu; kimlik bacak bazlı', () => {
    const bos = geziGunCizgileri([A, B, C], 0);
    expect(bos.map((c) => [c.id, c.kesik, c.ince, c.noktalar.length])).toEqual([
      ['gc:A>B', true, true, 2],
      ['gc:B>C', true, true, 2],
    ]);
    const rotalar = rotaHaritasi([bacak('A', 'B'), bacak('B', 'C', { mod: 'DRIVE', saniye: 3000, arac_saniye: 600 })]);
    const [ab, bc] = geziGunCizgileri([A, B, C], 0, rotalar);
    expect(ab.id).toBe('gc:A>B');
    expect(ab.noktalar.length).toBe(3);
    expect(ab.kesik).toBeFalsy();
    expect(ab.ince).toBeFalsy();
    expect(bc).toEqual(expect.objectContaining({ id: 'gc:B>C', kesik: true, arac: true }));
    expect(bc.ince).toBeFalsy();
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

/** Test yardımcısı: Google kodlu polyline (hassasiyet 1e-5). */
function kodla(noktalar: { lat: number; lng: number }[]): string {
  let s = '';
  let lat = 0;
  let lng = 0;
  const sayi = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let c = '';
    while (n >= 0x20) {
      c += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return c + String.fromCharCode(n + 63);
  };
  for (const p of noktalar) {
    const la = Math.round(p.lat * 1e5);
    const ln = Math.round(p.lng * 1e5);
    s += sayi(la - lat) + sayi(ln - lng);
    lat = la;
    lng = ln;
  }
  return s;
}
