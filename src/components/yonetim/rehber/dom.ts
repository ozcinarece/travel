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
  return { once: htmlMd(el).trim(), sonra: htmlMd(kap).trim() };
}

/** Öğeye odaklan, imleç başa ya da sona. */
export function odakla(el: HTMLElement, konum: 'bas' | 'son') {
  el.focus();
  const sec = window.getSelection();
  if (!sec) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(konum === 'bas');
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
