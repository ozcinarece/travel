// places-full — #80 mekan paneli (Genel): fotoğraf adları (≤ 10), saatler, adres, editoryal özet. Yorumlar burada DEĞİL
// (places-reviews; yalnız Yorumlar sekmesinde). Cevap bu izolatta 24 saat önbelleklenir (bellek; DB'ye yazılmaz, PRD §7).
// #316 KK2: arama seçimi `sessionToken` ile gelir — Google'a giden bu istek Autocomplete oturumunu kapatır (ayrı hafif Details yok).
// #353: seçilen yer önbellekteyse token gelse de Google'a gidilmez; oturum kapanmaz ve tuşlar tek tek faturalanır. Bu bilerek
// böyle: 12 tuşun altında oturumu kapatmak hiçbir alan maskesinde ucuzlatmıyor (hesap ve kaynak: _shared/oturum.ts).
import { GoogleHatasi, tamDetay, type TamYer } from '../_shared/google.ts';
import { govde, hata, json, kullaniciDogrula } from '../_shared/http.ts';
import { oturumAnahtari, tekOku } from '../_shared/oturum.ts';
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
  // "Bugün" satırı ve açık/kapalı günle değişir: önbellek aynı takvim gününde geçerli (TTL içinde gün değiştiyse yenilenir).
  const gecerli = (kayit: { zaman: number }) => simdi - kayit.zaman < TTL_MS && new Date(kayit.zaman).toDateString() === new Date(simdi).toDateString();
  try {
    const sonuc = await tekOku({
      eski: onbellek.get(anahtar),
      gecerli,
      oturum,
      sinir: async () =>
        (await sinirKontrol(k, 'details')) ??
        // #226: tamDetay ilk fotoğrafı ayrıca Place Photo ile URI'ye çeviriyor (fotoUri); o istek de Photo kovasından düşülür.
        (await sinirKontrol(k, 'photo')),
      detay: (o) => tamDetay(g.id, tz, o),
      yaz: (yer) => onbellek.set(anahtar, { zaman: simdi, deger: yer }),
    });
    if ('red' in sonuc) return sonuc.red;
    return json({ yer: sonuc.deger });
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-full google', e.durum, e.message);
      return hata('mekan bilgisi şu an alınamıyor', 502);
    }
    console.error('places-full', e);
    return hata('sunucu hatası', 500);
  }
}));
