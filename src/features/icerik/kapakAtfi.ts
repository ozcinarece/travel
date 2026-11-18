/**
 * #345 KK4 (kanvas 29i): kapak fotoğrafının atfı. DB'de `kapak_atif` = {yazar, lisans, kaynak_url} (KK1); kendi
 * fotoğrafımızda {"yazar": "Tripmate"}. Bu dosya yalnız saf yardımcılar; görünüm `components/icerik/KapakAtfi`.
 */
export type KapakAtfi = { yazar: string; lisans?: string | null; kaynak_url?: string | null };

export const TRIPMATE = 'Tripmate';

/** DB'den gelen jsonb'yi güvenle okur; biçim bozuksa ya da yazar boşsa null (atıf satırı hiç görünmez). */
export function kapakAtfiOku(ham: unknown): KapakAtfi | null {
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
  const a = ham as Record<string, unknown>;
  const yazar = typeof a.yazar === 'string' ? a.yazar.trim() : '';
  if (!yazar) return null;
  const lisans = typeof a.lisans === 'string' && a.lisans.trim() ? a.lisans.trim() : null;
  const kaynak = typeof a.kaynak_url === 'string' && /^https:\/\//.test(a.kaynak_url) ? a.kaynak_url : null;
  return { yazar, lisans, kaynak_url: kaynak };
}

/** Kanvas 29i: kısa adlar CC BY, CC BY-SA, CC0, PD (sürüm numarası kutuda görünmez; ekran okuyucu tam adı okur). */
export function lisansKisaAdi(lisans: string | null | undefined): string | null {
  const l = lisans?.trim();
  if (!l) return null;
  if (/^cc0\b/i.test(l)) return 'CC0';
  if (/^(pd\b|public domain)/i.test(l)) return 'PD';
  const cc = /^cc[- ]by(-sa)?\b/i.exec(l);
  if (cc) return cc[1] ? 'CC BY-SA' : 'CC BY';
  return l;
}

/** Kendi fotoğrafımız mı ("Foto: Tripmate", dokunma yok)? */
export function tripmateMi(a: KapakAtfi): boolean {
  return a.yazar === TRIPMATE && !a.kaynak_url;
}

/** Kaynak sayfası Commons'ta mı (E penceresindeki "Wikimedia Commons'tan…" satırı)? */
export function commonsMu(a: KapakAtfi): boolean {
  if (!a.kaynak_url) return false;
  try {
    return /(^|\.)commons\.wikimedia\.org$/.test(new URL(a.kaynak_url).hostname);
  } catch {
    return false;
  }
}

/** #351 KK1–KK2: Google yazar bağlantısı yalnız https ve yalnız yazar adı varken kullanılır. */
export function googleYazarBaglantisi(yazar: string | null | undefined, uri: string | null | undefined): string | null {
  if (!yazar?.trim() || typeof uri !== 'string') return null;
  const u = uri.trim();
  return /^https:\/\/\S+$/.test(u) ? u : null;
}

/** Kapağın kendisi hangi satırdan geliyorsa atıf da oradan: kapak yoksa atıf da yok. */
export function kapakVeAtif(kaynaklar: { kapak_url?: string | null; kapak_atif?: unknown }[]): { uri: string | null; atif: KapakAtfi | null } {
  const k = kaynaklar.find((x) => !!x.kapak_url);
  return k ? { uri: k.kapak_url!, atif: kapakAtfiOku(k.kapak_atif) } : { uri: null, atif: null };
}

/**
 * #348 inceleme 2: yedek kapağın atfı, fotoğrafı aldığı satırdan. `kapak` = satırın kendi kapağı (Commons ya da Ece'nin;
 * `kapak_atif` bozuksa atıf yok), `google` = Google fotoğrafı ("Foto: {yazar} · Google Maps"; yazar bilinmiyorsa yazarsız; #351 `uri` = yazarın Google sayfası).
 */
export type FotoAtfi = { tur: 'kapak'; atif: KapakAtfi | null } | { tur: 'google'; yazar: string | null; uri?: string | null };

/** Fotoğrafı olan ilk satır ve atfı; hiçbirinde fotoğraf yoksa null. */
export function ilkFoto<T>(satirlar: T[], oku: (s: T) => { foto_uri: string | null; foto_atif: FotoAtfi | null } | undefined): { uri: string; atif: FotoAtfi | null } | null {
  for (const x of satirlar) {
    const f = oku(x);
    if (f?.foto_uri) return { uri: f.foto_uri, atif: f.foto_atif };
  }
  return null;
}

/** #348 inceleme 1 (kanvas 29i-A): gezi kapağı en az 260 px (güvenli alan dahil); üst boşluk büyükse 166 + üst boşluk. */
export const GEZI_KAPAK_EN_AZ = 260;
export function kapakYuksekligi(ustBosluk: number): number {
  return Math.max(GEZI_KAPAK_EN_AZ, 166 + ustBosluk);
}
