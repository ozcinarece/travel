// places-photo — #31: Place Photo (New) adını URI'ye çevirir; istemci galeride fotoğrafı görünür olunca ister (tembel).
// Fotoğraf başına faturalanır; URI izolat belleğinde 24 sa tutulur. Anahtar istemciye gitmez (PRD §7).
// #316 KK1: `adlar` (en çok 12) ile toplu — Yer ekle çekmecesi Nearby'nin verdiği fotoğraf adlarını tek çağrıda çevirir
// (ayrıca Details yok). Cevap `uriler`, adlarla aynı sırada; alınamayan fotoğraf null.
import { fotoUri } from '../_shared/google.ts';
import { govde, hata, json, kullaniciDogrula, type Kullanici } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';
import { sinirKontrol } from '../_shared/sinir.ts';

type Istek = { ad?: string; adlar?: string[]; genislik?: number };

const AD = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; uri: string | null }>();

Deno.serve(sayacli('places-photo', async (istek) => {
  const k = await kullaniciDogrula(istek);
  if (k instanceof Response) return k;
  const g = await govde<Istek>(istek);
  const genislik = Math.min(Math.max(Math.trunc(Number(g.genislik) || 800), 100), 1600);
  if (Array.isArray(g.adlar)) return toplu(k, g.adlar, genislik);
  const ad = typeof g.ad === 'string' ? g.ad : '';
  if (!AD.test(ad)) return hata('fotoğraf adı geçersiz');
  const anahtar = `${ad}@${genislik}`;
  const eski = onbellek.get(anahtar);
  if (eski && Date.now() - eski.zaman < TTL_MS) return json({ uri: eski.uri });
  const sinir = await sinirKontrol(k, 'photo');
  if (sinir) return sinir;
  try {
    const uri = await fotoUri(ad, genislik);
    onbellek.set(anahtar, { zaman: Date.now(), uri });
    return json({ uri });
  } catch (e) {
    console.error('places-photo', e);
    return hata('fotoğraf alınamadı', 502);
  }
}));

/** #316 KK1: toplu çeviri. Önbellekte olmayan her ad bir Photo isteğidir ve öyle sayılır (#226). */
async function toplu(k: Kullanici, adlar: unknown[], genislik: number): Promise<Response> {
  if (adlar.length > 12) return hata('en fazla 12 fotoğraf');
  if (!adlar.every((a): a is string => typeof a === 'string' && AD.test(a))) return hata('fotoğraf adı geçersiz');
  const simdi = Date.now();
  const taze = (a: string) => {
    const eski = onbellek.get(`${a}@${genislik}`);
    return eski && simdi - eski.zaman < TTL_MS ? eski : undefined;
  };
  const eksik = new Set(adlar.filter((a) => !taze(a))).size;
  if (eksik > 0) {
    const sinir = await sinirKontrol(k, 'photo', eksik);
    if (sinir) return sinir;
  }
  // Aynı ad iki kez gelirse tek istek.
  const sozler = new Map<string, Promise<string | null>>();
  for (const a of adlar) {
    if (sozler.has(a)) continue;
    const eski = taze(a);
    sozler.set(
      a,
      eski
        ? Promise.resolve(eski.uri)
        : fotoUri(a, genislik).then(
            (uri) => {
              onbellek.set(`${a}@${genislik}`, { zaman: simdi, uri });
              return uri;
            },
            (e) => {
              console.error('places-photo toplu', e);
              return null;
            },
          ),
    );
  }
  const uriler = await Promise.all(adlar.map((a) => sozler.get(a)!));
  return json({ uriler });
}
