import { describe, expect, it } from '@jest/globals';

import { dakikaSaat, enYakinGun, kestirimYuruyusSn, tempoEtiketi, tempoHesapla } from '../tempo';

const otel = { lat: 41.9, lng: 12.5 };
// ~1,1 km kuzeyde ve ~1,1 km doğuda iki durak.
const a = { lat: 41.91, lng: 12.5 };
const b = { lat: 41.9, lng: 12.5134 };

describe('tempo', () => {
  it('kestirim: 1 km ≈ 17 dk', () => {
    const sn = kestirimYuruyusSn({ lat: 41.9, lng: 12.5 }, { lat: 41.909, lng: 12.5 });
    expect(sn / 60).toBeGreaterThan(16);
    expect(sn / 60).toBeLessThan(18.5);
  });

  it('etiket eşikleri §5.3', () => {
    expect(tempoEtiketi(0.59)).toBe('rahat');
    expect(tempoEtiketi(0.6)).toBe('normal');
    expect(tempoEtiketi(0.85)).toBe('normal');
    expect(tempoEtiketi(0.86)).toBe('yogun');
  });

  it('rahat gün: bitiş saati ve sığan durak sayısı', () => {
    const s = tempoHesapla({
      duraklar: [
        { id: 'a', konum: a, dakika: 90 },
        { id: 'b', konum: b, dakika: 60 },
      ],
      otel,
      baslangic: '09:00',
      bitis: '20:00',
    });
    expect(s.etiket).toBe('rahat');
    expect(s.geziDk).toBe(150);
    expect(s.yuruyusDk).toBeGreaterThan(50); // otel→a→b→otel ≈ 1,1+1,6+1,1 km ×1,3
    expect(s.bitis > '12:00' && s.bitis < '13:00').toBe(true);
    expect(s.sigar).toBeGreaterThanOrEqual(5);
    expect(s.sira).toHaveLength(2);
  });

  it('yoğun gün: en uzun durak', () => {
    const s = tempoHesapla({
      duraklar: [
        { id: 'a', konum: a, dakika: 240 },
        { id: 'b', konum: b, dakika: 360 },
      ],
      otel,
      baslangic: '09:00',
      bitis: '20:00',
    });
    expect(s.etiket).toBe('yogun');
    expect(s.enUzun).toEqual({ id: 'b', dakika: 360 });
    expect(s.sigar).toBe(0);
  });

  it('boş gün ve otelsiz gün', () => {
    const bos = tempoHesapla({ duraklar: [], otel, baslangic: '09:00', bitis: '20:00' });
    expect(bos.doluluk).toBe(0);
    expect(bos.bitis).toBe('09:00');
    const otelsiz = tempoHesapla({ duraklar: [{ id: 'a', konum: a, dakika: 60 }], otel: null, baslangic: '09:00', bitis: '20:00' });
    expect(otelsiz.yuruyusDk).toBe(0);
  });

  it('dakikaSaat gün sınırını sarar', () => {
    expect(dakikaSaat(9 * 60 + 5)).toBe('09:05');
    expect(dakikaSaat(25 * 60)).toBe('01:00');
  });

  it('enYakinGun boş günleri saymaz', () => {
    expect(enYakinGun(a, [{ id: 'g1', duraklar: [] }, { id: 'g2', duraklar: [b] }])).toBe('g2');
    expect(enYakinGun(a, [{ id: 'g1', duraklar: [] }])).toBeNull();
  });
});
