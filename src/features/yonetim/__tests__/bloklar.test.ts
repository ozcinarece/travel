import { describe, expect, it } from '@jest/globals';

import { markdownAyristir, satirParcalari } from '@/lib/markdown';

import {
  blokSayaclari,
  blokTasi,
  blokYerlestir,
  bloklarMd,
  duzMetin,
  fotoAdresleri,
  htmlMd,
  mdBloklari,
  mdHtml,
  slashSuz,
  slashSuzgeci,
  type Blok,
  type HtmlDugum,
} from '../bloklar';

const YAZI = [
  'Eskişehir’in imzası **çibörek**: ince hamur. Tatlı için [met helvası](mekan:ChIJ-met-helva-00002) almadan dönmeyin.',
  '',
  '![Kalabalık bir öğle sırası](foto:sehirler/11111111-1111-4111-8111-000000000001/a1b2c3d4-cibörek.webp)',
  '',
  '::mekan[ChIJ-hayri-usta-0001]',
  '',
  '## Tatlılar',
  '',
  '> Met helvasını *kutu kutu* alın.',
  '',
  '- Çibörek',
  '- [Balaban](https://ornek.com/balaban)',
].join('\n');

const tursuz = (b: Blok[]) => b.map(({ id: _id, ...r }) => r);

/** Testte DOM yerine küçük ağaç. */
function el(ad: string, cocuklar: (HtmlDugum | string)[], nitelik: Record<string, string> = {}, style?: HtmlDugum['style']): HtmlDugum {
  const childNodes = cocuklar.map((c) => (typeof c === 'string' ? { nodeType: 3, nodeName: '#text', textContent: c, childNodes: [] } : c));
  return { nodeType: 1, nodeName: ad.toUpperCase(), textContent: null, childNodes, getAttribute: (a) => nitelik[a] ?? null, style };
}

// #156 KK1 / KK6: WYSIWYG editör markdown'ı okur ve aynı biçimde yazar (mobil uyumu).
describe('bloklar (#156)', () => {
  it('markdown → bloklar: paragraf, foto, mekan kartı, ara başlık, ipucu (>), madde', () => {
    expect(tursuz(mdBloklari(YAZI))).toEqual([
      { tur: 'paragraf', md: 'Eskişehir’in imzası **çibörek**: ince hamur. Tatlı için [met helvası](mekan:ChIJ-met-helva-00002) almadan dönmeyin.' },
      { tur: 'foto', hedef: 'foto:sehirler/11111111-1111-4111-8111-000000000001/a1b2c3d4-cibörek.webp', alt: 'Kalabalık bir öğle sırası' },
      { tur: 'mekan', place_id: 'ChIJ-hayri-usta-0001' },
      { tur: 'baslik', md: 'Tatlılar' },
      { tur: 'ipucu', md: 'Met helvasını *kutu kutu* alın.' },
      { tur: 'liste', ogeler: ['Çibörek', '[Balaban](https://ornek.com/balaban)'] },
    ]);
  });

  it('gidiş-dönüş: aynı markdown; uygulamanın ayrıştırıcısı aynı blokları görür', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ornek.supabase.co';
    const geri = bloklarMd(mdBloklari(YAZI));
    expect(geri).toBe(YAZI);
    expect(markdownAyristir(geri).map((b) => b.tur)).toEqual(['paragraf', 'fotolar', 'mekan', 'baslik', 'alinti', 'madde']);
  });

  it('eski görsel satırları olduğu gibi: https ve virgüllü iki hedef', () => {
    const md = '![Masal şatosu](foto:yerler/y1/a.jpg, foto:yerler/y1/b.jpg)\n\n![Göl](https://ornek.com/g.jpg)';
    const b = mdBloklari(md);
    expect(b.map((x) => x.tur)).toEqual(['foto', 'foto']);
    expect(bloklarMd(b)).toBe(md);
    expect(fotoAdresleri((b[0] as { hedef: string }).hedef, (y) => `K/${y}`)).toEqual(['K/yerler/y1/a.jpg', 'K/yerler/y1/b.jpg']);
    expect(fotoAdresleri((b[1] as { hedef: string }).hedef, (y) => `K/${y}`)).toEqual(['https://ornek.com/g.jpg']);
  });

  it('boş paragraf / madde yazılmaz; çok satırlı paragraf tek satır', () => {
    const md = bloklarMd([
      { id: '1', tur: 'paragraf', md: '' },
      { id: '2', tur: 'paragraf', md: 'bir\niki' },
      { id: '3', tur: 'liste', ogeler: ['', 'a'] },
      { id: '4', tur: 'ipucu', md: '  ' },
    ]);
    expect(md).toBe('bir iki\n\n- a');
  });

  it('satır içi markdown ↔ HTML (dış bağlantı uygulamada yok: düz metin)', () => {
    const md = 'Bir **kalın** ve *italik*, [Met](mekan:ChIJ-met-helva-00002) ile [site](https://ornek.com/a?b=1) & <x>';
    const html = mdHtml(md);
    expect(html).toBe('Bir <b>kalın</b> ve <i>italik</i>, <a href="mekan:ChIJ-met-helva-00002">Met</a> ile [site](https://ornek.com/a?b=1) &amp; &lt;x&gt;');
    const kok = el('div', [
      'Bir ',
      el('b', ['kalın']),
      ' ve ',
      el('i', ['italik']),
      ', ',
      el('a', ['Met'], { href: 'mekan:ChIJ-met-helva-00002' }),
      ' ile [site](https://ornek.com/a?b=1) & <x>',
    ]);
    expect(htmlMd(kok)).toBe(md);
  });

  it('iç içe biçim ve biçimli bağlantı: tek kat işaret, bağlantı sarılmaz; uygulamanın ayrıştırıcısı işaretsiz okur', () => {
    const met = { href: 'mekan:ChIJ-met-helva-00002' };
    const ornekler: [HtmlDugum, string][] = [
      [el('div', [el('b', [el('i', ['ikisi'])])]), '**ikisi**'],
      [el('div', [el('i', ['a ', el('b', ['b']), ' c'])]), '*a b c*'],
      [el('div', [el('b', [el('a', ['Met'], met)])]), '[Met](mekan:ChIJ-met-helva-00002)'],
      [el('div', [el('a', [el('b', ['Met'])], met)]), '[Met](mekan:ChIJ-met-helva-00002)'],
      [el('div', [el('b', ['önce ', el('a', ['Met'], met), ' sonra'])]), '**önce** [Met](mekan:ChIJ-met-helva-00002) **sonra**'],
      [el('div', [el('span', ['x'], {}, { fontWeight: '700', fontStyle: 'italic' })]), '**x**'],
    ];
    for (const [kok, beklenen] of ornekler) {
      const md = htmlMd(kok);
      expect(md).toBe(beklenen);
      const parcalar = satirParcalari(md);
      expect(parcalar.map((p) => p.metin).join('')).not.toMatch(/[*[\]]/);
    }
    expect(satirParcalari('**önce** [Met](mekan:ChIJ-met-helva-00002) **sonra**').find((p) => p.place_id)?.metin).toBe('Met');
  });

  it('başlık seviyesi korunur (#, ##, ###)', () => {
    expect(bloklarMd(mdBloklari('# Bir\n\n## İki\n\n### Üç'))).toBe('# Bir\n\n## İki\n\n### Üç');
  });

  it('tarayıcı biçimleri: strong/em, kalın span, boşluk işaretin dışında, br ve nbsp boşluk, bilinmeyen bağlantı düz metin', () => {
    const kok = el('div', [
      el('strong', ['kalın ']),
      'metin',
      el('br', []),
      el('em', [' italik']),
      el('span', ['span'], {}, { fontWeight: '700' }),
      ' son ',
      el('a', ['js'], { href: 'javascript:alert(1)' }),
    ]);
    expect(htmlMd(kok)).toBe('**kalın** metin *italik***span** son js');
  });

  it('düz metin (süzgeç için)', () => {
    expect(duzMetin('**a** *b* [c](mekan:ChIJ-met-helva-00002)')).toBe('a b c');
  });

  it('"/" menüsü: "/me" mekan kartını, "/" hepsini, Türkçe harf duyarsız', () => {
    const etiket = { mekan: ['Mekan kartı'], baslik: ['Ara başlık'], foto: ['Fotoğraf'], ipucu: ['İpucu kutusu'], liste: ['Madde listesi'] };
    expect(slashSuzgeci('/me')).toBe('me');
    expect(slashSuzgeci('/')).toBe('');
    expect(slashSuzgeci('a/me')).toBeNull();
    expect(slashSuzgeci('/me x')).toBeNull();
    expect(slashSuz('me', etiket)).toEqual(['mekan']);
    expect(slashSuz('', etiket)).toEqual(['mekan', 'baslik', 'foto', 'ipucu', 'liste']);
    expect(slashSuz('ipu', etiket)).toEqual(['ipucu']);
    expect(slashSuz('fotog', etiket)).toEqual(['foto']);
    expect(slashSuz('baş', etiket)).toEqual(['baslik']);
    expect(slashSuz('zzz', etiket)).toEqual([]);
  });

  it('↑↓ taşı, sürükle-bırak yerleştir, sayaçlar', () => {
    const b = mdBloklari(YAZI);
    const [p, f, m] = b;
    expect(blokTasi(b, m.id, -1).slice(0, 3).map((x) => x.tur)).toEqual(['paragraf', 'mekan', 'foto']);
    expect(blokTasi(b, p.id, -1)).toEqual(b);
    expect(blokYerlestir(b, m.id, p.id).slice(0, 3).map((x) => x.tur)).toEqual(['mekan', 'paragraf', 'foto']);
    expect(blokYerlestir(b, p.id, null).map((x) => x.tur).pop()).toBe('paragraf');
    expect(blokYerlestir(b, f.id, f.id)).toEqual(b);
    expect(blokSayaclari(b)).toEqual({ kart: 1, satir: 1 });
  });
});
