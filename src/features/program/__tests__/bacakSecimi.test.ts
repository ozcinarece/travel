import { describe, expect, it, jest } from '@jest/globals';

import { bacakModu, tempoHesapla } from '@/schedule/tempo';

import { bacakSecimi, hapCifti, hapPinId, seciciBasligi, seciciSecenekleri } from '../bacakSecimi';
import { bacakAnahtari, bacakKaynagi, type BacakModlari } from '../sorgular';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));

const a = { lat: 39.78, lng: 30.5 };
const b = { lat: 39.79, lng: 30.5 };

describe('hapCifti / hapPinId (#101 KK2)', () => {
  it('hap kimliğinden çift; tekrar eki düşer; başka kimlik null', () => {
    expect(hapCifti('bacak:rota:g1:stay:s1>ChIJabc', 'g1')).toEqual({ from: 'stay:s1', to: 'ChIJabc' });
    expect(hapCifti('bacak:rota:g1:ChIJa>ChIJb#1', 'g1')).toEqual({ from: 'ChIJa', to: 'ChIJb' });
    expect(hapCifti('bacak:rota:g2:ChIJa>ChIJb', 'g1')).toBeNull();
    expect(hapCifti('m:abc', 'g1')).toBeNull();
    expect(hapPinId('rota:g1:A>B')).toBe('bacak:rota:g1:A>B');
  });
});

describe('bacakSecimi + bacakModu (#101 KK1: elle seçim, çift bozulursa otomatik)', () => {
  const modlar: BacakModlari = new Map([[bacakAnahtari('A', 'B'), 'araba']]);
  it('çift için seçim; sıra değişip çift bozulunca otomatik', () => {
    expect(bacakSecimi(modlar, { from: 'A', to: 'B' })).toBe('araba');
    expect(bacakSecimi(modlar, { from: 'A', to: 'C' })).toBe('otomatik');
    expect(bacakSecimi(undefined, { from: 'A', to: 'B' })).toBe('otomatik');
  });
  it('elle araba: kısa bacakta da taksi (süre varsa o, yoksa kestirim); elle yürüme: 40 dk üstünde de yürüyüş', () => {
    expect(bacakModu(a, b, { yuruyusSn: 600, taksiSn: 240, kestirim: false, secim: 'araba' })).toEqual({ mod: 'taksi', sn: 240, kestirim: false });
    expect(bacakModu(a, b, { yuruyusSn: 600, taksiSn: null, kestirim: false, secim: 'araba' })).toMatchObject({ mod: 'taksi', kestirim: true });
    expect(bacakModu(a, b, { yuruyusSn: 3000, taksiSn: 500, kestirim: false, secim: 'yurume' })).toEqual({ mod: 'yuruyus', sn: 3000, kestirim: false });
    // Otomatik: 40 dk kuralı değişmez.
    expect(bacakModu(a, b, { yuruyusSn: 3000, taksiSn: 500, kestirim: false })).toEqual({ mod: 'taksi', sn: 500, kestirim: false });
    expect(bacakModu(a, b, { yuruyusSn: 600, taksiSn: 240, kestirim: false, secim: null })).toEqual({ mod: 'yuruyus', sn: 600, kestirim: false });
  });
  it('bacakKaynagi seçimi taşır; araba süresi drive_seconds varsa her bacakta', () => {
    const rotalar = { 'A>B': { from_key: 'A', to_key: 'B', seconds: 600, meters: 800, mode: 'WALK' as const, polyline: 'x', drive_seconds: 240, drive_meters: 1200, drive_polyline: 'y' } };
    const k = bacakKaynagi(() => null, rotalar, modlar);
    expect(k('A', 'B')).toEqual({ sn: 600, m: 800, taksi: { sn: 240, m: 1200 }, secim: 'araba' });
    expect(k('B', 'A')).toBeNull();
  });
  it('tempo: elle araba seçimi saatleri yeniden hesaplar (KK5)', () => {
    const duraklar = [
      { id: 'a', konum: a, dakika: 60 },
      { id: 'b', konum: b, dakika: 60 },
    ];
    const bacak = (secim: 'araba' | null) => () => ({ yuruyusSn: 1200, taksiSn: 300, kestirim: false, secim });
    const otomatik = tempoHesapla({ duraklar, otel: null, baslangic: '09:00', bitis: '20:00', bacak: bacak(null), sira: ['a', 'b'] });
    const araba = tempoHesapla({ duraklar, otel: null, baslangic: '09:00', bitis: '20:00', bacak: bacak('araba'), sira: ['a', 'b'] });
    expect(otomatik.yuruyusDk).toBe(20);
    expect(otomatik.taksiDk).toBe(0);
    expect(araba.yuruyusDk).toBe(0);
    expect(araba.taksiDk).toBe(5);
    expect(araba.bitis < otomatik.bitis).toBe(true);
  });
});

describe('seciciBasligi / seciciSecenekleri (#101 KK2)', () => {
  it('"4 → 5 · SAZOVA → PORSUK KAFE"; uzun ad kısaltılır; otel O', () => {
    expect(seciciBasligi({ no: 4, ad: 'Sazova' }, { no: 5, ad: 'Porsuk Kafe' })).toBe('4 → 5 · SAZOVA → PORSUK KAFE');
    expect(seciciBasligi({ no: 'O', ad: 'Otel Divan Eskişehir' }, { no: 1, ad: 'Kurşunlu Cami' })).toBe('O → 1 · OTEL DİVAN ES… → KURŞUNLU CAMİ');
  });
  it('yürüme + araba süreleri, araba yükleniyorsa null, toplu pasif', () => {
    const s = seciciSecenekleri({ yurumeSn: 720, arabaSn: 240, arabaKestirimSn: 400, arabaYukleniyor: false, etkin: 'yuruyus' });
    expect(s.map((x) => [x.mod, x.dk, x.secili, x.pasif])).toEqual([
      ['yurume', 12, true, false],
      ['araba', 4, false, false],
      ['toplu', null, false, true],
    ]);
    expect(seciciSecenekleri({ yurumeSn: 720, arabaSn: null, arabaKestirimSn: 400, arabaYukleniyor: true, etkin: 'taksi' })[1]).toMatchObject({ dk: null, secili: true });
    expect(seciciSecenekleri({ yurumeSn: null, arabaSn: null, arabaKestirimSn: 400, arabaYukleniyor: false, etkin: 'taksi' })[1]).toMatchObject({ dk: 7, kestirim: true });
  });
});
