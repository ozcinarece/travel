// #401 KK1: il önerileri dosyasının (icerik/iller/<il>.json) doğrulayıcısı ve yükleme verisi. Saf; testli.
// Kurallar Ece'nin 19 Kasım 15:52 güncellemesiyle: 20–50 yer, kategori zorunlu ve tek değer, bulunan her kategoride en az
// 3 yer, `sira` tekil ve 1'den ardışık, `neden` en çok 90 karakter, Google alanı yok. Hata satırlarında yalnız sıra ve alan adı
// yazılır (loglar herkese açık).
import { AMACLAR, amacHatasi, OSM_ID, SEHIR_SLUG } from './dogrula.mjs';

/** Veritabanındaki `public.il_kategori_listesi()` ile aynı olmalı. */
export const IL_KATEGORILERI = ['doga', 'yemek', 'tatli_kahve', 'muze', 'tarih', 'carsi', 'aktivite', 'manzara'];
export const IL_EN_AZ = 20;
export const IL_EN_COK = 50;
export const KATEGORI_EN_AZ = 3;
export const NEDEN_EN_COK = 90;

const UST_ALANLAR = new Set(['il', 'slug', 'guncelleme', 'oneriler']);
const YER_ALANLARI = new Set(['sira', 'ad', 'kategori', 'amaclar', 'ilce', 'merkeze_km', 'neden', 'osm', 'place_id']);
/** Google'dan gelebilecek alanlar: hata metni ayrıca söyler (PRD §7; konum OSM'den, yükleme anında). */
const GOOGLE_ALANLARI = new Set(['lat', 'lng', 'konum', 'location', 'puan', 'rating', 'puan_sayisi', 'userRatingCount', 'yorum', 'yorumlar', 'reviews', 'adres', 'address', 'saatler', 'periyotlar', 'openingHours', 'foto', 'fotograf', 'photos', 'primary_type']);

function alanDenetle(nesne, izinli, yer, hatalar) {
  for (const k of Object.keys(nesne)) {
    if (izinli.has(k)) continue;
    hatalar.push(GOOGLE_ALANLARI.has(k) ? `${yer}${k}: il dosyasında Google verisi olmaz` : `${yer}${k}: bilinmeyen alan`);
  }
}

/** KK1: { hatalar, uyarilar }. `dosyaSlug` verilirse dosya adıyla `slug` aynı olmalı. */
export function ilDenetle(veri, { dosyaSlug } = {}) {
  const hatalar = [];
  const uyarilar = [];
  if (!veri || typeof veri !== 'object' || Array.isArray(veri)) return { hatalar: ['dosya bir JSON nesnesi olmalı'], uyarilar };
  alanDenetle(veri, UST_ALANLAR, '', hatalar);
  if (typeof veri.il !== 'string' || !veri.il.trim() || veri.il.length > 60) hatalar.push('il: 1–60 karakter olmalı');
  if (typeof veri.slug !== 'string' || !SEHIR_SLUG.test(veri.slug)) hatalar.push('slug: küçük harf, rakam ve tire (2–60)');
  else if (dosyaSlug && dosyaSlug !== veri.slug) hatalar.push('slug: dosya adıyla aynı olmalı');
  const liste = veri.oneriler;
  if (!Array.isArray(liste)) return { hatalar: [...hatalar, 'oneriler: dizi olmalı'], uyarilar };
  if (liste.length < IL_EN_AZ || liste.length > IL_EN_COK) hatalar.push(`oneriler: ${IL_EN_AZ}–${IL_EN_COK} yer olmalı (${liste.length})`);

  const siralar = [];
  const kategoriler = new Map();
  const placeIdler = new Set();
  liste.forEach((o, i) => {
    const yer = `oneriler[${i}].`;
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      hatalar.push(`oneriler[${i}]: nesne olmalı`);
      return;
    }
    alanDenetle(o, YER_ALANLARI, yer, hatalar);
    if (!Number.isInteger(o.sira) || o.sira < 1) hatalar.push(`${yer}sira: 1 ya da büyük tam sayı`);
    else siralar.push(o.sira);
    if (typeof o.ad !== 'string' || !o.ad.trim() || o.ad.length > 120) hatalar.push(`${yer}ad: 1–120 karakter`);
    if (!IL_KATEGORILERI.includes(o.kategori)) hatalar.push(`${yer}kategori: ${IL_KATEGORILERI.join(', ')} değerlerinden biri`);
    else kategoriler.set(o.kategori, (kategoriler.get(o.kategori) ?? 0) + 1);
    const amac = amacHatasi(o.amaclar);
    if (amac) hatalar.push(`${yer}amaclar: ${amac}`);
    if (typeof o.neden !== 'string' || !o.neden.trim()) hatalar.push(`${yer}neden: zorunlu`);
    else if (o.neden.length > NEDEN_EN_COK) hatalar.push(`${yer}neden: en çok ${NEDEN_EN_COK} karakter (${o.neden.length})`);
    if (o.ilce !== undefined && o.ilce !== null && (typeof o.ilce !== 'string' || !o.ilce.trim() || o.ilce.length > 60)) hatalar.push(`${yer}ilce: 1–60 karakter`);
    if (o.merkeze_km !== undefined && o.merkeze_km !== null && (typeof o.merkeze_km !== 'number' || !(o.merkeze_km >= 0) || o.merkeze_km > 99999)) hatalar.push(`${yer}merkeze_km: 0 ya da pozitif sayı`);
    if (o.osm !== undefined && o.osm !== null && (typeof o.osm !== 'string' || !OSM_ID.test(o.osm))) hatalar.push(`${yer}osm: node/…, way/… ya da relation/…`);
    if (o.place_id !== undefined && o.place_id !== null) {
      if (typeof o.place_id !== 'string' || !o.place_id.trim() || o.place_id.length > 300) hatalar.push(`${yer}place_id: metin ya da null`);
      else if (placeIdler.has(o.place_id)) uyarilar.push(`${yer}place_id: aynı yer listede iki kez`);
      else placeIdler.add(o.place_id);
    }
  });

  const sirali = [...siralar].sort((a, b) => a - b);
  if (new Set(siralar).size !== siralar.length) hatalar.push('sira: tekil olmalı');
  else if (sirali.some((s, i) => s !== i + 1)) hatalar.push('sira: 1’den başlayıp boşluksuz ardışık olmalı');
  const osmsuz = liste.filter((o) => o && !o.osm).length;
  if (osmsuz) uyarilar.push(`${osmsuz} yerde OSM kimliği yok; konumları boş kalır`);
  for (const [k, n] of kategoriler) if (n < KATEGORI_EN_AZ) hatalar.push(`kategori ${k}: en az ${KATEGORI_EN_AZ} yer (${n})`);
  return { hatalar, uyarilar };
}

/** KK3: `icerik_il_taslak_yukle` girdisi. Konum yalnız OSM'den (`osmKonumlari`: 'node/1' → {lat, lng}). */
export function ilYuklemeVerisi(veri, osmKonumlari = new Map()) {
  return {
    il: veri.il.trim(),
    slug: veri.slug,
    oneriler: veri.oneriler.map((o) => {
      const konum = o.osm ? osmKonumlari.get(o.osm) : undefined;
      return {
        sira: o.sira,
        ad: o.ad.trim(),
        kategori: o.kategori,
        amaclar: (o.amaclar ?? []).filter((a) => AMACLAR.includes(a)),
        ilce: o.ilce ?? null,
        merkeze_km: o.merkeze_km ?? null,
        neden: o.neden.trim(),
        osm: o.osm ?? null,
        place_id: o.place_id ?? null,
        ...(konum ? { lat: konum.lat, lng: konum.lng } : {}),
      };
    }),
  };
}

/** Listedeki OSM kimlikleri (tekrarsız). */
export const ilOsmIdleri = (veri) => [...new Set((veri.oneriler ?? []).map((o) => o.osm).filter((x) => typeof x === 'string' && OSM_ID.test(x)))];

/** Özet satırı için kategori dağılımı ("doga 11 · yemek 8 …"), kategori listesi sırasıyla. */
export function kategoriDagilimi(veri) {
  const say = new Map();
  for (const o of veri.oneriler ?? []) say.set(o.kategori, (say.get(o.kategori) ?? 0) + 1);
  return IL_KATEGORILERI.filter((k) => say.has(k)).map((k) => `${k} ${say.get(k)}`).join(' · ');
}
