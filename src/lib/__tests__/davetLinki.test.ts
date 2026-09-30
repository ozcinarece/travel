import { describe, expect, it } from '@jest/globals';

import { davetTokeni } from '../davetLinki';

describe('davetTokeni', () => {
  it('https ve uygulama şeması linklerinden token çıkarır', () => {
    expect(davetTokeni('https://gezi.app/r/x7k2Ab9Q')).toBe('x7k2Ab9Q');
    expect(davetTokeni('  gezi://r/x7k2Ab9Q?utm=1 ')).toBe('x7k2Ab9Q');
  });

  it('çıplak 8 karakterlik kodu kabul eder', () => {
    expect(davetTokeni('x7k2Ab9Q')).toBe('x7k2Ab9Q');
  });

  it('yanlış uzunluk ve alakasız metinde null döner', () => {
    expect(davetTokeni('https://gezi.app/r/kisa')).toBeNull();
    expect(davetTokeni('https://gezi.app/r/cokuzunbirtoken')).toBeNull();
    expect(davetTokeni('merhaba')).toBeNull();
  });
});
