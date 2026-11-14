// icerik-google — içerik hattının (docs/07) Google kapısı. Yalnız service_role (GitHub Actions'taki hat) ve yönetici
// (is_admin) çağırır; diğer herkese 403. Üç işlem:
//   kimlik — OSM adayının place_id'si: Text Search, yalnız `places.id` (IDs Only SKU, ücretsiz). Bütçe denetimine girmez;
//            istek sayısı ayrı, ücretsiz sayaca (`icerik-kimlik`) yazılır. Başka alan istenirse reddedilir.
//   puan   — kısa liste (≤ 30): ad, tip, işletme durumu, puan, yorum sayısı (Place Details Enterprise).
//   detay  — yükleme (≤ 60): ad, tip, konum, işletme durumu (Place Details Pro).
// puan ve detay Google'a gitmeden önce günlük bütçeyi (yonetim_ayarlari.google_gunluk_butce) bu isteğin tahmini maliyetiyle
// denetler; okunamazsa istek yapılmaz. Cevap yalnız çağırana döner; gövde ve Google verisi loga, DB'ye yazılmaz (PRD §7).
import { GoogleHatasi, icerikDetay, icerikKimlik, icerikPuan, type IcerikDetay, type IcerikPuan } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';

const EN_COK_KIMLIK = 80;
const EN_COK_PUAN = 30;
const EN_COK_DETAY = 60;
const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/;
/** kimlik isteğinde izin verilen anahtarlar: alan maskesi ya da alan listesi gönderilemez (IDs Only kalır). */
const KIMLIK_ANAHTARLARI = new Set(['islem', 'sorgular', 'merkez', 'yaricap_m']);

type KimlikSorgusu = { metin: string; lat?: number; lng?: number; yaricap_m?: number };
type Istek = {
  islem: 'kimlik' | 'puan' | 'detay';
  merkez: { lat: number; lng: number };
  yaricap_m: number;
  sorgular: KimlikSorgusu[];
  idler: string[];
};

/** Sabit zamanlı karşılaştırma (anahtar uzunluğu dışında bilgi sızdırmaz). */
function esit(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let fark = 0;
  for (let i = 0; i < x.length; i++) fark |= x[i] ^ y[i];
  return fark === 0;
}

/**
 * Yetki: Authorization taşıyıcısı ortamdaki service_role anahtarıyla birebir aynıysa ya da PostgREST onu service_role
 * olarak kabul ediyorsa (yalnız service_role'e açık RPC) hat; değilse kullanıcı oturumudur ve PostgREST `is_admin()` ile
 * denetlenir. Geçide (verify_jwt) güvenilmez: her iki denetim de JWT'yi PostgREST'e doğrulatır.
 */
async function yetkili(istek: Request): Promise<boolean> {
  const token = (istek.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (servis && esit(token, servis)) return true;
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return false;
  // Ortamdaki anahtar farklı biçimdeyse (yeni API anahtarları: sb_secret_…), taşıyıcıyı PostgREST doğrular: yalnız
  // service_role'e açık `icerik_google_butcesi` bu anahtarla çağrılabiliyorsa çağıran service_role'dür.
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/icerik_google_butcesi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: token, authorization: `Bearer ${token}` },
      body: JSON.stringify({ p_istek: 0 }),
    });
    await cevap.body?.cancel();
    if (cevap.ok) return true;
  } catch {
    // aşağıda yönetici denetimi
  }
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anon) return false;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anon, authorization: `Bearer ${token}` },
      body: '{}',
    });
    return cevap.ok && (await cevap.json()) === true;
  } catch {
    return false;
  }
}

/** Günlük bütçe: bugünkü tahmini harcama + bu isteğin üst sınır maliyeti bütçeyi aşıyorsa false. Okunamazsa null. */
async function butceVar(istekSayisi: number): Promise<{ yeterli: boolean; harcanan: number; butce: number | null } | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anahtar) return null;
  try {
    const cevap = await fetch(`${url}/rest/v1/rpc/icerik_google_butcesi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anahtar, authorization: `Bearer ${anahtar}` },
      body: JSON.stringify({ p_istek: istekSayisi }),
    });
    if (!cevap.ok) throw new Error(`${cevap.status}`);
    return (await cevap.json()) as { yeterli: boolean; harcanan: number; butce: number | null };
  } catch (e) {
    console.error('icerik-google bütçe okunamadı', e instanceof Error ? e.message : 'bilinmeyen');
    return null;
  }
}

/** En çok `es` iş aynı anda. */
async function sirayla<T, U>(ogeler: T[], es: number, is: (oge: T) => Promise<U>): Promise<U[]> {
  const sonuc: U[] = new Array(ogeler.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(es, ogeler.length) }, async () => {
      while (i < ogeler.length) {
        const n = i++;
        sonuc[n] = await is(ogeler[n]);
      }
    }),
  );
  return sonuc;
}

const googleDurumu = (e: unknown) => (e instanceof GoogleHatasi ? e.durum : 500);

const gecerliKonum = (lat: unknown, lng: unknown) => typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Ücretsiz kimlik isteklerini maliyet kalemi olmayan ayrı sayaca yazar (Genel bakış harcamasına girmez). */
async function kimlikSay(adet: number) {
  const url = Deno.env.get('SUPABASE_URL');
  const anahtar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anahtar || adet <= 0) return;
  try {
    await fetch(`${url}/rest/v1/rpc/api_sayac_artir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anahtar, authorization: `Bearer ${anahtar}` },
      body: JSON.stringify({ p_fonksiyon: 'icerik-kimlik', p_cagri: 0, p_google: adet }),
    });
  } catch {
    console.error('icerik-google kimlik sayacı yazılamadı');
  }
}

function idleriAl(g: Partial<Istek>, enCok: number): string[] | Response {
  const idler = Array.isArray(g.idler) ? [...new Set(g.idler.filter((x): x is string => typeof x === 'string'))] : [];
  if (idler.length === 0) return hata('en az bir place_id gerekli');
  if (idler.length > enCok) return hata(`istek başına en çok ${enCok} place_id`);
  if (idler.some((x) => !PLACE_ID.test(x))) return hata('geçersiz place_id');
  return idler;
}

Deno.serve(sayacli('icerik-google', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  if (!(await yetkili(istek))) return hata('yetki yok', 403);

  const g = await govde<Istek>(istek);
  if (g.islem === 'kimlik') {
    if (Object.keys(g).some((k) => !KIMLIK_ANAHTARLARI.has(k))) return hata('kimlik yalnız place_id döner; başka alan istenemez');
    const m = g.merkez;
    if (m !== undefined && !gecerliKonum(m?.lat, m?.lng)) return hata('merkez geçersiz');
    const varsayilanYaricap = typeof g.yaricap_m === 'number' && g.yaricap_m > 0 ? g.yaricap_m : 300;
    const sorgular = Array.isArray(g.sorgular) ? g.sorgular : [];
    if (sorgular.length === 0) return hata('en az bir sorgu gerekli');
    if (sorgular.length > EN_COK_KIMLIK) return hata(`istek başına en çok ${EN_COK_KIMLIK} sorgu`);
    for (const s of sorgular) {
      if (!s || typeof s.metin !== 'string' || !s.metin.trim() || s.metin.length > 200) return hata('geçersiz sorgu');
      if (Object.keys(s).some((k) => !['metin', 'lat', 'lng', 'yaricap_m'].includes(k))) return hata('kimlik yalnız place_id döner; başka alan istenemez');
      const konumVar = s.lat !== undefined || s.lng !== undefined;
      if (konumVar ? !gecerliKonum(s.lat, s.lng) : !m) return hata('her sorguda konum (lat, lng) ya da istekte merkez gerekli');
    }
    let adet = 0;
    const sonuclar = await sirayla(sorgular, 5, async (s) => {
      const merkez = s.lat !== undefined ? { lat: s.lat, lng: s.lng! } : m!;
      try {
        adet += 1;
        return { sorgu: s.metin.trim(), idler: await icerikKimlik({ metin: s.metin.trim(), merkez, yaricapM: s.yaricap_m ?? varsayilanYaricap }) };
      } catch (e) {
        console.error('icerik-google kimlik', googleDurumu(e));
        return { sorgu: s.metin.trim(), hata: googleDurumu(e) };
      }
    });
    await kimlikSay(adet);
    return json({ islem: 'kimlik', sonuclar });
  }

  if (g.islem === 'puan' || g.islem === 'detay') {
    const idler = idleriAl(g, g.islem === 'puan' ? EN_COK_PUAN : EN_COK_DETAY);
    if (idler instanceof Response) return idler;
    const butce = await butceVar(idler.length);
    if (!butce) return hata('bütçe denetlenemedi; Google çağrısı yapılmadı', 503);
    if (!butce.yeterli) return json({ hata: 'günlük Google bütçesi dolu', harcanan: butce.harcanan, butce: butce.butce }, 429);
    const cagri = g.islem === 'puan' ? icerikPuan : icerikDetay;
    const yerler = await sirayla(idler, 8, async (id): Promise<IcerikPuan | IcerikDetay | { place_id: string; hata: number }> => {
      try {
        return await cagri(id);
      } catch (e) {
        console.error(`icerik-google ${g.islem}`, googleDurumu(e));
        return { place_id: id, hata: googleDurumu(e) };
      }
    });
    return json({ islem: g.islem, yerler });
  }

  return hata("islem 'kimlik', 'puan' ya da 'detay' olmalı");
}));
