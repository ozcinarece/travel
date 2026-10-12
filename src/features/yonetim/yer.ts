// #108 yer editörü — saf kurallar: Rehber blok modeli (markdown ⇄ blok), sayaçlar, place_id denetimi. Testli.
import { okumaSuresiDk } from '@/lib/markdown';

/** Editörde tutulan yer alanları (Genel + Rehber). */
export type YerAlanlari = {
  ad: string;
  place_id: string | null;
  kategori: string | null;
  sehir_id: string;
  one_cikan_sira: number | null;
  kapak_url: string | null;
  rehber_md: string | null;
  yayin: boolean;
  lat: number;
  lng: number;
};

export type RehberBlokTuru = 'baslik' | 'paragraf' | 'alinti' | 'liste' | 'gorsel';

/**
 * Kanvas ekran 4 blok görünümü. Metin bloklarında satır içi işaretler (`**`, `*`, `[ad](mekan:…)`) olduğu gibi kalır;
 * görsel bloğunda hedefler `foto:<yol>` (en çok 2 → tek satır) ve ortak altyazı.
 */
export type RehberBlok = { id: string; tur: RehberBlokTuru; metin: string; hedefler?: string[] };

const GORSEL = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

let sayac = 0;
export const blokKimligi = () => `b${Date.now().toString(36)}${(sayac++).toString(36)}`;

/** Markdown → bloklar (boş satırla ayrılan parçalar; gezi yazısıyla aynı sözdizimi). */
export function rehberBloklari(md: string | null | undefined, kimlik: () => string = blokKimligi): RehberBlok[] {
  const parcalar = (md ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bloklar: RehberBlok[] = [];
  for (const parca of parcalar) {
    const satirlar = parca.split('\n').map((s) => s.trimEnd());
    const baslik = /^#{1,3}\s+(.*)$/.exec(satirlar[0]);
    if (baslik && satirlar.length === 1) {
      bloklar.push({ id: kimlik(), tur: 'baslik', metin: baslik[1].trim() });
    } else if (satirlar.every((s) => GORSEL.test(s.trim()))) {
      for (const s of satirlar) {
        const g = GORSEL.exec(s.trim())!;
        const hedefler = g[2].split(',').map((h) => h.trim()).filter(Boolean);
        const son = bloklar[bloklar.length - 1];
        if (son?.tur === 'gorsel' && (son.hedefler?.length ?? 0) + hedefler.length <= 2 && satirlar.length > 1) son.hedefler!.push(...hedefler);
        else bloklar.push({ id: kimlik(), tur: 'gorsel', metin: g[1], hedefler });
      }
    } else if (satirlar.every((s) => s.startsWith('>'))) {
      bloklar.push({ id: kimlik(), tur: 'alinti', metin: satirlar.map((s) => s.replace(/^>\s?/, '')).join('\n') });
    } else if (satirlar.every((s) => /^[-*]\s+/.test(s))) {
      bloklar.push({ id: kimlik(), tur: 'liste', metin: satirlar.map((s) => s.replace(/^[-*]\s+/, '')).join('\n') });
    } else {
      bloklar.push({ id: kimlik(), tur: 'paragraf', metin: satirlar.join('\n') });
    }
  }
  return bloklar;
}

/** Bloklar → markdown (boş bloklar atlanır). */
export function rehberMd(bloklar: RehberBlok[]): string {
  return bloklar
    .map((b) => {
      const m = b.metin.trim();
      switch (b.tur) {
        case 'baslik':
          return m ? `## ${m.replace(/\n+/g, ' ')}` : '';
        case 'alinti':
          return m ? m.split('\n').map((s) => `> ${s}`).join('\n') : '';
        case 'liste':
          return m ? m.split('\n').filter((s) => s.trim()).map((s) => `- ${s.trim()}`).join('\n') : '';
        case 'gorsel':
          return b.hedefler?.length ? `![${m.replace(/[[\]\n]/g, ' ')}](${b.hedefler.join(', ')})` : '';
        default:
          return m;
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Bloğun türünü değiştirir (araç çubuğu H2 / alıntı / liste; aynı türe yeniden basmak paragrafa döndürür). */
export function blokTuru(b: RehberBlok, tur: 'baslik' | 'alinti' | 'liste'): RehberBlok {
  if (b.tur === 'gorsel') return b;
  return { ...b, tur: b.tur === tur ? 'paragraf' : tur };
}

/** Görseli bloğa ekler: odaklı görsel bloğunda yer varsa yanına, yoksa odaklı bloğun arkasına yeni blok. */
export function gorselEkle(bloklar: RehberBlok[], odakId: string | null, hedef: string, kimlik: () => string = blokKimligi): RehberBlok[] {
  const i = bloklar.findIndex((b) => b.id === odakId);
  const odak = bloklar[i];
  if (odak?.tur === 'gorsel' && (odak.hedefler?.length ?? 0) < 2) {
    return bloklar.map((b) => (b.id === odak.id ? { ...b, hedefler: [...(b.hedefler ?? []), hedef] } : b));
  }
  const yeni: RehberBlok = { id: kimlik(), tur: 'gorsel', metin: '', hedefler: [hedef] };
  const yer = i === -1 ? bloklar.length : i + 1;
  return [...bloklar.slice(0, yer), yeni, ...bloklar.slice(yer)];
}

export type RehberSayaclari = { karakter: number; okumaDk: number; gorsel: number; mekan: number };

/** Kanvas alt şeridi: "1.240 karakter · ~2 dk okuma · 2 görsel · 1 mekan bağlantısı". */
export function rehberSayaclari(md: string | null | undefined): RehberSayaclari {
  const m = md ?? '';
  const gorsel = [...m.matchAll(/^!\[[^\]]*\]\(([^)]+)\)\s*$/gm)].reduce((t, g) => t + g[1].split(',').filter((h) => h.trim()).length, 0);
  const mekan = [...m.matchAll(/\[[^\]]+\]\(mekan:[^)\s]+\)/g)].length;
  return { karakter: m.length, okumaDk: okumaSuresiDk(m), gorsel, mekan };
}

/** KK7: Google place_id biçimi (DB kısıtıyla aynı). */
export function gecerliPlaceId(id: string | null | undefined): boolean {
  return !!id && /^[A-Za-z0-9_-]{10,255}$/.test(id);
}

/** Öne çıkan sırası girdisi: boş = öne çıkmıyor; 1 ve üstü tam sayı. */
export function oneCikanSirasi(girdi: string): number | null | 'gecersiz' {
  const t = girdi.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 ? n : 'gecersiz';
}

/** Türkçe binlik ayraçlı sayı: 1240 → "1.240". */
export function binlik(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
