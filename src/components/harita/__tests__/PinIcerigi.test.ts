import { describe, expect, it } from '@jest/globals';

import { pinGorseli, pinPngAnahtari } from '../PinIcerigi';
import type { HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };
const p = (o: Partial<HaritaPini>): HaritaPini => ({ id: 'x', konum: roma, renk: '#0f0f0f', ...o });

// #59 §B: pinin beklediği PNG ikon anahtarı — Harita.native bitmap yakalamasını buna bağlar.
describe('pinPngAnahtari', () => {
  it('kategori pini, listede ✓, tamamlanan durak ✓, otel ev, taksi hapı', () => {
    expect(pinPngAnahtari(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' }))).toBe('kamera-3b6fe0');
    expect(pinPngAnahtari(p({ tur: 'bos', ikon: 'agac', kategoriRenk: '#1f8a4c' }))).toBe('agac-1f8a4c');
    expect(pinPngAnahtari(p({ tur: 'listede' }))).toBe('tik-ffffff');
    expect(pinPngAnahtari(p({ tur: 'durak', etiket: '2', tamam: true }))).toBe('tik-ffffff');
    expect(pinPngAnahtari(p({ tur: 'otel' }))).toBe('ev-ffffff');
    expect(pinPngAnahtari(p({ tur: 'etiket', etiket: '14 dk', etiketIkon: 'taksi' }))).toBe('taksi-0f0f0f');
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
  it('kategori / listede / tamamlanan / otel için PNG; seçili 34 px sürümü', () => {
    expect(pinGorseli(p({ tur: 'oneri', ikon: 'kamera', kategoriRenk: '#3b6fe0' }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'bos', ikon: 'agac', kategoriRenk: '#1f8a4c', secili: true }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'listede', ikon: 'muze', kategoriRenk: '#8a4fd6' }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'listede' }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'durak', etiket: '2', tamam: true }))).toBeDefined();
    expect(pinGorseli(p({ tur: 'otel' }))).toBeDefined();
  });
  it('numaralı durak, konum, aday, hap ve bilinmeyen ikon görünüm olarak çizilir (undefined)', () => {
    expect(pinGorseli(p({ tur: 'durak', etiket: '2' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'konum' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'aday', etiket: 'Otel' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'etiket', etiket: '4 dk', etiketIkon: 'taksi' }))).toBeUndefined();
    expect(pinGorseli(p({ tur: 'oneri', ikon: 'pin' }))).toBeUndefined();
  });
});
