/** @jest-environment jsdom */
import { describe, expect, it } from '@jest/globals';
import { uygulamayiOnYukle } from '@/lib/davetWebGirisi';

describe('#550 tam uygulamayı önden indirme', () => {
  const belgeKur = (meta?: string) => {
    document.head.innerHTML = meta ? `<meta name="tripmate-uygulama-js" content="${meta}">` : '';
    return document;
  };

  it('meta varsa bir kez prefetch bağlantısı ekler', () => {
    const belge = belgeKur('/_expo/static/js/web/entry-abc.js');
    expect(uygulamayiOnYukle(belge)).toBe(true);
    expect(uygulamayiOnYukle(belge)).toBe(false);
    const baglar = belge.querySelectorAll('link[rel="prefetch"]');
    expect(baglar).toHaveLength(1);
    expect(baglar[0].getAttribute('href')).toBe('/_expo/static/js/web/entry-abc.js');
  });

  it('meta yoksa ya da dış adresse hiçbir şey yapmaz', () => {
    expect(uygulamayiOnYukle(belgeKur())).toBe(false);
    expect(uygulamayiOnYukle(belgeKur('//kotu.example/a.js'))).toBe(false);
    expect(uygulamayiOnYukle(undefined)).toBe(false);
  });
});
