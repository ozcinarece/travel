import { describe, expect, it, jest } from '@jest/globals';

import type { HafifYer } from '../api';
import { aktifFiltreSayisi, BOS_FILTRE, filtreOzeti, filtreUygula, kategoriDegistir, oneCikanlar } from '../filtre';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const y = (place_id: string, puan: number | null, n: number | null, primary_type: string | null = 'tourist_attraction'): HafifYer => ({
  place_id,
  ad: place_id,
  lat: 0,
  lng: 0,
  primary_type,
  tz: null,
  puan,
  puan_sayisi: n,
  acik: null,
  ulke_kodu: null,
});

// #69 §A: öne çıkan = şehrin yüklenmiş mekanları arasında skoru en üst %10 (≥ 4,3 puan, ≥ 200 yorum); eşik şehre göre.
describe('oneCikanlar (#69)', () => {
  it('en üst %10, en az 4,3 puan ve 200 yorum; eşik listeye göre', () => {
    // 20 mekan → 2 öne çıkan.
    const liste = [y('a', 4.8, 30_000), y('b', 4.7, 9_000), y('c', 4.6, 5_000), ...Array.from({ length: 17 }, (_, i) => y(`z${i}`, 4.2, 100))];
    expect([...oneCikanlar(liste)]).toEqual(['a', 'b']);
    // Küçük şehir: 5 mekan → 1 öne çıkan; aday yoksa boş.
    expect([...oneCikanlar([y('a', 4.5, 300), y('b', 4.4, 250), y('c', 4.0, 50), y('d', 4.9, 20), y('e', null, null)])]).toEqual(['a']);
    expect(oneCikanlar([y('a', 4.9, 150), y('b', 4.2, 10_000)]).size).toBe(0);
    expect(oneCikanlar([]).size).toBe(0);
  });
  it('Roma ile Eskişehir aynı eşiği kullanmaz: aynı mekan büyük listede öne çıkmaz', () => {
    const esk = [y('kursunlu', 4.6, 9_000), y('x', 4.3, 400), y('q', 4.1, 100)];
    expect(oneCikanlar(esk).has('kursunlu')).toBe(true);
    const roma = [...Array.from({ length: 30 }, (_, i) => y(`r${i}`, 4.8, 100_000)), ...esk];
    expect(oneCikanlar(roma).has('kursunlu')).toBe(false);
    expect(oneCikanlar(roma).size).toBe(4);
  });
});

// #69 §B/§C: filtreler VE; "4,5+" yalnız ≥ 100 yorumlu; kategori çoklu.
describe('filtreUygula (#69)', () => {
  const liste = [y('a', 4.8, 30_000, 'museum'), y('b', 4.6, 60, 'cafe'), y('c', 4.5, 600, 'restaurant'), y('d', 4.0, 7_000, 'park'), y('e', null, null, null)];
  const one = new Set(['a']);
  it('boş filtre dokunmaz; öne çıkan / puan / yorum / kategori', () => {
    expect(filtreUygula(liste, BOS_FILTRE, one)).toBe(liste);
    expect(filtreUygula(liste, { ...BOS_FILTRE, oneCikan: true }, one).map((x) => x.place_id)).toEqual(['a']);
    // b 4,6 ama 60 yorum → sayılmaz.
    expect(filtreUygula(liste, { ...BOS_FILTRE, puan: 4.5 }, one).map((x) => x.place_id)).toEqual(['a', 'c']);
    expect(filtreUygula(liste, { ...BOS_FILTRE, yorum: 5000 }, one).map((x) => x.place_id)).toEqual(['a', 'd']);
    expect(filtreUygula(liste, { ...BOS_FILTRE, kategoriler: ['kafe', 'park'] }, one).map((x) => x.place_id)).toEqual(['b', 'd']);
    // VE: 4,5+ ve 5K+ birlikte → yalnız a.
    expect(filtreUygula(liste, { ...BOS_FILTRE, puan: 4.5, yorum: 5000 }, one).map((x) => x.place_id)).toEqual(['a']);
  });
  it('kategori seç/bırak ve rozet sayısı', () => {
    const f1 = kategoriDegistir(BOS_FILTRE, 'muze');
    expect(f1.kategoriler).toEqual(['muze']);
    expect(kategoriDegistir(f1, 'muze').kategoriler).toEqual([]);
    expect(aktifFiltreSayisi(BOS_FILTRE)).toBe(0);
    expect(aktifFiltreSayisi({ oneCikan: true, kategoriler: ['muze', 'park'], puan: 4.5, yorum: 0 })).toBe(3);
  });
  it('filtreOzeti: aktif filtreler · gizli sayısı', () => {
    expect(filtreOzeti({ ...BOS_FILTRE, oneCikan: true }, 9)).toBe('Şehrin öne çıkanları · 9 mekan gizli');
    expect(filtreOzeti({ oneCikan: false, kategoriler: ['muze'], puan: 4.5, yorum: 5000 }, 3)).toBe('Müze · 4,5+ puan · 5K+ yorum · 3 mekan gizli');
    expect(filtreOzeti({ ...BOS_FILTRE, kategoriler: ['muze', 'park'], yorum: 500 }, 0)).toBe('2 kategori · 500+ yorum · 0 mekan gizli');
  });
});
