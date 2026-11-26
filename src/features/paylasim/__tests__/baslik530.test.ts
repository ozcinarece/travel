// #530 incelemesi: paylaşımda yalnız ilk ad (1) ve üç kip (3). Sunucudaki `paylasim_ozeti` aynı kuralı kullanır (rls_test.sql).
import { describe, expect, it } from '@jest/globals';

import { ilkAd, kisiKipi, paylasimOzeti } from '../baslik';

describe('#530 paylaşım başlığı yardımcıları', () => {
  it('ilkAd her boşlukta böler (boşluk, sekme, U+00A0, baştaki boşluk); ad yoksa null', () => {
    expect(ilkAd('Ayşe Yılmaz')).toBe('Ayşe');
    expect(ilkAd('Ayşe\tYılmaz')).toBe('Ayşe');
    expect(ilkAd('Ayşe Yılmaz')).toBe('Ayşe');
    expect(ilkAd('  Ayşe  Yılmaz ')).toBe('Ayşe');
    expect(ilkAd('Ayşe')).toBe('Ayşe');
    expect(ilkAd('   ')).toBeNull();
    expect(ilkAd(null)).toBeNull();
  });

  it('kip geziModu ile: plan gidiyor, gezi geziyor, bitti gezdi', () => {
    expect(kisiKipi('plan')).toBe('gidiyor');
    expect(kisiKipi('gezi')).toBe('geziyor');
    expect(kisiKipi('bitti')).toBe('gezdi');
    expect(paylasimOzeti(3, 12, 3, 'geziyor')).toBe('3 gün · 12 durak · 3 kişi geziyor');
    expect(paylasimOzeti(3, 12, 3, 'gezdi')).toBe('3 gün · 12 durak · 3 kişi gezdi');
  });
});
