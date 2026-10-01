// places-full — PRD 3.8 KK6: TAM Place Details yalnızca mekan detayı ekranı için.
// Yorumlar ve fotoğraflar önbelleklenmez, saklanmaz (PRD §7).
import { GoogleHatasi, tamDetay } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { id: string; tz?: string };

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  if (typeof g.id !== 'string' || !g.id) return hata('id gerekli');
  const tz = typeof g.tz === 'string' && g.tz.length < 64 ? g.tz : undefined;
  try {
    return json({ yer: await tamDetay(g.id, tz) });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-full google', e.durum, e.message);
      return hata('mekan bilgisi şu an alınamıyor', 502);
    }
    console.error('places-full', e);
    return hata('sunucu hatası', 500);
  }
});
