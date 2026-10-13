// İçerik hattı (docs/07): plan dosyası doğrulayıcısı — saf işlevler (jest: scripts/icerik/__tests__).
// HATA yüklemeyi durdurur, UYARI rapora girer. İletiler herkese açık loga düşer: durak adı, koordinat, saat gibi Google
// verisi YAZILMAZ; duraklar "g2.d3" (2. gün 3. durak) ve place_id ile anılır.

export const SINIR = {
  baslik: 50,
  ozet: 70,
  gunBaslik: 30,
  durakAd: 120,
  yazarAd: 80,
  sureEnAz: 15,
  sureEnCok: 480,
  gunEnAz: 1,
  gunEnCok: 30,
  durakAz: 4,
  durakCok: 7,
  gunDk: 480,
  gecisDk: 25,
  kelimeAz: 500,
  kelimeCok: 900,
};

export const SLUG = /^[a-z0-9-]{2,80}$/;
export const SEHIR_SLUG = /^[a-z0-9-]{2,60}$/;
export const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/;

/** Plan dosyasına girmemesi gereken Google alanları (PRD §7: koordinat, puan, adres, saat, yorum). */
const YASAK_ALANLAR = new Set(['lat', 'lng', 'konum', 'location', 'puan', 'rating', 'puan_sayisi', 'userRatingCount', 'yorum', 'yorumlar', 'reviews', 'adres', 'address', 'saatler', 'periyotlar', 'openingHours']);

/** src/lib/kategori.ts VARSAYILAN_DAKIKA ile aynı (listede olmayan tip 45). */
export const VARSAYILAN_DAKIKA = {
  museum: 90,
  art_gallery: 60,
  tourist_attraction: 60,
  historical_landmark: 45,
  church: 30,
  place_of_worship: 30,
  park: 45,
  viewpoint: 20,
  scenic_point: 20,
  restaurant: 75,
  cafe: 30,
  coffee_shop: 30,
  bar: 90,
  bakery: 20,
  shopping_mall: 90,
  market: 45,
  zoo: 120,
  aquarium: 120,
  amusement_park: 240,
};
export const varsayilanDakika = (tip) => (tip && VARSAYILAN_DAKIKA[tip]) || 45;

const KLISELER = ['muhteşem', 'büyüleyici', 'eşsiz', 'mutlaka görülmeli', 'saklı cennet', 'masalsı', 'nefes kesen'];

const HARF = { ş: 's', ı: 'i', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

/** Başlıktan slug: küçük harf, Türkçe harfler sade, yalnız harf/rakam/tire, en çok 80. */
export function slugUret(metin) {
  return (metin ?? '')
    .toLocaleLowerCase('tr')
    .replace(/['’]/g, '')
    .replace(/[şığüöçâîû]/g, (h) => HARF[h])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

const MEKAN_IZI = /\[([^\]\n]+)\]\(mekan:([A-Za-z0-9_-]{10,255})\)|^::mekan\[([A-Za-z0-9_-]{10,255})\][ \t]*$/gm;

/** Yazıdaki mekanlar, yazı sırasıyla (BO'nun mekanBaglari kuralı): satır içi = satir, `::mekan[id]` = kart. */
export function mekanIzleri(md) {
  return [...(md ?? '').matchAll(MEKAN_IZI)].map((m) => (m[3] ? { place_id: m[3], bicim: 'kart' } : { place_id: m[2], bicim: 'satir', ad: m[1].trim() }));
}

export function kelimeSayisi(md) {
  const sade = (md ?? '')
    .replace(/^::mekan\[[^\]]*\]\s*$/gm, '')
    .replace(/\]\(mekan:[^)]*\)/g, ']')
    .replace(/[#>*[\]_-]/g, ' ');
  return sade.split(/\s+/).filter((k) => /[\p{L}\p{N}]/u.test(k)).length;
}

/**
 * src/lib/markdown.ts'in çizmediği ya da bu hatta yasak sözdizimi (HATA). Satır numarası 1'den başlar; metin alıntılanmaz.
 */
export function markdownHatalari(md) {
  const hatalar = [];
  const satirlar = (md ?? '').replace(/\r\n?/g, '\n').split('\n');
  satirlar.forEach((ham, i) => {
    const n = i + 1;
    const satir = ham.trimEnd();
    if (!satir.trim()) return;
    const yer = `yazi_md ${n}. satır`;
    if (/^#\s/.test(satir) || /^#$/.test(satir)) hatalar.push(`${yer}: tek diyezli başlık; ara başlık için "## " kullan`);
    else if (/^#{3,}/.test(satir)) hatalar.push(`${yer}: "###" ve daha küçük başlık yok; yalnız "## "`);
    else if (/^#[^#\s]/.test(satir)) hatalar.push(`${yer}: başlık işaretinden sonra boşluk yok`);
    if (/^\s*\|.*\|\s*$/.test(satir) || /^\s*\|?\s*:?-{3,}:?\s*\|/.test(satir)) hatalar.push(`${yer}: tablo desteklenmiyor`);
    if (/^\s*\d+[.)]\s/.test(satir)) hatalar.push(`${yer}: numaralı liste desteklenmiyor; "- " kullan`);
    if (/^\s+[-*+]\s/.test(ham)) hatalar.push(`${yer}: iç içe liste desteklenmiyor`);
    else if (/^[*+]\s/.test(satir)) hatalar.push(`${yer}: madde için "- " kullan`);
    if (/https?:\/\/|www\./i.test(satir)) hatalar.push(`${yer}: dış bağlantı (http/https) kullanılmaz`);
    if (/!\[/.test(satir) || /foto:/i.test(satir)) hatalar.push(`${yer}: görsel / foto: sözdizimi kullanılmaz; fotoğrafları Ece BO'dan ekler`);
    if (/^::/.test(satir.trim()) && !/^::mekan\[[A-Za-z0-9_-]{10,255}\]$/.test(satir.trim())) hatalar.push(`${yer}: geçersiz kart satırı; biçim "::mekan[<place_id>]"`);
    // Mekan bağlantısı ve kartı dışındaki köşeli parantez: unutulmuş not, "[doğrula]", kaynak notu, başka bağlantı.
    const parantezsiz = satir.replace(/\[[^\]\n]+\]\(mekan:[A-Za-z0-9_-]{10,255}\)/g, '').replace(/^::mekan\[[A-Za-z0-9_-]{10,255}\]$/, '');
    if (/\]\(/.test(parantezsiz)) hatalar.push(`${yer}: yalnız mekan bağlantısı kullanılır: [ad](mekan:<place_id>)`);
    else if (/[[\]]/.test(parantezsiz)) hatalar.push(`${yer}: köşeli parantezli not kalmış (ör. [doğrula], kaynak notu)`);
    if (/\b(TODO|TBD|XXX)\b|kaynak:/i.test(satir)) hatalar.push(`${yer}: not ya da kaynak işareti kalmış`);
    // Kalın/italik: geçerli tek katmanlı aralıklar çıkarılınca yıldız kalmamalı (iç içe ya da kapanmamış biçim).
    const govde = satir.replace(/^[-*+]\s/, '');
    const bicimsiz = govde.replace(/\*\*[^*\n]+\*\*/g, '').replace(/\*[^*\s][^*\n]*\*/g, '');
    if (/\*\*\*/.test(govde) || /\*/.test(bicimsiz)) hatalar.push(`${yer}: iç içe ya da kapanmamış kalın/italik`);
  });
  return hatalar;
}

const durakKodu = (g, d) => `g${g + 1}.d${d + 1}`;

function yasakAlanlar(nesne, yol, hatalar) {
  if (!nesne || typeof nesne !== 'object') return;
  for (const [k, v] of Object.entries(nesne)) {
    const alt = Array.isArray(nesne) ? `${yol}[${k}]` : yol ? `${yol}.${k}` : k;
    if (!Array.isArray(nesne) && YASAK_ALANLAR.has(k)) {
      hatalar.push(`${alt}: plan dosyasında Google verisi (koordinat, puan, adres, saat, yorum) olmaz; yükleme anında alınır`);
    }
    if (v && typeof v === 'object') yasakAlanlar(v, alt, hatalar);
  }
}

function yayinVar(nesne) {
  if (!nesne || typeof nesne !== 'object') return false;
  return Object.entries(nesne).some(([k, v]) => ((k === 'yayin' || k === 'yayin_at') && v !== false && v !== null) || (v && typeof v === 'object' && yayinVar(v)));
}

const uzunluk = (s) => [...(s ?? '')].length;

/**
 * Plan dosyasının durağan denetimi (Google verisi gerekmeden).
 * `bilinenIdler`: araştırmada bulunan place_id'ler (yazıda durak dışı mekan anılırsa); `plan.ek_mekanlar` da sayılır.
 */
export function planDenetle(plan, { bilinenIdler = [] } = {}) {
  const hatalar = [];
  const uyarilar = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { hatalar: ['plan bir JSON nesnesi olmalı'], uyarilar };
  if (plan.surum !== 1) hatalar.push('surum: 1 olmalı');
  if (yayinVar(plan)) hatalar.push('yayin / yayin_at: plan dosyasında olmaz; yayını Ece BO\'dan yapar');
  yasakAlanlar(plan, '', hatalar);

  // Şehir
  const sehir = plan.sehir;
  if (!sehir || typeof sehir !== 'object') hatalar.push('sehir: {slug} ya da {yeni: {ad, slug, place_id}} gerekli');
  else if (sehir.yeni) {
    if (!SEHIR_SLUG.test(sehir.yeni.slug ?? '')) hatalar.push('sehir.yeni.slug: ^[a-z0-9-]{2,60}$');
    if (!(uzunluk(sehir.yeni.ad?.trim()) >= 1 && uzunluk(sehir.yeni.ad) <= 80)) hatalar.push('sehir.yeni.ad: 1–80 karakter');
    if (!PLACE_ID.test(sehir.yeni.place_id ?? '')) hatalar.push('sehir.yeni.place_id: şehrin koordinatı yüklemede bundan alınır');
  } else if (!SEHIR_SLUG.test(sehir.slug ?? '')) hatalar.push('sehir.slug: ^[a-z0-9-]{2,60}$');

  // Gezi
  const gezi = plan.gezi ?? {};
  if (!SLUG.test(gezi.slug ?? '')) hatalar.push('gezi.slug: yalnız küçük harf, rakam ve tire; 2–80 karakter');
  if (!gezi.baslik?.trim()) hatalar.push('gezi.baslik: boş');
  else if (uzunluk(gezi.baslik) > SINIR.baslik) hatalar.push(`gezi.baslik: ${uzunluk(gezi.baslik)} karakter (en çok ${SINIR.baslik})`);
  if (!gezi.ozet?.trim()) hatalar.push('gezi.ozet: boş');
  else if (uzunluk(gezi.ozet) > SINIR.ozet) hatalar.push(`gezi.ozet: ${uzunluk(gezi.ozet)} karakter (en çok ${SINIR.ozet})`);
  if (!gezi.yazar_ad?.trim() || uzunluk(gezi.yazar_ad) > SINIR.yazarAd) hatalar.push(`gezi.yazar_ad: 1–${SINIR.yazarAd} karakter`);
  if (!gezi.yazi_md?.trim()) hatalar.push('gezi.yazi_md: boş');

  // Günler ve duraklar
  const gunler = Array.isArray(plan.gunler) ? plan.gunler : [];
  if (gunler.length < SINIR.gunEnAz || gunler.length > SINIR.gunEnCok) hatalar.push(`gunler: ${SINIR.gunEnAz}–${SINIR.gunEnCok} gün olmalı (gelen ${gunler.length})`);
  const durakIdleri = new Set();
  const gorulen = new Map();
  gunler.forEach((gun, gi) => {
    const kod = `${gi + 1}. gün`;
    if (!gun?.baslik?.trim()) hatalar.push(`${kod}: başlık boş`);
    else if (uzunluk(gun.baslik) > SINIR.gunBaslik) hatalar.push(`${kod}: başlık ${uzunluk(gun.baslik)} karakter (en çok ${SINIR.gunBaslik})`);
    const duraklar = Array.isArray(gun?.duraklar) ? gun.duraklar : [];
    if (duraklar.length === 0) hatalar.push(`${kod}: en az 1 durak olmalı`);
    else if (duraklar.length < SINIR.durakAz || duraklar.length > SINIR.durakCok) uyarilar.push(`${kod}: ${duraklar.length} durak (önerilen ${SINIR.durakAz}–${SINIR.durakCok})`);
    duraklar.forEach((d, di) => {
      const dk = durakKodu(gi, di);
      if (!PLACE_ID.test(d?.place_id ?? '')) hatalar.push(`${dk}: place_id geçersiz`);
      else {
        if (gorulen.has(d.place_id)) uyarilar.push(`${dk}: aynı mekan ${gorulen.get(d.place_id)} durağında da var`);
        else gorulen.set(d.place_id, dk);
        durakIdleri.add(d.place_id);
      }
      if (!d?.ad?.trim()) hatalar.push(`${dk}: ad boş`);
      else if (uzunluk(d.ad) > SINIR.durakAd) hatalar.push(`${dk}: ad ${uzunluk(d.ad)} karakter (en çok ${SINIR.durakAd})`);
      if (!Number.isInteger(d?.sure_dk) || d.sure_dk < SINIR.sureEnAz || d.sure_dk > SINIR.sureEnCok) hatalar.push(`${dk}: sure_dk ${SINIR.sureEnAz}–${SINIR.sureEnCok} arası tam sayı olmalı`);
    });
  });

  // Yazı
  const md = gezi.yazi_md ?? '';
  hatalar.push(...markdownHatalari(md));
  const ekIdler = new Set((Array.isArray(plan.ek_mekanlar) ? plan.ek_mekanlar : []).map((m) => m?.place_id));
  for (const id of ekIdler) if (!PLACE_ID.test(id ?? '')) hatalar.push('ek_mekanlar: place_id geçersiz');
  const bilinen = new Set([...durakIdleri, ...ekIdler, ...bilinenIdler]);
  const izler = mekanIzleri(md);
  for (const iz of izler) {
    if (!bilinen.has(iz.place_id)) hatalar.push(`yazi_md: ${iz.bicim === 'kart' ? '::mekan' : 'mekan:'} ${iz.place_id} ne durakta ne araştırmada (ek_mekanlar)`);
  }
  const yazidakiler = new Set(izler.filter((i) => i.bicim === 'satir').map((i) => i.place_id));
  gunler.forEach((gun, gi) =>
    (gun?.duraklar ?? []).forEach((d, di) => {
      if (d?.place_id && !yazidakiler.has(d.place_id)) uyarilar.push(`${durakKodu(gi, di)}: yazıda bağlantılı geçmiyor ([ad](mekan:${d.place_id}))`);
    }),
  );
  const kelime = kelimeSayisi(md);
  if (md && (kelime < SINIR.kelimeAz || kelime > SINIR.kelimeCok)) uyarilar.push(`yazi_md: ${kelime} kelime (önerilen ${SINIR.kelimeAz}–${SINIR.kelimeCok})`);
  const gunBasliklari = md.split('\n').filter((s) => /^## \d+\. gün · /.test(s)).length;
  if (gunler.length && gunBasliklari !== gunler.length) uyarilar.push(`yazi_md: ${gunBasliklari} gün başlığı var, plan ${gunler.length} gün ("## N. gün · <başlık>")`);
  if (!/^>/m.test(md)) uyarilar.push('yazi_md: ">" ipucu paragrafı yok');
  // Gün başına 1–2 kart: "## N. gün" bölümlerine göre.
  const bolumler = md.split(/^## /m).slice(1);
  bolumler.forEach((b, i) => {
    const kart = (b.match(/^::mekan\[/gm) ?? []).length;
    if (/^\d+\. gün/.test(b) && (kart < 1 || kart > 2)) uyarilar.push(`yazi_md: ${i + 1}. bölümde ${kart} mekan kartı (gün başına 1–2)`);
  });
  const kucuk = md.toLocaleLowerCase('tr');
  for (const k of KLISELER) if (kucuk.includes(k)) uyarilar.push(`yazi_md: klişe "${k}"`);
  if (/\d\.\d+\s?(sa|km)\b/.test(md)) uyarilar.push('yazi_md: ondalıkta virgül kullan (1,5 sa)');

  return { hatalar, uyarilar };
}

// ---------------------------------------------------------------- yükleme anı denetimleri (Google detayıyla)

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;

/** Kuş uçuşu metre. */
export function mesafeM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Yürüme tahmini (dk): kuş uçuşu × 1,3 ÷ 75 m/dk, yukarı yuvarlanır. */
export const yurumeDk = (a, b) => Math.ceil((mesafeM(a, b) * 1.3) / 75);

const GUNLER = { pazar: 0, pazartesi: 1, sali: 2, salı: 2, carsamba: 3, çarşamba: 3, persembe: 4, perşembe: 4, cuma: 5, cumartesi: 6 };
export const GUN_ADI = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];

/** Planın 1. gününün haftanın günü (0 = Pazar); `takvim.ilk_gun` yoksa cumartesi (hafta sonu varsayımı). */
export function ilkGun(plan) {
  const ad = plan?.takvim?.ilk_gun;
  return typeof ad === 'string' && ad.toLocaleLowerCase('tr') in GUNLER ? GUNLER[ad.toLocaleLowerCase('tr')] : 6;
}

const dakika = (hhmm) => {
  const [s, d] = hhmm.split(':').map(Number);
  return s * 60 + d;
};
const HAFTA = 7 * 1440;

/**
 * Ziyaret aralığı [bas, bit) (haftanın günü + gün içi dakika) açık bir periyoda sığıyor mu? periyotlar: Google haftalık
 * (gun 0 = Pazar). Boş dizi = her zaman açık; null = bilinmiyor. Döner: 'acik' | 'kapali_gun' | 'saat_disi' | 'bilinmiyor'.
 */
export function acikMi(periyotlar, gun, basDk, bitDk) {
  if (periyotlar === null || periyotlar === undefined) return 'bilinmiyor';
  if (periyotlar.length === 0) return 'acik';
  const araliklar = periyotlar.map((p) => {
    const a = p.gun * 1440 + dakika(p.ac);
    let k = p.kapaGun * 1440 + dakika(p.kapa);
    if (k <= a) k += HAFTA;
    return [a, k];
  });
  const b = gun * 1440 + basDk;
  const e = gun * 1440 + bitDk;
  const sigar = araliklar.some(([a, k]) => [0, HAFTA, -HAFTA].some((kay) => b >= a + kay && e <= k + kay));
  if (sigar) return 'acik';
  const gunBas = gun * 1440;
  const gunBit = gunBas + 1440;
  const oGunAcik = araliklar.some(([a, k]) => [0, HAFTA, -HAFTA].some((kay) => a + kay < gunBit && k + kay > gunBas));
  return oGunAcik ? 'saat_disi' : 'kapali_gun';
}

const YEMEK = /(^|_)(restaurant|food_court|meal_takeaway|diner|steak_house|brunch_restaurant)$|^restaurant$/;
export const yemekMi = (tip) => !!tip && YEMEK.test(tip);

/**
 * Detaylarla gün denetimi (UYARI). `detaylar`: place_id → {lat, lng, primary_type, periyotlar}. Gün 09:30'da başlar;
 * saatler kestirimdir (uygulama kendi hesaplar). Döner: { uyarilar, gunler: [{durak, sure, yurume}] } (yalnız sayı).
 */
export function gunleriDenetle(plan, detaylar, { baslangic = '09:30' } = {}) {
  const uyarilar = [];
  const ozet = [];
  const ilk = ilkGun(plan);
  (plan.gunler ?? []).forEach((gun, gi) => {
    const haftaGunu = (ilk + gi) % 7;
    let t = dakika(baslangic);
    let sure = 0;
    let yurume = 0;
    let ogle = false;
    let onceki = null;
    (gun.duraklar ?? []).forEach((d, di) => {
      const kod = durakKodu(gi, di);
      const det = detaylar.get(d.place_id);
      if (!det) return;
      if (onceki) {
        const y = yurumeDk(onceki, det);
        if (y > SINIR.gecisDk) uyarilar.push(`${kod}: önceki duraktan tahmini yürüme ${y} dk (> ${SINIR.gecisDk}); yazıda tramvay ya da taksi öner`);
        yurume += y;
        t += y;
      }
      const durum = acikMi(det.periyotlar, haftaGunu, t, t + d.sure_dk);
      if (durum === 'kapali_gun') uyarilar.push(`${kod}: ${GUN_ADI[haftaGunu]} günü kapalı`);
      else if (durum === 'saat_disi') uyarilar.push(`${kod}: tahmini ziyaret saati (${saat(t)}–${saat(t + d.sure_dk)}) açık saatlere sığmıyor`);
      if (yemekMi(det.primary_type) && t < 14 * 60 && t + d.sure_dk > 12 * 60) ogle = true;
      if (d.sure_dk !== varsayilanDakika(det.primary_type) && !d.sure_gerekcesi?.trim()) {
        uyarilar.push(`${kod}: süre ${d.sure_dk} dk, varsayılan ${varsayilanDakika(det.primary_type)}; sure_gerekcesi yaz`);
      }
      sure += d.sure_dk;
      t += d.sure_dk;
      onceki = det;
    });
    if (sure + yurume > SINIR.gunDk) uyarilar.push(`${gi + 1}. gün: ${sure + yurume} dk (> ${SINIR.gunDk}; durak ${sure} + yürüme ${yurume})`);
    if ((gun.duraklar ?? []).length && !ogle) uyarilar.push(`${gi + 1}. gün: 12:00–14:00 arasına yemek durağı düşmüyor`);
    ozet.push({ durak: (gun.duraklar ?? []).length, sure, yurume, bitis: saat(t) });
  });
  return { uyarilar, gunler: ozet };
}

function saat(dk) {
  const d = Math.round(dk);
  return `${String(Math.floor(d / 60) % 24).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
}

/** Yükleme verisi (icerik_gezi_taslak_yukle p_veri): kategori ve konum detaydan; adı plan verir. */
export function yuklemeVerisi(plan, detaylar) {
  const sehir = plan.sehir.yeni
    ? (() => {
        const s = detaylar.get(plan.sehir.yeni.place_id);
        return { yeni: { ad: plan.sehir.yeni.ad.trim(), slug: plan.sehir.yeni.slug, lat: s.lat, lng: s.lng } };
      })()
    : { slug: plan.sehir.slug };
  return {
    sehir,
    gezi: {
      slug: plan.gezi.slug,
      baslik: plan.gezi.baslik.trim(),
      ozet: plan.gezi.ozet.trim(),
      yazar_ad: plan.gezi.yazar_ad.trim(),
      yazi_md: plan.gezi.yazi_md.replace(/\r\n?/g, '\n').trim(),
    },
    gunler: plan.gunler.map((g) => ({
      baslik: g.baslik.trim(),
      duraklar: g.duraklar.map((d) => {
        const det = detaylar.get(d.place_id);
        return { place_id: d.place_id, ad: d.ad.trim(), kategori: det.primary_type ?? null, sure_dk: d.sure_dk, lat: det.lat, lng: det.lng };
      }),
    })),
  };
}

/** Yüklemede detayı alınacak place_id'ler: duraklar + ek mekanlar + yeni şehir. */
export function detayIdleri(plan) {
  const idler = new Set();
  for (const g of plan.gunler ?? []) for (const d of g.duraklar ?? []) if (d?.place_id) idler.add(d.place_id);
  for (const m of plan.ek_mekanlar ?? []) if (m?.place_id) idler.add(m.place_id);
  if (plan.sehir?.yeni?.place_id) idler.add(plan.sehir.yeni.place_id);
  return [...idler];
}

/** SQL'e gömülecek metin için dolar tırnağı etiketi: metinde geçmeyen rastgele bir etiket. */
export function dolarEtiketi(metin, rastgele = () => Math.random().toString(36).slice(2, 10)) {
  for (;;) {
    const etiket = `$i${rastgele().replace(/[^a-z0-9]/g, '')}$`;
    if (!metin.includes(etiket)) return etiket;
  }
}
