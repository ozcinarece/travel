// #318 inceleme 4: seyahat merkezi boşsa harita Türkiye ortasında açılmasın; Tekrar kur null merkezle seyahat doğurmasın.
import { describe, expect, it, jest } from '@jest/globals';

import { haritaMerkezi, YEDEK_MERKEZ, YEDEK_ZOOM, yedekMerkezMi } from '@/lib/konum';
import { tekrarSehri } from '@/features/sihirbaz/girisler';

import { canliMerkezGerekli, seyahatMerkeziSec } from '../merkez';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('#318 inceleme 4: seyahat merkezi', () => {
  it('kayıtlı merkez varsa o kullanılır, canlı istek gerekmez', () => {
    const s = { lat: 40.18, lng: 29.06, city_place_id: 'c1' };
    expect(canliMerkezGerekli(s)).toBe(false);
    expect(seyahatMerkeziSec(s, { lat: 1, lng: 2 })).toEqual({ lat: 40.18, lng: 29.06 });
  });

  it('merkez boşsa şehir kimliğinden canlı konum kullanılır', () => {
    const s = { lat: null, lng: null, city_place_id: 'c1' };
    expect(canliMerkezGerekli(s)).toBe(true);
    expect(seyahatMerkeziSec(s, null)).toBeNull();
    expect(seyahatMerkeziSec(s, { lat: 38.42, lng: 27.14 })).toEqual({ lat: 38.42, lng: 27.14 });
  });

  it('şehir kimliği yoksa canlı istek gitmez', () => {
    expect(canliMerkezGerekli({ lat: null, lng: null, city_place_id: null })).toBe(false);
  });

  it('hiç koordinat yoksa yedek merkez ülke ölçeğinde (zoom ≈ 5) açılır', () => {
    const m = haritaMerkezi(null, { lat: null, lng: null });
    expect(m).toEqual(YEDEK_MERKEZ);
    expect(yedekMerkezMi(m)).toBe(true);
    expect(YEDEK_ZOOM).toBe(5);
    expect(yedekMerkezMi(haritaMerkezi({ lat: 40.18, lng: 29.06 }))).toBe(false);
  });

  it('Tekrar kur: kaynağın merkezi boşsa seçim null döner (şehir Google kimliğinden yeniden seçilir)', () => {
    const satir = { city_place_id: 'c1', city_label: 'Bursa', country_code: 'TR', tz: 'Europe/Istanbul' };
    expect(tekrarSehri({ ...satir, lat: null, lng: null })).toBeNull();
    expect(tekrarSehri({ ...satir, lat: 40.18, lng: 29.06 })).toEqual({ place_id: 'c1', ad: 'Bursa', ikincil: '', lat: 40.18, lng: 29.06, tz: 'Europe/Istanbul', country_code: 'TR' });
  });
});
