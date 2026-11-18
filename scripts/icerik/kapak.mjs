// #345 KK2: kapak fotoğrafı Wikimedia Commons'tan, lisansı ve atfıyla. Plan dosyasında gezi, şehir ve durak için isteğe bağlı
// `kapak: {commons: "File:…"}`. Lisans Commons API'den okunur; yalnız CC0, kamu malı (PD), CC BY ve CC BY-SA kabul edilir.
// Fotoğraf Commons'ın kendi küçük boyuyla (en çok 1600 px) indirilir, `icerik` kovasına konur. Google fotoğrafı hiç kullanılmaz.
// Loglara yalnız dosya adı, lisans kısa adı ve sayı yazılır (hepsi Commons'ta herkese açık; Google verisi değil).
import { createHash } from 'node:crypto';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const KAPAK_GENISLIK = 1600;
export const COMMONS_DOSYA = /^File:[^\n#<>[\]|{}]{1,240}\.(jpe?g|png|webp)$/i;
const TUR_UZANTI = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// Commons, kimliği belli bir User-Agent ister (https://meta.wikimedia.org/wiki/User-Agent_policy).
export const KULLANICI_AJANI = 'TripmateIcerikHatti/1.0 (https://github.com/ozcinarece/travel)';

/** Plan dosyasındaki `kapak` alanlarının biçimi. Alan yoksa sorun yok (kapak isteğe bağlı). */
export function kapakDenetle(plan) {
  const hatalar = [];
  const bak = (kapak, yol) => {
    if (kapak === undefined) return;
    if (!kapak || typeof kapak !== 'object' || Array.isArray(kapak) || Object.keys(kapak).some((k) => k !== 'commons')) {
      hatalar.push(`${yol}: {commons: "File:…"} olmalı`);
    } else if (typeof kapak.commons !== 'string' || !COMMONS_DOSYA.test(kapak.commons)) {
      hatalar.push(`${yol}.commons: "File:Ad.jpg" biçiminde bir Commons dosyası olmalı (jpg, png, webp)`);
    }
  };
  bak(plan?.gezi?.kapak, 'gezi.kapak');
  bak(plan?.sehir?.kapak, 'sehir.kapak');
  (plan?.gunler ?? []).forEach((g, gi) => (g?.duraklar ?? []).forEach((d, di) => bak(d?.kapak, `g${gi + 1}.d${di + 1}.kapak`)));
  return hatalar;
}

/** Yüklenecek kapaklar: {hedef: 'gezi'|'sehir'|'yer', anahtar (slug ya da place_id), dosya}. Aynı yer iki durakta olsa da bir kez. */
export function kapakIstekleri(plan) {
  const liste = [];
  if (plan?.gezi?.kapak?.commons) liste.push({ hedef: 'gezi', anahtar: plan.gezi.slug, dosya: plan.gezi.kapak.commons });
  const sehirSlug = plan?.sehir?.yeni?.slug ?? plan?.sehir?.slug;
  if (plan?.sehir?.kapak?.commons) liste.push({ hedef: 'sehir', anahtar: sehirSlug, dosya: plan.sehir.kapak.commons });
  const gorulen = new Set();
  for (const g of plan?.gunler ?? []) {
    for (const d of g?.duraklar ?? []) {
      if (!d?.kapak?.commons || gorulen.has(d.place_id)) continue;
      gorulen.add(d.place_id);
      liste.push({ hedef: 'yer', anahtar: d.place_id, dosya: d.kapak.commons });
    }
  }
  return liste;
}

const varliklar = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Commons `Artist` alanı HTML'dir: etiketler ve varlıklar temizlenir, boşluklar sadeleşir, en çok 200 karakter. */
export function yazarTemizle(html) {
  const duz = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, v) => {
      if (varliklar[v.toLowerCase()] !== undefined) return varliklar[v.toLowerCase()];
      if (/^#x/i.test(v)) return String.fromCodePoint(parseInt(v.slice(2), 16));
      if (/^#\d+$/.test(v)) return String.fromCodePoint(Number(v.slice(1)));
      return m;
    })
    .replace(/\s+/g, ' ')
    .trim();
  return [...duz].slice(0, 200).join('');
}

/**
 * #348 inceleme 5: yazar önce `Artist`, boşsa `Credit`, o da boşsa `Attribution` alanından. Üçü de boşsa boş metin döner;
 * `kapakDenetimi` bunu HATA sayar (atıfsız yükleme yok; "Bilinmeyen yazar" gibi bir yedek yazılmaz).
 */
export function yazarBul(meta) {
  for (const alan of ['Artist', 'Credit', 'Attribution']) {
    const y = yazarTemizle(meta?.[alan]?.value);
    if (y) return y;
  }
  return '';
}

/**
 * Lisans: Commons `LicenseShortName` ve `License` alanlarından. Kabul: CC0, kamu malı, CC BY, CC BY-SA (sürümüyle).
 * Ret: NC, ND, GFDL-yalnız, adil kullanım ve tanınmayan her şey. Dönüş {kabul, lisans (≤ 60, uygulamada görünen ad)}.
 */
export function lisansCoz(meta) {
  const kisa = String(meta?.LicenseShortName?.value ?? '').trim();
  const kod = String(meta?.License?.value ?? '').trim().toLowerCase();
  const birlesik = `${kisa} ${kod}`.toLowerCase();
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|non-free/.test(birlesik)) return { kabul: false, lisans: kisa || kod };
  if (/^cc0\b|^cc-zero$|^cc0-1\.0$/.test(kod) || /^cc0\b/i.test(kisa)) return { kabul: true, lisans: 'CC0' };
  if (/^pd\b|^pd-|public domain/.test(kod) || /^public domain\b|^pd\b/i.test(kisa)) return { kabul: true, lisans: 'PD' };
  const cc = /^cc[- ]by(-sa)?(?:[- ](\d\.\d))?\b/.exec(kod) ?? /^cc by(-sa)?(?: (\d\.\d))?\b/i.exec(kisa);
  if (cc) {
    const ad = `CC BY${cc[1] ? '-SA' : ''}${cc[2] ? ` ${cc[2]}` : ''}`;
    return { kabul: true, lisans: ad };
  }
  return { kabul: false, lisans: kisa || kod || 'bilinmiyor' };
}

/** Kovadaki yol dosya adından türetilir: aynı Commons dosyası her yüklemede aynı yere yazılır (tekrar yükleme kopya üretmez). */
export function kapakYolu(dosya, mime) {
  const ozet = createHash('sha256').update(dosya).digest('hex').slice(0, 24);
  return `kapak/commons/${ozet}.${TUR_UZANTI[mime] ?? 'jpg'}`;
}

/**
 * Commons'tan dosya bilgisi (en çok 50 dosya tek istekte): lisans, yazar, kaynak sayfası, 1600 px küçük boy adresi.
 * Dönüş Map<dosya, {var, mime, kucukUrl, kaynakUrl, yazar, kabul, lisans}>.
 */
export async function commonsBilgisi(dosyalar, { fetchFn = fetch } = {}) {
  const sonuc = new Map();
  const tekil = [...new Set(dosyalar)];
  for (let i = 0; i < tekil.length; i += 50) {
    const parca = tekil.slice(i, i + 50);
    const adres = new URL(COMMONS_API);
    for (const [k, v] of Object.entries({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiextmetadatafilter: 'LicenseShortName|License|Artist|Credit|Attribution',
      iiurlwidth: String(KAPAK_GENISLIK),
      titles: parca.join('|'),
    })) adres.searchParams.set(k, v);
    const cevap = await fetchFn(adres.toString(), { headers: { 'user-agent': KULLANICI_AJANI } });
    if (!cevap.ok) throw new Error(`Commons API ${cevap.status}`);
    const j = await cevap.json();
    // Commons başlığı normalleştirir (alt çizgi → boşluk); istenen adla eşlemek için.
    const normal = new Map((j?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const sayfa of j?.query?.pages ?? []) {
      const istenen = normal.get(sayfa.title) ?? sayfa.title;
      const bilgi = sayfa.imageinfo?.[0];
      if (sayfa.missing || !bilgi) {
        sonuc.set(istenen, { var: false });
        continue;
      }
      const { kabul, lisans } = lisansCoz(bilgi.extmetadata);
      sonuc.set(istenen, {
        var: true,
        mime: bilgi.mime,
        kucukUrl: bilgi.thumburl ?? bilgi.url,
        kaynakUrl: bilgi.descriptionurl,
        yazar: yazarBul(bilgi.extmetadata),
        kabul,
        lisans,
      });
    }
  }
  return sonuc;
}

/** İstekleri Commons bilgisiyle eşler; lisansı uygun olmayan, bulunamayan ya da türü desteklenmeyen dosya HATA. */
export function kapakDenetimi(istekler, bilgi) {
  const hatalar = [];
  const hazir = [];
  for (const i of istekler) {
    const b = bilgi.get(i.dosya);
    const kod = `${i.hedef} ${i.anahtar}: ${i.dosya}`;
    if (!b?.var) hatalar.push(`${kod} Commons'ta bulunamadı`);
    else if (!b.kabul) hatalar.push(`${kod} lisansı uygun değil (${b.lisans}); yalnız CC0, PD, CC BY, CC BY-SA`);
    else if (!TUR_UZANTI[b.mime]) hatalar.push(`${kod} türü desteklenmiyor (${b.mime})`);
    else if (!b.yazar) hatalar.push(`${kod} yazarı yok (Artist, Credit ve Attribution boş); atıfsız yüklenmez`);
    else if (!/^https:\/\//.test(b.kaynakUrl ?? '') || !indirmeAdresiUygun(b.kucukUrl)) hatalar.push(`${kod} adresi alınamadı ya da upload.wikimedia.org değil`);
    else hazir.push({ ...i, ...b, yol: kapakYolu(i.dosya, b.mime) });
  }
  return { hatalar, hazir };
}

/** Veritabanına giden kapak verisi: {gezi?, sehir?, yerler[]}; atıf KK1 biçiminde {yazar, lisans, kaynak_url}. */
export function kapakVerisi(plan, hazir, kokUrl) {
  const satir = (h) => ({
    kapak_url: `${kokUrl.replace(/\/+$/, '')}/storage/v1/object/public/icerik/${h.yol}`,
    kapak_atif: { yazar: h.yazar, lisans: h.lisans, kaynak_url: h.kaynakUrl },
  });
  const veri = { sehir_slug: plan?.sehir?.yeni?.slug ?? plan?.sehir?.slug, gezi_slug: plan?.gezi?.slug, yerler: [] };
  for (const h of hazir) {
    if (h.hedef === 'gezi') veri.gezi = satir(h);
    else if (h.hedef === 'sehir') veri.sehir = satir(h);
    else veri.yerler.push({ place_id: h.anahtar, ...satir(h) });
  }
  return veri;
}

/** #348 inceleme 6: indirme yalnız `https://upload.wikimedia.org/…` adresinden. */
export const INDIRME_KOKU = 'upload.wikimedia.org';
export const EN_BUYUK_KAPAK = 5 * 1024 * 1024;

export function indirmeAdresiUygun(adres) {
  try {
    const u = new URL(String(adres ?? ''));
    return u.protocol === 'https:' && u.hostname === INDIRME_KOKU && !u.username && !u.password && !u.port;
  } catch {
    return false;
  }
}

/**
 * Kapağı indirir: adres `upload.wikimedia.org` değilse ya da `content-length` 5 MB'ı geçiyorsa gövde hiç okunmaz.
 * Başlık yoksa ya da yanlışsa okunan gövde de 5 MB'ta kesilir. Yönlendirme izlenmez (başka sunucuya gidemez).
 */
export async function kapakIndir(adres, { fetchFn = fetch } = {}) {
  if (!indirmeAdresiUygun(adres)) throw new Error('adres upload.wikimedia.org değil');
  const cevap = await fetchFn(adres, { headers: { 'user-agent': KULLANICI_AJANI }, redirect: 'error' });
  if (!cevap.ok) throw new Error(`indirme ${cevap.status}`);
  const uzunluk = Number(cevap.headers?.get?.('content-length'));
  if (Number.isFinite(uzunluk) && uzunluk > EN_BUYUK_KAPAK) {
    await cevap.body?.cancel?.();
    throw new Error(`dosya 5 MB'tan büyük (${Math.ceil(uzunluk / 1024 / 1024)} MB)`);
  }
  if (!cevap.body?.getReader) {
    const govde = Buffer.from(await cevap.arrayBuffer());
    if (govde.length > EN_BUYUK_KAPAK) throw new Error("dosya 5 MB'tan büyük");
    return govde;
  }
  const okuyucu = cevap.body.getReader();
  const parcalar = [];
  let toplam = 0;
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) break;
    toplam += value.byteLength;
    if (toplam > EN_BUYUK_KAPAK) {
      await okuyucu.cancel();
      throw new Error("dosya 5 MB'tan büyük");
    }
    parcalar.push(Buffer.from(value));
  }
  return Buffer.concat(parcalar);
}
