// #537: depolaması kapalı tarayıcıda (localStorage null ya da SecurityError) oturum deposu bellekte kalır, hata fırlatmaz.
import { describe, expect, it } from '@jest/globals';

import { webDepolama } from '../depolama';

function guvenlikHatasi(): never {
  const e = new Error('Access is denied for this document.');
  e.name = 'SecurityError';
  throw e;
}

describe('webDepolama (#537)', () => {
  it('localStorage null ise bellek deposu döner ve çalışır', () => {
    const d = webDepolama({ localStorage: null });
    d.setItem('a', '1');
    expect(d.getItem('a')).toBe('1');
    d.removeItem('a');
    expect(d.getItem('a')).toBeNull();
  });

  it('localStorage okunurken SecurityError verirse bellek deposu döner', () => {
    const kapsam = {};
    Object.defineProperty(kapsam, 'localStorage', { get: guvenlikHatasi });
    const d = webDepolama(kapsam);
    d.setItem('a', '2');
    expect(d.getItem('a')).toBe('2');
  });

  it('localStorage yazılamıyorsa (kota/gizli mod) bellek deposu döner', () => {
    const ls = { getItem: () => null, setItem: guvenlikHatasi, removeItem: () => undefined } as unknown as Storage;
    const d = webDepolama({ localStorage: ls });
    expect(d).not.toBe(ls);
    d.setItem('a', '3');
    expect(d.getItem('a')).toBe('3');
  });

  it('yazılabilir localStorage varsa onu kullanır', () => {
    const kayit: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => kayit[k] ?? null,
      setItem: (k: string, v: string) => {
        kayit[k] = v;
      },
      removeItem: (k: string) => {
        delete kayit[k];
      },
    } as unknown as Storage;
    expect(webDepolama({ localStorage: ls })).toBe(ls);
    expect(Object.keys(kayit)).toHaveLength(0);
  });
});
