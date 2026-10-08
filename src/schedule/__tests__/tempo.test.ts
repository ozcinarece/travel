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

describe('tempo #33 taksi bacağı', () => {
  const otel = { lat: 41.9, lng: 12.5 };
  const yakin = { lat: 41.905, lng: 12.5 }; // ~550 m
  const uzak = { lat: 41.95, lng: 12.5 }; // ~5,5 km → yürüyüş > 40 dk
  it('40 dk üstü bacak taksi sayılır; kestirimde bayrak kalkar', () => {
    const s = tempoHesapla({ duraklar: [{ id: 'u', konum: uzak, dakika: 60 }], otel, baslangic: '09:00', bitis: '20:00' });
    expect(s.taksiDk).toBeGreaterThan(10);
    expect(s.yuruyusDk).toBe(0);
    expect(s.kestirim).toBe(true);
  });
  it('gerçek matris: yürüyüş ve taksi ayrı toplanır, verilen sıra korunur', () => {
    const bacak = (a: { lat: number }, b: { lat: number }) => {
      const uzakMi = Math.abs(a.lat - b.lat) > 0.02;
      return uzakMi ? { yuruyusSn: 70 * 60, taksiSn: 9 * 60, kestirim: false } : { yuruyusSn: 8 * 60, taksiSn: null, kestirim: false };
    };
    const s = tempoHesapla({
      duraklar: [
        { id: 'y', konum: yakin, dakika: 60 },
        { id: 'u', konum: uzak, dakika: 60 },
      ],
      otel,
      baslangic: '09:00',
      bitis: '20:00',
      bacak,
      sira: ['u', 'y'],
    });
    expect(s.sira).toEqual(['u', 'y']);
    // otel→u taksi 9, u→y taksi 9, y→otel yürüyüş 8
    expect(s.taksiDk).toBe(18);
    expect(s.yuruyusDk).toBe(8);
    expect(s.kestirim).toBe(false);
    expect(s.bitis).toBe('11:26');
  });
});

// #56 gün bazlı otel: kestirimle (kuş uçuşu) ayrı bitiş noktası.
describe('tempo #56 bitiş noktası', () => {
  const otel = { lat: 41.9, lng: 12.5 };
  const a = { lat: 41.905, lng: 12.5 };
  it('#56 taşınma günü: bitiş başka otel; yürüyüş son durak → yeni otel bacağını içerir', () => {
    const uzak = { lat: otel.lat + 0.02, lng: otel.lng };
    const ortak = { duraklar: [{ id: 'a', konum: a, dakika: 60 }], otel, baslangic: '09:00', bitis: '20:00' };
    const donus = tempoHesapla(ortak);
    const tasinma = tempoHesapla({ ...ortak, bitisOtel: uzak });
    expect(tasinma.yuruyusDk + tasinma.taksiDk).toBeGreaterThan(donus.yuruyusDk + donus.taksiDk);
    const sonDurakta = tempoHesapla({ ...ortak, bitisOtel: null });
    expect(sonDurakta.yuruyusDk).toBeLessThan(donus.yuruyusDk);
  });
});
