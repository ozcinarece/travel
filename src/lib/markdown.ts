// #97 B KK1: gezi yazısı için küçük markdown ayrıştırıcı (paket yok) — paragraf, başlık (#, ##), alıntı (>), madde (-),
// görsel (![altyazı](url); art arda iki görsel = ikili foto satırı, altyazı ilk görselin alt metni). Saf; test edilir.
export type MdBlok =
  | { tur: 'baslik'; seviye: 1 | 2 | 3; metin: string }
  | { tur: 'paragraf'; metin: string }
  | { tur: 'alinti'; metin: string }
  | { tur: 'madde'; ogeler: string[] }
  | { tur: 'fotolar'; fotolar: { url: string; alt: string }[]; altyazi: string | null };

const GORSEL = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;

export function markdownAyristir(kaynak: string | null | undefined): MdBlok[] {
  const bloklar: MdBlok[] = [];
  const satirlar = (kaynak ?? '').replace(/\r\n?/g, '\n').split('\n');
  let paragraf: string[] = [];
  let alinti: string[] = [];
  let madde: string[] = [];
  const bitir = () => {
    if (paragraf.length) bloklar.push({ tur: 'paragraf', metin: paragraf.join(' ').trim() });
    if (alinti.length) bloklar.push({ tur: 'alinti', metin: alinti.join(' ').trim() });
    if (madde.length) bloklar.push({ tur: 'madde', ogeler: madde });
    paragraf = [];
    alinti = [];
    madde = [];
  };
  for (const ham of satirlar) {
    const satir = ham.trimEnd();
    if (!satir.trim()) {
      bitir();
      continue;
    }
    const b = /^(#{1,3})\s+(.*)$/.exec(satir);
    if (b) {
      bitir();
      bloklar.push({ tur: 'baslik', seviye: b[1].length as 1 | 2 | 3, metin: b[2].trim() });
      continue;
    }
    const g = GORSEL.exec(satir.trim());
    if (g && !/^https?:\/\//i.test(g[2])) {
      // #119 KK1b: çözülemeyen görsel (foto:… yer tutucu, göreli yol) çizilmez; boş kutu yok.
      bitir();
      continue;
    }
    if (g) {
      bitir();
      const son = bloklar[bloklar.length - 1];
      // Art arda görseller aynı satıra (en çok 2); altyazı ilk görselin alt metni.
      if (son && son.tur === 'fotolar' && son.fotolar.length < 2) son.fotolar.push({ url: g[2], alt: g[1] });
      else bloklar.push({ tur: 'fotolar', fotolar: [{ url: g[2], alt: g[1] }], altyazi: g[1] || null });
      continue;
    }
    if (satir.startsWith('>')) {
      if (paragraf.length || madde.length) bitir();
      alinti.push(satir.replace(/^>\s?/, '').trim());
      continue;
    }
    const m = /^[-*]\s+(.*)$/.exec(satir);
    if (m) {
      if (paragraf.length || alinti.length) bitir();
      madde.push(m[1].trim());
      continue;
    }
    if (alinti.length || madde.length) bitir();
    paragraf.push(satir.trim());
  }
  bitir();
  return bloklar;
}

/** "4 dk okuma": ~200 kelime / dk, en az 1. */
export function okumaSuresiDk(kaynak: string | null | undefined): number {
  const kelime = (kaynak ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(kelime / 200));
}
