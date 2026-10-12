import { describe, expect, it } from '@jest/globals';

import type { Gun } from '@/lib/tipler';

import { gecePlani, geceler, gunFarki, oncekiAdim, seyahatAdi, seyahatAdiOner, sonrakiAdim, tarihDokun, tarihOzeti } from '../sihirbaz';

const gun = (index: number, date: string | null, start: string | null = null, end: string | null = null): Gun =>
  ({ id: `g${index}`, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: start, end_stay_id: end }) as Gun;

describe('sihirbaz adımları ve ad (#98 KK1–2)', () => {
  it('adım sırası ileri/geri', () => {
    expect(sonrakiAdim('nereye')).toBe('nezaman');
    expect(sonrakiAdim('onerilenler')).toBeNull();
    expect(oncekiAdim('nereye')).toBeNull();
    expect(oncekiAdim('oteller')).toBe('nezaman');
  });
  it('seyahat adı: "{Şehir} Gezisi", iki şehirde "A – B Gezisi"; ekranda yazılan ad > şehir etiketi', () => {
    expect(seyahatAdiOner(['Eskişehir'])).toBe('Eskişehir Gezisi');
    expect(seyahatAdiOner(['Eskişehir', 'Bursa'])).toBe('Eskişehir – Bursa Gezisi');
    expect(seyahatAdiOner([])).toBe('');
    expect(seyahatAdi({ name: null, city_label: 'Roma' })).toBe('Roma');
    expect(seyahatAdi({ name: '  Balayı ', city_label: 'Roma' })).toBe('Balayı');
  });
});

describe('takvim aralığı (#98 KK3)', () => {
  it('iki dokunuş = aralık; önceye dokununca gidiş yeniden başlar; aynı güne iki kez = tek gün', () => {
    const a = tarihDokun(null, '2026-10-16');
    expect(a).toEqual({ gidis: '2026-10-16', donus: null });
    expect(tarihDokun(a, '2026-10-19')).toEqual({ gidis: '2026-10-16', donus: '2026-10-19' });
    expect(tarihDokun(a, '2026-10-10')).toEqual({ gidis: '2026-10-10', donus: null });
    expect(tarihDokun(a, '2026-10-16')).toEqual({ gidis: '2026-10-16', donus: '2026-10-16' });
    expect(tarihDokun({ gidis: '2026-10-16', donus: '2026-10-19' }, '2026-10-20')).toEqual({ gidis: '2026-10-20', donus: null });
  });
  it('özet: "16 – 19 Ekim · 4 gün · 3 gece"; ay geçişi; tek gün', () => {
    expect(tarihOzeti({ gidis: '2026-10-16', donus: '2026-10-19' })).toBe('16 – 19 Ekim · 4 gün · 3 gece');
    expect(tarihOzeti({ gidis: '2026-10-30', donus: '2026-11-02' })).toBe('30 Ekim – 2 Kasım · 4 gün · 3 gece');
    expect(tarihOzeti({ gidis: '2026-10-16', donus: '2026-10-16' })).toBe('16 Ekim · 1 gün');
    expect(tarihOzeti({ gidis: '2026-10-16', donus: null })).toBe('16 Ekim · 1 gün');
    expect(tarihOzeti(null)).toBe('');
    expect(gunFarki('2026-10-16', '2026-10-19')).toBe(3);
  });
});

describe('geceler ve gece oteli (#98 KK4)', () => {
  const gunler = [gun(1, '2026-10-16'), gun(2, '2026-10-17'), gun(3, '2026-10-18'), gun(4, '2026-10-19')];
  it('4 gün = 3 gece, etiket "Cum 16 → Cmt 17"; tarihsiz "1. gece"; tek gün 1 gece', () => {
    const g = geceler(gunler);
    expect(g.map((x) => x.etiket)).toEqual(['Cum 16 → Cmt 17', 'Cmt 17 → Paz 18', 'Paz 18 → Pzt 19']);
    expect(geceler([gun(1, null), gun(2, null)]).map((x) => x.etiket)).toEqual(['1. gece']);
    expect(geceler([gun(1, null)])).toHaveLength(1);
    expect(geceler([])).toEqual([]);
  });
  it('geceye otel: akşam gününün bitişi + sabah gününün başlangıcı (ve dönüşse bitişi); tek günde her ikisi', () => {
    const g = geceler(gunler);
    expect(gecePlani(g[0], 'S1')).toEqual([
      { id: 'g1', start_stay_id: null, end_stay_id: 'S1' },
      { id: 'g2', start_stay_id: 'S1', end_stay_id: 'S1' },
    ]);
    // Sabah gününün bitişi başka otelse (taşınma) korunur.
    const tasinma = geceler([gun(1, '2026-10-16'), gun(2, '2026-10-17', 'S0', 'S9')]);
    expect(gecePlani(tasinma[0], 'S1')[1]).toEqual({ id: 'g2', start_stay_id: 'S1', end_stay_id: 'S9' });
    expect(gecePlani(geceler([gun(1, null)])[0], 'S1')).toEqual([{ id: 'g1', start_stay_id: 'S1', end_stay_id: 'S1' }]);
    expect(gecePlani(g[2], null)).toEqual([
      { id: 'g3', start_stay_id: null, end_stay_id: null },
      { id: 'g4', start_stay_id: null, end_stay_id: null },
    ]);
  });
});
