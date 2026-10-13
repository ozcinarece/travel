// #156 editör — contentEditable imleç yardımcıları (yalnız web). Saf DOM; React bilmez.
import { htmlMd } from '@/features/yonetim/bloklar';

/** İmleç öğenin başında mı (öncesinde metin yok). */
export function imlecBasta(el: HTMLElement): boolean {
  const sec = window.getSelection();
  if (!sec || !sec.rangeCount || !sec.isCollapsed || !el.contains(sec.anchorNode)) return false;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(sec.anchorNode!, sec.anchorOffset);
  return r.toString().length === 0;
}

/** İmleç öğenin sonunda mı (sonrasında metin yok). */
export function imlecSonda(el: HTMLElement): boolean {
  const sec = window.getSelection();
  if (!sec || !sec.rangeCount || !sec.isCollapsed || !el.contains(sec.anchorNode)) return false;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setStart(sec.anchorNode!, sec.anchorOffset);
  return r.toString().length === 0;
}

/** İmleçte böl: öncesi öğede kalır, sonrası markdown olarak döner (Enter = yeni paragraf). */
export function imlectenBol(el: HTMLElement): { once: string; sonra: string } {
  const sec = window.getSelection();
  if (!sec || !sec.rangeCount || !el.contains(sec.anchorNode)) return { once: htmlMd(el), sonra: '' };
  const r = sec.getRangeAt(0);
  r.deleteContents();
  const kalan = document.createRange();
  kalan.selectNodeContents(el);
  kalan.setStart(r.startContainer, r.startOffset);
  const parca = kalan.extractContents();
  const kap = document.createElement('div');
  kap.appendChild(parca);
  // Kırpılmaz: Backspace aynı yerden araya boşluk koymadan birleştirir. Bölünen yerdeki boşluk öncekinde kalır (yeni satırın
  // başında görünmez).
  const sonra = htmlMd(kap);
  const bosluk = /^ +/.exec(sonra)?.[0] ?? '';
  return { once: htmlMd(el) + (bosluk ? ' ' : ''), sonra: sonra.slice(bosluk.length) };
}

/** Öğeye odaklan, imleç başa, sona ya da `konum`uncu karaktere. */
export function odakla(el: HTMLElement, konum: 'bas' | 'son' | number) {
  el.focus();
  const sec = window.getSelection();
  if (!sec) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(konum === 'bas');
  if (typeof konum === 'number') {
    let kalan = konum;
    const yuruyen = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let d = yuruyen.nextNode(); d; d = yuruyen.nextNode()) {
      const uzunluk = d.textContent?.length ?? 0;
      if (kalan <= uzunluk) {
        r.setStart(d, kalan);
        r.collapse(true);
        break;
      }
      kalan -= uzunluk;
    }
  }
  sec.removeAllRanges();
  sec.addRange(r);
}

/** Seçimin editör kabına göre dikdörtgeni (araç çubuğunu konumlamak için). */
export function secimKutusu(kap: HTMLElement): { x: number; y: number; genislik: number } | null {
  const sec = window.getSelection();
  if (!sec || !sec.rangeCount || sec.isCollapsed) return null;
  const r = sec.getRangeAt(0).getBoundingClientRect();
  const k = kap.getBoundingClientRect();
  return { x: r.left - k.left, y: r.top - k.top, genislik: r.width };
}
