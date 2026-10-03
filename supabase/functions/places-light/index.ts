// places-light — toplu HAFİF Place Details (PRD §7, teknik not §3 tablo).
// Bir istekte en fazla 25 place_id. `saatler: true` ile haftalık açılış periyotları da gelir (3.7 KK5; yalnız program durakları). Cevap bu izolatta 24 saat önbelleklenir (bellek; DB'ye yazılmaz:
// ad/puan/saat veritabanına girmez). Şehir modunda (sehir: true) puan yerine saat dilimi + ülke kodu döner.
import { GoogleHatasi, hafifDetay, type HafifYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';

type Istek = { ids: string[]; sehir?: boolean; saatler?: boolean; foto?: boolean; sessionToken?: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: HafifYer }>();

function onbellekAnahtari(id: string, sehir: boolean, saatler: boolean, foto: boolean) {
  return `${sehir ? 'sehir' : saatler ? 'saatli' : foto ? 'fotolu' : 'hafif'}:${id}`;
}

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const ids = Array.isArray(g.ids) ? g.ids.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  if (ids.length === 0) return json({ yerler: [] });
  if (ids.length > 25) return hata('en fazla 25 place_id');
  const sehir = g.sehir === true;
  const saatler = g.saatler === true && !sehir;
  // #29: fotoğraf yalnız tek mekan için (önizleme kartı); Photo çağrısı fotoğraf başına faturalanır.
  const foto = g.foto === true && !sehir && !saatler && ids.length === 1;
  const oturum = typeof g.sessionToken === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(g.sessionToken) ? g.sessionToken : undefined;

  const simdi = Date.now();
  try {
    const yerler = await Promise.all(
      [...new Set(ids)].map(async (id, i) => {
        const anahtar = onbellekAnahtari(id, sehir, saatler, foto);
        const eski = onbellek.get(anahtar);
        if (eski && simdi - eski.zaman < TTL_MS) return eski.deger;
        // Oturum token'ı yalnızca ilk (seçilen) kayda bağlanır; oturumu kapatır.
        const yer = await hafifDetay(id, { sehir, saatler, foto, oturum: i === 0 ? oturum : undefined });
        onbellek.set(anahtar, { zaman: simdi, deger: yer });
        return yer;
      }),
    );
    return json({ yerler });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-light google', e.durum, e.message);
      return hata('mekan bilgisi şu an alınamıyor', 502);
    }
    console.error('places-light', e);
    return hata('sunucu hatası', 500);
  }
});
