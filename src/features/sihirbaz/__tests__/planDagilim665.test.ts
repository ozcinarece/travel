// #665: "Planı kur" mekanları günlere dengeli dağıtır — 4 günlük gezide 7 durağın 6'sı 1. güne yığılmaz.
import { describe, expect, it } from '@jest/globals';

import { bolgeler, planKur, type KonumluMekan, type PlanGunu, type PlanSonucu } from '../planKur';

const m = (id: string, lat: number, lng: number, dakika = 60, ek: Partial<KonumluMekan> = {}): KonumluMekan => ({ id, lat, lng, dakika, ...ek });
const sayilar = (p: PlanSonucu) => p.gunler.map((g) => g.mekanlar.length);
const fark = (p: PlanSonucu) => Math.max(...sayilar(p)) - Math.min(...sayilar(p));
const gunler = (n: number, haftaGunleri?: number[]): PlanGunu[] =>
  Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, index: i + 1, ...(haftaGunleri ? { haftaGunu: haftaGunleri[i] } : {}) }));

// Kütahya merkez (birbirine yürüme mesafesi, tek bölge) + ~50 km ötede Aizanoi. 7–10 Ocak: Per, Cum, Cmt, Paz (Google: 4, 5, 6, 0).
const merkez = [
  m('kale', 39.4167, 29.9811, 60),
  m('ulucami', 39.4186, 29.9838, 45),
  m('cini', 39.4183, 29.9842, 60),
  m('kossuth', 39.4171, 29.9825, 45),
  m('germiyan', 39.416, 29.98, 60),
  m('arkeoloji', 39.4189, 29.9846, 60),
];
const aizanoi = m('aizanoi', 39.2, 29.61, 90);
const PER_PAZ = [4, 5, 6, 0];

describe('#665 KK2 günlere dengeli dağıtım', () => {
  it('Kütahya: 7 durak / 4 gün — boş gün yok, günler 1–2 durak, merkez kümesi günlere bölünür', () => {
    expect(bolgeler(merkez)).toHaveLength(1);
    const p = planKur([...merkez, aizanoi], gunler(4, PER_PAZ));
    expect(p.atanmamis).toEqual([]);
    expect(sayilar(p).every((n) => n >= 1 && n <= 2)).toBe(true);
    expect(sayilar(p).reduce((t, n) => t + n, 0)).toBe(7);
    // Merkezin 6 durağı tek güne yığılmaz.
    expect(p.gunler.filter((g) => g.mekanlar.some((x) => x.id !== 'aizanoi')).length).toBeGreaterThanOrEqual(3);
  });

  it('10 durak / 3 gün — günler 4-3-3 (fark ≤ 2), boş gün yok', () => {
    const on = Array.from({ length: 10 }, (_, i) => m(`d${i}`, 39.76 + i * 0.03, 30.52, 45));
    const p = planKur(on, gunler(3));
    expect(p.atanmamis).toEqual([]);
    expect(sayilar(p)).toEqual([4, 3, 3]);
    expect(fark(p)).toBeLessThanOrEqual(2);
  });

  it('tek küme 5 durak / 2 gün — 3 + 2, küme iki güne bölünür', () => {
    const kume = merkez.slice(0, 5);
    expect(bolgeler(kume)).toHaveLength(1);
    const p = planKur(kume, gunler(2));
    expect(p.atanmamis).toEqual([]);
    expect(sayilar(p).sort()).toEqual([2, 3]);
  });

  it('gezme sırası korunur: aynı küme ardışık günlerde, gün içi en yakın komşu', () => {
    const p = planKur([...merkez, aizanoi], gunler(4));
    // Aizanoi kendi bölgesi; merkez kümesinin durakları arasına girmez (ilk ya da son gün).
    const aGunu = p.gunler.findIndex((g) => g.mekanlar.some((x) => x.id === 'aizanoi'));
    expect([0, 3]).toContain(aGunu);
  });

  it('kapalı gün kuralı dengeyi kırarsa kural öncelikli: Cuma kapalı mekan Cuma\'ya konmaz, yine de boş gün kalmaz', () => {
    const cumaKapali = merkez.map((x) => ({ ...x, kapaliGunler: [5] }));
    const p = planKur([...cumaKapali, aizanoi], gunler(4, PER_PAZ));
    expect(p.atanmamis).toEqual([]);
    // Cuma'ya yalnız Aizanoi girebilir.
    expect(p.gunler[1].mekanlar.map((x) => x.id)).toEqual(['aizanoi']);
    expect(sayilar(p).every((n) => n >= 1)).toBe(true);
  });

  it('her mekan her gün kapalıysa o gün boş kalır (kural engeli)', () => {
    const p = planKur(merkez.slice(0, 2).map((x) => ({ ...x, kapaliGunler: [5] })), gunler(2, [4, 5]));
    expect(sayilar(p)).toEqual([2, 0]);
  });

  it('günde mevcut durak varsa dengeye sayılır (#141 Günlere dağıt): yeni mekanlar boş günlere', () => {
    const mevcut = new Map([['g1', [m('x1', 39.4167, 29.9811), m('x2', 39.4186, 29.9838)]]]);
    const p = planKur(merkez.slice(0, 2), gunler(3), { mevcut });
    expect(sayilar(p)).toEqual([0, 1, 1]);
  });

  it('kota yalnız girebilecek mekanları sayar: her gün kapalı mekan atanmamış, kalan 3 mekan 1-1-1', () => {
    const hepKapali = { ...aizanoi, kapaliGunler: [4, 5, 6] };
    const p = planKur([...merkez.slice(0, 3), hepKapali], gunler(3, [4, 5, 6]));
    expect(sayilar(p)).toEqual([1, 1, 1]);
    expect(p.atanmamis.map((x) => x.id)).toEqual(['aizanoi']);
  });

  it('gün sınırı bölge sınırına kayar: iki uzak bölge 3 + 3 / 4 gün → [a1,a2][a3][b1,b2][b3]', () => {
    const a = merkez.slice(0, 3).map((x) => ({ ...x, dakika: 90 }));
    const b = [m('b1', 39.2, 29.61), m('b2', 39.201, 29.611), m('b3', 39.202, 29.612)];
    expect(bolgeler([...a, ...b])).toHaveLength(2);
    const p = planKur([...a, ...b], gunler(4));
    const bolgesi = (id: string) => (id.startsWith('b') ? 'b' : 'a');
    expect(sayilar(p)).toEqual([2, 1, 2, 1]);
    // Hiçbir gün iki bölgeyi karıştırmaz.
    p.gunler.forEach((g) => expect(new Set(g.mekanlar.map((x) => bolgesi(x.id))).size).toBe(1));
    expect(p.gunler[2].mekanlar.every((x) => bolgesi(x.id) === 'b')).toBe(true);
  });

  it('kota aşımında eşit duraklı günlerden mekana en yakın gün seçilir; gün içi en yakın komşu', () => {
    // Cumartesi hepsi kapalı: 3. güne kimse giremez. b2 taşar; 1. ve 2. gün 2'şer duraklı, b1 olan 2. gün seçilir.
    const cmtKapali = (x: KonumluMekan) => ({ ...x, kapaliGunler: [6] });
    const a = merkez.slice(0, 3).map(cmtKapali);
    const b = [m('b1', 39.2, 29.61), m('b2', 39.201, 29.611)].map(cmtKapali);
    const p = planKur([...a, ...b], gunler(3, [4, 5, 6]));
    expect(p.atanmamis).toEqual([]);
    expect(sayilar(p)).toEqual([2, 3, 0]);
    const ikinci = p.gunler[1].mekanlar.map((x) => x.id);
    expect([...ikinci].sort()).toEqual(['b1', 'b2', 'cini']);
    // En yakın komşu: b1 ile b2 yan yana, merkezdeki durak bir uçta.
    expect([0, 2]).toContain(ikinci.indexOf('cini'));
  });

  it('tek gün: kapasite yettiğince hepsi o güne (eski davranış)', () => {
    const p = planKur([...merkez], gunler(1));
    expect(sayilar(p)).toEqual([6]);
  });
});
