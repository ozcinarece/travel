// icerik-google — içerik hattının (docs/07) Google kapısı: metin araması ve durak detayı. Yalnız service_role anahtarı
// (GitHub Actions'taki hat) ve yönetici (is_admin) çağırır; diğer herkese 403. Google'a gitmeden önce günlük Google bütçesi
// (yonetim_ayarlari.google_gunluk_butce) bu isteğin tahmini maliyetiyle denetlenir; okunamazsa istek yapılmaz (kapalı kalır).
// Cevap yalnız çağırana döner; gövde ve Google verisi loga, DB'ye yazılmaz (PRD §7). Loga yalnız durum kodu düşer.
import { GoogleHatasi, icerikDetay, icerikMetinAra, KONAKLAMA_TIPLERI, type IcerikAday, type IcerikDetay } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { sayacli } from '../_shared/sayac.ts';

const EN_COK_SORGU = 25;
const EN_COK_DETAY = 60;
const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/;
const KONAKLAMA = new Set(KONAKLAMA_TIPLERI);

type Sorgu = { metin: string; tip?: string };
type Istek = {
  islem: 'ara' | 'detay';
  merkez: { lat: number; lng: number };
  yaricap_m: number;
  sorgular: Sorgu[];
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
 * Yetki: Authorization taşıyıcısı projenin service_role anahtarıyla birebir aynıysa hat; değilse kullanıcı oturumudur ve
 * PostgREST `is_admin()` ile denetlenir (JWT'yi PostgREST doğrular). Geçide (verify_jwt) güvenilmez: anahtar karşılaştırması
 * ve PostgREST denetimi ayarı ne olursa olsun geçerlidir.
 */
async function yetkili(istek: Request): Promise<boolean> {
  const token = (istek.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (servis && esit(token, servis)) return true;
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
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

const konaklama = (a: IcerikAday) => (a.primary_type !== null && KONAKLAMA.has(a.primary_type)) || a.tipler.includes('lodging');

Deno.serve(sayacli('icerik-google', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;
  if (!(await yetkili(istek))) return hata('yetki yok', 403);

  const g = await govde<Istek>(istek);
  if (g.islem === 'ara') {
    const m = g.merkez;
    if (!m || typeof m.lat !== 'number' || typeof m.lng !== 'number' || Math.abs(m.lat) > 90 || Math.abs(m.lng) > 180) return hata('merkez (lat, lng) gerekli');
    const yaricap = typeof g.yaricap_m === 'number' && g.yaricap_m > 0 ? Math.min(g.yaricap_m, 50_000) : 15_000;
    const sorgular = Array.isArray(g.sorgular) ? g.sorgular.filter((s): s is Sorgu => !!s && typeof s.metin === 'string' && s.metin.trim().length > 0) : [];
    if (sorgular.length === 0) return hata('en az bir sorgu gerekli');
    if (sorgular.length > EN_COK_SORGU) return hata(`istek başına en çok ${EN_COK_SORGU} sorgu`);
    if (sorgular.some((s) => s.metin.length > 200 || (s.tip !== undefined && (typeof s.tip !== 'string' || !/^[a-z_]{2,40}$/.test(s.tip))))) return hata('geçersiz sorgu');

    const butce = await butceVar(sorgular.length);
    if (!butce) return hata('bütçe denetlenemedi; Google çağrısı yapılmadı', 503);
    if (!butce.yeterli) return json({ hata: 'günlük Google bütçesi dolu', harcanan: butce.harcanan, butce: butce.butce }, 429);

    const sonuclar = await sirayla(sorgular, 5, async (s) => {
      try {
        const adaylar = await icerikMetinAra({ metin: s.metin.trim(), merkez: m, yaricapM: yaricap, tip: s.tip });
        const kalan = adaylar.filter((a) => !konaklama(a));
        return { sorgu: s.metin.trim(), tip: s.tip ?? null, elenen_konaklama: adaylar.length - kalan.length, adaylar: kalan };
      } catch (e) {
        console.error('icerik-google ara', googleDurumu(e));
        return { sorgu: s.metin.trim(), tip: s.tip ?? null, hata: googleDurumu(e) };
      }
    });
    return json({ islem: 'ara', sonuclar });
  }

  if (g.islem === 'detay') {
    const idler = Array.isArray(g.idler) ? [...new Set(g.idler.filter((x): x is string => typeof x === 'string'))] : [];
    if (idler.length === 0) return hata('en az bir place_id gerekli');
    if (idler.length > EN_COK_DETAY) return hata(`istek başına en çok ${EN_COK_DETAY} place_id`);
    if (idler.some((x) => !PLACE_ID.test(x))) return hata('geçersiz place_id');

    const butce = await butceVar(idler.length);
    if (!butce) return hata('bütçe denetlenemedi; Google çağrısı yapılmadı', 503);
    if (!butce.yeterli) return json({ hata: 'günlük Google bütçesi dolu', harcanan: butce.harcanan, butce: butce.butce }, 429);

    const yerler = await sirayla(idler, 8, async (id): Promise<IcerikDetay | { place_id: string; hata: number }> => {
      try {
        return await icerikDetay(id);
      } catch (e) {
        console.error('icerik-google detay', googleDurumu(e));
        return { place_id: id, hata: googleDurumu(e) };
      }
    });
    return json({ islem: 'detay', yerler });
  }

  return hata("islem 'ara' ya da 'detay' olmalı");
}));
