// #156 rehber editörü — saf çekirdek: markdown ↔ bloklar ve satır içi markdown ↔ HTML (contentEditable). Testli.
// Saklama biçimi değişmez (src/lib/markdown.ts okur): paragraf, `## ara başlık`, `- madde`, `> ipucu`, `![alt](foto:yol)` (ya da
// https / virgüllü iki hedef, olduğu gibi),
// `::mekan[place_id]`; satır içi `**kalın**`, `*italik*`, `[metin](mekan:id)`. Uygulamanın ayrıştırıcısı iç içe biçim ve dış
// bağlantı okumaz: editör de üretmez (tek kat biçim; bağlantı metni biçimsiz).

export type Blok =
  | { id: string; tur: 'paragraf'; md: string }
  /** `seviye` yalnız `#` / `###` ile gelen başlıkta (yoksa `##`; "/" menüsü `##` açar). */
  | { id: string; tur: 'baslik'; md: string; seviye?: 1 | 3 }
  | { id: string; tur: 'liste'; ogeler: string[] }
  | { id: string; tur: 'ipucu'; md: string }
  /** `hedef` parantez içi olduğu gibi: `foto:<yol>`, `https://…` ya da virgüllü iki hedef (yan yana iki foto). */
  | { id: string; tur: 'foto'; hedef: string; alt: string }
  | { id: string; tur: 'mekan'; place_id: string };

export type BlokTuru = Blok['tur'];

let sayac = 0;
/** Oturum içi blok kimliği (kaydedilmez). */
export function blokId(): string {
  sayac += 1;
  return `b${Date.now().toString(36)}${sayac.toString(36)}`;
}

const MEKAN_KARTI = /^::mekan\[([A-Za-z0-9_-]{10,255})\]\s*$/;
const FOTO = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

/** Markdown → bloklar. Boş satır blok ayırır; ardışık `-` / `>` satırları tek blok; `#` / `##` / `###` ara başlık. */
export function mdBloklari(md: string | null | undefined): Blok[] {
  const bloklar: Blok[] = [];
  let paragraf: string[] = [];
  let ipucu: string[] = [];
  let liste: string[] = [];
  const bitir = () => {
    if (paragraf.length) bloklar.push({ id: blokId(), tur: 'paragraf', md: paragraf.join(' ') });
    if (ipucu.length) bloklar.push({ id: blokId(), tur: 'ipucu', md: ipucu.join(' ') });
    if (liste.length) bloklar.push({ id: blokId(), tur: 'liste', ogeler: liste });
    paragraf = [];
    ipucu = [];
    liste = [];
  };
  for (const ham of (md ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const satir = ham.trim();
    if (!satir) {
      bitir();
      continue;
    }
    const b = /^(#{1,3})\s+(.*)$/.exec(satir);
    const k = MEKAN_KARTI.exec(satir);
    const f = FOTO.exec(satir);
    if (b || k || f) {
      bitir();
      if (b) bloklar.push({ id: blokId(), tur: 'baslik', md: b[2].trim(), ...(b[1].length !== 2 ? { seviye: b[1].length as 1 | 3 } : {}) });
      else if (k) bloklar.push({ id: blokId(), tur: 'mekan', place_id: k[1] });
      else if (f) bloklar.push({ id: blokId(), tur: 'foto', hedef: f[2].trim(), alt: f[1] });
      continue;
    }
    if (satir.startsWith('>')) {
      if (paragraf.length || liste.length) bitir();
      ipucu.push(satir.replace(/^>\s?/, '').trim());
      continue;
    }
    const m = /^[-*]\s+(.*)$/.exec(satir);
    if (m) {
      if (paragraf.length || ipucu.length) bitir();
      liste.push(m[1].trim());
      continue;
    }
    if (ipucu.length || liste.length) bitir();
    paragraf.push(satir);
  }
  bitir();
  return bloklar;
}

/** Bloklar → markdown (bloklar boş satırla ayrılır; boş paragraf / madde düşer). */
export function bloklarMd(bloklar: readonly Blok[]): string {
  const parcalar: string[] = [];
  for (const b of bloklar) {
    switch (b.tur) {
      case 'paragraf':
        if (b.md.trim()) parcalar.push(tekSatir(b.md));
        break;
      case 'baslik':
        if (b.md.trim()) parcalar.push(`${'#'.repeat(b.seviye ?? 2)} ${tekSatir(b.md)}`);
        break;
      case 'ipucu':
        if (b.md.trim()) parcalar.push(`> ${tekSatir(b.md)}`);
        break;
      case 'liste': {
        const ogeler = b.ogeler.map(tekSatir).filter(Boolean);
        if (ogeler.length) parcalar.push(ogeler.map((o) => `- ${o}`).join('\n'));
        break;
      }
      case 'foto':
        parcalar.push(`![${b.alt.replace(/[[\]\n]/g, '').trim()}](${b.hedef})`);
        break;
      case 'mekan':
        parcalar.push(`::mekan[${b.place_id}]`);
        break;
    }
  }
  return parcalar.join('\n\n');
}

const tekSatir = (md: string) => md.replace(/\s*\n\s*/g, ' ').replace(/ /g, ' ').trim();

// ---------------------------------------------------------------- satır içi

const SATIR_ICI = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\((mekan:[A-Za-z0-9_-]{10,255})\)/g;
const MEKAN_BAGI = /\[[^\]]+\]\(mekan:[A-Za-z0-9_-]{10,255}\)/g;

const kacis = (m: string) => m.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Satır içi markdown → contentEditable HTML (`<b>`, `<i>`, `<a href="mekan:…">`). */
export function mdHtml(md: string): string {
  let html = '';
  let son = 0;
  for (const m of md.matchAll(SATIR_ICI)) {
    html += kacis(md.slice(son, m.index));
    if (m[1] !== undefined) html += `<b>${mdHtml(m[1])}</b>`;
    else if (m[2] !== undefined) html += `<i>${mdHtml(m[2])}</i>`;
    else html += `<a href="${kacis(m[4])}">${kacis(m[3])}</a>`;
    son = m.index + m[0].length;
  }
  return html + kacis(md.slice(son));
}

/** DOM düğümü benzeri (test için de): metin ya da etiketli öğe. */
export type HtmlDugum = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<HtmlDugum>; getAttribute?: (a: string) => string | null; style?: { fontWeight?: string; fontStyle?: string } };

/**
 * contentEditable içeriği → satır içi markdown (tarayıcının `<b>/<strong>/<i>/<em>/<a>/<span style>` biçimleri).
 * `bicimli`: bir biçimin ya da bağlantının içindeyiz — iç işaret basılmaz (uygulama `***x***`, `**[a](…)**` okumaz).
 */
export function htmlMd(kok: HtmlDugum, bicimli = false): string {
  let md = '';
  for (const d of Array.from(kok.childNodes)) md += dugumMd(d, bicimli);
  return md.replace(/\u00a0/g, ' ').replace(/[ \t]*\n[ \t]*/g, ' ').replace(/ {2,}/g, ' ');
}

/** Metni işaretle sarar; işaret boşluğa yapışmaz ("**kalın** "), mekan bağlantıları sarılmaz (çevresindeki parçalar sarılır). */
function sar(ic: string, isaret: string): string {
  let md = '';
  let son = 0;
  const parca = (p: string) => {
    if (!p.trim()) return p;
    const bas = p.match(/^\s*/)![0];
    const bit = p.match(/\s*$/)![0];
    return `${bas}${isaret}${p.trim()}${isaret}${bit}`;
  };
  for (const m of ic.matchAll(MEKAN_BAGI)) {
    md += parca(ic.slice(son, m.index)) + m[0];
    son = m.index + m[0].length;
  }
  return md + parca(ic.slice(son));
}

function dugumMd(d: HtmlDugum, bicimli: boolean): string {
  if (d.nodeType === 3) return (d.textContent ?? '').replace(/\n/g, ' ');
  if (d.nodeType !== 1) return '';
  const ad = d.nodeName.toLowerCase();
  if (ad === 'br') return ' ';
  if (ad === 'a') {
    const href = d.getAttribute?.('href') ?? '';
    // Yalnız mekan bağlantısı; metni biçimsiz ve tek satır. Başka adres (yapıştırılmış dış bağlantı) düz metin kalır.
    if (!/^mekan:[A-Za-z0-9_-]{10,255}$/.test(href)) return htmlMd(d, bicimli);
    const metin = htmlMd(d, true).replace(/[[\]*]/g, '').trim();
    return metin ? `[${metin}](${href})` : '';
  }
  const kalin = ad === 'b' || ad === 'strong' || (d.style?.fontWeight ?? '') === 'bold' || Number(d.style?.fontWeight) >= 600;
  const italik = ad === 'i' || ad === 'em' || d.style?.fontStyle === 'italic';
  if ((kalin || italik) && !bicimli) {
    const ic = htmlMd(d, true);
    // İkisi birden: kalın kalır.
    return ic.trim() ? sar(ic, kalin ? '**' : '*') : ic;
  }
  const ic = htmlMd(d, bicimli);
  if (ad === 'div' || ad === 'p') return ` ${ic} `;
  return ic;
}

/** Biçimsiz düz metin (slash menüsü süzgeci, boşluk denetimi). */
export function duzMetin(md: string): string {
  return md.replace(SATIR_ICI, (_t, k, i, a) => k ?? i ?? a ?? '');
}

// ---------------------------------------------------------------- "/" menüsü

export type SlashSecenek = 'mekan' | 'baslik' | 'foto' | 'ipucu' | 'liste';
export const SLASH_SECENEKLERI: SlashSecenek[] = ['mekan', 'baslik', 'foto', 'ipucu', 'liste'];

const kucuk = (m: string) => m.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

/** "/me" → adı ya da anahtar kelimesi süzgeçle başlayan seçenekler (yazdıkça süzülür). */
export function slashSuz(suzgec: string, etiketler: Record<SlashSecenek, string[]>): SlashSecenek[] {
  const s = kucuk(suzgec.trim());
  if (!s) return SLASH_SECENEKLERI;
  return SLASH_SECENEKLERI.filter((o) => etiketler[o].some((e) => kucuk(e).split(/\s+/).some((k) => k.startsWith(s)) || kucuk(e).startsWith(s)));
}

/** Paragraf "/…" ile başlıyorsa süzgeç (slash menüsü açık), değilse null. */
export function slashSuzgeci(md: string): string | null {
  const m = /^\/(\S*)$/.exec(md.trim());
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- blok işlemleri

export function blokTasi(bloklar: readonly Blok[], id: string, yon: -1 | 1): Blok[] {
  const i = bloklar.findIndex((b) => b.id === id);
  const j = i + yon;
  if (i < 0 || j < 0 || j >= bloklar.length) return [...bloklar];
  const yeni = [...bloklar];
  [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
  return yeni;
}

/** Sürükle-bırak: `id` bloğunu `hedef` bloğunun önüne (hedef null = sona). */
export function blokYerlestir(bloklar: readonly Blok[], id: string, hedef: string | null): Blok[] {
  const tasinan = bloklar.find((b) => b.id === id);
  if (!tasinan || id === hedef) return [...bloklar];
  const kalan = bloklar.filter((b) => b.id !== id);
  const j = hedef ? kalan.findIndex((b) => b.id === hedef) : kalan.length;
  kalan.splice(j < 0 ? kalan.length : j, 0, tasinan);
  return kalan;
}

/** "N mekan kartı · M satır içi bağlantı" ve okuma süresi için sayımlar. */
export function blokSayaclari(bloklar: readonly Blok[]): { kart: number; satir: number } {
  const md = bloklarMd(bloklar);
  return {
    kart: bloklar.filter((b) => b.tur === 'mekan').length,
    satir: [...md.matchAll(/\[[^\]]+\]\(mekan:[A-Za-z0-9_-]{10,255}\)/g)].length,
  };
}

/** Görsel bloğunun adresleri (en çok 2): `foto:<yol>` kovadan, diğerleri olduğu gibi. */
export function fotoAdresleri(hedef: string, kovaUrl: (yol: string) => string): string[] {
  return hedef
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((h) => (h.startsWith('foto:') ? kovaUrl(h.slice(5).trim()) : h));
}
