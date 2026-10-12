// #97 B KK1: gezi yazısı için küçük markdown ayrıştırıcı (paket yok) — paragraf, başlık (#, ##), alıntı (>), madde (-),
// görsel (![altyazı](url); art arda iki görsel = ikili foto satırı, altyazı ilk görselin alt metni). Saf; test edilir.
// #107 (backoffice yazar): `foto:<yol>` = `icerik` kovasındaki dosya; `![a](foto:x, foto:y)` tek satırda iki foto;
// `[ad](mekan:<place_id>)`, `**kalın**`, `*italik*`: `metin` sade kalır (işaretsiz), biçim `parcalar`'da, bağlantılar `mekanlar`'da.
// #111: tek satır `::mekan[<place_id>]` = paragraf altına mekan kartı (`mekan` bloğu; uygulamada kart bileşeni çizer).
export type MekanBaglantisi = { ad: string; place_id: string };
export type MdParca = { metin: string; kalin?: true; italik?: true; place_id?: string };
type Bicim = { mekanlar?: MekanBaglantisi[]; parcalar?: MdParca[] };

export type MdBlok =
  | ({ tur: 'baslik'; seviye: 1 | 2 | 3; metin: string } & Bicim)
  | ({ tur: 'paragraf'; metin: string } & Bicim)
  | ({ tur: 'alinti'; metin: string } & Bicim)
  | { tur: 'madde'; ogeler: string[]; mekanlar?: MekanBaglantisi[] }
  | { tur: 'fotolar'; fotolar: { url: string; alt: string }[]; altyazi: string | null }
  | { tur: 'mekan'; place_id: string };

const GORSEL = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
export const MEKAN_KARTI = /^::mekan\[([A-Za-z0-9_-]{10,255})\]$/;
const SATIR_ICI = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(mekan:([^)\s]+)\)/g;

/** `icerik` kovasındaki dosyanın herkese açık adresi (yol: `geziler/<id>/<dosya>`). */
export function icerikFotoUrl(yol: string): string {
  const kok = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const temiz = yol.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${kok}/storage/v1/object/public/icerik/${temiz}`;
}

/** Görsel hedefi: `foto:<yol>` kovadan, diğerleri olduğu gibi. */
function gorselUrl(hedef: string): string {
  const h = hedef.trim();
  return h.startsWith('foto:') ? icerikFotoUrl(h.slice(5).trim()) : h;
}

/** Satır içi biçim: kalın, italik, mekan bağlantısı; biçimsiz metin tek parça. */
export function satirParcalari(metin: string): MdParca[] {
  const parcalar: MdParca[] = [];
  let son = 0;
  for (const m of metin.matchAll(SATIR_ICI)) {
    if (m.index > son) parcalar.push({ metin: metin.slice(son, m.index) });
    if (m[1] !== undefined) parcalar.push({ metin: m[1], kalin: true });
    else if (m[2] !== undefined) parcalar.push({ metin: m[2], italik: true });
    else parcalar.push({ metin: m[3], place_id: m[4] });
    son = m.index + m[0].length;
  }
  if (son < metin.length) parcalar.push({ metin: metin.slice(son) });
  return parcalar;
}

/** Metindeki biçim işaretlerini ve mekan bağlantılarını ayıklar (`metin` sade). */
export function mekanlariAyikla(metin: string): { metin: string; mekanlar: MekanBaglantisi[]; parcalar: MdParca[] } {
  const parcalar = satirParcalari(metin);
  const mekanlar = parcalar.filter((p) => p.place_id).map((p) => ({ ad: p.metin, place_id: p.place_id! }));
  return { metin: parcalar.map((p) => p.metin).join(''), mekanlar, parcalar };
}

function mekanli<T extends { metin: string }>(blok: T): T & Bicim {
  const { metin, mekanlar, parcalar } = mekanlariAyikla(blok.metin);
  const bicimli = parcalar.length > 1 || parcalar.some((p) => p.kalin || p.italik || p.place_id);
  return { ...blok, metin, ...(mekanlar.length ? { mekanlar } : {}), ...(bicimli ? { parcalar } : {}) };
}

export function markdownAyristir(kaynak: string | null | undefined): MdBlok[] {
  const bloklar: MdBlok[] = [];
  const satirlar = (kaynak ?? '').replace(/\r\n?/g, '\n').split('\n');
  let paragraf: string[] = [];
  let alinti: string[] = [];
  let madde: string[] = [];
  const bitir = () => {
    if (paragraf.length) bloklar.push(mekanli({ tur: 'paragraf' as const, metin: paragraf.join(' ').trim() }));
    if (alinti.length) bloklar.push(mekanli({ tur: 'alinti' as const, metin: alinti.join(' ').trim() }));
    if (madde.length) {
      const ayik = madde.map(mekanlariAyikla);
      const mekanlar = ayik.flatMap((a) => a.mekanlar);
      bloklar.push({ tur: 'madde', ogeler: ayik.map((a) => a.metin), ...(mekanlar.length ? { mekanlar } : {}) });
    }
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
      bloklar.push(mekanli({ tur: 'baslik' as const, seviye: b[1].length as 1 | 2 | 3, metin: b[2].trim() }));
      continue;
    }
    const k = MEKAN_KARTI.exec(satir.trim());
    if (k) {
      bitir();
      bloklar.push({ tur: 'mekan', place_id: k[1] });
      continue;
    }
    const g = GORSEL.exec(satir.trim());
    if (g) {
      bitir();
      // Art arda görseller aynı satıra (en çok 2); altyazı ilk görselin alt metni. Tek etikette virgüllü hedefler de olur.
      // #119 KK1b: çözümden sonra hâlâ http(s) olmayan hedef (göreli yol, yer tutucu) çizilmez; boş kutu yok. `foto:` (#107) çözülür.
      for (const hedef of g[2].split(',').filter((h) => h.trim())) {
        const url = gorselUrl(hedef);
        if (!/^https?:\/\//i.test(url)) continue;
        const son = bloklar[bloklar.length - 1];
        const foto = { url, alt: g[1] };
        if (son && son.tur === 'fotolar' && son.fotolar.length < 2) son.fotolar.push(foto);
        else bloklar.push({ tur: 'fotolar', fotolar: [foto], altyazi: g[1] || null });
      }
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
