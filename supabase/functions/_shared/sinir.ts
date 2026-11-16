// #226: Places fonksiyonlarında kullanıcı başına günlük sınır. Sınırlar yalnız bu dosyada.
// Sayaç public.places_gunluk_sayac (kullanıcı kimliğinin SHA-256 özeti × gün × kategori); artırma atomik
// (places_sinir_artir, yalnız service_role). Sayılan şey Google'a gidecek istektir: izolat önbelleğinden dönen cevap sayılmaz.
// Sayaç okunamazsa istek engellenmez (fail-open; log'a yalnız hata kodu yazılır).
import { hata, type Kullanici } from './http.ts';

export type SinirKategorisi = 'details' | 'photo' | 'nearby' | 'autocomplete' | 'link';

/** Gün başına sınır: kayıtlı kullanıcı / misafir (anonim oturum). */
export const GUNLUK_SINIR: Record<SinirKategorisi, { kullanici: number; misafir: number }> = {
  details: { kullanici: 300, misafir: 100 },
  photo: { kullanici: 500, misafir: 150 },
  nearby: { kullanici: 50, misafir: 15 },
  autocomplete: { kullanici: 300, misafir: 100 },
  link: { kullanici: 30, misafir: 10 },
};

/** Sınırı dolan kullanıcı bu izolatta günün sonuna kadar RPC'siz reddedilir. */
const dolu = new Set<string>();
let doluGun = '';

const bugun = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

export function sinirAsildi(): Response {
  return hata('gunluk_sinir', 429);
}

/**
 * Google isteğinden hemen önce çağrılır: `adet` (gidecek Google isteği; places-light'ta önbellekte olmayan kimlik sayısı)
 * sınıra sığıyorsa sayacı artırır ve null döner; sığmıyorsa 429 cevabı döner.
 */
export async function sinirKontrol(k: Kullanici, kategori: SinirKategorisi, adet = 1): Promise<Response | null> {
  const gun = bugun();
  if (gun !== doluGun) {
    dolu.clear();
    doluGun = gun;
  }
  const anahtar = `${k.ozet}:${kategori}`;
  if (dolu.has(anahtar)) return sinirAsildi();

  const url = Deno.env.get('SUPABASE_URL');
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servis) return null;
  const sinir = GUNLUK_SINIR[kategori][k.misafir ? 'misafir' : 'kullanici'];
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/places_sinir_artir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: servis, authorization: `Bearer ${servis}` },
      body: JSON.stringify({ p_ozet: k.ozet, p_kategori: kategori, p_sinir: sinir, p_adet: Math.min(Math.max(Math.trunc(adet), 1), 25) }),
    });
    if (!cevap.ok) throw new Error(String(cevap.status));
    if ((await cevap.json()) === false) {
      // Tek isteklik çağrı sığmıyorsa sayaç dolu; toplu istek sığmadıysa daha küçüğü sığabilir, işaretlenmez.
      if (adet <= 1) dolu.add(anahtar);
      return sinirAsildi();
    }
    return null;
  } catch (e) {
    console.error('places_sinir_artir', kategori, e instanceof Error ? e.message : 'bilinmeyen');
    return null;
  }
}
