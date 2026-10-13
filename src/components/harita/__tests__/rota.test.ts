import { describe, expect, it } from '@jest/globals';

import { bolgeHesapla } from '../geo';
import { bacakEtiketPinleri, cizgiAnahtari, hapGlifAnahtari, OK_EN_FAZLA, rotaYuvaKatmanlari, SAYDAM, yonOklari, yuvaSayisi } from '../rota';
import type { HaritaCizgisi, HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };
// Zoom ~15: 400×800 px ekran, 0,02° enlem = 800 px → 1 px = 0,000025°.
const bolge = bolgeHesapla(roma, 0.02, 0.01);
const ekran = { genislik: 400, yukseklik: 800 };
const px = 0.000025;

describe('yonOklari (#59 §C)', () => {
  it('doğuya giden 456 px bacakta ~24 px aralıkla oklar, açı 90°', () => {
    const c: HaritaCizgisi = { id: 'a', noktalar: [roma, { lat: roma.lat, lng: roma.lng + 456 * px }], renk: '#1f4fc2', opaklik: 0.9 };
    const oklar = yonOklari([c], [], bolge, ekran);
    expect(oklar).toHaveLength(19);
    expect(oklar.every((o) => Math.abs(o.aci - 90) < 0.01)).toBe(true);
    // Kuzeye giden bacak 0°, güneye 180°.
    const kuzey: HaritaCizgisi = { ...c, id: 'k', noktalar: [roma, { lat: roma.lat + 100 * px, lng: roma.lng }] };
    expect(yonOklari([kuzey], [], bolge, ekran)[0].aci).toBeCloseTo(0);
    const guney: HaritaCizgisi = { ...c, id: 'g', noktalar: [roma, { lat: roma.lat - 100 * px, lng: roma.lng }] };
    expect(yonOklari([guney], [], bolge, ekran)[0].aci).toBeCloseTo(180);
  });

  it('pinlerin 20 px yakınına ok konmaz; kesik / ince / soluk çizgide ok yok', () => {
    const c: HaritaCizgisi = { id: 'a', noktalar: [roma, { lat: roma.lat, lng: roma.lng + 450 * px }], renk: '#1f4fc2', opaklik: 0.9 };
    // #65: oklar 12, 36, 60… px'te (19 ok); 12 px'e pin koyunca 20 px içindeki ilk ok düşer (36 px'teki 24 px uzakta, kalır).
    const pin: HaritaPini = { id: 'p', konum: { lat: roma.lat, lng: roma.lng + 12 * px }, renk: '#000', tur: 'durak' };
    expect(yonOklari([c], [pin], bolge, ekran)).toHaveLength(18);
    expect(yonOklari([{ ...c, kesik: true }], [], bolge, ekran)).toHaveLength(0);
    // #65: araba bacağında ok yok.
    expect(yonOklari([{ ...c, arac: true }], [], bolge, ekran)).toHaveLength(0);
    expect(yonOklari([{ ...c, ince: true }], [], bolge, ekran)).toHaveLength(0);
    expect(yonOklari([{ ...c, opaklik: 0.35 }], [], bolge, ekran)).toHaveLength(0);
  });

  it('toplam 40 ile sınırlı; kaydırma (merkez) sonucu değiştirmez', () => {
    const uzun: HaritaCizgisi = { id: 'u', noktalar: [roma, { lat: roma.lat, lng: roma.lng + 4500 * px }], renk: '#1f4fc2', opaklik: 0.9 };
    expect(yonOklari([uzun], [], bolge, ekran).length).toBeLessThanOrEqual(OK_EN_FAZLA);
    const kaymis = bolgeHesapla({ lat: roma.lat + 0.3, lng: roma.lng - 0.4 }, 0.02, 0.01);
    const a = yonOklari([uzun], [], bolge, ekran).map((o) => [o.konum, o.aci]);
    const b = yonOklari([uzun], [], kaymis, ekran).map((o) => [o.konum, o.aci]);
    expect(b).toEqual(a);
  });

  it('bacakEtiketPinleri: etiketli her çizgiden hap (#95: yürüme de), bacak uzunluğu ve rota tonu taşır; zoom < 13 → yok', () => {
    const yuruyus: HaritaCizgisi = { id: 'y', noktalar: [roma, { lat: roma.lat + 0.01, lng: roma.lng }], renk: '#2f6fed', etiket: '12 dk', etiketIkon: 'yuru', etiketRenk: '#1f4fc2', kesik: true };
    const taksi: HaritaCizgisi = { ...yuruyus, id: 't', arac: true, kesik: false, etiket: '14 dk', etiketIkon: 'araba', renk: '#1f4fc2' };
    const etiketsiz: HaritaCizgisi = { ...yuruyus, id: 'g', etiket: undefined };
    const haplar = bacakEtiketPinleri([yuruyus, taksi, etiketsiz], 15);
    expect(haplar).toHaveLength(2);
    // Kuş uçuşunda çizgi gün renginde ama hap glifi rota tonunda (PNG yalnız rota tonlarında var).
    expect(haplar[0]).toMatchObject({ id: 'bacak:y', tur: 'etiket', etiket: '12 dk', etiketIkon: 'yuru', renk: '#1f4fc2' });
    expect(haplar[1]).toMatchObject({ id: 'bacak:t', etiket: '14 dk', etiketIkon: 'araba', renk: '#1f4fc2' });
    expect(haplar[0].bacakM).toBeGreaterThan(1000);
    expect(bacakEtiketPinleri([yuruyus, taksi], 12.9)).toEqual([]);
    expect(bacakEtiketPinleri([yuruyus, taksi]).length).toBe(2);
    // Glif PNG anahtarı: yürüme Lacivert (#136), araba rota tonunda.
    expect(hapGlifAnahtari(haplar[0])).toBe('yuru-0e1430');
    expect(hapGlifAnahtari(haplar[1])).toBe('araba-1f4fc2');
    expect(hapGlifAnahtari({ renk: '#000' })).toBeNull();
  });
});

describe('cizgiAnahtari (#88 KK1)', () => {
  it('kuş uçuşu ve gerçek rota ayrı Polyline örnekleri: aynı bacak, farklı anahtar; aynı hal aynı anahtar', () => {
    expect(cizgiAnahtari({ id: 'rota:g1:A>B', kesik: true })).toBe('rota:g1:A>B|kus');
    expect(cizgiAnahtari({ id: 'rota:g1:A>B', kesik: false })).toBe('rota:g1:A>B|yol');
    expect(cizgiAnahtari({ id: 'rota:g1:A>B' })).toBe('rota:g1:A>B|yol');
    expect(cizgiAnahtari({ id: 'rota:g1:A>B', kesik: true })).not.toBe(cizgiAnahtari({ id: 'rota:g1:A>B', kesik: false }));
  });
});

describe('rota yuva havuzu (#91 ikinci tur — Android Polyline kaldırılmaz)', () => {
  const a = { lat: 41.9, lng: 12.49 };
  const z = { lat: 41.91, lng: 12.5 };
  it('havuz yalnız büyür: 9 → 0 çizgide 9 yuva kalır, 12 gelince 12', () => {
    expect(yuvaSayisi(0, 9)).toBe(9);
    expect(yuvaSayisi(9, 0)).toBe(9);
    expect(yuvaSayisi(9, 12)).toBe(12);
  });
  it('her yuva hep 4 katman, aynı sırada ve genişlikte; boş yuva noktasız + saydam', () => {
    const bos = rotaYuvaKatmanlari(null);
    expect(bos.map((k) => k.ad)).toEqual(['kesik', 'golge', 'kenar', 'renk']);
    expect(bos.map((k) => k.genislik)).toEqual([3, 11, 9, 5.5]);
    expect(bos.every((k) => k.noktalar.length === 0 && k.renk === SAYDAM)).toBe(true);
  });
  it('kuş uçuşu yalnız kesik katmanı doldurur; rota üç düz katmanı doldurur, kesik boşalır', () => {
    const kus = rotaYuvaKatmanlari({ id: 'r', noktalar: [a, z], renk: '#2f6fed', opaklik: 0.9, kesik: true, ince: true });
    expect(kus[0].noktalar).toEqual([a, z]);
    expect(kus[0].renk).toBe('#2f6fede6');
    expect(kus.slice(1).every((k) => k.noktalar.length === 0 && k.renk === SAYDAM)).toBe(true);

    const yol = rotaYuvaKatmanlari({ id: 'r', noktalar: [a, z], renk: '#1f4fc2', opaklik: 0.9 });
    expect(yol[0].noktalar).toEqual([]);
    expect(yol[0].renk).toBe(SAYDAM);
    expect(yol.slice(1).map((k) => k.noktalar)).toEqual([[a, z], [a, z], [a, z]]);
    expect(yol[3].renk).toBe('#1f4fc2e6');
    expect(yol[2].renk).toBe('#ffffffe6');
    // Katman sırası ve genişlikleri çizgiden bağımsız sabit: yuvadaki Polyline örnekleri yerinde güncellenir.
    expect(yol.map((k) => [k.ad, k.genislik, k.zIndex])).toEqual(rotaYuvaKatmanlari(null).map((k) => [k.ad, k.genislik, k.zIndex]));
  });
});
