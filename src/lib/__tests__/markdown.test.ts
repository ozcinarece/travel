import { describe, expect, it } from '@jest/globals';

import { markdownAyristir, okumaSuresiDk } from '../markdown';

describe('markdownAyristir (#97 B KK1)', () => {
  it('paragraf, başlık, alıntı, madde ve ikili foto satırı', () => {
    const md = `Giriş paragrafı\nikinci satırı.\n\n## 1. gün\n\n- a\n- b\n\n> Çibörek için erken gidin.\n\n![Porsuk](https://x/1.jpg)\n![Sazova](https://x/2.jpg)\n\nSon.`;
    expect(markdownAyristir(md)).toEqual([
      { tur: 'paragraf', metin: 'Giriş paragrafı ikinci satırı.' },
      { tur: 'baslik', seviye: 2, metin: '1. gün' },
      { tur: 'madde', ogeler: ['a', 'b'] },
      { tur: 'alinti', metin: 'Çibörek için erken gidin.' },
      { tur: 'fotolar', fotolar: [{ url: 'https://x/1.jpg', alt: 'Porsuk' }, { url: 'https://x/2.jpg', alt: 'Sazova' }], altyazi: 'Porsuk' },
      { tur: 'paragraf', metin: 'Son.' },
    ]);
  });
  it('üçüncü görsel yeni satıra; boş kaynak boş; okuma süresi en az 1 dk', () => {
    const md = '![a](u1)\n![b](u2)\n![c](u3)';
    const b = markdownAyristir(md);
    expect(b).toHaveLength(2);
    expect(b[1]).toEqual({ tur: 'fotolar', fotolar: [{ url: 'u3', alt: 'c' }], altyazi: 'c' });
    expect(markdownAyristir(null)).toEqual([]);
    expect(okumaSuresiDk('bir iki üç')).toBe(1);
    expect(okumaSuresiDk(Array.from({ length: 800 }, () => 'kelime').join(' '))).toBe(4);
  });
});
