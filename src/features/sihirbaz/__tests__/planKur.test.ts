import { describe, expect, it } from '@jest/globals';

import { bacakDk, bolgeler, durakDakikasi, enYakinKomsu, GUN_KAPASITESI_DK, gunDolulugu, gunEki, planKur, secimOzeti, type KonumluMekan } from '../planKur';

// Eskişehir: Odunpazarı kümesi (birbirine ~300–600 m) ve Sazova kümesi (~5 km batıda).
const m = (id: string, lat: number, lng: number, dakika = 60): KonumluMekan => ({ id, lat, lng, dakika });
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

  it('#665: gezme sırası günlere ardışık ve dengeli bölünür (5 mekan / 3 gün → 2-2-1); en kalabalık bölge önce', () => {
    // Kapasite 200 dk: Odunpazarı önce (en kalabalık bölge), kotası dolan gün atlanır; Sazova'ya geçiş araç bacağı.
    const p = planKur([...sazova, ...odunpazari], gunler, { kapasiteDk: 200 });
    expect(p.bolgeSayisi).toBe(2);
    expect(p.gunler.map((g) => g.mekanlar.length)).toEqual([2, 2, 1]);
    expect(p.gunler[0].mekanlar.map((x) => x.id).sort()).toEqual(['o1', 'o2']);
    expect(p.gunler[1].mekanlar.map((x) => x.id)).toEqual(['o3', 's2']);
    expect(p.gunler[2].mekanlar.map((x) => x.id)).toEqual(['s1']);
    expect(p.atanmamis).toEqual([]);
  });

  it('#665: tam günde (9 sa) bile tek güne yığılmaz; bölge geçişi araç sayılır (5 km yürüme 40 dk\'yı aşar)', () => {
    const p = planKur([...odunpazari, ...sazova], gunler);
    expect(p.gunler.map((g) => g.mekanlar.length)).toEqual([2, 2, 1]);
    expect(p.gunler.reduce((t, g) => t + g.ziyaretDk, 0)).toBe(390);
    p.gunler.forEach((g) => expect(g.ziyaretDk + g.yolDk).toBeLessThanOrEqual(GUN_KAPASITESI_DK));
    expect(p.gunler[1].arabaBacagi).toBe(1);
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
    // 1. gün 500 dk dolu: yeni mekan sığmaz; #665 kota 1. günü sayar, kalan 3 mekan 2. ve 3. güne bölünür (kota aşımı en az duraklıya).
    const mevcut = new Map([['g1', [m('x', 39.7637, 30.5243, 500)]]]);
    const p = planKur(odunpazari, gunler, { mevcut });
    expect(p.gunler[0].mekanlar).toHaveLength(0);
    expect(p.gunler[1].mekanlar.length + p.gunler[2].mekanlar.length).toBe(3);
    expect(p.gunler[2].mekanlar.length).toBeGreaterThanOrEqual(1);
    expect(p.atanmamis).toEqual([]);
  });

  it('hiçbir güne sığmayan mekan önceki günün kalan kapasitesini boşa harcatmaz', () => {
    // Her gün 8 saat dolu (mevcut); 10 saatlik mekan hiçbir güne sığmaz ve kota kapmaz; 30 dk'lık mekan 1. günün kalanına girer.
    const mevcut = new Map(gunler.map((g) => [g.id, [m(`dolu-${g.id}`, 39.7637, 30.5243, 480)]]));
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

  it('durak dakikası tam dakika (yuvarlama yok), 15–480', () => {
    expect(durakDakikasi(50)).toBe(50);
    expect(durakDakikasi(5)).toBe(15);
    expect(durakDakikasi(700)).toBe(480);
  });
});

// #401 (`Ekran07cIlOnerileri` A–B alt çubuğu): "2 günün 1,2'si dolu" ve gün çubukları.
describe('#401 gün doluluğu ve iyelik eki', () => {
  it('ek okunuşa göre çekimlenir', () => {
    expect(gunEki(1.2)).toBe("1,2'si");
    expect(gunEki(1.6)).toBe("1,6'sı");
    expect(gunEki(1)).toBe("1'i");
    expect(gunEki(0.5)).toBe("0,5'i");
    expect(gunEki(2)).toBe("2'si");
    expect(gunEki(3.3)).toBe("3,3'ü");
    expect(gunEki(0.9)).toBe("0,9'u");
    expect(gunEki(0)).toBe("0'ı");
    expect(gunEki(10)).toBe("10'u");
    expect(gunEki(20)).toBe("20'si");
    expect(gunEki(1.04)).toBe("1'i");
  });

  it('günler sırayla dolar; kapasite GUN_KAPASITESI_DK', () => {
    const tek = [{ id: 'a', lat: 39.76, lng: 30.52, dakika: GUN_KAPASITESI_DK * 1.2 }];
    expect(gunDolulugu(tek, 2)).toEqual({ dolu: 1.2, cubuklar: [1, expect.closeTo(0.2, 5)] });
    expect(gunDolulugu([], 2)).toEqual({ dolu: 0, cubuklar: [0, 0] });
    expect(gunDolulugu(tek, 0).cubuklar).toEqual([]);
  });
});
