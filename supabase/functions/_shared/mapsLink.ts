// Google Maps linki ayrıştırıcı (saf TS; Deno ve Jest'te aynı dosya).
// Desteklenen biçimler (PRD 3.3 KK1, teknik not T8: yalnızca Google Maps; Booking/Instagram v2):
//   https://www.google.com/maps/place/<ad>/@lat,lng,17z/data=...!3dLAT!4dLNG...!19sChIJ...
//   https://www.google.com/maps/search/?api=1&query=lat,lng&query_place_id=ChIJ...
//   https://www.google.com/maps/place/?q=place_id:ChIJ...
//   https://maps.google.com/?q=lat,lng  ·  https://www.google.com/maps?q=lat,lng
//   geo:lat,lng?q=...
//   Kısa linkler (maps.app.goo.gl, goo.gl/maps) önce sunucuda takip edilir, sonra buraya gelir.

export type AyristirilmisLink = {
  placeId?: string;
  ad?: string;
  lat?: number;
  lng?: number;
};

const KISA_HOSTLAR = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

export function kisaLinkMi(url: string): boolean {
  try {
    const u = new URL(url);
    return KISA_HOSTLAR.includes(u.hostname);
  } catch {
    return false;
  }
}

/** google.com, google.com.tr, maps.google.de … ve /maps yolu. */
export function googleMapsLinkiMi(url: string): boolean {
  if (url.startsWith('geo:')) return true;
  try {
    const u = new URL(url);
    if (kisaLinkMi(url)) return true;
    const host = u.hostname;
    const google = /(^|\.)google\.[a-z.]{2,8}$/.test(host);
    return google && (u.pathname.startsWith('/maps') || host.startsWith('maps.'));
  } catch {
    return false;
  }
}

function sayi(x: string | null | undefined): number | undefined {
  if (!x) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function koordinatCifti(metin: string | null | undefined): { lat: number; lng: number } | undefined {
  if (!metin) return undefined;
  const m = metin.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export function haritaLinkiAyristir(url: string): AyristirilmisLink | null {
  if (url.startsWith('geo:')) {
    const govde = url.slice(4);
    const [konum, sorgu] = govde.split('?');
    const k = koordinatCifti(konum);
    const q = sorgu ? new URLSearchParams(sorgu).get('q') : null;
    const qk = koordinatCifti(q?.split('(')[0]);
    const ad = q?.match(/\((.+)\)/)?.[1];
    const son = qk ?? k;
    if (!son && !q) return null;
    return { ...(son ?? {}), ad: ad ?? (q && !qk ? q : undefined) };
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const sonuc: AyristirilmisLink = {};
  const p = u.searchParams;

  // Açık place_id biçimleri
  const qpid = p.get('query_place_id') ?? p.get('place_id');
  if (qpid) sonuc.placeId = qpid;
  const q = p.get('q') ?? p.get('query');
  if (q?.startsWith('place_id:')) sonuc.placeId = q.slice('place_id:'.length);

  // data=... içindeki !19sChIJ… (yer kimliği) — en güvenilir ipucu
  const veri = decodeURIComponent(u.pathname + u.search);
  const pid = veri.match(/!19s(ChIJ[A-Za-z0-9_-]+)/) ?? veri.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (pid && !sonuc.placeId) sonuc.placeId = pid[1];

  // Ad: /maps/place/<ad>/
  const adM = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (adM) {
    const ad = decodeURIComponent(adM[1].replace(/\+/g, ' ')).trim();
    if (ad && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(ad)) sonuc.ad = ad;
  }

  // Koordinat: !3dLAT!4dLNG (mekanın kendisi) > @lat,lng (görünüm merkezi) > q/query/ll/center
  const tam = veri.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (tam) {
    sonuc.lat = sayi(tam[1]);
    sonuc.lng = sayi(tam[2]);
  } else {
    const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const k = at ? { lat: Number(at[1]), lng: Number(at[2]) } : koordinatCifti(q) ?? koordinatCifti(p.get('ll')) ?? koordinatCifti(p.get('center'));
    if (k) {
      sonuc.lat = k.lat;
      sonuc.lng = k.lng;
    }
  }
  if (!sonuc.ad && q && !koordinatCifti(q) && !q.startsWith('place_id:')) sonuc.ad = q;

  if (!sonuc.placeId && sonuc.lat === undefined && !sonuc.ad) return null;
  return sonuc;
}
