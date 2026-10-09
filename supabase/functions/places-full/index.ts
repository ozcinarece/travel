// places-full — #80 mekan paneli (Genel): fotoğraf adları (≤ 10), saatler, adres, editoryal özet. Yorumlar burada DEĞİL
// (places-reviews; yalnız Yorumlar sekmesinde). Cevap bu izolatta 24 saat önbelleklenir (bellek; DB'ye yazılmaz, PRD §7).
import { GoogleHatasi, tamDetay, type TamYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { id: string; tz?: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: TamYer }>();

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  const g = await govde<Istek>(istek);
  if (typeof g.id !== 'string' || !g.id) return hata('id gerekli');
  const tz = typeof g.tz === 'string' && g.tz.length < 64 ? g.tz : undefined;
  const anahtar = `${tz ?? '-'}:${g.id}`;
  const simdi = Date.now();
  const eski = onbellek.get(anahtar);
  // "Bugün" satırı ve açık/kapalı günle değişir: önbellek aynı takvim gününde geçerli (TTL içinde gün değiştiyse yenilenir).
  if (eski && simdi - eski.zaman < TTL_MS && new Date(eski.zaman).toDateString() === new Date(simdi).toDateString()) return json({ yer: eski.deger });
  try {
    const yer = await tamDetay(g.id, tz);
    onbellek.set(anahtar, { zaman: simdi, deger: yer });
    return json({ yer });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-full google', e.durum, e.message);
      return hata('mekan bilgisi şu an alınamıyor', 502);
    }
    console.error('places-full', e);
    return hata('sunucu hatası', 500);
  }
});
