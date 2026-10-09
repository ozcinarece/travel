// places-reviews — #80 KK8: mekan panelinin Yorumlar sekmesi. Yalnız sekmeye dokununca çağrılır; Google en fazla 5 yorum
// verir (ek sayfa yok). Cevap bu izolatta 24 saat önbelleklenir (bellek); yorumlar DB'ye yazılmaz (PRD §7).
import { GoogleHatasi, yorumDetay, type YorumOzeti } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { id: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: YorumOzeti }>();

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  if (typeof g.id !== 'string' || !g.id) return hata('id gerekli');
  const simdi = Date.now();
  const eski = onbellek.get(g.id);
  if (eski && simdi - eski.zaman < TTL_MS) return json(eski.deger);
  try {
    const ozet = await yorumDetay(g.id);
    onbellek.set(g.id, { zaman: simdi, deger: ozet });
    return json(ozet);
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-reviews google', e.durum, e.message);
      return hata('yorumlar şu an alınamıyor', 502);
    }
    console.error('places-reviews', e);
    return hata('sunucu hatası', 500);
  }
});
