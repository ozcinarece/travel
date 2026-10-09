// places-nearby — Nearby Search (New), POPULARITY. 3.4 KK4 öneri çipleri (en fazla 20) ve
// #17 otel adayları (`cip: 'otel'`, en fazla 12). Cevap yalnız bellekte; veritabanına yazılmaz (PRD §7).
// Önbellek: (çip, 0,0001° hücre, yarıçap, adet) anahtarıyla izolat belleğinde 24 sa (teknik not §3). #66: karo
// merkezleri 125 m'ye kadar inebildiğinden hücre 4 ondalık, yarıçap en az 100 m.
import { CIP_TIPLERI, GoogleHatasi, yakinAra, type HafifYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { merkez: { lat: number; lng: number }; yaricapM?: number; cip: string; enFazla?: number };

const TTL_MS = 24 * 60 * 60 * 1000;
/** Önbellek izolat belleğinde (kullanıcılar arasında yalnız aynı izolat paylaşır); en çok bu kadar anahtar, en eski silinir (#68 incelemesi). */
const ONBELLEK_EN_FAZLA = 5000;
const onbellek = new Map<string, { zaman: number; deger: HafifYer[] }>();
function onbellekYaz(anahtar: string, deger: HafifYer[]) {
  const simdi = Date.now();
  if (onbellek.size >= ONBELLEK_EN_FAZLA) {
    for (const [k, v] of onbellek) if (simdi - v.zaman >= TTL_MS) onbellek.delete(k);
    while (onbellek.size >= ONBELLEK_EN_FAZLA) onbellek.delete(onbellek.keys().next().value!);
  }
  onbellek.set(anahtar, { zaman: simdi, deger });
}

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const lat = Number(g.merkez?.lat);
  const lng = Number(g.merkez?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return hata('merkez geçersiz');
  const tipler = typeof g.cip === 'string' ? CIP_TIPLERI[g.cip] : undefined;
  if (!tipler) return hata('cip geçersiz');
  const yaricapM = Math.min(Math.max(Number(g.yaricapM) || 3000, 100), 15_000);
  const enFazla = Math.min(Math.max(Math.trunc(Number(g.enFazla) || 20), 1), 20);

  const anahtar = `${g.cip}:${lat.toFixed(4)},${lng.toFixed(4)}:${yaricapM}:${enFazla}`;
  const eski = onbellek.get(anahtar);
  if (eski && Date.now() - eski.zaman < TTL_MS) return json({ yerler: eski.deger, onbellek: true });
  if (eski) onbellek.delete(anahtar);

  try {
    const yerler = await yakinAra({ merkez: { lat, lng }, yaricapM, tipler, enFazla });
    onbellekYaz(anahtar, yerler);
    return json({ yerler, onbellek: false });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-nearby google', e.durum, e.message);
      return hata('öneriler şu an alınamıyor', 502);
    }
    console.error('places-nearby', e);
    return hata('sunucu hatası', 500);
  }
});
