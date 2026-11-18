// İçerik hattı (docs/07): .github/workflows/icerik.yml'in çalıştırdığı işlemler — sehirler, osm, osm-esle (#205 KK3), arastir,
// yukle, kontrol, sil, kesfet-olc (#190: Keşfet · Turistik isteğinin ölçümü, yalnız sayı). #197: `sehirler` kimliği (Google kimliği, saat dilimi,
// ülke kodu) eksik şehirleri bir kez doldurur (KURU=false); yeni şehirli yükleme kendi şehrini doldurur.
// Ortam: ISLEM, DOSYA, ISTEK, KURU, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, YONETIM_URL, CIKTI (osm, arastir), GITHUB_RUN_ID;
// yerel deneme için SUPABASE_API_URL ve SUPABASE_URL.
// Loglar ve duyurular HERKESE AÇIK: yalnız sayı, slug, id ve sonuç yazılır. Google verisi (ad, puan, adres, saat, koordinat)
// ve kullanıcı verisi yazılmaz. service_role anahtarı çalışma anında Yönetim API'sinden alınır, maskelenir, hiçbir yere
// yazılmaz. Yazma yalnız icerik_gezi_taslak_yukle / icerik_gezi_taslak_sil (ve #197 icerik_sehir_kimligi_yaz) ile; KURU=true iken
// işlem hatayla geri alınır, `sehirler` Google'a gitmez.
import { randomUUID } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  detayIdleri,
  dolarEtiketi,
  eslemeKareleri,
  eslemeYaricapi,
  gunleriDenetle,
  osmEslestir,
  osmKonumDenetle,
  planDenetle,
  REHBER_DOSYA,
  SEHIR_SLUG,
  sehirKimligi,
  sehirKimligiSql,
  SLUG,
  yuklemeVerisi,
  mekanDurumuDenetle,
} from './dogrula.mjs';
import { osmAdaylariOku } from './aday.mjs';
import { OsmOkumaHatasi, yuklemeKonumlari } from './konum.mjs';
import { OverpassHatasi, overpassYeniden, SureBittiHatasi } from './overpass.mjs';
import { derAl, sifrele } from './sifre.mjs';

const ortam = process.env;
const REF = ortam.SUPABASE_PROJECT_REF ?? '';
const TOKEN = ortam.SUPABASE_ACCESS_TOKEN ?? '';
const YONETIM_URL = (ortam.YONETIM_URL || 'https://gezi-yonetim.pages.dev').replace(/\/+$/, '');
const KURU = ortam.KURU !== 'false';
// Yerel deneme için değiştirilebilir; iş akışında varsayılanlar kullanılır.
const API_KOK = ortam.SUPABASE_API_URL || 'https://api.supabase.com';
const PROJE_URL = ortam.SUPABASE_URL || `https://${REF}.supabase.co`;
const EN_COK_KIMLIK = 80;
const EN_COK_PUAN = 30;
const EN_COK_DETAY = 60;

class HatHatasi extends Error {}

// ---------------------------------------------------------------- duyurular (GitHub iş akışı komutları)

const kacis = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** Bir adımda tür başına en çok 10 duyuru gösterilir: satırlar tek duyuruda birleşir. */
function duyuru(tur, baslik, satirlar) {
  const liste = (Array.isArray(satirlar) ? satirlar : [satirlar]).filter(Boolean);
  if (!liste.length) return;
  console.log(`::${tur} title=${kacis(baslik).replace(/[,:]/g, ' ')}::${kacis(liste.join('\n'))}`);
}

async function ozet(satirlar) {
  if (!ortam.GITHUB_STEP_SUMMARY) return;
  await appendFile(ortam.GITHUB_STEP_SUMMARY, `${satirlar.join('\n')}\n`);
}

// ---------------------------------------------------------------- Supabase

async function yonetim(yol, secenek = {}) {
  if (!TOKEN || !REF) throw new HatHatasi('SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF gerekli');
  return fetch(`${API_KOK}/v1/projects/${REF}${yol}`, {
    ...secenek,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(secenek.headers ?? {}) },
  });
}

/** Postgres hata iletisinin ilk satırı (CONTEXT/QUERY satırları sorgu metnini, yani veriyi taşıyabilir: atılır). */
export function guvenliHata(govde) {
  let ileti = '';
  try {
    ileti = JSON.parse(govde).message ?? '';
  } catch {
    ileti = govde ?? '';
  }
  return String(ileti)
    .split('\n')[0]
    .replace(/^Failed to run sql query:\s*/i, '')
    .replace(/\s+(QUERY|CONTEXT|LINE \d+):.*$/, '')
    .slice(0, 300);
}

/** Yönetim API'siyle SQL (postgres rolü). Hata: güvenli ilk satır + ham gövde (yalnız ayrıştırma için, yazdırılmaz). */
async function sql(sorgu) {
  const cevap = await yonetim('/database/query', { method: 'POST', body: JSON.stringify({ query: sorgu }) });
  const metin = await cevap.text();
  if (!cevap.ok) {
    const h = new HatHatasi(`veritabanı ${cevap.status}: ${guvenliHata(metin)}`);
    h.ham = metin;
    throw h;
  }
  return JSON.parse(metin);
}

const jsonAl = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

let servis = null;

/** service_role anahtarı: Yönetim API'sinden, çalışma anında; JWT'nin rolü ve projesi doğrulanır, hemen maskelenir. */
async function servisAnahtari() {
  if (servis) return servis;
  const cevap = await yonetim('/api-keys?reveal=true');
  if (!cevap.ok) throw new HatHatasi(`api anahtarları alınamadı (${cevap.status})`);
  const anahtarlar = await cevap.json();
  const aday = (Array.isArray(anahtarlar) ? anahtarlar : []).find((k) => k?.name === 'service_role' && typeof k.api_key === 'string')?.api_key;
  if (!aday) throw new HatHatasi('service_role anahtarı bulunamadı');
  console.log(`::add-mask::${aday}`);
  let yuk = {};
  try {
    yuk = JSON.parse(Buffer.from(aday.split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    // aşağıda reddedilir
  }
  if (yuk.role !== 'service_role' || yuk.ref !== REF) throw new HatHatasi('service_role anahtarı doğrulanamadı (rol ya da proje farklı)');
  servis = aday;
  return servis;
}

/** icerik-google Edge Function. Hata iletisi fonksiyonun kendi metnidir (Google verisi taşımaz). */
async function google(govde) {
  const anahtar = await servisAnahtari();
  const cevap = await fetch(`${PROJE_URL}/functions/v1/icerik-google`, {
    method: 'POST',
    headers: { authorization: `Bearer ${anahtar}`, apikey: anahtar, 'content-type': 'application/json' },
    body: JSON.stringify(govde),
  });
  const j = await cevap.json().catch(() => ({}));
  if (cevap.status === 429) throw new HatHatasi(`Google bütçesi dolu: bugün tahmini $${j.harcanan ?? '?'} / günlük $${j.butce ?? '?'}; Google'a gidilmedi`);
  if (!cevap.ok) throw new HatHatasi(`icerik-google ${cevap.status}: ${typeof j.hata === 'string' ? j.hata.slice(0, 200) : 'hata'}`);
  return j;
}

/** Uygulamanın kendi Edge Function'ı (service_role ile). Google isteği o fonksiyonun sayacına yazılır; hata iletisi onundur. */
async function fonksiyon(ad, govde) {
  const anahtar = await servisAnahtari();
  const cevap = await fetch(`${PROJE_URL}/functions/v1/${ad}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${anahtar}`, apikey: anahtar, 'content-type': 'application/json' },
    body: JSON.stringify(govde),
  });
  const j = await cevap.json().catch(() => ({}));
  if (!cevap.ok) throw new HatHatasi(`${ad} ${cevap.status}: ${typeof j.hata === 'string' ? j.hata.slice(0, 200) : 'hata'}`);
  return j;
}

/**
 * #197: şehrin kimliği — uygulamanın şehir seçimiyle aynı yol: place_id biliniyorsa yalnız hafif yer (şehir modu: saat dilimi,
 * ülke kodu), yoksa önce Autocomplete (cities, şehrin konumuna yanlı, ilk öneri). Google'ın şehri bizimkinden 50 km'den uzaksa
 * null. Google verisi loga yazılmaz.
 */
async function sehirKimligiCoz(sehir, placeId) {
  const oturum = randomUUID().replace(/-/g, '');
  let id = placeId;
  if (!id) {
    const { oneriler } = await fonksiyon('places-autocomplete', { input: sehir.ad, sessionToken: oturum, tur: 'cities', limit: 1, merkez: { lat: sehir.lat, lng: sehir.lng, yaricapM: 50_000 } });
    id = Array.isArray(oneriler) ? oneriler[0]?.place_id : undefined;
    if (!id) return null;
  }
  const { yerler } = await fonksiyon('places-light', { ids: [id], sehir: true, sessionToken: oturum });
  return sehirKimligi({ lat: Number(sehir.lat), lng: Number(sehir.lng) }, Array.isArray(yerler) ? yerler[0] : null);
}

/** Kimliği bir kez yazar (dolu alan ezilmez). Döner: yazıldı mı. */
async function sehirKimligiYaz(slug, k) {
  return (await sql(sehirKimligiSql(slug, k)))[0]?.y === true;
}

// ---------------------------------------------------------------- yardımcılar

function istekAl() {
  const ham = (ortam.ISTEK ?? '').trim();
  if (!ham) return {};
  if (!ham.startsWith('{')) return { slug: ham };
  try {
    return JSON.parse(ham);
  } catch {
    throw new HatHatasi('istek geçerli bir JSON değil');
  }
}

async function planOku() {
  const dosya = (ortam.DOSYA ?? '').trim();
  if (!/^icerik\/geziler\/[a-z0-9-]{2,80}\.json$/.test(dosya)) throw new HatHatasi('dosya: icerik/geziler/<slug>.json olmalı');
  const plan = JSON.parse(await readFile(dosya, 'utf8'));
  if (path.basename(dosya, '.json') !== plan?.gezi?.slug) throw new HatHatasi('dosya adı gezi.slug ile aynı olmalı');
  return plan;
}

function slugAl() {
  const istek = istekAl();
  const slug = istek.slug ?? (ortam.DOSYA ? path.basename(ortam.DOSYA, '.json') : '');
  if (!SLUG.test(slug ?? '')) throw new HatHatasi('slug gerekli (istek: slug ya da {"slug": …}; ya da dosya)');
  return slug;
}

const editorLinki = (id) => `${YONETIM_URL}/yonetim/geziler?id=${id}`;

/**
 * Yazan çağrı: KURU iken DO bloğunda çalışır ve sonucu bir hatayla taşıyarak biter — işlem her durumda geri alınır,
 * yazma kalıcı olamaz. Gerçek yazmada tek SELECT (tek işlem).
 */
async function yazanCagri(cagri, metin) {
  if (!KURU) return jsonAl((await sql(`select ${cagri} as r`))[0].r);
  const etiket = dolarEtiketi(metin + cagri);
  try {
    await sql(`do ${etiket} declare r jsonb; begin r := ${cagri}; raise exception 'KURU_TAMAM %', r::text using errcode = 'P0001'; end ${etiket};`);
  } catch (e) {
    let ileti = e.ham ?? '';
    try {
      ileti = JSON.parse(ileti).message ?? '';
    } catch {
      // düz metin gövde
    }
    const m = /KURU_TAMAM (\{[^\n]*\})/.exec(String(ileti));
    if (m) return JSON.parse(m[1]);
    throw e;
  }
  throw new HatHatasi('kuru çalıştırma beklenmedik biçimde bitti');
}

// ---------------------------------------------------------------- işlemler

async function sehirler() {
  const liste = jsonAl((await sql('select public.icerik_sehirler() as s'))[0].s) ?? [];
  const satirlar = liste.map((s) => {
    const g = s.geziler ?? [];
    const geziler = g.map((z) => `${z.slug} (${z.durum}, ${z.gun} gün, ${z.durak} durak)`).join('; ');
    return `${s.slug} · ${s.ad} · ${s.yayin ? 'yayında' : 'taslak'} · ${g.length} gezi${g.length ? `: ${geziler}` : ''}`;
  });
  duyuru('notice', `Şehirler (${liste.length})`, satirlar.length ? satirlar : ['şehir yok']);
  await ozet(['### Şehirler', ...satirlar.map((s) => `- ${s}`)]);

  // #197: kimliği (Google kimliği + saat dilimi) eksik şehirler bir kez doldurulur — mevcut şehirlerin tek seferlik doldurması da bu.
  // Loga yalnız slug ve sayı.
  const eksik = liste.filter((s) => !s.kimlik);
  if (!eksik.length) {
    duyuru('notice', 'Şehir kimliği', ['hepsi dolu']);
    return;
  }
  if (KURU) {
    const satir = [`${eksik.length} şehirde eksik (KURU: Google'a gidilmedi, yazılmadı): ${eksik.map((s) => s.slug).join(', ')}`];
    duyuru('notice', 'Şehir kimliği', satir);
    await ozet(['### Şehir kimliği', ...satir.map((s) => `- ${s}`)]);
    return;
  }
  const dolan = [];
  const olmayan = [];
  for (const s of eksik) {
    try {
      const k = await sehirKimligiCoz(s);
      if (!k) olmayan.push(`${s.slug} (eşleşmedi)`);
      else if (await sehirKimligiYaz(s.slug, k)) dolan.push(s.slug);
      else olmayan.push(`${s.slug} (yazılmadı)`);
    } catch (e) {
      olmayan.push(`${s.slug} (${e instanceof HatHatasi ? e.message : 'hata'})`);
    }
  }
  const satir = [`dolduruldu ${dolan.length}${dolan.length ? `: ${dolan.join(', ')}` : ''}`, ...(olmayan.length ? [`doldurulamadı ${olmayan.length}: ${olmayan.join(', ')}`] : [])];
  duyuru(olmayan.length ? 'warning' : 'notice', 'Şehir kimliği', satir);
  await ozet(['### Şehir kimliği', ...satir.map((s) => `- ${s}`)]);
}

function acikAnahtarAl(istek) {
  try {
    derAl(istek.acik_anahtar);
  } catch {
    throw new HatHatasi('istek.acik_anahtar gerekli (scripts/icerik/anahtar.mjs)');
  }
  return istek.acik_anahtar;
}

async function sehirMerkezi(istek) {
  if (istek.merkez) return istek.merkez;
  if (!SEHIR_SLUG.test(istek.sehir ?? '')) throw new HatHatasi('istek.sehir (slug) ya da istek.merkez gerekli');
  const satir = (await sql(`select lat, lng from public.sehirler where slug = '${istek.sehir}'`))[0];
  if (!satir) throw new HatHatasi(`şehir bulunamadı: ${istek.sehir}; istek.merkez ver`);
  return { lat: Number(satir.lat), lng: Number(satir.lng) };
}

/** Sonuç oturumun açık anahtarıyla şifrelenir; iş akışı onu geçici dala (icerik-sonuc/<run_id>) koyar. */
async function sifreliYaz(sonuc, acik) {
  await writeFile(ortam.CIKTI, JSON.stringify(await sifrele(JSON.stringify(sonuc), acik)));
}

/**
 * Araştırma (Google): `kimlik` — OSM adaylarının place_id'si (IDs Only, ücretsiz; ≤ 80 sorgu, sorgu başına OSM konumu);
 * `puan` — kısa liste (≤ 30) için ad, tip, işletme durumu, puan, yorum sayısı. Geniş aramada puan istenmez.
 */
async function arastir() {
  const istek = istekAl();
  const acik = acikAnahtarAl(istek);
  const kimlik = Array.isArray(istek.kimlik) ? istek.kimlik : [];
  const puan = Array.isArray(istek.puan) ? [...new Set(istek.puan)] : [];
  if (!kimlik.length && !puan.length) throw new HatHatasi('istek.kimlik ya da istek.puan gerekli');
  if (kimlik.length > EN_COK_KIMLIK) throw new HatHatasi(`en çok ${EN_COK_KIMLIK} kimlik sorgusu`);
  if (puan.length > EN_COK_PUAN) throw new HatHatasi(`kısa liste en çok ${EN_COK_PUAN} mekan`);

  const merkez = kimlik.some((k) => k?.lat === undefined) ? await sehirMerkezi(istek) : undefined;
  const sonuc = { zaman: new Date().toISOString(), istek: { sehir: istek.sehir ?? null, kimlik, puan } };
  if (kimlik.length) sonuc.kimlik = await google({ islem: 'kimlik', sorgular: kimlik, ...(merkez ? { merkez } : {}) });
  if (puan.length) sonuc.puan = await google({ islem: 'puan', idler: puan });
  await sifreliYaz(sonuc, acik);

  const k = sonuc.kimlik?.sonuclar ?? [];
  const p = sonuc.puan?.yerler ?? [];
  const satir = [
    `kimlik: ${k.length} sorgu · ${k.filter((x) => x.idler?.length).length} eşleşti · ${k.filter((x) => x.hata).length} hatalı (ücretsiz)`,
    `puan: ${p.length} mekan · ${p.filter((y) => y.hata).length} hatalı`,
    `şifreli sonuç: icerik-sonuc/${ortam.GITHUB_RUN_ID}`,
  ];
  duyuru('notice', 'Araştırma', satir);
  await ozet(['### Araştırma', ...satir.map((x) => `- ${x}`)]);
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/** OSM aday listesi (Overpass, `aday.mjs`): ad, konum, tür, opening_hours, wikipedia/wikidata. Google'a gidilmez. */
async function osm() {
  const istek = istekAl();
  const acik = acikAnahtarAl(istek);
  const merkez = await sehirMerkezi(istek);
  const yaricap = Math.min(Math.max(Number(istek.yaricap_m) || 8000, 500), 30000);
  // #328 KK1–KK3: yeniden denemeyle ve süre bütçesiyle; düşerse tek satır ("Overpass 504, 3 deneme").
  let adaylar;
  try {
    adaylar = await osmAdaylariOku(merkez, yaricap);
  } catch (e) {
    if (e instanceof OsmOkumaHatasi) throw new HatHatasi(e.message);
    throw e;
  }
  await sifreliYaz({ zaman: new Date().toISOString(), kaynak: '© OpenStreetMap katkıcıları (ODbL)', merkez, yaricap_m: yaricap, adaylar }, acik);
  const say = (f) => adaylar.filter(f).length;
  const satir = [
    `${adaylar.length} aday · müze/galeri ${say((a) => /museum|gallery/.test(a.etiketler.tourism ?? ''))} · tarihi ${say((a) => a.etiketler.historic)} · ibadet ${say((a) => a.etiketler.amenity === 'place_of_worship')} · park ${say((a) => a.etiketler.leisure)} · yemek/kafe ${say((a) => /restaurant|cafe/.test(a.etiketler.amenity ?? ''))}`,
    `wikidata ${say((a) => a.etiketler.wikidata)} · opening_hours ${say((a) => a.etiketler.opening_hours)}`,
    `şifreli sonuç: icerik-sonuc/${ortam.GITHUB_RUN_ID}`,
  ];
  duyuru('notice', 'OSM adayları', satir);
  await ozet(['### OSM adayları', ...satir.map((x) => `- ${x}`)]);
}

/**
 * #205 KK3: eşleştirme için bir karedeki adlı OSM nesneleri (aday seçiminden geniş: her amenity, place).
 * Kare: [güney, batı, kuzey, doğu] (eslemeKareleri); büyük şehir tek sorguda zaman aşımına düştüğü için parça parça sorulur.
 */
export function eslemeSorgusu([g, b, k, d]) {
  const a = `(${g},${b},${k},${d})`;
  return `[out:json][timeout:90];
(
  nwr${a}["tourism"]["name"];
  nwr${a}["historic"]["name"];
  nwr${a}["amenity"]["name"];
  nwr${a}["leisure"]["name"];
  nwr${a}["place"]["name"];
);
out center tags;`;
}

/**
 * Bir şehrin eşleştirme adayları: kareler sırayla sorulur, OSM kimliğiyle tekilleştirilir. Bir kare düşerse şehir hatalıdır.
 * `bitis`: koşu bütçesinin sonu (#266 KK4); dolarsa `SureBittiHatasi`. `ilerleme.kare`: sorulan kare sayısı (özet için).
 */
async function eslemeAdaylari(merkez, yaricap, bitis, ilerleme) {
  const adaylar = new Map();
  const kareler = eslemeKareleri(merkez, yaricap);
  ilerleme.toplamKare = kareler.length;
  for (const [i, kare] of kareler.entries()) {
    if (i) await bekle(1000);
    const veri = await overpassYeniden(eslemeSorgusu(kare), { bitis });
    ilerleme.kare = i + 1;
    for (const e of veri.elements ?? []) {
      const a = {
        osm: `${e.type}/${e.id}`,
        adlar: [e.tags?.name, e.tags?.['name:tr'], e.tags?.['name:en'], e.tags?.alt_name, e.tags?.official_name].filter(Boolean),
        lat: e.lat ?? e.center?.lat,
        lng: e.lon ?? e.center?.lon,
      };
      if (a.adlar.length && typeof a.lat === 'number' && typeof a.lng === 'number') adaylar.set(a.osm, a);
    }
  }
  return [...adaylar.values()];
}

/** Konumu Google'dan (google_30g) olan içerik satırları, şehirleriyle. Ad ve konum yalnız bellekte kalır, yazdırılmaz. */
async function googleSatirlari() {
  const satirlar = await sql(`
    select 'sehirler' as tablo, s.id, s.id as sehir_id, s.ad, s.lat, s.lng from public.sehirler s where s.konum_kaynagi = 'google_30g'
    union all
    select 'yerler', y.id, y.sehir_id, y.ad, y.lat, y.lng from public.yerler y where y.konum_kaynagi = 'google_30g'
    union all
    select 'gezi_duraklari', d.id, g.sehir_id, d.ad, d.lat, d.lng
      from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id join public.geziler g on g.id = gg.gezi_id
     where d.konum_kaynagi = 'google_30g'`);
  const merkezler = new Map((await sql('select id, slug, lat, lng from public.sehirler')).map((s) => [s.id, { slug: s.slug, lat: Number(s.lat), lng: Number(s.lng) }]));
  return { satirlar: satirlar.map((s) => ({ ...s, lat: Number(s.lat), lng: Number(s.lng) })), merkezler };
}

/**
 * #205 KK3: mevcut google_30g satırlar OSM eşleşmesiyle taşınır (ad + en çok 150 m). Şehir başına, şehir merkezi çevresindeki
 * daire en çok 6 km'lik karelere bölünüp sorulur; satır koordinatı dışarı gönderilmez, eşleştirme yerelde yapılır. Google'a gidilmez.
 * KURU (varsayılan): eşleştirir, icerik_konum_osm_esle'yi çağırır ve geri alır; yalnız sayılar raporlanır.
 * Eşleşmeyenler tablo başına sayı ve satır kimliğiyle (uuid) özete girer; ad ve koordinat yazılmaz.
 */
/** #266 KK4: osm-esle koşusunun toplam süre bütçesi (iş akışı 30 dk'da kesilir; özet yazılacak pay kalır). */
const OSM_ESLE_BUTCE_MS = 25 * 60_000;

async function osmEsle() {
  const { satirlar, merkezler } = await googleSatirlari();
  const TABLOLAR = ['sehirler', 'yerler', 'gezi_duraklari'];
  const sayi = Object.fromEntries(TABLOLAR.map((t) => [t, { toplam: 0, eslesen: 0, eslesmeyen: [] }]));
  const eslesmeler = [];
  const sehirSatirlari = new Map();
  for (const s of satirlar) {
    if (!sehirSatirlari.has(s.sehir_id)) sehirSatirlari.set(s.sehir_id, []);
    sehirSatirlari.get(s.sehir_id).push(s);
  }
  const hataliSehir = [];
  const sehirOzeti = [];
  let merkezsiz = 0;
  // #266 KK4: koşunun toplam süre bütçesi; dolunca kalan şehirler hatalı sayılır, özet yine yazılır.
  const bitis = Date.now() + OSM_ESLE_BUTCE_MS;
  for (const [sehirId, liste] of sehirSatirlari) {
    const merkez = merkezler.get(sehirId);
    // #266 KK5: şehir merkezi yoksa satırlar atlanır ve sayılır (eşleşmeyen sayılmaz; yeniden denenecek bir Overpass hatası değil).
    if (!merkez || !Number.isFinite(merkez.lat) || !Number.isFinite(merkez.lng)) {
      merkezsiz += liste.length;
      continue;
    }
    let adaylar = [];
    const ilerleme = { kare: 0, toplamKare: 0 };
    const basla = Date.now();
    let durum = 'tamam';
    if (basla >= bitis) {
      durum = 'bütçe doldu';
      hataliSehir.push(merkez.slug);
    } else {
      try {
        adaylar = await eslemeAdaylari(merkez, eslemeYaricapi(merkez, liste), bitis, ilerleme);
      } catch (e) {
        // Yalnız Overpass/ağ hatası ve bütçe yakalanır; kod hatası koşuyu durdurur.
        if (!(e instanceof OverpassHatasi) && !(e instanceof SureBittiHatasi)) throw e;
        durum = e instanceof SureBittiHatasi ? 'bütçe doldu' : `hatalı (${e.durum ?? 'ağ'})`;
        hataliSehir.push(merkez.slug);
      }
    }
    sehirOzeti.push(`| ${merkez.slug} | ${ilerleme.kare}/${ilerleme.toplamKare} | ${Math.round((Date.now() - basla) / 1000)} sn | ${durum} |`);
    for (const s of liste) {
      sayi[s.tablo].toplam += 1;
      const e = adaylar.length ? osmEslestir(s, adaylar) : null;
      if (e) {
        sayi[s.tablo].eslesen += 1;
        eslesmeler.push({ tablo: s.tablo, id: s.id, ...e });
      } else sayi[s.tablo].eslesmeyen.push(s.id);
    }
  }
  const sonuc = eslesmeler.length
    ? await yazanCagri(`public.icerik_konum_osm_esle('${JSON.stringify(eslesmeler).replace(/'/g, "''")}'::jsonb)`, 'osm-esle')
    : { yazilan: {}, atlanan: {} };
  const satir = TABLOLAR.map(
    (t) =>
      `${t}: google_30g ${sayi[t].toplam} · eşleşen ${sayi[t].eslesen} · ${KURU ? 'yazılacak' : 'yazılan'} ${sonuc.yazilan?.[t] ?? 0} · atlanan ${sonuc.atlanan?.[t] ?? 0} · eşleşmeyen ${sayi[t].eslesmeyen.length}`,
  );
  if (hataliSehir.length) satir.push(`Overpass yanıt vermedi ya da bütçe doldu (bu şehirlerin satırları eşleşmeyen sayıldı): ${hataliSehir.join(', ')}`);
  if (merkezsiz) satir.push(`şehir merkezi olmadığı için atlanan satır: ${merkezsiz}`);
  satir.push(KURU ? 'KURU: yazılmadı (işlem geri alındı)' : 'yazıldı');
  duyuru(hataliSehir.length ? 'warning' : 'notice', 'OSM eşleştirmesi', satir);
  await ozet([
    '### OSM eşleştirmesi (#205 KK3)',
    ...satir.map((x) => `- ${x}`),
    '',
    '#### Şehirler (#266 KK4)',
    '| Şehir | Kare | Süre | Durum |',
    '|---|---|---|---|',
    ...sehirOzeti,
    '',
    '#### Eşleşmeyen satırlar (kimlik)',
    ...TABLOLAR.flatMap((t) => (sayi[t].eslesmeyen.length ? [`- ${t}: ${sayi[t].eslesmeyen.join(', ')}`] : [])),
  ]);
}

/** Planın mekan rehberleri: icerik/yerler/<şehir>/<rehber>.md (yoksa haritada yok; doğrulayıcı HATA verir). */
async function rehberleriOku(plan) {
  const sehir = plan.sehir?.yeni?.slug ?? plan.sehir?.slug;
  const rehberler = new Map();
  if (!SEHIR_SLUG.test(sehir ?? '')) return rehberler;
  for (const g of plan.gunler ?? []) {
    for (const d of g.duraklar ?? []) {
      if (typeof d?.rehber !== 'string' || !REHBER_DOSYA.test(d.rehber) || rehberler.has(d.rehber)) continue;
      try {
        rehberler.set(d.rehber, await readFile(`icerik/yerler/${sehir}/${d.rehber}.md`, 'utf8'));
      } catch {
        // dosya yok: doğrulayıcı HATA verir
      }
    }
  }
  return rehberler;
}

async function yukle() {
  const plan = await planOku();
  const { yeniden } = istekAl();
  const rehberler = await rehberleriOku(plan);
  const { hatalar, uyarilar } = planDenetle(plan, { rehberler });
  if (hatalar.length) {
    duyuru('error', `HATA (${hatalar.length}) · ${plan.gezi.slug}`, hatalar);
    throw new HatHatasi(`plan dosyasında ${hatalar.length} hata; yüklenmedi`);
  }

  const idler = detayIdleri(plan);
  if (idler.length > EN_COK_DETAY) throw new HatHatasi(`en çok ${EN_COK_DETAY} mekan`);
  // #323 KK1: önce OSM (yeniden denemeyle), sonra Google detayı; Overpass düşerse Google'a istek gitmez.
  let konum;
  try {
    konum = await yuklemeKonumlari(plan, { googleFn: google });
  } catch (e) {
    if (e instanceof OsmOkumaHatasi) throw new HatHatasi(e.message);
    throw e;
  }
  const { osmKonumlari, yerler } = konum;
  const detaylar = new Map(yerler.filter((y) => !y.hata).map((y) => [y.place_id, y]));
  // #335: boş işletme durumu UYARI; CLOSED_* ve bilinmeyen değer HATA.
  const { hatalar: sorunlar, uyarilar: durumUyarilari } = mekanDurumuDenetle(idler, yerler, plan.sehir?.yeni?.place_id);
  if (sorunlar.length) {
    duyuru('error', `Mekan sorunu (${sorunlar.length}) · ${plan.gezi.slug}`, sorunlar);
    throw new HatHatasi('kapalı ya da bulunamayan mekan var; yüklenmedi');
  }

  // #205 KK2: OSM adayı olan duraklarda konum OSM'den (süresiz, atıfla); aday Google'daki yerle aynı mekan olmalı (≤ 150 m).
  const osmSorunlari = osmKonumDenetle(plan, detaylar, osmKonumlari);
  if (osmSorunlari.length) {
    duyuru('error', `OSM sorunu (${osmSorunlari.length}) · ${plan.gezi.slug}`, osmSorunlari);
    throw new HatHatasi('OSM adayı bulunamadı ya da Google konumundan uzak; yüklenmedi');
  }

  const gun = gunleriDenetle(plan, detaylar);
  const tumUyarilar = [...uyarilar, ...durumUyarilari, ...gun.uyarilar];
  duyuru('warning', `UYARI (${tumUyarilar.length}) · ${plan.gezi.slug}`, tumUyarilar);

  const yukleme = yuklemeVerisi(plan, detaylar, rehberler, osmKonumlari);
  const veri = JSON.stringify(yukleme);
  const durakSayisi = yukleme.gunler.reduce((t, g) => t + g.duraklar.length, 0);
  const osmDurak = yukleme.gunler.reduce((t, g) => t + g.duraklar.filter((d) => d.osm_id).length, 0);
  const etiket = dolarEtiketi(veri);
  const r = await yazanCagri(`public.icerik_gezi_taslak_yukle(${etiket}${veri}${etiket}::jsonb, ${yeniden === true})`, veri);

  const gunSatirlari = gun.gunler.map((g, i) => `${i + 1}. gün · ${g.durak} durak · ${g.sure} dk durak + ${g.yurume} dk yürüme · tahmini bitiş ${g.bitis}`);
  const satir = [
    `${KURU ? 'KURU: denetimler geçti, hiçbir şey yazılmadı' : 'YÜKLENDİ (taslak)'} · ${r.slug} · gezi_id ${r.gezi_id}${KURU ? ' (geri alındı)' : ''}`,
    `${r.gun_sayisi} gün · ${r.mekan_sayisi} durak · yazıda ${r.yazidaki_mekan} mekan izi · ${r.yeniden ? 'yeniden yazıldı' : 'yeni'}${r.yeni_sehir ? ' · yeni şehir (taslak)' : ''} · updated_at ${r.updated_at}`,
    `mekan rehberi: ${r.rehber_yazilan ?? 0} yazıldı (${r.yer_acilan ?? 0} yeni taslak yer) · atlanan ${(r.rehber_atlanan ?? []).length}${(r.rehber_atlanan ?? []).length ? ` (yayında ya da dolu: ${r.rehber_atlanan.join(', ')})` : ''}`,
    `amaç: ${r.amac_yazilan ?? 0} yere yazıldı · atlanan ${(r.amac_atlanan ?? []).length}${(r.amac_atlanan ?? []).length ? ` (yer satırı yok, yayında ya da dolu: ${r.amac_atlanan.join(', ')})` : ''}`,
    `konum: ${osmDurak} durak OSM · ${durakSayisi - osmDurak} durak Google (30 gün)`,
    ...gunSatirlari,
    ...(KURU ? [] : [`BO: ${editorLinki(r.gezi_id)}`]),
  ];
  duyuru('notice', `${KURU ? 'Kuru yükleme' : 'Yükleme'} · ${r.slug}`, satir);
  await ozet([`### ${KURU ? 'Kuru yükleme' : 'Yükleme'}`, ...satir.map((s) => `- ${s}`), ...tumUyarilar.map((u) => `- UYARI: ${u}`)]);
  if (!KURU) await kontrol(r.slug);
  // #197: yeni şehir kimliğiyle açılır (place_id plandan; saat dilimi ve ülke kodu tek hafif yer isteğiyle). Olmazsa yükleme
  // bozulmaz: `sehirler` işlemi sonra doldurur.
  if (!KURU && r.yeni_sehir) {
    const yeni = plan.sehir.yeni;
    const konum = detaylar.get(yeni.place_id);
    let sonuc = 'doldurulamadı (sehirler işlemi doldurur)';
    try {
      const k = konum ? await sehirKimligiCoz({ ad: yeni.ad, lat: konum.lat, lng: konum.lng }, yeni.place_id) : null;
      if (k && (await sehirKimligiYaz(yeni.slug, k))) sonuc = 'yazıldı';
    } catch {
      // aşağıda uyarı
    }
    duyuru(sonuc === 'yazıldı' ? 'notice' : 'warning', `Şehir kimliği · ${yeni.slug}`, [sonuc]);
  }
}

async function kontrol(slug = slugAl()) {
  const k = jsonAl((await sql(`select public.icerik_gezi_kontrol('${slug}') as k`))[0].k);
  if (!k) throw new HatHatasi(`gezi bulunamadı: ${slug}`);
  const satir = [
    `${k.slug} · ${k.durum} (yayin=${k.yayin}, yayin_at=${k.yayin_at ?? 'boş'}) · gezi_id ${k.gezi_id}`,
    `${k.gun_sayisi} gün · ${k.mekan_sayisi} durak (gün başına ${k.gunler.map((g) => g.durak).join('/')}) · place_id eksik ${k.place_id_eksik}`,
    `yazıdaki mekan: ${k.mekan_kart} kart, ${k.mekan_satir} bağlantı · foto ${k.foto} · kapak ${k.kapak ? 'var' : 'yok'}`,
    `mekan rehberi: ${k.rehber_dolu} durakta dolu (${k.rehber_yayinda} yayında) · ${k.yer_yok} durağın yer satırı yok`,
    `şehir ${k.sehir} (${k.sehir_yayin ? 'yayında' : 'taslak'}) · updated_at ${k.updated_at}`,
    `BO: ${editorLinki(k.gezi_id)}`,
  ];
  duyuru('notice', `Kontrol · ${k.slug}`, satir);
  await ozet(['### Kontrol', ...satir.map((s) => `- ${s}`)]);
}

async function sil() {
  const slug = slugAl();
  const r = await yazanCagri(`public.icerik_gezi_taslak_sil('${slug}')`, slug);
  const satir = `${KURU ? 'KURU: silinebilir, silinmedi' : 'SİLİNDİ'} · ${r.slug} · gezi_id ${r.gezi_id} · ${r.gun_sayisi} gün · ${r.mekan_sayisi} durak`;
  duyuru('notice', `${KURU ? 'Kuru silme' : 'Silme'} · ${r.slug}`, satir);
  await ozet([`### ${KURU ? 'Kuru silme' : 'Silme'}`, `- ${satir}`]);
}

// ---------------------------------------------------------------- kesfet-olc (#190 / #189 Ek 1)

// Ölçüm noktaları: issue'daki üç bölge. Sabit; istekle değişmez (log herkese açık, yalnız bu adlar ve sayılar yazılır).
const OLCUM_NOKTALARI = [
  { ad: 'Düzce merkez', lat: 40.8438, lng: 31.1565 },
  { ad: 'Eskişehir Odunpazarı', lat: 39.7637, lng: 30.5263 },
  { ad: 'İstanbul Sultanahmet', lat: 41.0055, lng: 28.9768 },
];
// supabase/functions/_shared/google.ts ile aynı kümeler (TURISTIK_BIRINCIL, ibadet tipleri, Turistik varsayılan eşiği).
const OLCUM_TURISTIK = new Set(['tourist_attraction', 'historical_landmark', 'historical_place', 'cultural_landmark', 'monument', 'sculpture', 'castle', 'museum', 'art_museum', 'history_museum', 'art_gallery', 'observation_deck']);
const OLCUM_IBADET = new Set(['mosque', 'church', 'synagogue', 'place_of_worship', 'hindu_temple']);
const OLCUM_ESIK = { yorum: 50, puan: 3.8 };
// Kaçan ibadet yerlerinden bilinenler: etiket bizim listemizden yazılır (Google'ın ad metni loga girmez). Sıra önemli.
const BILINEN_IBADET = [
  [/k[üu][çc][üu]k ayasofya|little hagia/i, 'Küçük Ayasofya'],
  [/ayasofya|hagia sophia/i, 'Ayasofya'],
  [/sultan ?ahmet|blue mosque/i, 'Sultanahmet Camii'],
  [/s[üu]leymaniye/i, 'Süleymaniye'],
  [/r[üu]stem pa[şs]a/i, 'Rüstem Paşa'],
  [/yeni cami|new mosque/i, 'Yeni Cami'],
  [/kur[şs]unlu/i, 'Kurşunlu'],
  [/alaeddin/i, 'Alaeddin Camii'],
];

/** Bir Turistik cevabının sayıları (yer adı, puan, koordinat yazılmaz). */
export function turistikSayilari(yerler) {
  const yorumda = (y) => (y.puan_sayisi ?? 0) >= OLCUM_ESIK.yorum;
  const esikte = (y) => yorumda(y) && (y.puan ?? 0) >= OLCUM_ESIK.puan;
  const s = { toplam: yerler.length, turistik: 0, turistikEsikte: 0, turistikYorumAlti: 0, turistikPuanAlti: 0, ibadet: 0, ibadetEsikte: 0, bilinen: [], diger: 0 };
  for (const y of yerler) {
    if (OLCUM_TURISTIK.has(y.primary_type)) {
      s.turistik += 1;
      if (esikte(y)) s.turistikEsikte += 1;
      else if (!yorumda(y)) s.turistikYorumAlti += 1;
      else s.turistikPuanAlti += 1;
    } else if (OLCUM_IBADET.has(y.primary_type)) {
      s.ibadet += 1;
      if (esikte(y)) {
        s.ibadetEsikte += 1;
        s.bilinen.push(BILINEN_IBADET.find(([desen]) => desen.test(y.ad ?? ''))?.[1] ?? 'diğer');
      }
    } else s.diger += 1;
  }
  return s;
}

/**
 * Yayındaki places-nearby'ye noktalar × yarıçaplar için Turistik isteği atar ve sayıları yazar. "İbadet (eşikte)" = birincil tipi
 * ibadet yeri olup Turistik eşiğini geçen yer: `includedPrimaryTypes` isteğinde gelmez (kaçan tarihî cami). Her istek
 * places-nearby sayacına 1 çağrı (önbellekte değilse 1 Google isteği) olarak yazılır.
 */
async function kesfetOlc() {
  const istek = istekAl();
  const yaricaplar = (Array.isArray(istek.yaricaplar) ? istek.yaricaplar : [1000, 3000]).map(Number).filter((r) => Number.isFinite(r) && r >= 100 && r <= 15000).slice(0, 3);
  if (!yaricaplar.length) throw new HatHatasi('yaricaplar: 100–15000 m arası 1–3 sayı');
  const anahtar = await servisAnahtari();
  const satirlar = [];
  const toplam = { istek: 0, google: 0, ibadetEsikte: 0 };
  for (const n of OLCUM_NOKTALARI) {
    for (const r of yaricaplar) {
      const cevap = await fetch(`${PROJE_URL}/functions/v1/places-nearby`, {
        method: 'POST',
        headers: { authorization: `Bearer ${anahtar}`, apikey: anahtar, 'content-type': 'application/json' },
        body: JSON.stringify({ merkez: { lat: n.lat, lng: n.lng }, yaricapM: r, cip: 'turistik', enFazla: 20 }),
      });
      toplam.istek += 1;
      const j = await cevap.json().catch(() => ({}));
      if (!cevap.ok) throw new HatHatasi(`places-nearby ${cevap.status}: ${typeof j.hata === 'string' ? j.hata.slice(0, 200) : 'hata'}`);
      if (!j.onbellek) toplam.google += 1;
      const s = turistikSayilari(Array.isArray(j.yerler) ? j.yerler : []);
      toplam.ibadetEsikte += s.ibadetEsikte;
      satirlar.push(
        `| ${n.ad} | ${r} m | ${s.toplam} | ${s.turistik} (${s.turistikEsikte}; yorum < ${OLCUM_ESIK.yorum}: ${s.turistikYorumAlti}, puan < ${OLCUM_ESIK.puan}: ${s.turistikPuanAlti}) | ${s.ibadet} (${s.ibadetEsikte}${s.bilinen.length ? `: ${s.bilinen.join(', ')}` : ''}) | ${s.diger} |${j.onbellek ? ' önbellek' : ''}`,
      );
    }
  }
  const baslik = '| Nokta | Yarıçap | Sonuç | Turistik birincil (eşikte; eşik altı nedeni) | İbadet birincil (eşikte: bilinenler) | Diğer |';
  duyuru('notice', 'Keşfet ölçümü', [baslik, ...satirlar, `istek ${toplam.istek} · Google ${toplam.google} · eşikte ibadet toplamı ${toplam.ibadetEsikte}`]);
  await ozet(['### Keşfet · Turistik ölçümü', '', baslik, '|---|---|---|---|---|---|', ...satirlar, '', `- istek ${toplam.istek} · Google ${toplam.google} · eşikte ibadet toplamı ${toplam.ibadetEsikte}`]);
}

const ISLEMLER = { sehirler, osm, 'osm-esle': osmEsle, arastir, yukle, kontrol: () => kontrol(), sil, 'kesfet-olc': kesfetOlc };

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const is = ISLEMLER[ortam.ISLEM];
  try {
    if (!is) throw new HatHatasi(`bilinmeyen işlem: ${ortam.ISLEM}`);
    await is();
  } catch (e) {
    // Yalnız kendi iletilerimiz yazılır; beklenmeyen hatada yığın ve ileti (veri taşıyabilir) yazılmaz.
    duyuru('error', `${ortam.ISLEM ?? 'icerik'} başarısız`, e instanceof HatHatasi ? e.message : `beklenmeyen hata (${e?.name ?? 'Error'})`);
    process.exit(1);
  }
}
