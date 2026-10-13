import { describe, expect, it } from '@jest/globals';

import { aktifBolum, bolumYazisi, okumaOrani, rehberMekanIdleri } from '../rehber';

describe('şehir rehberi sekmesi (#142 KK4–5)', () => {
  it('yazılardaki mekanlar: kart ve satır içi bağlantı, tekil, sırayla', () => {
    const a = 'Çiböreği [Hayri Usta](mekan:ChIJ-hayri-usta-0001) yapar.\n\n::mekan[ChIJ-hayri-usta-0001]\n\n::mekan[ChIJ-met-helva-00002]';
    const b = '# Mahalleler\n\nOdunpazarı ve [Kurşunlu](mekan:ChIJ-kursunlu-00003).';
    expect(rehberMekanIdleri([a, null, b])).toEqual(['ChIJ-hayri-usta-0001', 'ChIJ-met-helva-00002', 'ChIJ-kursunlu-00003']);
  });
  it('okunan bölüm: üstü yapışkan başlığın altına gelmiş son bölüm', () => {
    const konumlar = [400, 900, undefined, 1600];
    expect(aktifBolum(0, konumlar, 160)).toBe(0);
    expect(aktifBolum(800, konumlar, 160)).toBe(1);
    expect(aktifBolum(1500, konumlar, 160)).toBe(3);
  });
  it('okuma oranı 0–1; kaymayan içerikte 1', () => {
    expect(okumaOrani(0, 3000, 800)).toBe(0);
    expect(okumaOrani(1100, 3000, 800)).toBe(0.5);
    expect(okumaOrani(5000, 3000, 800)).toBe(1);
    expect(okumaOrani(0, 500, 800)).toBe(1);
  });
  it('bölüm yazısının ilk başlığı düşer', () => {
    expect(bolumYazisi('# Ne yenir\n\nÇibörek.')).toBe('Çibörek.');
    expect(bolumYazisi(null)).toBe('');
  });
});
