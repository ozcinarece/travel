import { describe, expect, it, jest } from '@jest/globals';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { birikimeEkle, birikimListesi, gorunurKarolar, gorunurOneriler, istenecekKarolar, KARO_EN_FAZLA_ISTEK, karoKenariM, karoOnbellekAnahtari, karoYap, karoZoomu } from '../karolar';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
// 400 × 800 px telefon: görünür enlem aralığı zoom'dan (zoomDelta), boylam yarısı.
const bolge = (zoom: number, merkez = eskisehir) => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom) / 2, zoom);

// #66 KK3: karo boyu zoom adımına bağlı; karo anahtarı kaydırmadan bağımsız (sabit ızgara).
describe('karolar (#66)', () => {
  it('karo kenarı: zoom 12 → 2,5 km, 14 → 625 m, 16 → ~156 m; adım 11–17 arasına kırpılır', () => {
    expect(karoKenariM(12)).toBe(2500);
    expect(karoKenariM(14)).toBe(625);
    expect(karoKenariM(16)).toBe(156.25);
    expect(karoZoomu(9.3)).toBe(11);
    expect(karoZoomu(13.4)).toBe(13);
    expect(karoZoomu(13.9)).toBe(13);
    expect(karoZoomu(19)).toBe(17);
  });

  it('karo merkezi ve yarıçapı: karo dairenin içinde kalır', () => {
    const k = karoYap(14, 100, 200);
    expect(k.anahtar).toBe('14:100:200');
    // Yarım köşegen ≥ yarım kenar; Eskişehir enleminde boylam karosu dar → yarıçap < 354 m.
    expect(k.yaricapM).toBeGreaterThanOrEqual(313);
    expect(k.yaricapM).toBeLessThanOrEqual(442);
    expect(karoOnbellekAnahtari('yemek', k)).toBe('yemek|14:100:200');
  });

  it('görünür alan ≈ 3×4 karo (8–16); küçük kaydırma aynı karoları verir, merkeze yakın önce', () => {
    const k13 = gorunurKarolar(bolge(13));
    expect(k13.length).toBeGreaterThanOrEqual(8);
    expect(k13.length).toBeLessThanOrEqual(16);
    const kaymis = gorunurKarolar(bolge(13, { lat: eskisehir.lat + 0.0005, lng: eskisehir.lng + 0.0005 }));
    expect(new Set(kaymis.map((k) => k.anahtar))).toEqual(new Set(k13.map((k) => k.anahtar)));
    // İlk karo merkezi içerir.
    const d = karoKenariM(13) / 111_320;
    expect(Math.abs(k13[0].merkez.lat - eskisehir.lat)).toBeLessThanOrEqual(d / 2);
    expect(Math.abs(k13[0].merkez.lng - eskisehir.lng)).toBeLessThanOrEqual(d / 2);
    // Zoom değişince karolar başka adımdan.
    expect(gorunurKarolar(bolge(15)).every((k) => k.z === 15)).toBe(true);
  });

  it('istenecekKarolar: önbellektekiler atlanır, en fazla 12', () => {
    const b = bolge(12);
    const hepsi = gorunurKarolar(b);
    const istek = istenecekKarolar(b, 'populer', () => false);
    expect(istek.length).toBe(Math.min(hepsi.length, KARO_EN_FAZLA_ISTEK));
    const bilinen = new Set(istek.map((k) => karoOnbellekAnahtari('populer', k)));
    const kalan = istenecekKarolar(b, 'populer', (a) => bilinen.has(a));
    expect(kalan.every((k) => !bilinen.has(karoOnbellekAnahtari('populer', k)))).toBe(true);
    // Başka çip aynı karoları yeniden ister.
    expect(istenecekKarolar(b, 'yemek', (a) => bilinen.has(a)).length).toBe(istek.length);
  });

  it('birikim: yeni eklenir, bilinen güncellenir, hiçbir şey silinmez; liste popülerlik sırasıyla', () => {
    const y = (place_id: string, puan: number, n: number): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan, puan_sayisi: n, acik: null, ulke_kodu: null });
    const b = new Map<string, HafifYer>();
    expect(birikimeEkle(b, [y('a', 4.0, 10), y('b', 4.8, 500)])).toBe(2);
    expect(birikimeEkle(b, [y('b', 4.9, 600), y('c', 4.2, 50)])).toBe(1);
    expect(birikimListesi(b).map((x) => x.place_id)).toEqual(['b', 'c', 'a']);
    expect(b.get('b')?.puan).toBe(4.9);
    expect(birikimListesi(undefined)).toEqual([]);
  });

  it('gorunurOneriler: 250 altı dokunulmaz; üstünde görünür alandakiler, en fazla 250', () => {
    const icerde = Array.from({ length: 200 }, (_, i) => ({ id: `i${i}`, lat: eskisehir.lat + (i % 10) * 0.0001, lng: eskisehir.lng }));
    const disarda = Array.from({ length: 100 }, (_, i) => ({ id: `d${i}`, lat: eskisehir.lat + 1, lng: eskisehir.lng }));
    const b = bolge(14);
    expect(gorunurOneriler(icerde, b)).toBe(icerde);
    const secilen = gorunurOneriler([...disarda, ...icerde], b);
    expect(secilen).toHaveLength(200);
    expect(secilen.every((x) => x.id.startsWith('i'))).toBe(true);
    expect(gorunurOneriler([...icerde, ...icerde, ...icerde], b)).toHaveLength(250);
    expect(gorunurOneriler([...icerde, ...disarda], null)).toHaveLength(250);
  });
});
