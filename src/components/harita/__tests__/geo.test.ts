import { describe, expect, it } from '@jest/globals';

import { kumeHesapla, etiketOnceligi, sigdir, bolgedenUzaklasti, bolgeHesapla, deltaZoom, detayGoster, gizliEtiketler, haritaDolgusu, kisaAd, mesafeM, pinCapasi, SIFIR_DOLGU, zoomDelta } from '../geo';
import type { HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };

describe('geo', () => {
  it('mesafeM: Roma–Vatikan ~3 km', () => {
    const vatikan = { lat: 41.9029, lng: 12.4534 };
    const m = mesafeM(roma, vatikan);
    expect(m).toBeGreaterThan(3300);
    expect(m).toBeLessThan(3700);
  });

  it('bolgeHesapla: kısa kenarın yarısı yarıçap olur', () => {
    // 0,02° enlem ≈ 2,2 km; 0,06° boylam Roma enleminde ≈ 5 km → yarıçap ≈ 1,1 km.
    const b = bolgeHesapla(roma, 0.02, 0.06);
    expect(b.yaricapM).toBeGreaterThan(1000);
    expect(b.yaricapM).toBeLessThan(1200);
  });

  it('bolgedenUzaklasti: küçük kaymada hayır, yarıçapın %30 üstünde ya da ölçek değişince evet', () => {
    const arama = { merkez: roma, yaricapM: 2000, latDelta: 0.04, lngDelta: 0.05, zoom: 13 };
    expect(bolgedenUzaklasti({ ...arama, merkez: { lat: roma.lat + 0.003, lng: roma.lng } }, arama)).toBe(false);
    expect(bolgedenUzaklasti({ ...arama, merkez: { lat: roma.lat + 0.01, lng: roma.lng } }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ ...arama, yaricapM: 4000 }, arama)).toBe(true);
    expect(bolgedenUzaklasti({ ...arama, yaricapM: 1200 }, arama)).toBe(true);
  });

  it('kisaAd 18 karakterde kısaltır', () => {
    expect(kisaAd('Pantheon')).toBe('Pantheon');
    expect(kisaAd('Galleria Nazionale d’Arte Moderna')).toHaveLength(18);
    expect(kisaAd('Galleria Nazionale d’Arte Moderna').endsWith('…')).toBe(true);
  });

  it('gizliEtiketler: çakışanda düşük öncelikli gizlenir, uzakta ikisi de görünür, yakınlaşınca geri gelir', () => {
    // Ekran 400×800 px, görünür alan 0,02° × 0,01° → 1 px ≈ 0,000025°.
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 14 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const pin = (id: string, dLng: number, tur: HaritaPini['tur'], secili = false): HaritaPini => ({
      id,
      konum: { lat: roma.lat, lng: roma.lng + dLng },
      renk: '#000',
      tur,
      ad: `Mekan ${id}`,
      secili,
    });
    // 20 px arayla: etiketler (~70 px) çakışır → öneri gizlenir, durak kalır.
    const yakin = [pin('a', 0, 'oneri'), pin('b', 0.0005, 'durak')];
    expect([...gizliEtiketler(yakin, bolge, ekran).etiket]).toEqual(['a']);
    // Seçili öneri durağı yener.
    expect([...gizliEtiketler([pin('a', 0, 'oneri', true), pin('b', 0.0005, 'durak')], bolge, ekran).etiket]).toEqual(['b']);
    // 200 px arayla çakışma yok.
    expect(gizliEtiketler([pin('a', 0, 'oneri'), pin('b', 0.005, 'durak')], bolge, ekran).etiket.size).toBe(0);
    // Yakınlaşınca (aralık 10 kat küçük) aynı pinler artık çakışmaz.
    expect(gizliEtiketler(yakin, { ...bolge, latDelta: 0.002, lngDelta: 0.001, zoom: 13 }, ekran).etiket.size).toBe(0);
  });

  it('pinCapasi daire merkezini çapa yapar; detay satırıyla kutu uzar', () => {
    const c = pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' });
    expect(c.x).toBe(0.5);
    // #55: 32 px daire (+2 boşluk +16 etiket); seçili 38 px (halka kenarda).
    expect(c.y).toBeCloseTo(16 / 50);
    expect(pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' }, true).y).toBeCloseTo(16 / 64);
    expect(pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak', secili: true }).y).toBeCloseTo(19 / 56);
  });

  it('deltaZoom zoomDelta\'nın tersidir; bolgeHesapla zoom üretir', () => {
    expect(deltaZoom(zoomDelta(14))).toBeCloseTo(14);
    expect(bolgeHesapla(roma, zoomDelta(16), zoomDelta(16)).zoom).toBeCloseTo(16);
    expect(bolgeHesapla(roma, 0.02, 0.02, 15.5).zoom).toBe(15.5);
  });

  it('detayGoster: seçili ya da zoom ≥ 14 (#40), puan ve ad varsa', () => {
    const p: HaritaPini = { id: 'x', konum: roma, renk: '#000', tur: 'oneri', ad: 'Pantheon', puan: 4.8 };
    expect(detayGoster(p, 13.9)).toBe(false);
    expect(detayGoster(p, 14)).toBe(true);
    expect(detayGoster(p, 16)).toBe(true);
    expect(detayGoster({ ...p, secili: true }, 12)).toBe(true);
    expect(detayGoster({ ...p, puan: null }, 17)).toBe(false);
    expect(detayGoster({ ...p, tur: 'aday' }, 17)).toBe(false);
  });

  it('bacak etiketi (tur etiket) en düşük öncelik: pin etiketiyle çakışınca gizlenir', () => {
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 14 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const pin: HaritaPini = { id: 'p', konum: roma, renk: '#000', tur: 'durak', ad: 'Pantheon' };
    const hap: HaritaPini = { id: 'h', konum: { lat: roma.lat - 0.0003, lng: roma.lng }, renk: '#000', tur: 'etiket', etiket: '🚶 12 dk' };
    expect([...gizliEtiketler([hap, pin], bolge, ekran).etiket]).toEqual(['h']);
    expect(gizliEtiketler([{ ...hap, konum: { lat: roma.lat - 0.005, lng: roma.lng } }, pin], bolge, ekran).etiket.size).toBe(0);
  });

  it('#40: çakışmada önce puan satırı düşer, ad kalır; hâlâ çakışırsa ad da gizlenir', () => {
    // Zoom 15: detay açık; 1 px = 0,000025°. #55: etiket başka pinin DAİRESİNE de binemez.
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 15 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const ust: HaritaPini = { id: 'ust', konum: roma, renk: '#000', tur: 'durak', ad: 'Pantheon', puan: 4.8 };
    // 52 px yukarıda öneri: iki satırlı kutusu (30 px) durağın dairesine çarpar, tek satır (16 px) sığar → yalnız puan gizlenir.
    const alt: HaritaPini = { id: 'alt', konum: { lat: roma.lat + 0.0013, lng: roma.lng }, renk: '#000', tur: 'oneri', ad: 'Kafe', puan: 4.2 };
    const g = gizliEtiketler([ust, alt], bolge, ekran);
    expect(g.etiket.size).toBe(0);
    expect([...g.detay]).toEqual(['alt']);
    // 40 px yukarıda: tek satır da dairenin üstüne biner → düşük öncelikli önerinin adı da gizlenir.
    const g2 = gizliEtiketler([ust, { ...alt, konum: { lat: roma.lat + 0.001, lng: roma.lng } }], bolge, ekran);
    expect([...g2.etiket]).toEqual(['alt']);
    expect(g2.detay.size).toBe(0);
  });

  // #49: Android'de harita hazır olmadan mapPadding değişmez (native çöküş).
  it('haritaDolgusu: hazır değilken hep aynı sıfır nesnesi', () => {
    expect(haritaDolgusu(false, 240)).toBe(SIFIR_DOLGU);
    expect(haritaDolgusu(false, 0)).toBe(SIFIR_DOLGU);
    expect(haritaDolgusu(true, 0)).toBe(SIFIR_DOLGU);
    expect(haritaDolgusu(true, Number.NaN)).toBe(SIFIR_DOLGU);
    expect(haritaDolgusu(true, -5)).toBe(SIFIR_DOLGU);
  });

  it('haritaDolgusu: hazırken alt boşluk (tam sayı)', () => {
    expect(haritaDolgusu(true, 212.6)).toEqual({ top: 0, right: 0, bottom: 213, left: 0 });
  });

  // #53 §5: yarı açık panelde harita rotayı sığdırır.
  it('sigdir: merkez ortada, geniş alan daha uzak zoom, 11–16 arası', () => {
    const noktalar = [roma, { lat: 41.89, lng: 12.48 }, { lat: 41.91, lng: 12.5 }];
    const a = sigdir(noktalar, { genislik: 390, yukseklik: 300 })!;
    expect(a.konum.lat).toBeCloseTo(41.9, 2);
    expect(a.zoom).toBeGreaterThanOrEqual(11);
    expect(a.zoom).toBeLessThanOrEqual(16);
    const genis = sigdir([...noktalar, { lat: 41.95, lng: 12.6 }], { genislik: 390, yukseklik: 300 })!;
    expect(genis.zoom).toBeLessThan(a.zoom);
    expect(sigdir([], { genislik: 390, yukseklik: 300 })).toBeNull();
    expect(sigdir([roma], { genislik: 390, yukseklik: 300 })!.zoom).toBe(15);
  });

  // #55 §A2: öncelik — seçili > seçili günün durakları (sıra no küçük önce) > listede > diğer günler > atanmamış > öneri.
  it('etiketOnceligi: #55 sırası', () => {
    const p = (o: Partial<HaritaPini>): HaritaPini => ({ id: 'x', konum: roma, renk: '#000', ...o });
    const sirali = [
      p({ tur: 'oneri', secili: true }),
      p({ tur: 'durak', etiket: '1' }),
      p({ tur: 'durak', etiket: '2' }),
      p({ tur: 'listede' }),
      p({ tur: 'durak', etiket: '1', opaklik: 0.4 }),
      p({ tur: 'bos' }),
      p({ tur: 'oneri' }),
      p({ tur: 'etiket', etiket: '5 dk' }),
    ].map(etiketOnceligi);
    expect([...sirali].sort((a, b) => b - a)).toEqual(sirali);
    expect(new Set(sirali).size).toBe(sirali.length);
  });

  it('kumeHesapla: üst üste binen pinler tek pin + "+N"; uzaktakiler ayrı; yakınlaşınca dağılır', () => {
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 14 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const pin = (id: string, dLng: number, o: Partial<HaritaPini> = {}): HaritaPini => ({ id, konum: { lat: roma.lat, lng: roma.lng + dLng }, renk: '#000', tur: 'oneri', ...o });
    // 4 px arayla üç pin: seçili günün durağı baş olur, diğer ikisi gizlenir.
    const k = kumeHesapla([pin('a', 0), pin('b', 0.0001, { tur: 'durak', etiket: '1' }), pin('c', 0.0002), pin('uzak', 0.005)], bolge, ekran);
    expect([...k.gizli].sort()).toEqual(['a', 'c']);
    expect(k.rozet.get('b')).toBe(2);
    expect(k.uyeler.get('b')).toHaveLength(3);
    expect(k.rozet.has('uzak')).toBe(false);
    // 100 kat yakınlaşınca (40 px aralık) küme yok.
    expect(kumeHesapla([pin('a', 0), pin('b', 0.0001)], { ...bolge, latDelta: 0.0002, lngDelta: 0.0001, zoom: 20 }, ekran).gizli.size).toBe(0);
    // Rota hapları ve konum kümelenmez.
    expect(kumeHesapla([pin('a', 0), pin('h', 0, { tur: 'etiket', etiket: '4 dk' }), pin('k', 0, { tur: 'konum' })], bolge, ekran).gizli.size).toBe(0);
  });

  it('gizliEtiketler: başlık alanına düşen rota hapı gizlenir (#55 §A6)', () => {
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 14 };
    const ekran = { genislik: 400, yukseklik: 800 };
    // Ekranın üstünden 100 px aşağıda (merkezden 300 px yukarıda) bir hap; başlık 180 px.
    const hap: HaritaPini = { id: 'h', konum: { lat: roma.lat + 300 / 40000, lng: roma.lng }, renk: '#000', tur: 'etiket', etiket: '4 dk' };
    expect(gizliEtiketler([hap], bolge, ekran, 180).etiket.has('h')).toBe(true);
    expect(gizliEtiketler([hap], bolge, ekran, 50).etiket.has('h')).toBe(false);
  });
});
