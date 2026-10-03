// places-photo — #31: Place Photo (New) adını URI'ye çevirir; istemci galeride fotoğrafı görünür olunca ister (tembel).
// Fotoğraf başına faturalanır; URI izolat belleğinde 24 sa tutulur. Anahtar istemciye gitmez (PRD §7).
import { fotoUri } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { ad: string; genislik?: number };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; uri: string | null }>();

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  const ad = typeof g.ad === 'string' ? g.ad : '';
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ad)) return hata('fotoğraf adı geçersiz');
  const genislik = Math.min(Math.max(Math.trunc(Number(g.genislik) || 800), 100), 1600);
  const anahtar = `${ad}@${genislik}`;
  const eski = onbellek.get(anahtar);
  if (eski && Date.now() - eski.zaman < TTL_MS) return json({ uri: eski.uri });
  try {
    const uri = await fotoUri(ad, genislik);
    onbellek.set(anahtar, { zaman: Date.now(), uri });
    return json({ uri });
  } catch (e) {
    console.error('places-photo', e);
    return hata('fotoğraf alınamadı', 502);
  }
});
