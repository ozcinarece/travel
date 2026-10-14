import { describe, expect, it } from '@jest/globals';

import { bulunmaEkli, iyelikEkli, yonelmeEkli } from '../ek';

describe('iyelikEkli (#143)', () => {
  it('son okunan sayının sesine göre ek', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(iyelikEkli)).toEqual(["1'i", "2'si", "3'ü", "4'ü", "5'i", "6'sı", "7'si", "8'i", "9'u"]);
    expect([10, 20, 30, 40, 50, 60, 70, 80, 90].map(iyelikEkli)).toEqual(["10'u", "20'si", "30'u", "40'ı", "50'si", "60'ı", "70'i", "80'i", "90'ı"]);
    expect([11, 26, 100, 1000].map(iyelikEkli)).toEqual(["11'i", "26'sı", "100'ü", "1000'i"]);
  });
});

describe('yonelmeEkli (#144)', () => {
  it('ünsüz / ünlü / iyelikli tamlama', () => {
    expect(['Eskişehir', 'Bursa', 'Kapadokya', 'Paris', 'New York', 'Eskişehir Gezisi', 'Roma Tatili', 'Ece ile Roma', 'İzmir'].map(yonelmeEkli)).toEqual([
      "Eskişehir'e",
      "Bursa'ya",
      "Kapadokya'ya",
      "Paris'e",
      "New York'a",
      "Eskişehir Gezisi'ne",
      "Roma Tatili'ne",
      "Ece ile Roma'ya",
      "İzmir'e",
    ]);
    expect(yonelmeEkli('Yaz 2026')).toBeNull();
  });
});

describe('bulunmaEkli (#191)', () => {
  it('kalın / ince ünlü, sert ünsüz, iyelikli tamlama', () => {
    expect(['Eskişehir', 'Bursa', 'Düzce', 'Kars', 'Sultanahmet', 'Bodrum', 'Kapadokya', 'İstanbul', 'Eskişehir Merkezi', 'New York'].map(bulunmaEkli)).toEqual([
      "Eskişehir'de",
      "Bursa'da",
      "Düzce'de",
      "Kars'ta",
      "Sultanahmet'te",
      "Bodrum'da",
      "Kapadokya'da",
      "İstanbul'da",
      "Eskişehir Merkezi'nde",
      "New York'ta",
    ]);
    expect(bulunmaEkli('Yaz 2026')).toBeNull();
  });
});
