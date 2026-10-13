import { describe, expect, it } from '@jest/globals';

import { bacakDk, bolgeler, durakDakikasi, enYakinKomsu, GUN_KAPASITESI_DK, planKur, secimOzeti, type PlanMekani } from '../planKur';

// Eskişehir: Odunpazarı kümesi (birbirine ~300–600 m) ve Sazova kümesi (~5 km batıda).
const m = (id: string, lat: number, lng: number, dakika = 60): PlanMekani => ({ id, lat, lng, dakika });
const odunpazari = [m('o1', 39.7637, 30.5243), m('o2', 39.7660, 30.5260), m('o3', 39.7620, 30.5280)];
const sazova = [m('s1', 39.7700, 30.4600, 120), m('s2', 39.7715, 30.4630, 90)];
const gunler = [
  { id: 'g1', index: 1 },
  { id: 'g2', index: 2 },
  { id: 'g3', index: 3 },
];

describe('planKur (#139 KK5)', () => {
  it('yakın mekanlar aynı bölgede; 5 km ötesi ayrı bölge', () => {
    const b = bolgeler([...odunpazari, ...sazova]);
    expect(b).toHaveLength(2);
    expect(b.map((g) => g.map((x) => x.id).sort())).toEqual([['o1', 'o2', 'o3'], ['s1', 's2']]);
  });

  it('bacak: kısa yürüme kesirli dakika (yuvarlama yok); 40 dk üstü araç tahmini', () => {
    const kisa = bacakDk(odunpazari[0], odunpazari[1]);
    expect(kisa.araba).toBe(false);
    expect(kisa.dk).toBeGreaterThan(0);
    expect(Number.isInteger(kisa.dk)).toBe(false);
    expect(bacakDk(odunpazari[0], { lat: 39.9, lng: 30.6 }).araba).toBe(true);
  });

  it('günler sırayla dolar: ilk bölge 1. güne, sığmayan kalan ertesi güne; boş günler boş kalır', () => {
    // Kapasite 200 dk: Odunpazarı 3 × 60 + yürüme ≈ 190 → 1. gün; Sazova 90 + 120 + yol 2. güne sığmaz → Odunpazarı'na yakın s2 2. gün, s1 3. gün.
    const p = planKur([...sazova, ...odunpazari], gunler, { kapasiteDk: 200 });
    expect(p.bolgeSayisi).toBe(2);
    expect(p.gunler[0].mekanlar.map((x) => x.id).sort()).toEqual(['o1', 'o2', 'o3']);
    expect(p.gunler[1].mekanlar.map((x) => x.id)).toEqual(['s2']);
    expect(p.gunler[2].mekanlar.map((x) => x.id)).toEqual(['s1']);
    expect(p.atanmamis).toEqual([]);
  });

  it('tam günde (9 sa) hepsi 1. güne; bölge geçişi araç sayılmaz (5 km yürüme < 40 dk değil → araç)', () => {
    const p = planKur([...odunpazari, ...sazova], gunler);
    expect(p.gunler[0].mekanlar).toHaveLength(5);
    expect(p.gunler[0].ziyaretDk).toBe(390);
    expect(p.gunler[0].ziyaretDk + p.gunler[0].yolDk).toBeLessThanOrEqual(GUN_KAPASITESI_DK);
    expect(p.gunler[0].arabaBacagi).toBe(1);
    expect(p.gunler[1].mekanlar).toHaveLength(0);
  });

  it('günler biterse kalanlar atanmamış; tek başına güne sığmayan mekan atanmamış', () => {
    const p = planKur([...odunpazari, ...sazova], [{ id: 'g1', index: 1 }], { kapasiteDk: 200 });
    expect(p.gunler[0].mekanlar).toHaveLength(3);
    expect(p.atanmamis.map((x) => x.id).sort()).toEqual(['s1', 's2']);
    const dev = planKur([m('uzun', 39.76, 30.52, 600), ...odunpazari], [{ id: 'g1', index: 1 }]);
    expect(dev.atanmamis.map((x) => x.id)).toEqual(['uzun']);
    expect(dev.gunler[0].mekanlar).toHaveLength(3);
  });

  it('mevcut duraklar kapasiteyi doldurur; yeni mekanlar arkalarına eklenir (#141 Günlere dağıt)', () => {
    const mevcut = new Map([['g1', [m('x', 39.7637, 30.5243, 500)]]]);
    const p = planKur(odunpazari, gunler, { mevcut });
    expect(p.gunler[0].mekanlar).toHaveLength(0);
    expect(p.gunler[1].mekanlar).toHaveLength(3);
  });

  it('hiçbir güne sığmayan mekan önceki günün kalan kapasitesini boşa harcatmaz', () => {
    // 1. gün 8 saat dolu (mevcut); 10 saatlik mekan hiçbir güne sığmaz; ardından gelen 30 dk'lık mekan 1. günün kalanına girer.
    const mevcut = new Map([['g1', [m('dolu', 39.7637, 30.5243, 480)]]]);
    const p = planKur([m('dev', 39.7637, 30.5243, 600), m('kucuk', 39.7638, 30.5244, 30)], gunler, { mevcut });
    expect(p.atanmamis.map((x) => x.id)).toEqual(['dev']);
    expect(p.gunler[0].mekanlar.map((x) => x.id)).toEqual(['kucuk']);
  });

  it('en yakın komşu: başlangıçtan en yakına; başlangıç yoksa en batıdan', () => {
    expect(enYakinKomsu(odunpazari, { lat: 39.7621, lng: 30.5281 })[0].id).toBe('o3');
    expect(enYakinKomsu([...odunpazari, ...sazova], null)[0].id).toBe('s1');
  });

  it('seçim özeti: N mekan · K bölge · ~S saat (en az 1)', () => {
    expect(secimOzeti([])).toEqual({ mekan: 0, bolge: 0, saat: 0 });
    const o = secimOzeti([...odunpazari, ...sazova]);
    expect(o.mekan).toBe(5);
    expect(o.bolge).toBe(2);
    expect(o.saat).toBeGreaterThanOrEqual(7);
    expect(secimOzeti([m('k', 39.7, 30.5, 15)]).saat).toBe(1);
  });

  it('durak dakikası 15 katı, 15–480', () => {
    expect(durakDakikasi(50)).toBe(45);
    expect(durakDakikasi(5)).toBe(15);
    expect(durakDakikasi(700)).toBe(480);
  });
});
