import { describe, expect, it, jest } from '@jest/globals';

import { bolgeHesapla, mesafeM, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { BOS_FILTRE, VARSAYILAN_FILTRE } from '../filtre';
import { alanCipi, alandaAraGorunur, alanIcinde, genisAlan, genisletilmeli, gorunumAlani, sehirCipleri, sehirDisinda } from '../sehirListesi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// #189 Ek 2 KK10: alan seçimi, genişletme kuralı ve görünüm süzmesi (saf fonksiyonlar).
const eskisehir = { lat: 39.7767, lng: 30.5206 };
const ekran = (z: number, m = eskisehir) => bolgeHesapla(m, zoomDelta(z), zoomDelta(z) / 2, z);
const sehir = { merkez: eskisehir, yaricapM: 8000 };
const yer = (id: string, lat: number, lng: number): HafifYer => ({ place_id: id, ad: id, lat, lng, primary_type: 'museum', tz: null, puan: 4.6, puan_sayisi: 500, acik: null, ulke_kodu: null });

describe('KK7 şehir istekleri', () => {
  it('Turistik üç alt istek; çip seçilince her biri bir istek; Tümü tek istek', () => {
    expect(sehirCipleri(VARSAYILAN_FILTRE)).toEqual(['turistik_tarihi', 'turistik_muze', 'turistik_manzara']);
    expect(sehirCipleri({ ...BOS_FILTRE, kategoriler: ['yemek'] })).toEqual(['yemek']);
    expect(sehirCipleri({ ...BOS_FILTRE, kategoriler: ['kafe', 'park', 'alisveris'] })).toEqual(['kafe', 'park', 'alisveris']);
    expect(sehirCipleri(BOS_FILTRE)).toEqual(['hepsi']);
  });

  it('Turistik alt seçenekleri kendi alt isteğine; ibadet tarihî yerler isteğine (tekrar yok)', () => {
    expect(sehirCipleri({ ...BOS_FILTRE, kategoriler: ['muze'] })).toEqual(['turistik_muze']);
    expect(sehirCipleri({ ...BOS_FILTRE, kategoriler: ['gezilecek', 'ibadet'] })).toEqual(['turistik_tarihi']);
    expect(sehirCipleri({ ...BOS_FILTRE, kategoriler: ['manzara', 'yemek'] })).toEqual(['turistik_manzara', 'yemek']);
  });
});

describe('KK9 "Bu alanda ara"', () => {
  it('tek isteğin çipi: Turistik grubu → turistik; tek kategori → kendi; Tümü / karışık → hepsi', () => {
    expect(alanCipi(VARSAYILAN_FILTRE)).toBe('turistik');
    expect(alanCipi({ ...BOS_FILTRE, kategoriler: ['muze'] })).toBe('turistik');
    expect(alanCipi({ ...BOS_FILTRE, kategoriler: ['yemek'] })).toBe('yemek');
    expect(alanCipi({ ...BOS_FILTRE, kategoriler: ['yemek', 'kafe'] })).toBe('hepsi');
    expect(alanCipi(BOS_FILTRE)).toBe('hepsi');
  });

  it('alan: merkez görünüm merkezi, yarıçap yarı köşegen; genişletme 3 kat (15 km sınırı); 5\'ten az yerde genişletilir', () => {
    const b = ekran(14);
    const a = gorunumAlani(b);
    expect(a.merkez).toEqual(b.merkez);
    const kose = { lat: b.merkez.lat + b.latDelta / 2, lng: b.merkez.lng + b.lngDelta / 2 };
    expect(Math.abs(a.yaricapM - mesafeM(b.merkez, kose))).toBeLessThan(1);
    expect(genisAlan(a).yaricapM).toBe(Math.round(a.yaricapM * 3));
    expect(genisAlan({ merkez: eskisehir, yaricapM: 9000 }).yaricapM).toBe(15_000);
    expect(genisletilmeli(4)).toBe(true);
    expect(genisletilmeli(5)).toBe(false);
  });

  it('görünüm bir alanın içinde mi; şehir dışında mı', () => {
    const iceride = gorunumAlani(ekran(15));
    expect(alanIcinde(iceride, sehir)).toBe(true);
    expect(alanIcinde(gorunumAlani(ekran(10)), sehir)).toBe(false);
    expect(sehirDisinda(ekran(13), sehir)).toBe(false);
    expect(sehirDisinda(ekran(13, { lat: eskisehir.lat + 0.25, lng: eskisehir.lng }), sehir)).toBe(true);
  });

  it('hap: şehir dışında çıkar; şehir içinde yeterli öneri varken çıkmaz, az öneride çıkar; aranmış alanda çıkmaz', () => {
    const disarida = ekran(13, { lat: eskisehir.lat + 0.25, lng: eskisehir.lng });
    expect(alandaAraGorunur({ bolge: disarida, sehir, arananlar: [], oneriler: [] })).toBe(true);
    expect(alandaAraGorunur({ bolge: disarida, sehir, arananlar: [gorunumAlani(disarida)], oneriler: [] })).toBe(false);
    // Aranan alan genişletildiyse (3 kat) yakın kaydırmada da hap çıkmaz.
    const biraz = ekran(13, { lat: disarida.merkez.lat + 0.01, lng: disarida.merkez.lng });
    expect(alandaAraGorunur({ bolge: biraz, sehir, arananlar: [genisAlan(gorunumAlani(disarida))], oneriler: [] })).toBe(false);

    const merkezde = ekran(14);
    const dolu = [yer('a', eskisehir.lat, eskisehir.lng), yer('b', eskisehir.lat + 0.002, eskisehir.lng), yer('c', eskisehir.lat, eskisehir.lng + 0.002)];
    expect(alandaAraGorunur({ bolge: merkezde, sehir, arananlar: [], oneriler: dolu })).toBe(false);
    expect(alandaAraGorunur({ bolge: merkezde, sehir, arananlar: [], oneriler: dolu.slice(0, 2) })).toBe(true);
    expect(alandaAraGorunur({ bolge: null, sehir, arananlar: [], oneriler: [] })).toBe(false);
    expect(alandaAraGorunur({ bolge: merkezde, sehir: null, arananlar: [], oneriler: [] })).toBe(false);
  });
});
