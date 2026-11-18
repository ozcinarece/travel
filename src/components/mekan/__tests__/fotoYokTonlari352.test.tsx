// #352 (kanvas 29i · D2): fotoğraf yok halinde 8 kategorinin koyu glif tonu; bekleme ve çevrimdışında da D hali.
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { KATEGORI_KOYU, kategoriKoyuRengi, kutuRengi } from '@/components/gezi/GeziParcalari';
import { KATEGORI_PIN, type PinKategorisi } from '@/lib/pinIkonu';

import { FotoYok, fotoAlaniHali, fotoYokGosterilir } from '../MekanPaneli';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn(), hataBildir: jest.fn() }));

// Kategoriyi seçen örnek primary_type, glif ve tablodaki koyu ton (#352 KK1).
const TABLO: [PinKategorisi, string, string, string][] = [
  ['gezilecek', 'tourist_attraction', 'kamera', '#2350C4'],
  ['muze', 'museum', 'muze', '#5B34B8'],
  ['ibadet', 'mosque', 'ibadet', '#4B5563'],
  ['yemek', 'restaurant', 'catal', '#B23A0A'],
  ['kafe', 'cafe', 'fincan', '#7A4520'],
  ['park', 'park', 'agac', '#16703C'],
  ['manzara', 'scenic_spot', 'dag', '#0369A1'],
  ['alisveris', 'shopping_mall', 'canta', '#A3154D'],
];

function goreliParlaklik(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const [x, y] = [goreliParlaklik(a), goreliParlaklik(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe('kategoriKoyuRengi (KK1)', () => {
  it.each(TABLO)('%s: tablodaki koyu ton, glif değişmez', (kategori, tip, glif, ton) => {
    expect(kategoriKoyuRengi(tip)).toBe(ton);
    expect(KATEGORI_KOYU[kategori]).toBe(ton);
    expect(KATEGORI_PIN[kategori].ikon).toBe(glif);
  });

  it('8 kategorinin hepsi tanımlı ve hiçbiri pin rengine düşmüyor', () => {
    expect(Object.keys(KATEGORI_KOYU).sort()).toEqual(Object.keys(KATEGORI_PIN).sort());
    for (const k of Object.keys(KATEGORI_PIN) as PinKategorisi[]) {
      expect(KATEGORI_KOYU[k].toLowerCase()).not.toBe(KATEGORI_PIN[k].renk.toLowerCase());
    }
  });

  it('pin renkleri değişmedi (harita pinleri ve PNG adları bunlara bağlı)', () => {
    expect(KATEGORI_PIN.manzara.renk).toBe('#0ea5e9');
    expect(KATEGORI_PIN.muze.renk).toBe('#8a4fd6');
  });

  it.each(TABLO)('%s: beyazda ve kendi kutuRengi zemininde kontrast ≥ 4,5:1', (_k, tip, _g, ton) => {
    expect(kontrast(ton, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(ton, kutuRengi(tip))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('bekleme ve çevrimdışı (KK2)', () => {
  const temel = { rehberKapak: false, rehberli: false, rehberBekliyor: false, googleFotolar: 0, hafifFoto: false };

  it('rehberli mi bekleniyorken (çevrimdışında sorgu duraklar) D hali gösterilir', () => {
    const hali = fotoAlaniHali({ ...temel, rehberBekliyor: true, googleFotolar: 5, hafifFoto: true });
    expect(hali).toBe('bekliyor');
    expect(fotoYokGosterilir(hali)).toBe(true);
  });

  it('fotoğraf gelince D yerini fotoğrafa bırakır', () => {
    expect(fotoYokGosterilir(fotoAlaniHali({ ...temel, googleFotolar: 2 }))).toBe(false);
    expect(fotoYokGosterilir(fotoAlaniHali({ ...temel, hafifFoto: true }))).toBe(false);
    expect(fotoYokGosterilir(fotoAlaniHali({ ...temel, rehberKapak: true }))).toBe(false);
    expect(fotoYokGosterilir(fotoAlaniHali(temel))).toBe(true);
  });

  it('D hali: foto-yok, zemin kutuRengi, glif koyu tonda', () => {
    const { getByTestId, UNSAFE_root } = render(<FotoYok tip="scenic_spot" />);
    expect(getByTestId('foto-yok')).toBeTruthy();
    expect(getByTestId('kategori-glifi')).toBeTruthy();
    expect(UNSAFE_root.findAll((n) => (n.props as { stroke?: string }).stroke === '#0369A1').length).toBeGreaterThan(0);
  });
});
