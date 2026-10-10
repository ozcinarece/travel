import { beforeEach, describe, expect, it } from '@jest/globals';

import { hataOzeti, ilkBilesen, izEkle, izleriSifirla, sonIzler } from '../izler';

describe('izler (#85 hata kartı kanıtı)', () => {
  beforeEach(() => izleriSifirla());

  it('son 5 iz en yenisi sonda; 20 ile sınırlı', () => {
    for (let i = 0; i < 25; i++) izEkle('panel', `iz ${i}`, i);
    const son = sonIzler(5);
    expect(son.map((x) => x.mesaj)).toEqual(['iz 20', 'iz 21', 'iz 22', 'iz 23', 'iz 24']);
    expect(sonIzler(100)).toHaveLength(20);
  });

  it('hata özeti ilk satır + ad; bileşen yığınından ilk bileşen', () => {
    expect(hataOzeti(new TypeError("Cannot read property 'contentOffset' of null\nat x"))).toBe("TypeError: Cannot read property 'contentOffset' of null");
    expect(hataOzeti('düz metin\nikinci')).toBe('düz metin');
    expect(ilkBilesen('\n    in FotoSeridi (created by GenelSekmesi)\n    in RCTScrollView')).toBe('FotoSeridi');
    expect(ilkBilesen('at KucukFoto (file.tsx:12)')).toBe('KucukFoto');
    expect(ilkBilesen(null)).toBeNull();
  });
});
