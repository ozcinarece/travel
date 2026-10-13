// İçerik hattı (docs/07): .github/workflows/icerik.yml'in çalıştırdığı işlemler — sehirler, arastir, yukle, kontrol, sil.
// Ortam: ISLEM, DOSYA, ISTEK, KURU, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, YONETIM_URL, CIKTI (arastir), GITHUB_RUN_ID;
// yerel deneme için SUPABASE_API_URL ve SUPABASE_URL.
// Loglar ve duyurular HERKESE AÇIK: yalnız sayı, slug, id ve sonuç yazılır. Google verisi (ad, puan, adres, saat, koordinat)
// ve kullanıcı verisi yazılmaz. service_role anahtarı çalışma anında Yönetim API'sinden alınır, maskelenir, hiçbir yere
// yazılmaz. Yazma yalnız icerik_gezi_taslak_yukle / icerik_gezi_taslak_sil ile; KURU=true iken işlem hatayla geri alınır.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { detayIdleri, dolarEtiketi, gunleriDenetle, planDenetle, SEHIR_SLUG, SLUG, yuklemeVerisi } from './dogrula.mjs';
import { derAl, sifrele } from './sifre.mjs';

const ortam = process.env;
const REF = ortam.SUPABASE_PROJECT_REF ?? '';
const TOKEN = ortam.SUPABASE_ACCESS_TOKEN ?? '';
const YONETIM_URL = (ortam.YONETIM_URL || 'https://gezi-yonetim.pages.dev').replace(/\/+$/, '');
const KURU = ortam.KURU !== 'false';
// Yerel deneme için değiştirilebilir; iş akışında varsayılanlar kullanılır.
const API_KOK = ortam.SUPABASE_API_URL || 'https://api.supabase.com';
const PROJE_URL = ortam.SUPABASE_URL || `https://${REF}.supabase.co`;
const EN_COK_SORGU = 25;
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
}

async function arastir() {
  const istek = istekAl();
  const acik = istek.acik_anahtar;
  try {
    derAl(acik);
  } catch {
    throw new HatHatasi('istek.acik_anahtar gerekli (scripts/icerik/anahtar.mjs)');
  }
  const sorgular = Array.isArray(istek.sorgular) ? istek.sorgular : [];
  const idler = Array.isArray(istek.detay) ? [...new Set(istek.detay)] : [];
  if (!sorgular.length && !idler.length) throw new HatHatasi('istek.sorgular ya da istek.detay gerekli');
  if (sorgular.length > EN_COK_SORGU) throw new HatHatasi(`en çok ${EN_COK_SORGU} sorgu`);
  if (idler.length > EN_COK_DETAY) throw new HatHatasi(`en çok ${EN_COK_DETAY} detay`);

  let merkez = istek.merkez;
  if (sorgular.length && !merkez) {
    if (!SEHIR_SLUG.test(istek.sehir ?? '')) throw new HatHatasi('istek.sehir (slug) ya da istek.merkez gerekli');
    const satir = (await sql(`select lat, lng from public.sehirler where slug = '${istek.sehir}'`))[0];
    if (!satir) throw new HatHatasi(`şehir bulunamadı: ${istek.sehir}; istek.merkez ver`);
    merkez = { lat: Number(satir.lat), lng: Number(satir.lng) };
  }

  const sonuc = { zaman: new Date().toISOString(), istek: { sehir: istek.sehir ?? null, merkez, yaricap_m: istek.yaricap_m ?? null, sorgular, detay: idler } };
  if (sorgular.length) sonuc.ara = await google({ islem: 'ara', merkez, yaricap_m: istek.yaricap_m, sorgular });
  if (idler.length) sonuc.detay = await google({ islem: 'detay', idler });

  const paket = await sifrele(JSON.stringify(sonuc), acik);
  await writeFile(ortam.CIKTI, JSON.stringify(paket));

  const ara = sonuc.ara?.sonuclar ?? [];
  const detay = sonuc.detay?.yerler ?? [];
  const satir = [
    `${ara.length} sorgu · ${ara.reduce((t, s) => t + (s.adaylar?.length ?? 0), 0)} aday · ${ara.reduce((t, s) => t + (s.elenen_konaklama ?? 0), 0)} konaklama elendi · ${ara.filter((s) => s.hata).length} hatalı sorgu`,
    `${detay.length} detay · ${detay.filter((y) => y.hata).length} hatalı`,
    `şifreli sonuç: icerik-sonuc/${ortam.GITHUB_RUN_ID}`,
  ];
  duyuru('notice', 'Araştırma', satir);
  await ozet(['### Araştırma', ...satir.map((s) => `- ${s}`)]);
}

async function yukle() {
  const plan = await planOku();
  const { yeniden } = istekAl();
  const { hatalar, uyarilar } = planDenetle(plan);
  if (hatalar.length) {
    duyuru('error', `HATA (${hatalar.length}) · ${plan.gezi.slug}`, hatalar);
    throw new HatHatasi(`plan dosyasında ${hatalar.length} hata; yüklenmedi`);
  }

  const idler = detayIdleri(plan);
  if (idler.length > EN_COK_DETAY) throw new HatHatasi(`en çok ${EN_COK_DETAY} mekan`);
  const { yerler } = await google({ islem: 'detay', idler });
  const detaylar = new Map(yerler.filter((y) => !y.hata).map((y) => [y.place_id, y]));
  const sorunlar = [];
  const sehirId = plan.sehir?.yeni?.place_id;
  for (const id of idler) {
    const y = yerler.find((x) => x.place_id === id);
    if (!y || y.hata) sorunlar.push(`${id}: detay alınamadı (${y?.hata ?? 'yok'})`);
    else if (!y.lat || !y.lng) sorunlar.push(`${id}: konum yok`);
    else if (id !== sehirId && y.durum !== 'OPERATIONAL') sorunlar.push(`${id}: işletme durumu OPERATIONAL değil (${y.durum ?? 'bilinmiyor'})`);
  }
  if (sorunlar.length) {
    duyuru('error', `Mekan sorunu (${sorunlar.length}) · ${plan.gezi.slug}`, sorunlar);
    throw new HatHatasi('kapalı ya da bulunamayan mekan var; yüklenmedi');
  }

  const gun = gunleriDenetle(plan, detaylar);
  const tumUyarilar = [...uyarilar, ...gun.uyarilar];
  duyuru('warning', `UYARI (${tumUyarilar.length}) · ${plan.gezi.slug}`, tumUyarilar);

  const veri = JSON.stringify(yuklemeVerisi(plan, detaylar));
  const etiket = dolarEtiketi(veri);
  const r = await yazanCagri(`public.icerik_gezi_taslak_yukle(${etiket}${veri}${etiket}::jsonb, ${yeniden === true})`, veri);

  const gunSatirlari = gun.gunler.map((g, i) => `${i + 1}. gün · ${g.durak} durak · ${g.sure} dk durak + ${g.yurume} dk yürüme · tahmini bitiş ${g.bitis}`);
  const satir = [
    `${KURU ? 'KURU: denetimler geçti, hiçbir şey yazılmadı' : 'YÜKLENDİ (taslak)'} · ${r.slug} · gezi_id ${r.gezi_id}${KURU ? ' (geri alındı)' : ''}`,
    `${r.gun_sayisi} gün · ${r.mekan_sayisi} durak · yazıda ${r.yazidaki_mekan} mekan izi · ${r.yeniden ? 'yeniden yazıldı' : 'yeni'}${r.yeni_sehir ? ' · yeni şehir (taslak)' : ''} · updated_at ${r.updated_at}`,
    ...gunSatirlari,
    ...(KURU ? [] : [`BO: ${editorLinki(r.gezi_id)}`]),
  ];
  duyuru('notice', `${KURU ? 'Kuru yükleme' : 'Yükleme'} · ${r.slug}`, satir);
  await ozet([`### ${KURU ? 'Kuru yükleme' : 'Yükleme'}`, ...satir.map((s) => `- ${s}`), ...tumUyarilar.map((u) => `- UYARI: ${u}`)]);
  if (!KURU) await kontrol(r.slug);
}

async function kontrol(slug = slugAl()) {
  const k = jsonAl((await sql(`select public.icerik_gezi_kontrol('${slug}') as k`))[0].k);
  if (!k) throw new HatHatasi(`gezi bulunamadı: ${slug}`);
  const satir = [
    `${k.slug} · ${k.durum} (yayin=${k.yayin}, yayin_at=${k.yayin_at ?? 'boş'}) · gezi_id ${k.gezi_id}`,
    `${k.gun_sayisi} gün · ${k.mekan_sayisi} durak (gün başına ${k.gunler.map((g) => g.durak).join('/')}) · place_id eksik ${k.place_id_eksik}`,
    `yazıdaki mekan: ${k.mekan_kart} kart, ${k.mekan_satir} bağlantı · foto ${k.foto} · kapak ${k.kapak ? 'var' : 'yok'}`,
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

const ISLEMLER = { sehirler, arastir, yukle, kontrol: () => kontrol(), sil };

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
