// #401 KK4: BO › İl önerileri saf kuralları.
import { describe, expect, it } from '@jest/globals';

import { ilceler, kategoriSayilari, kategoriTahmini, silindiSirasi, suz, tasi, yeniSira, zamanEtiketi, type IlKategori, type IlOneri } from '../ilOneri';

const yer = (id: string, sira: number, kategori: IlKategori, ilce: string | null = 'Merkez'): IlOneri => ({
  id,
  il_slug: 'bolu',
  sira,
  ad: id,
  kategori,
  amaclar: [],
  ilce,
  merkeze_km: null,
  neden: null,
  place_id: null,
  gorunur: true,
});

const LISTE = [yer('a', 1, 'doga'), yer('b', 2, 'yemek', 'Mudurnu'), yer('c', 3, 'doga', 'Mudurnu'), yer('d', 4, 'muze'), yer('e', 5, 'doga')];

describe('il önerileri süzgeci', () => {
  it('kategori ve ilçe birlikte süzer', () => {
    expect(suz(LISTE, { kategori: 'doga', ilce: null }).map((o) => o.id)).toEqual(['a', 'c', 'e']);
    expect(suz(LISTE, { kategori: 'doga', ilce: 'Mudurnu' }).map((o) => o.id)).toEqual(['c']);
  });

  it('çipler yalnız dolu kategoriler, kanvas sırasıyla; sayılar ilçeye göre', () => {
    expect(kategoriSayilari(LISTE, null)).toEqual([
      { kategori: 'doga', sayi: 3 },
      { kategori: 'yemek', sayi: 1 },
      { kategori: 'muze', sayi: 1 },
    ]);
    expect(kategoriSayilari(LISTE, 'Mudurnu')).toEqual([
      { kategori: 'doga', sayi: 1 },
      { kategori: 'yemek', sayi: 1 },
    ]);
  });

  it('ilçeler tekrarsız ve Türkçe sırayla', () => {
    expect(ilceler([...LISTE, yer('f', 6, 'tarih', 'Çaydurt'), yer('g', 7, 'tarih', null)])).toEqual(['Çaydurt', 'Merkez', 'Mudurnu']);
  });
});

describe('sürükleme sırası', () => {
  it('bütün listede yukarı ve aşağı taşır', () => {
    expect(tasi(LISTE, LISTE, 3, 0)).toEqual(['d', 'a', 'b', 'c', 'e']);
    expect(tasi(LISTE, LISTE, 0, 2)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(tasi(LISTE, LISTE, 1, 1)).toBeNull();
  });

  it('süzülmüş listede taşınan yer hedefin yanına girer, diğerleri yerinde kalır', () => {
    const doga = suz(LISTE, { kategori: 'doga', ilce: null });
    expect(tasi(LISTE, doga, 2, 0)).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(tasi(LISTE, doga, 0, 1)).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('silme boşluğu kapatır; yeni yer sona', () => {
    expect(silindiSirasi(LISTE, 'b')).toEqual(['a', 'c', 'd', 'e']);
    expect(yeniSira(LISTE)).toBe(6);
    expect(yeniSira([])).toBe(1);
  });
});

describe('yeni yerin kategorisi', () => {
  it('seçili süzgeç önce, yoksa Google tipinden', () => {
    expect(kategoriTahmini('museum', 'yemek')).toBe('yemek');
    expect(kategoriTahmini('museum', null)).toBe('muze');
    expect(kategoriTahmini('national_park', null)).toBe('doga');
    expect(kategoriTahmini('cafe', null)).toBe('tatli_kahve');
    expect(kategoriTahmini('turkish_restaurant', null)).toBe('yemek');
    // #440: lokanta yemek durağı, kafe değil.
    expect(kategoriTahmini('cafeteria', null)).toBe('yemek');
    expect(kategoriTahmini('ski_resort', null)).toBe('aktivite');
    expect(kategoriTahmini('observation_deck', null)).toBe('manzara');
    expect(kategoriTahmini('mosque', null)).toBe('tarih');
    expect(kategoriTahmini(null, null)).toBe('tarih');
  });
});

describe('son değişiklik zamanı', () => {
  it('aynı gün "bugün", başka gün tarih (İstanbul saati)', () => {
    const simdi = new Date('2026-11-19T15:00:00Z');
    expect(zamanEtiketi('2026-11-19T13:25:00Z', simdi)).toBe('bugün 16:25');
    expect(zamanEtiketi('2026-11-18T13:25:00Z', simdi)).toBe('18 Kasım 16:25');
  });
});
