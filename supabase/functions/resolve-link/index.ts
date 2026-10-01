// resolve-link — PRD 3.3 KK1 / 3.4: yapıştırılan Google Maps linkinden mekan çözer.
// Kısa link sunucuda takip edilir (istemciye yönlendirme zinciri gelmez), ardından
// place_id → hafif Details; ad+koordinat → Text Search; yalnız koordinat → koordinat döner.
// Booking / Instagram linkleri v2 (T8): 'desteklenmeyen_link'.
import { GoogleHatasi, hafifDetay, metinAra, type HafifYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { googleMapsLinkiMi, haritaLinkiAyristir, kisaLinkMi } from '../_shared/mapsLink.ts';

type Istek = { url: string; merkez?: { lat: number; lng: number } };
type Cevap = { yer: HafifYer; kaynak: 'place_id' | 'arama' | 'koordinat' };

async function kisaLinkiTakipEt(url: string): Promise<string> {
  let simdiki = url;
  for (let i = 0; i < 5; i++) {
    const cevap = await fetch(simdiki, { method: 'HEAD', redirect: 'manual' });
    const hedef = cevap.headers.get('location');
    if (!hedef) return simdiki;
    simdiki = new URL(hedef, simdiki).toString();
    if (!kisaLinkMi(simdiki)) return simdiki;
  }
  return simdiki;
}

Deno.serve(async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const ham = typeof g.url === 'string' ? g.url.trim() : '';
  if (!ham || ham.length > 2000) return hata('url gerekli');
  const url = /^(https?:\/\/|geo:)/i.test(ham) ? ham : `https://${ham}`;
  if (!googleMapsLinkiMi(url)) return json({ hata: 'desteklenmeyen_link' }, 422);

  try {
    const acik = kisaLinkMi(url) ? await kisaLinkiTakipEt(url) : url;
    const ayr = haritaLinkiAyristir(acik);
    if (!ayr) return json({ hata: 'cozulemedi' }, 422);

    if (ayr.placeId) {
      const yer = await hafifDetay(ayr.placeId, {});
      return json({ yer, kaynak: 'place_id' } satisfies Cevap);
    }
    const merkez = ayr.lat !== undefined && ayr.lng !== undefined ? { lat: ayr.lat, lng: ayr.lng } : g.merkez;
    if (ayr.ad) {
      const yer = await metinAra({ metin: ayr.ad, merkez, yaricapM: ayr.lat !== undefined ? 500 : 30_000 });
      if (yer) return json({ yer, kaynak: 'arama' } satisfies Cevap);
    }
    if (ayr.lat !== undefined && ayr.lng !== undefined) {
      const yer: HafifYer = {
        place_id: '',
        ad: ayr.ad ?? '',
        lat: ayr.lat,
        lng: ayr.lng,
        primary_type: null,
        tz: null,
        puan: null,
        puan_sayisi: null,
        acik: null,
        ulke_kodu: null,
      };
      return json({ yer, kaynak: 'koordinat' } satisfies Cevap);
    }
    return json({ hata: 'cozulemedi' }, 422);
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('resolve-link google', e.durum, e.message);
      return hata('mekan bilgisi şu an alınamıyor', 502);
    }
    console.error('resolve-link', e);
    return hata('sunucu hatası', 500);
  }
});
