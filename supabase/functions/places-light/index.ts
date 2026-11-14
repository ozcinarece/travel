// places-light — toplu HAFİF Place Details (PRD §7, teknik not §3 tablo).
// Bir istekte en fazla 25 place_id. `saatler: true` ile haftalık açılış periyotları da gelir (3.7 KK5; yalnız program durakları). Cevap bu izolatta 24 saat önbelleklenir (bellek; DB'ye yazılmaz:
// ad/puan/saat veritabanına girmez). Şehir modunda (sehir: true) puan yerine saat dilimi + ülke kodu döner.
// #172 KK3: `puansiz: true` — puan / "şu an açık" göstermeyen çağrılar Pro maskeyle (Enterprise alanları yok); saatli
// istekte yok sayılır (açılış saatleri zaten Enterprise). `saatler` + `foto`: saat ve fotoğraf tek istekte (≤ 12 kimlik).
import { GoogleHatasi, hafifDetay, type HafifYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';

type Istek = { ids: string[]; sehir?: boolean; saatler?: boolean; foto?: boolean; ozet?: boolean; puansiz?: boolean; sessionToken?: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: HafifYer }>();

function onbellekAnahtari(id: string, sehir: boolean, saatler: boolean, foto: boolean, ozet: boolean, puansiz: boolean) {
  const tur = sehir
    ? 'sehir'
    : saatler
      ? foto ? 'saatlifotolu' : 'saatli'
      : foto ? (ozet ? 'ozetli' : puansiz ? 'profotolu' : 'fotolu') : puansiz ? 'pro' : 'hafif';
  return `${tur}:${id}`;
}

Deno.serve(sayacli('places-light', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const ids = Array.isArray(g.ids) ? g.ids.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  if (ids.length === 0) return json({ yerler: [] });
  if (ids.length > 25) return hata('en fazla 25 place_id');
  const sehir = g.sehir === true;
  const saatler = g.saatler === true && !sehir;
  // #29: fotoğraf önizleme kartı için; #119: içerik karoları (gezi durakları, yerler) için en çok 12 kimlikle de —
  // `photos` alanı Details maskesine ek SKU getirmez, Photo medyası istemci yüklerken faturalanır; 24 sa önbellek.
  const foto = g.foto === true && !sehir && ids.length <= 12;
  // #45: editorialSummary yalnız pin paneli (tek mekan, fotoğrafla birlikte); 24 sa önbellek.
  const ozet = foto && !saatler && g.ozet === true;
  const puansiz = g.puansiz === true && !sehir && !saatler && !ozet;
  const oturum = typeof g.sessionToken === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(g.sessionToken) ? g.sessionToken : undefined;

  const simdi = Date.now();
  try {
    const yerler = await Promise.all(
      [...new Set(ids)].map(async (id, i) => {
        const anahtar = onbellekAnahtari(id, sehir, saatler, foto, ozet, puansiz);
        const eski = onbellek.get(anahtar);
        if (eski && simdi - eski.zaman < TTL_MS) return eski.deger;
        // Oturum token'ı yalnızca ilk (seçilen) kayda bağlanır; oturumu kapatır.
        const yer = await hafifDetay(id, { sehir, saatler, foto, ozet, puansiz, oturum: i === 0 ? oturum : undefined });
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
}));
