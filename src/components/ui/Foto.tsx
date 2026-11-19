// #390 (PRD §7): uygulamada her uzak fotoğraf bu sarmalayıcıdan çizilir; `expo-image` doğrudan kullanılmaz (lint kuralı ve
// `fotoOnbellek.test.ts` arama testi). expo-image'ın varsayılanı `disk`: Google Places fotoğrafı cihaz diskine yazılırdı.
// Kural: yalnız bizim depomuz (Supabase Storage: kendi kapaklarımız, Commons'tan yüklenenler dahil), Wikimedia Commons ve
// yerel dosyalar `disk`te kalabilir (KK2). Google adresleri ve tanımadığımız her adres `memory`: bellekte, uygulama kapanınca
// gider. Böylece yeni bir Google alan adı gelse de diske yazılmaz.
import { Image, type ImageProps } from 'expo-image';

export type FotoOnbellek = 'memory' | 'disk';

/** Diske yazılmasına izin verilen uzak alan adları (KK2). Supabase projesi ortam değişkeninden. */
function izinliAlanlar(): string[] {
  const alanlar = ['upload.wikimedia.org', 'commons.wikimedia.org'];
  const supabase = alanAdi(process.env.EXPO_PUBLIC_SUPABASE_URL);
  if (supabase) alanlar.push(supabase);
  return alanlar;
}

/** http(s) adresinin alan adı (küçük harf); RN'nin `URL`'inde `hostname` her sürümde yok, düzenli ifadeyle. */
function alanAdi(uri: string | null | undefined): string | null {
  const m = uri ? /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i.exec(uri) : null;
  return m ? m[1].toLowerCase() : null;
}

/** Tek bir adresin önbellek politikası: http(s) dışındaki (yerel, data, file) `disk`; izinli alan `disk`; gerisi `memory`. */
export function adresPolitikasi(uri: string | null | undefined): FotoOnbellek {
  if (!uri) return 'disk';
  if (!/^https?:\/\//i.test(uri)) return 'disk';
  const alan = alanAdi(uri);
  if (!alan) return 'memory';
  return izinliAlanlar().some((a) => alan === a || alan.endsWith(`.${a}`)) ? 'disk' : 'memory';
}

type Kaynak = ImageProps['source'];

function adresler(kaynak: Kaynak): (string | null | undefined)[] {
  if (kaynak == null || typeof kaynak === 'number') return [];
  if (typeof kaynak === 'string') return [kaynak];
  if (Array.isArray(kaynak)) return kaynak.flatMap((k) => adresler(k as Kaynak));
  return [(kaynak as { uri?: string }).uri];
}

/** Kaynağın (tek ya da dizi) politikası: herhangi biri `memory` ise `memory`. */
export function fotoOnbellekPolitikasi(kaynak: Kaynak): FotoOnbellek {
  return adresler(kaynak).some((u) => adresPolitikasi(u) === 'memory') ? 'memory' : 'disk';
}

type FotoProps = Omit<ImageProps, 'cachePolicy'>;

/** Kaynağa göre önbellek seçen fotoğraf: kapak ya da Google olabilen karışık yerler için. */
export function Foto(props: FotoProps) {
  return <Image {...props} cachePolicy={fotoOnbellekPolitikasi(props.source)} />;
}

/** KK1: yalnız Google fotoğrafı çizen yerler (galeri, mekan paneli): her zaman `memory`. */
export function GoogleFoto(props: FotoProps) {
  return <Image {...props} cachePolicy="memory" />;
}
