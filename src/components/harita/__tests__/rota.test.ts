import { describe, expect, it } from '@jest/globals';

import { bolgeHesapla } from '../geo';
import { bacakEtiketPinleri, OK_EN_FAZLA, yonOklari } from '../rota';
import type { HaritaCizgisi, HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };
// Zoom ~15: 400×800 px ekran, 0,02° enlem = 800 px → 1 px = 0,000025°.
const bolge = bolgeHesapla(roma, 0.02, 0.01);
const ekran = { genislik: 400, yukseklik: 800 };
const px = 0.000025;

describe('yonOklari (#59 §C)', () => {
  it('doğuya giden 450 px bacakta ~45 px aralıkla oklar, açı 90°', () => {
    const c: HaritaCizgisi = { id: 'a', noktalar: [roma, { lat: roma.lat, lng: roma.lng + 450 * px }], renk: '#1f4fc2', opaklik: 0.9 };
    const oklar = yonOklari([c], [], bolge, ekran);
    expect(oklar).toHaveLength(10);
    expect(oklar.every((o) => Math.abs(o.aci - 90) < 0.01)).toBe(true);
    // Kuzeye giden bacak 0°, güneye 180°.
    const kuzey: HaritaCizgisi = { ...c, id: 'k', noktalar: [roma, { lat: roma.lat + 100 * px, lng: roma.lng }] };
    expect(yonOklari([kuzey], [], bolge, ekran)[0].aci).toBeCloseTo(0);
    const guney: HaritaCizgisi = { ...c, id: 'g', noktalar: [roma, { lat: roma.lat - 100 * px, lng: roma.lng }] };
    expect(yonOklari([guney], [], bolge, ekran)[0].aci).toBeCloseTo(180);
  });

  it('pinlerin 20 px yakınına ok konmaz; kesik / ince / soluk çizgide ok yok', () => {
    const c: HaritaCizgisi = { id: 'a', noktalar: [roma, { lat: roma.lat, lng: roma.lng + 450 * px }], renk: '#1f4fc2', opaklik: 0.9 };
    // İlk ok 22,5 px'te: tam oraya pin koyunca o ok düşer.
    const pin: HaritaPini = { id: 'p', konum: { lat: roma.lat, lng: roma.lng + 22.5 * px }, renk: '#000', tur: 'durak' };
    expect(yonOklari([c], [pin], bolge, ekran)).toHaveLength(9);
    expect(yonOklari([{ ...c, kesik: true }], [], bolge, ekran)).toHaveLength(0);
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

  it('bacakEtiketPinleri yalnız etiketli (taksi) çizgiden hap üretir', () => {
    const yuruyus: HaritaCizgisi = { id: 'y', noktalar: [roma, { lat: roma.lat + 0.01, lng: roma.lng }], renk: '#000' };
    const taksi: HaritaCizgisi = { ...yuruyus, id: 't', kesik: true, etiket: '14 dk', etiketIkon: 'taksi' };
    const haplar = bacakEtiketPinleri([yuruyus, taksi]);
    expect(haplar).toHaveLength(1);
    expect(haplar[0]).toMatchObject({ id: 'bacak:t', tur: 'etiket', etiket: '14 dk', etiketIkon: 'taksi' });
  });
});
