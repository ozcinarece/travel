// places-nearby — PRD 3.4 KK4 öneri çipleri: Nearby Search (New), POPULARITY, en fazla 20 sonuç.
// Önbellek: (çip, 0,01° hücre, yarıçap) anahtarıyla izolat belleğinde 24 sa (teknik not §3).
import { CIP_TIPLERI, GoogleHatasi, yakinAra, type HafifYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { merkez: { lat: number; lng: number }; yaricapM?: number; cip: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: HafifYer[] }>();

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const lat = Number(g.merkez?.lat);
  const lng = Number(g.merkez?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return hata('merkez geçersiz');
  const tipler = typeof g.cip === 'string' ? CIP_TIPLERI[g.cip] : undefined;
  if (!tipler) return hata('cip geçersiz');
  const yaricapM = Math.min(Math.max(Number(g.yaricapM) || 3000, 500), 15_000);

  const anahtar = `${g.cip}:${lat.toFixed(2)},${lng.toFixed(2)}:${yaricapM}`;
  const eski = onbellek.get(anahtar);
  if (eski && Date.now() - eski.zaman < TTL_MS) return json({ yerler: eski.deger, onbellek: true });

  try {
    const yerler = await yakinAra({ merkez: { lat, lng }, yaricapM, tipler });
    onbellek.set(anahtar, { zaman: Date.now(), deger: yerler });
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
