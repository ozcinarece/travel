import { describe, expect, it } from '@jest/globals';

import { enYakinPin, etiketBolgesi, etiketOnceligi, isaretciImzasi, izlemeGerekli, sigdir, bolgedenUzaklasti, bolgeHesapla, deltaZoom, detayGoster, gizliEtiketler, haritaDolgusu, kisaAd, kucukPin, mesafeM, pinBoyu, pinCapasi, pinCapi, SIFIR_DOLGU, zoomaGorePinler, zoomDelta } from '../geo';
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
    // #71 KK5: üst katmanın (ustBosluk) altında kalan ad gizlenir — pin ekranın üst 100 px'inde, üst katman 220 px.
    const ustte = { ...pin('u', 0, 'oneri'), konum: { lat: roma.lat + 0.0075, lng: roma.lng } };
    expect(gizliEtiketler([ustte], bolge, ekran, 220).etiket.has('u')).toBe(true);
    expect(gizliEtiketler([ustte], bolge, ekran, 60).etiket.has('u')).toBe(false);
    // 200 px arayla çakışma yok.
    expect(gizliEtiketler([pin('a', 0, 'oneri'), pin('b', 0.005, 'durak')], bolge, ekran).etiket.size).toBe(0);
    // Yakınlaşınca (aralık 10 kat küçük) aynı pinler artık çakışmaz.
    expect(gizliEtiketler(yakin, { ...bolge, latDelta: 0.002, lngDelta: 0.001, zoom: 13 }, ekran).etiket.size).toBe(0);
  });

  it('pinCapasi daire merkezini çapa yapar; detay satırıyla kutu uzar', () => {
    const c = pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' });
    expect(c.x).toBe(0.5);
    // #59: 28 px daire (+2 boşluk +16 etiket); seçili 34 px (halka kenarda).
    expect(c.y).toBeCloseTo(14 / 46);
    expect(pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' }, true).y).toBeCloseTo(14 / 60);
    // #65: seçili iğne 38 × 46 (+ 3,25 px dış halka → görünen uç 49,25), çapa görünen uç; etiket ucun 4 px altında.
    expect(pinCapasi({ id: 'x', konum: roma, renk: '#000', tur: 'durak', secili: true }).y).toBeCloseTo(49.25 / 69.25);
  });

  it('deltaZoom zoomDelta\'nın tersidir; bolgeHesapla zoom üretir', () => {
    expect(deltaZoom(zoomDelta(14))).toBeCloseTo(14);
    expect(bolgeHesapla(roma, zoomDelta(16), zoomDelta(16)).zoom).toBeCloseTo(16);
    expect(bolgeHesapla(roma, 0.02, 0.02, 15.5).zoom).toBe(15.5);
  });

  it('detayGoster: seçili ya da zoom ≥ 15 (#66; #40\'ta 14), puan ve ad varsa', () => {
    const p: HaritaPini = { id: 'x', konum: roma, renk: '#000', tur: 'oneri', ad: 'Pantheon', puan: 4.8 };
    expect(detayGoster(p, 14.9)).toBe(false);
    expect(detayGoster(p, 15)).toBe(true);
    expect(detayGoster(p, 16)).toBe(true);
    expect(detayGoster({ ...p, secili: true }, 12)).toBe(true);
    // #69: öne çıkan pinin altında ★ puan her zoom'da.
    expect(detayGoster({ ...p, oneCikan: true }, 12)).toBe(true);
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

  it('#59 §B: etiket bölgesi yalnız zoom adımında yenilenir; saf kaydırma aynı nesneyi döndürür', () => {
    const b1 = bolgeHesapla(roma, 0.02, 0.01);
    const kaydirilmis = bolgeHesapla({ lat: roma.lat + 0.01, lng: roma.lng + 0.02 }, 0.02, 0.01);
    expect(etiketBolgesi(b1, kaydirilmis)).toBe(b1);
    // Küçük zoom oynaması (< 0,125) da aynı adımda kalır; iki kat yakınlaşma yeni bölge.
    expect(etiketBolgesi(b1, bolgeHesapla(roma, 0.0195, 0.00975))).toBe(b1);
    const yakin = bolgeHesapla(roma, 0.01, 0.005);
    expect(etiketBolgesi(b1, yakin)).toBe(yakin);
    expect(etiketBolgesi(null, b1)).toBe(b1);
  });

  it('#59 §B: izleme imza yakalanınca kapanır; PNG yüklenmesi anahtara bağlı, imza değişince yeniden beklenmez', () => {
    // İlk kurulum: ne imza yakalandı ne PNG yüklendi.
    expect(izlemeGerekli('i1', null, 'kamera-3b6fe0', null)).toBe(true);
    // İmza yakalandı ama PNG henüz yok → açık; PNG gelince kapanır.
    expect(izlemeGerekli('i1', 'i1', 'kamera-3b6fe0', null)).toBe(true);
    expect(izlemeGerekli('i1', 'i1', 'kamera-3b6fe0', 'kamera-3b6fe0')).toBe(false);
    // İmza değişti (seçim / detay), PNG aynı: yalnız yakalama turu; yakalanınca kapanır (🔴 1).
    expect(izlemeGerekli('i2', 'i1', 'kamera-3b6fe0', 'kamera-3b6fe0')).toBe(true);
    expect(izlemeGerekli('i2', 'i2', 'kamera-3b6fe0', 'kamera-3b6fe0')).toBe(false);
    // PNG değişti (bos → listede ✓): yeni PNG beklenir.
    expect(izlemeGerekli('i3', 'i3', 'tik-ffffff', 'kamera-3b6fe0')).toBe(true);
    // İkonsuz pin (numaralı durak): yalnız imza.
    expect(izlemeGerekli('i1', 'i1', null, null)).toBe(false);
  });

  it('#59 §B: işaretçi imzası konum/opaklıktan bağımsız, görünümle değişir', () => {
    const p: HaritaPini = { id: 'a', konum: roma, renk: '#000', tur: 'oneri', ad: 'Pantheon', ikon: 'kamera', kategoriRenk: '#3b6fe0', puan: 4.7 };
    const imza = isaretciImzasi(p, false, false);
    expect(isaretciImzasi({ ...p, konum: { lat: 1, lng: 2 }, opaklik: 0.4 }, false, false)).toBe(imza);
    expect(isaretciImzasi(p, true, false)).not.toBe(imza);
    expect(isaretciImzasi(p, false, true)).not.toBe(imza);
    expect(isaretciImzasi({ ...p, secili: true }, false, false)).not.toBe(imza);
    expect(isaretciImzasi({ ...p, tur: 'listede' }, false, false)).not.toBe(imza);
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

// #66 KK1: pin hiç düşmez — çakışmada yalnız ad / puan gizlenir. KK2: zoom < 13'te öneri küçük pin (20 px, adsız).
describe('pin düşürme yok, zoom\'a göre küçük pin (#66)', () => {
  const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 15 };
  const ekran = { genislik: 400, yukseklik: 800 };
  const p = (id: string, dLng: number, o: Partial<HaritaPini>): HaritaPini => ({ id, konum: { lat: roma.lat, lng: roma.lng + dLng }, renk: '#000', ad: `Yer ${id}`, ...o });
  it('üst üste iki öneri: ikisi de kalır, yalnız düşük öncelikli (id sırası) adını yitirir', () => {
    const pinler = [p('a', 0, { tur: 'oneri' }), p('b', 0.0001, { tur: 'oneri' })];
    const gizli = gizliEtiketler(pinler, bolge, ekran);
    expect([...gizli.etiket]).toEqual(['b']);
    // Harita artık pin listesini süzmez: zoomaGorePinler zoom ≥ 13'te pinleri olduğu gibi bırakır.
    expect(zoomaGorePinler(pinler, 15)).toEqual(pinler);
  });
  it('listede pin önerinin üstünde: öneri kalır (adsız), listede adıyla', () => {
    const gizli = gizliEtiketler([p('o', 0, { tur: 'oneri' }), p('l', 0.0001, { tur: 'listede' })], bolge, ekran);
    expect(gizli.etiket.has('o')).toBe(true);
    expect(gizli.etiket.has('l')).toBe(false);
  });
  it('zoom < 13: seçili olmayan öneri küçük (20 px, adsız, puansız); listede / seçili / durak tam boy', () => {
    expect(kucukPin(p('a', 0, { tur: 'oneri' }), 12.9)).toBe(true);
    expect(kucukPin(p('a', 0, { tur: 'oneri' }), 13)).toBe(false);
    expect(kucukPin(p('a', 0, { tur: 'oneri', secili: true }), 12)).toBe(false);
    // #69: öne çıkan her zoom'da tam boy.
    expect(kucukPin(p('a', 0, { tur: 'oneri', oneCikan: true }), 12)).toBe(false);
    expect(kucukPin(p('a', 0, { tur: 'listede' }), 12)).toBe(false);
    const [k, l] = zoomaGorePinler([p('a', 0, { tur: 'oneri', puan: 4.5 }), p('l', 0.001, { tur: 'listede' })], 12);
    expect(k).toMatchObject({ kucuk: true, puan: null });
    expect(k.ad).toBeUndefined();
    expect(pinCapi(k)).toBe(20);
    expect(l.kucuk).toBeUndefined();
    // Küçük pinler adsız olduğundan hiçbir etiket çakışmaz.
    expect(gizliEtiketler(zoomaGorePinler([p('a', 0, { tur: 'oneri' }), p('b', 0.0001, { tur: 'oneri' })], 12), { ...bolge, zoom: 12 }, ekran).etiket.size).toBe(0);
  });
  it('#61 §5: diğer günün durağı 20 px, seçili günün durağı 28, seçili iğne 38', () => {
    expect(pinCapi({ id: 'x', konum: roma, renk: '#000', tur: 'durak', opaklik: 0.4 })).toBe(20);
    expect(pinCapi({ id: 'x', konum: roma, renk: '#000', tur: 'durak' })).toBe(28);
    expect(pinCapi({ id: 'x', konum: roma, renk: '#000', tur: 'durak', opaklik: 0.4, secili: true })).toBe(38);
  });

  it('#73 A: pin boyu zoom kademeleri 28 / 30 / 32 / 34; zoomaGorePinler boyu işler, küçük pin ve hap dokunulmaz', () => {
    expect([15, 16, 16.49, 16.5, 16.99, 17, 17.49, 17.5, 19].map(pinBoyu)).toEqual([28, 28, 28, 30, 30, 32, 32, 34, 34]);
    const pinler: HaritaPini[] = [
      { id: 'o', konum: roma, renk: '#000', tur: 'oneri', ad: 'A' },
      { id: 'l', konum: roma, renk: '#000', tur: 'listede', secili: true },
      { id: 'd', konum: roma, renk: '#000', tur: 'durak', etiket: '1' },
      { id: 'h', konum: roma, renk: '#000', tur: 'etiket', etiket: '4 dk' },
    ];
    const z18 = zoomaGorePinler(pinler, 18);
    expect(z18.map((p) => p.boy)).toEqual([34, 34, 34, undefined]);
    expect(pinCapi(z18[0])).toBe(34);
    // Seçili iğne 34 kademesinde 44 × 53; çapa görünen uç.
    expect(pinCapi(z18[1])).toBe(44);
    expect(pinCapasi(z18[1]).y).toBeCloseTo(56.25 / 76.25);
    expect(pinCapasi(pinler[1]).y).toBeCloseTo(49.25 / 69.25);
    // Zoom 15: boy yok (28), zoom 12: öneri küçük.
    expect(zoomaGorePinler(pinler, 15).map((p) => p.boy)).toEqual([undefined, undefined, undefined, undefined]);
    expect(zoomaGorePinler(pinler, 12)[0].kucuk).toBe(true);
  });

  it('#73 B: enYakinPin — 22 px içinde en yakın, dışında yok, eşitlikte pinZ; seçili iğnede baş merkezi; hap / konum sayılmaz', () => {
    // 1 px = 0,000025° (400 × 800 ekran, 0,02° × 0,01°).
    const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 15 };
    const ekran = { genislik: 400, yukseklik: 800 };
    const px = 0.000025;
    const p = (id: string, dx: number, dy: number, o: Partial<HaritaPini> = {}): HaritaPini => ({ id, konum: { lat: roma.lat + dy * px, lng: roma.lng + dx * px }, renk: '#000', tur: 'oneri', ...o });
    const a = p('a', 0, 0);
    const b = p('b', 30, 0);
    // 10 px sağda: a (10 px) b'den (20 px) yakın; 21 px: ikisi de aralıkta, b (9 px) yakın; 60 px: ikisi de 22 dışı.
    expect(enYakinPin([a, b], bolge, ekran, { lat: roma.lat, lng: roma.lng + 10 * px })).toBe('a');
    expect(enYakinPin([a, b], bolge, ekran, { lat: roma.lat, lng: roma.lng + 21 * px })).toBe('b');
    expect(enYakinPin([a, b], bolge, ekran, { lat: roma.lat, lng: roma.lng + 60 * px })).toBeNull();
    expect(enYakinPin([a], bolge, ekran, { lat: roma.lat + 22.5 * px, lng: roma.lng })).toBeNull();
    expect(enYakinPin([a], bolge, ekran, { lat: roma.lat + 21.5 * px, lng: roma.lng })).toBe('a');
    // Eşit uzaklıkta pinZ yüksek olan (listede 9 > öneri 1).
    const l = p('l', 30, 0, { tur: 'listede' });
    expect(enYakinPin([a, l], bolge, ekran, { lat: roma.lat, lng: roma.lng + 15 * px })).toBe('l');
    // Seçili iğne: baş merkezi koordinatın 27 px üstünde — uca değil başa dokunulur.
    const s = p('s', 0, 0, { secili: true });
    expect(enYakinPin([s], bolge, ekran, { lat: roma.lat + 27 * px, lng: roma.lng })).toBe('s');
    expect(enYakinPin([s], bolge, ekran, { lat: roma.lat - 10 * px, lng: roma.lng })).toBeNull();
    // Hap ve konum sayılmaz; işaretçi dokunuşu (konum = pin konumu) 0 px → o pin.
    expect(enYakinPin([p('h', 0, 0, { tur: 'etiket', etiket: '4 dk' }), p('k', 0, 0, { tur: 'konum' })], bolge, ekran, roma)).toBeNull();
    expect(enYakinPin([a, b], bolge, ekran, b.konum)).toBe('b');
    // Bölge yoksa seçim yok.
    expect(enYakinPin([a], null, ekran, roma)).toBeNull();
  });
});
