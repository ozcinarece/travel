import { describe, expect, it } from '@jest/globals';

import { addanOner, gecerliKullaniciAdi, temizle } from '../kullaniciAdi';

describe('temizle', () => {
  it('Türkçe karakterleri sadeleştirir ve küçültür', () => {
    expect(temizle('Ece Özçınar')).toBe('ece.ozcinar');
    expect(temizle('İSMAİL')).toBe('ismail');
    expect(temizle('IŞIK')).toBe('isik');
  });

  it('izin verilmeyen karakterleri atar, 24 ile sınırlar', () => {
    expect(temizle('ece@gezer!')).toBe('ecegezer');
    expect(temizle('a'.repeat(30))).toHaveLength(24);
  });
});

describe('gecerliKullaniciAdi', () => {
  it('3–24 karakter, küçük harf/rakam/nokta/alt çizgi', () => {
    expect(gecerliKullaniciAdi('ece.gezer')).toBe(true);
    expect(gecerliKullaniciAdi('ab')).toBe(false);
    expect(gecerliKullaniciAdi('Ece')).toBe(false);
    expect(gecerliKullaniciAdi('ece gezer')).toBe(false);
  });
});

describe('addanOner', () => {
  it('baştaki, sondaki ve ardışık noktaları temizler', () => {
    expect(addanOner('  Ece  Özçınar  ')).toBe('ece.ozcinar');
    expect(addanOner('.ece.')).toBe('ece');
  });
});
