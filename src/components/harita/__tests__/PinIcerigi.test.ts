import { describe, expect, it } from '@jest/globals';

import { PIN_IKONLARI } from '../pinIkonlari';
import { pinGorselAdi, pinGorseli, pinPngAnahtari } from '../PinIcerigi';
import type { HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };
const p = (o: Partial<HaritaPini>): HaritaPini => ({ id: 'x', konum: roma, renk: '#0f0f0f', ...o });

// #59 §B: pinin beklediği PNG ikon anahtarı — Harita.native bitmap yakalamasını buna bağlar.
describe('pinPngAnahtari', () => {
  it('kategori pini, listede ✓, tamamlanan durak ✓, otel ev, araba hapı', () => {
    expect(pinPngAnahtari(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' }))).toBe('kamera-3b6fe0');
    expect(pinPngAnahtari(p({ tur: 'bos', ikon: 'agac', kategoriRenk: '#1f8a4c' }))).toBe('agac-1f8a4c');
    expect(pinPngAnahtari(p({ tur: 'listede' }))).toBe('tik-ffffff');
    expect(pinPngAnahtari(p({ tur: 'durak', etiket: '2', tamam: true }))).toBe('tik-ffffff');
    expect(pinPngAnahtari(p({ tur: 'otel' }))).toBe('ev-ffffff');
    expect(pinPngAnahtari(p({ tur: 'etiket', etiket: '14 dk', etiketIkon: 'araba', renk: '#1f4fc2' }))).toBe('araba-1f4fc2');
  });

  it('ikonsuz ya da PNG üretilmemiş pin → null (SVG / metin, beklenmez)', () => {
    expect(pinPngAnahtari(p({ tur: 'durak', etiket: '2' }))).toBeNull();
    expect(pinPngAnahtari(p({ tur: 'konum' }))).toBeNull();
    expect(pinPngAnahtari(p({ tur: 'aday', etiket: 'Otel' }))).toBeNull();
    expect(pinPngAnahtari(p({ tur: 'etiket', etiket: '4 dk' }))).toBeNull();
    // Üretilmemiş renk: SVG'ye düşer.
    expect(pinPngAnahtari(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#123456' }))).toBeNull();
  });
});

// #61 §6: tam pin görseli (daire + ikon) — görünüm yakalaması gerektirmeyen `image` işaretçisi.
describe('pinGorseli', () => {
  it('kategori / listede / tamamlanan / otel için PNG; seçili iğne sürümü', () => {
    expect(pinGorseli(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' }))).toBeDefined();
    // #69: öne çıkan — ★ rozetli sürümler (öneri / listede, daire / iğne) ayrı PNG.
    const temel = p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' });
    expect(pinGorseli({ ...temel, oneCikan: true })).toBeDefined();
    expect(pinGorseli({ ...temel, oneCikan: true })).not.toBe(pinGorseli(temel));
    expect(pinGorseli({ ...temel, oneCikan: true, secili: true })).not.toBe(pinGorseli({ ...temel, secili: true }));
    expect(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6', oneCikan: true }))).not.toBe(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6' })));
    // Küçük pin öne çıkan olamaz (kucukPin), tamamlanan durakta rozet yok.
    expect(pinGorseli(p({ tur: 'durak', etiket: '2', tamam: true, oneCikan: true }))).toBe(pinGorseli(p({ tur: 'durak', etiket: '2', tamam: true })));
    // #66: küçük öneri pini ayrı PNG (20 px).
    const kucuk = pinGorseli(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0', kucuk: true }));
    expect(kucuk).toBeDefined();
    expect(kucuk).not.toBe(pinGorseli(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' })));
    expect(pinGorseli(p({ tur: 'bos', ikon: 'agac', kategoriRenk: '#1f8a4c', secili: true }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6', secili: true }))).not.toBe(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6' })));
    expect(pinGorseli(p({ tur: 'durak', etiket: '2', tamam: true, secili: true }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6' }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'listede' }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'durak', etiket: '2', tamam: true }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'otel' }))).toBeDefined();
  });
  it('numaralı durak, konum, aday, hap ve bilinmeyen ikon görünüm olarak çizilir (undefined)', () => {
    expect(pinGorseli(p({ tur: 'durak', etiket: '2' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'konum' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'aday', etiket: 'Otel' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'etiket', etiket: '4 dk', etiketIkon: 'araba' }))).toBeUndefined();
    // #65: seçili numaralı durak görünüm (iğne), PNG yok.
    expect(pinGorseli(p({ tur: 'durak', etiket: '2', secili: true }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'oneri', ikon: 'pin' }))).toBeUndefined();
  });

  it('#73 A: boy kademesi PNG adına girer; seçili iğne 34 kademesinde igne34-; küçük pin boydan bağımsız', () => {
    const o = p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' });
    expect(pinGorselAdi(o)).toBe('daire-kamera-28');
    expect(pinGorselAdi({ ...o, boy: 30 })).toBe('daire-kamera-30');
    expect(pinGorselAdi({ ...o, boy: 34, oneCikan: true })).toBe('one-daire-kamera-34');
    expect(pinGorselAdi({ ...o, boy: 32, secili: true })).toBe('igne-daire-kamera');
    expect(pinGorselAdi({ ...o, boy: 34, secili: true })).toBe('igne34-daire-kamera');
    expect(pinGorselAdi(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6', boy: 34, secili: true, oneCikan: true }))).toBe('igne34-one-dolu-muze');
    expect(pinGorselAdi(p({ tur: 'listede', boy: 34 }))).toBe('tik-34');
    expect(pinGorselAdi(p({ tur: 'otel', boy: 32 }))).toBe('otel-32');
    expect(pinGorselAdi(p({ tur: 'durak', etiket: '2', tamam: true, boy: 34, secili: true }))).toBe('igne34-tamam');
    expect(pinGorselAdi({ ...o, boy: 34, kucuk: true })).toBe('kucuk-kamera-20');
    for (const ad of ['daire-kamera-30', 'one-dolu-agac-32', 'igne34-tik', 'otel-34']) expect(pinGorseli({ ...o, boy: 34 }) !== undefined && ad in PIN_IKONLARI).toBe(true);
  });
});
