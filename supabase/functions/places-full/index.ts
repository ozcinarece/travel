// places-full — #80 mekan paneli (Genel): fotoğraf adları (≤ 10), saatler, adres, editoryal özet. Yorumlar burada DEĞİL
// (places-reviews; yalnız Yorumlar sekmesinde). Cevap bu izolatta 24 saat önbelleklenir (bellek; DB'ye yazılmaz, PRD §7).
// #316 KK2: arama seçimi `sessionToken` ile gelir — bu istek Autocomplete oturumunu kapatır (ayrı hafif Details yok). Token'lı
// istek önbelleği okumaz: önbellekten dönülürse Google'a Details gitmez, oturum kapanmaz ve her tuş ayrı faturalanır.
import { GoogleHatasi, tamDetay, type TamYer } from '../_shared/google.ts';
import { govde, hata, json, kullaniciDogrula } from '../_shared/http.ts';
import { oturumAnahtari } from '../_shared/oturum.ts';
import { sayacli } from '../_shared/sayac.ts';
import { sinirKontrol } from '../_shared/sinir.ts';

type Istek = { id: string; tz?: string; sessionToken?: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; deger: TamYer }>();

Deno.serve(sayacli('places-full', async (istek) => {
  const k = await kullaniciDogrula(istek);
  if (k instanceof Response) return k;
  const g = await govde<Istek>(istek);
  if (typeof g.id !== 'string' || !g.id) return hata('id gerekli');
  const tz = typeof g.tz === 'string' && g.tz.length < 64 ? g.tz : undefined;
  const oturum = oturumAnahtari(g.sessionToken);
  const anahtar = `${tz ?? '-'}:${g.id}`;
  const simdi = Date.now();
  const eski = onbellek.get(anahtar);
  // "Bugün" satırı ve açık/kapalı günle değişir: önbellek aynı takvim gününde geçerli (TTL içinde gün değiştiyse yenilenir).
  if (!oturum && eski && simdi - eski.zaman < TTL_MS && new Date(eski.zaman).toDateString() === new Date(simdi).toDateString()) return json({ yer: eski.deger });
  const sinir = await sinirKontrol(k, 'details');
  if (sinir) return sinir;
  // #226: tamDetay ilk fotoğrafı ayrıca Place Photo ile URI'ye çeviriyor (fotoUri); o istek de Photo kovasından düşülür.
  const fotoSiniri = await sinirKontrol(k, 'photo');
  if (fotoSiniri) return fotoSiniri;
  try {
    const yer = await tamDetay(g.id, tz, oturum);
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
}));
