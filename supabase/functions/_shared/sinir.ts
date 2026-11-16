// #226: Places fonksiyonlarında kullanıcı başına günlük sınır. Sınırlar yalnız bu dosyada.
// #246: Routes fonksiyonları (route-matrix, route-legs) `rota` kategorisinde sayılır; sayılan şey Google'a giden ELEMAN
// (matris kaynak × hedef; route-legs'te her computeRoutes 1).
// Sayaç public.places_gunluk_sayac (kullanıcı kimliğinin SHA-256 özeti × gün × kategori); artırma atomik
// (places_sinir_artir, yalnız service_role). Sayılan şey Google'a gidecek istektir: izolat önbelleğinden dönen cevap sayılmaz.
// Misafir (anonim oturum) ayrıca bütün misafirlerin ortak günlük tavanından geçer (MISAFIR_TOPLAM; yeni anonim oturum yeni
// kota demek olduğu için). Sayaç okunamazsa: kayıtlı kullanıcı geçer (fail-open), misafir 503 alır (fail-closed).
// Log'a yalnız kategori ve hata kodu yazılır.
import { hata, type Kullanici } from './http.ts';

/** `metin`: Autocomplete boş dönünce denenen Text Search yedeği (#118). `rota`: Routes elemanı (#246). */
export type SinirKategorisi = 'details' | 'photo' | 'nearby' | 'autocomplete' | 'metin' | 'link' | 'rota';

/** Tek çağrıda sayılabilecek en çok adet (route-matrix 25 × 25 nokta); `places_sinir_artir` ile aynı. */
export const EN_FAZLA_ADET = 625;

/** Gün başına sınır: kayıtlı kullanıcı / misafir (anonim oturum). */
export const GUNLUK_SINIR: Record<SinirKategorisi, { kullanici: number; misafir: number }> = {
  details: { kullanici: 300, misafir: 100 },
  photo: { kullanici: 500, misafir: 150 },
  nearby: { kullanici: 50, misafir: 15 },
  autocomplete: { kullanici: 300, misafir: 100 },
  metin: { kullanici: 50, misafir: 15 },
  link: { kullanici: 30, misafir: 10 },
  rota: { kullanici: 2000, misafir: 500 },
};

/** Bütün misafirlerin toplamı için gün başına tavan. */
export const MISAFIR_TOPLAM: Record<SinirKategorisi, number> = {
  details: 1000,
  photo: 1500,
  nearby: 150,
  autocomplete: 1000,
  metin: 150,
  link: 100,
  rota: 3000,
};

/** Sınırı dolan kullanıcı bu izolatta günün sonuna kadar RPC'siz reddedilir. */
const dolu = new Set<string>();
let doluGun = '';
let ortamUyarildi = false;

const bugun = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

export function sinirAsildi(): Response {
  return hata('gunluk_sinir', 429);
}

function sayacYok(k: Kullanici): Response | null {
  return k.misafir ? hata('gecici_olarak_kullanilamiyor', 503) : null;
}

/**
 * Google isteğinden hemen önce çağrılır: `adet` (gidecek Google isteği; places-light'ta önbellekte olmayan kimlik sayısı)
 * sınıra sığıyorsa sayacı artırır ve null döner; sığmıyorsa 429, sayaç okunamıyorsa misafire 503 cevabı döner.
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
  if (!url || !servis) {
    if (!ortamUyarildi) {
      ortamUyarildi = true;
      console.error('places sinir: ortam degiskeni eksik');
    }
    return sayacYok(k);
  }
  const sinir = GUNLUK_SINIR[kategori][k.misafir ? 'misafir' : 'kullanici'];
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/places_sinir_artir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: servis, authorization: `Bearer ${servis}` },
      body: JSON.stringify({
        p_ozet: k.ozet,
        p_kategori: kategori,
        p_sinir: sinir,
        p_adet: Math.min(Math.max(Math.trunc(adet), 1), EN_FAZLA_ADET),
        p_toplam_sinir: k.misafir ? MISAFIR_TOPLAM[kategori] : null,
      }),
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
    return sayacYok(k);
  }
}
