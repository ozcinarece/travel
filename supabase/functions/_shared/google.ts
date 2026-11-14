// Google Places API (New) çağrıları. Anahtar YALNIZCA burada okunur
// (Supabase secret GOOGLE_SERVER_KEY); istemci paketine asla girmez (PRD §7, teknik not §3).

import { googleSay } from './sayac.ts';

const KOK = 'https://places.googleapis.com/v1';
const DIL = 'tr';

function anahtar(): string {
  const k = Deno.env.get('GOOGLE_SERVER_KEY');
  if (!k) throw new Error('GOOGLE_SERVER_KEY tanımlı değil');
  return k;
}

export class GoogleHatasi extends Error {
  constructor(
    public durum: number,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

async function istek<T>(yol: string, secenek: { govde?: unknown; maske?: string; say?: boolean }): Promise<T> {
  const basliklar: Record<string, string> = {
    'content-type': 'application/json',
    'x-goog-api-key': anahtar(),
  };
  if (secenek.maske) basliklar['x-goog-fieldmask'] = secenek.maske;
  // Ücretsiz SKU (Text Search IDs Only) çağıranın kendi sayacına yazılır; maliyet kalemlerine girmez.
  if (secenek.say !== false) googleSay();
  const cevap = await fetch(`${KOK}/${yol}`, {
    method: secenek.govde ? 'POST' : 'GET',
    headers: basliklar,
    body: secenek.govde ? JSON.stringify(secenek.govde) : undefined,
  });
  if (!cevap.ok) {
    const metin = await cevap.text();
    throw new GoogleHatasi(cevap.status, metin.slice(0, 300));
  }
  return (await cevap.json()) as T;
}

// ---------------------------------------------------------------- Autocomplete

export type Oneri = { place_id: string; ana: string; ikincil: string; tipler: string[] };

type AutocompleteCevap = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      types?: string[];
    };
  }[];
};

/**
 * Autocomplete (New). Oturum token'ı seçimdeki Details çağrısıyla kapanır (tek oturum ücreti).
 * `tur`: 'cities' → yalnızca şehirler (PRD 3.2 KK1), 'lodging' → oteller (3.3 KK1), yoksa serbest.
 */
export async function otomatikTamamla(secenek: {
  girdi: string;
  oturum: string;
  tur?: 'cities' | 'lodging';
  merkez?: { lat: number; lng: number; yaricapM?: number };
}): Promise<Oneri[]> {
  const govde: Record<string, unknown> = {
    input: secenek.girdi,
    sessionToken: secenek.oturum,
    languageCode: DIL,
    includeQueryPredictions: false,
  };
  if (secenek.tur === 'cities') govde.includedPrimaryTypes = ['(cities)'];
  if (secenek.tur === 'lodging') govde.includedPrimaryTypes = ['lodging'];
  if (secenek.merkez) {
    govde.locationBias = {
      circle: {
        center: { latitude: secenek.merkez.lat, longitude: secenek.merkez.lng },
        radius: secenek.merkez.yaricapM ?? 20_000,
      },
    };
  }
  const cevap = await istek<AutocompleteCevap>('places:autocomplete', { govde });
  return (cevap.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      place_id: p.placeId,
      ana: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      ikincil: p.structuredFormat?.secondaryText?.text ?? '',
      tipler: p.types ?? [],
    }));
}

// ---------------------------------------------------------------- Details (hafif)

/** PRD §7: liste/seçim için HAFİF maske; tam Details yalnızca 3.8'de (ayrı fonksiyon). */
const HAFIF_MASKE = 'id,location,displayName,primaryType,timeZone,rating,userRatingCount,currentOpeningHours.openNow';
/** 3.7 KK5 (§7 açık nokta): program açılış kontrolü için haftalık periyotlar da istenir; yalnız stops için. */
const SAATLI_MASKE = `${HAFIF_MASKE},regularOpeningHours.periods`;
/** #29: önizleme kartı için ilk fotoğraf adı (photos alanı Enterprise maskesine ek maliyet getirmez; Photo çağrısı ayrı). */
const FOTOLU_MASKE = `${HAFIF_MASKE},photos`;
/** #45: pin paneli "Bilmen gerekenler" — editorialSummary daha pahalı SKU'da; yalnız pin paneli açılınca, tek mekan. */
const OZETLI_MASKE = `${FOTOLU_MASKE},editorialSummary`;
/** Şehir seçimi: puan gerekmez; saat dilimi ve ülke kodu gerekir (trips.tz, trips.country_code). */
const SEHIR_MASKE = 'id,location,displayName,primaryType,timeZone,addressComponents';
/**
 * #172 KK3: puan ya da "şu an açık" göstermeyen çağrılar (`puansiz`) Enterprise alanlarını (rating, userRatingCount,
 * currentOpeningHours) istemez — Place Details Pro SKU. Fotoğraf gerekiyorsa yalnız `photos` eklenir.
 */
const PRO_MASKE = 'id,location,displayName,primaryType,timeZone';
const PRO_FOTOLU_MASKE = `${PRO_MASKE},photos`;
/** #172 KK2: Listem satırı saat + fotoğrafı tek istekte alır (iki ayrı Details yerine). */
const SAATLI_FOTOLU_MASKE = `${SAATLI_MASKE},photos`;

/** Details maskesi: şehir · saatli (Enterprise, puan da gelir) · foto (+ özet) · hafif; `puansiz` ile Pro maskeler. */
export function hafifMaske(secenek: { sehir?: boolean; saatler?: boolean; foto?: boolean; ozet?: boolean; puansiz?: boolean }): string {
  if (secenek.sehir) return SEHIR_MASKE;
  if (secenek.saatler) return secenek.foto ? SAATLI_FOTOLU_MASKE : SAATLI_MASKE;
  if (secenek.foto) return secenek.ozet ? OZETLI_MASKE : secenek.puansiz ? PRO_FOTOLU_MASKE : FOTOLU_MASKE;
  return secenek.puansiz ? PRO_MASKE : HAFIF_MASKE;
}

export type HafifYer = {
  place_id: string;
  ad: string;
  lat: number;
  lng: number;
  primary_type: string | null;
  tz: string | null;
  puan: number | null;
  puan_sayisi: number | null;
  acik: boolean | null;
  /** ISO 3166-1 alpha-2; yalnızca şehir maskesinde dolar. */
  ulke_kodu: string | null;
  /** Haftalık açılış periyotları (yalnız `saatler: true`); gun 0 = Pazar … 6 = Cumartesi, "HH:MM". Boş dizi = her zaman açık. */
  periyotlar?: { gun: number; ac: string; kapaGun: number; kapa: string }[] | null;
  /** İlk fotoğraf (yalnız `foto: true`, #29 önizleme kartı); yoksa null. */
  foto_uri?: string | null;
  /** #45: Google editoryal özeti (yalnız `ozet: true`); yoksa null. */
  ozet?: string | null;
};

type DetailsCevap = {
  id: string;
  location?: { latitude: number; longitude: number };
  displayName?: { text: string };
  primaryType?: string;
  /** Tüm tipler (yalnız Nearby maskesinde; #178 ibadet süzgeci). */
  types?: string[];
  timeZone?: { id: string };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { periods?: { open?: GunSaat; close?: GunSaat }[] };
  addressComponents?: { shortText?: string; types?: string[] }[];
  photos?: { name: string }[];
  editorialSummary?: { text?: string };
};

type GunSaat = { day?: number; hour?: number; minute?: number };

function hhmm(g?: GunSaat) {
  return `${String(g?.hour ?? 0).padStart(2, '0')}:${String(g?.minute ?? 0).padStart(2, '0')}`;
}

export async function hafifDetay(
  placeId: string,
  secenek: { sehir?: boolean; oturum?: string; saatler?: boolean; foto?: boolean; ozet?: boolean; puansiz?: boolean },
): Promise<HafifYer> {
  const parametreler = new URLSearchParams({ languageCode: DIL });
  if (secenek.oturum) parametreler.set('sessionToken', secenek.oturum);
  const d = await istek<DetailsCevap>(`places/${encodeURIComponent(placeId)}?${parametreler}`, { maske: hafifMaske(secenek) });
  const foto = secenek.foto ? (d.photos?.[0]?.name ? await fotoUri(d.photos[0].name, 400) : null) : undefined;
  const ulke = d.addressComponents?.find((b) => b.types?.includes('country'))?.shortText ?? null;
  const hamPeriyotlar = (d.regularOpeningHours?.periods ?? []).filter((p) => p.open?.day !== undefined);
  // #51: kapanışı olmayan periyot (Places'te 7/24 açık) → boş dizi = her zaman açık.
  const periyotlar = secenek.saatler
    ? hamPeriyotlar.some((p) => !p.close)
      ? []
      : hamPeriyotlar.map((p) => ({ gun: p.open!.day!, ac: hhmm(p.open), kapaGun: p.close!.day ?? p.open!.day!, kapa: hhmm(p.close) }))
    : undefined;
  return {
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    primary_type: d.primaryType ?? null,
    tz: d.timeZone?.id ?? null,
    puan: d.rating ?? null,
    puan_sayisi: d.userRatingCount ?? null,
    acik: d.currentOpeningHours?.openNow ?? null,
    ulke_kodu: ulke && /^[A-Z]{2}$/.test(ulke) ? ulke : null,
    periyotlar: secenek.saatler ? (d.regularOpeningHours ? periyotlar! : null) : undefined,
    foto_uri: foto,
    ...(secenek.foto && secenek.ozet ? { ozet: d.editorialSummary?.text?.trim() || null } : {}),
  };
}

// ---------------------------------------------------------------- Text Search (link çözme)

/** Metin araması (New): ad + konum ipucuyla tek sonuç. Yalnızca resolve-link kullanır (PRD §7 maliyet notu). */
export async function metinAra(secenek: {
  metin: string;
  merkez?: { lat: number; lng: number };
  yaricapM?: number;
}): Promise<HafifYer | null> {
  const govde: Record<string, unknown> = { textQuery: secenek.metin, languageCode: DIL, maxResultCount: 1 };
  if (secenek.merkez) {
    govde.locationBias = {
      circle: { center: { latitude: secenek.merkez.lat, longitude: secenek.merkez.lng }, radius: secenek.yaricapM ?? 500 },
    };
  }
  const cevap = await istek<{ places?: DetailsCevap[] }>('places:searchText', {
    govde,
    maske: 'places.id,places.location,places.displayName,places.primaryType',
  });
  const d = cevap.places?.[0];
  if (!d) return null;
  return {
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    primary_type: d.primaryType ?? null,
    tz: null,
    puan: null,
    puan_sayisi: null,
    acik: null,
    ulke_kodu: null,
  };
}

// ---------------------------------------------------------------- İçerik hattı (icerik-google; docs/07)

/**
 * Kimlik eşleme: Text Search yalnız `places.id` maskesiyle (Text Search Essentials IDs Only — ücretsiz, sınırsız). Aday
 * listesi OpenStreetMap'ten gelir; burada yalnız place_id bulunur. Başka alan istenmez. `googleSay` çağrılmaz: çağıran
 * ücretsiz sayaca (`icerik-kimlik`) yazar.
 */
const ICERIK_KIMLIK_MASKE = 'places.id';
/** Kısa liste (gezi başına ≤ 30): puan ve yorum sayısı — Place Details Enterprise SKU. Adres, saat, fotoğraf istenmez. */
const ICERIK_PUAN_MASKE = 'id,displayName,primaryType,businessStatus,rating,userRatingCount';
/** Yükleme: kapalı mı, taze konum ve kategori — Place Details Pro SKU (açılış saatleri istenmez; kapalı gün plandan). */
const ICERIK_DETAY_MASKE = 'id,displayName,primaryType,location,businessStatus';

export type IcerikPuan = {
  place_id: string;
  ad: string;
  primary_type: string | null;
  durum: string | null;
  puan: number | null;
  puan_sayisi: number | null;
};

export type IcerikDetay = {
  place_id: string;
  ad: string;
  primary_type: string | null;
  lat: number;
  lng: number;
  durum: string | null;
};

type IcerikCevap = DetailsCevap & { businessStatus?: string };

/** Ada ve konuma (OSM noktası) en yakın en çok 3 place_id, Google sırasıyla. */
export async function icerikKimlik(secenek: { metin: string; merkez: { lat: number; lng: number }; yaricapM: number }): Promise<string[]> {
  const cevap = await istek<{ places?: { id: string }[] }>('places:searchText', {
    govde: {
      textQuery: secenek.metin,
      languageCode: DIL,
      maxResultCount: 3,
      locationBias: {
        circle: { center: { latitude: secenek.merkez.lat, longitude: secenek.merkez.lng }, radius: Math.min(Math.max(secenek.yaricapM, 50), 50_000) },
      },
    },
    maske: ICERIK_KIMLIK_MASKE,
    say: false,
  });
  return (cevap.places ?? []).map((p) => p.id);
}

export async function icerikPuan(placeId: string): Promise<IcerikPuan> {
  const d = await istek<IcerikCevap>(`places/${encodeURIComponent(placeId)}?languageCode=${DIL}`, { maske: ICERIK_PUAN_MASKE });
  return {
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    primary_type: d.primaryType ?? null,
    durum: d.businessStatus ?? null,
    puan: d.rating ?? null,
    puan_sayisi: d.userRatingCount ?? null,
  };
}

export async function icerikDetay(placeId: string): Promise<IcerikDetay> {
  const d = await istek<IcerikCevap>(`places/${encodeURIComponent(placeId)}?languageCode=${DIL}`, { maske: ICERIK_DETAY_MASKE });
  return {
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    primary_type: d.primaryType ?? null,
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    durum: d.businessStatus ?? null,
  };
}

// ---------------------------------------------------------------- Nearby Search (3.3 otel adayları, 3.4 öneri çipleri)

/** Çip → Places (New) tipleri. 3.4 çipleri PRD KK4 / teknik not T8; `otel` #17 (lodging). Geçerlilik ilk canlı testte doğrulanır. */
// #69 KK10: Keşfet çipleri kalktı — `hepsi` tek tip listesiyle karo isteği; kategori filtresinde o kategorinin kümesi de
// istenir (Places API (New) Table A tipleri; includedTypes en çok 50).
const KATEGORI_TIPLERI: Record<string, string[]> = {
  gezilecek: ['tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument'],
  muze: ['museum', 'art_gallery'],
  ibadet: ['church', 'mosque', 'synagogue', 'hindu_temple'],
  park: ['park', 'garden', 'botanical_garden', 'zoo', 'national_park'],
  manzara: ['observation_deck'],
  yemek: ['restaurant'],
  kafe: ['cafe', 'coffee_shop', 'bakery'],
  alisveris: ['shopping_mall', 'market'],
};
export const CIP_TIPLERI: Record<string, string[]> = {
  otel: ['lodging'],
  hepsi: [...new Set(Object.values(KATEGORI_TIPLERI).flat())],
  // #164 KK1: Keşfet'in varsayılan "Turistik" grubu ve sihirbazın "Görmen gerekenler" listesi aynı küme: tarihi yer ve anıt,
  // müze ve galeri, manzara. #178 KK1: ibadet tipleri (mosque, church, synagogue) çıktı — her mahalle camisi bu tiplerde;
  // tarihî ve turistik ibadet yerleri tourist_attraction / historical_landmark tipini de taşıdığı için yine gelir.
  turistik: ['tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument', 'museum', 'art_gallery', 'observation_deck'],
  ...KATEGORI_TIPLERI,
  // #189 Ek 2: şehir listesinde Turistik üç alt istek (müze ve galeri · tarihî yer, anıt, kültürel · manzara ve park). İstek
  // `includedPrimaryTypes` ile gider (istekBirincilTipleri); bu listeler yalnız yedek istek (`includedTypes`) içindir.
  turistik_muze: ['museum', 'art_gallery'],
  turistik_tarihi: ['tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument'],
  turistik_manzara: ['observation_deck', 'park', 'garden', 'botanical_garden', 'national_park'],
  // Eski istemciler (#69 öncesi çipler) bir sürüm daha kabul edilir; OTA'yı almamış istemci 400 almasın.
  populer: ['tourist_attraction'],
  sanat: ['museum', 'art_gallery'],
};

/**
 * #164 KK2: konaklama birincil tipleri (Places API (New) Table A, Lodging). Google bazı otelleri `tourist_attraction` diye de
 * etiketlediğinden otel dışındaki tüm öneri istekleri bunları `excludedPrimaryTypes` ile dışlar; istemci de ayrıca süzer.
 */
export const KONAKLAMA_TIPLERI = [
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'bed_and_breakfast',
  'guest_house',
  'resort_hotel',
  'extended_stay_hotel',
  'private_guest_room',
  'cottage',
  'farmstay',
  'campground',
  'camping_cabin',
  'rv_park',
];

/** #178 KK2: ibadet tipleri. `place_of_worship` Table B'dir (includedTypes'ta kullanılamaz) ama cevabın `types` listesinde görünür. */
const IBADET_TIPLERI = ['mosque', 'church', 'synagogue', 'place_of_worship'];
/** Bir ibadet yerinin turistik değeri olduğunu gösteren tipler. */
const TURISTIK_DEGER_TIPLERI = ['tourist_attraction', 'historical_landmark', 'cultural_landmark'];
export const IBADET_EN_AZ_YORUM = 1000;

/**
 * #178 KK2: Turistik'te ibadet yeri yalnız turistik değeri varsa gösterilir — turistik tiplerden birini de taşıyorsa ya da en
 * az 1.000 yorumu varsa. İbadet yeri olmayan sonuç olduğu gibi kalır. Tipler ve yorum sayısı Nearby cevabında (ek istek yok).
 */
export function turistikDegeriVar(d: Pick<DetailsCevap, 'types' | 'primaryType' | 'userRatingCount'>): boolean {
  const tipler = new Set([...(d.types ?? []), ...(d.primaryType ? [d.primaryType] : [])]);
  if (!IBADET_TIPLERI.some((t) => tipler.has(t))) return true;
  return TURISTIK_DEGER_TIPLERI.some((t) => tipler.has(t)) || (d.userRatingCount ?? 0) >= IBADET_EN_AZ_YORUM;
}

type YakinSecenek = {
  merkez: { lat: number; lng: number };
  yaricapM: number;
  tipler: string[];
  enFazla?: number;
  /** Dışlanacak birincil tipler (excludedPrimaryTypes). */
  haric?: string[];
  /** #178: turistik değeri olmayan ibadet yerleri cevaptan süzülür (Turistik çipi). */
  ibadetSuzgeci?: boolean;
  /**
   * #190: kategori çiplerinde `includedTypes` yerine `includedPrimaryTypes` — yalnız birincil tipi bu kümede olan yer gelir
   * (tiplerine `museum` ekleyen kuaför 20 kişilik yeri doldurmaz). Bkz. `istekBirincilTipleri`.
   */
  birincilTipler?: string[];
};

/** Nearby sonucu + tüm tipleri (#189 süzgeci için; istemciye gönderilmeden önce `hafifYer` ile atılır). */
export type YakinYer = HafifYer & { tipler: string[] };

export async function yakinAra(secenek: YakinSecenek): Promise<YakinYer[]> {
  // Tip listesi reddedilirse (tip hatası → 400) Keşfet boş kalmasın: önce `includedTypes`'a, sonra dışlamasız isteğe düşülür;
  // sonradan süzgeç (kesfetSuzgeci) ve istemci süzgeci yine çalışır. Başka 400'lerde (ör. geçersiz konum) tekrar denenmez.
  const denemeler: { birincil: boolean; haric: string[] | undefined }[] = [
    ...(secenek.birincilTipler?.length ? [{ birincil: true, haric: secenek.haric }] : []),
    { birincil: false, haric: secenek.haric },
    ...(secenek.haric?.length ? [{ birincil: false, haric: undefined }] : []),
  ];
  for (let i = 0; ; i++) {
    const d = denemeler[i];
    try {
      return await yakinAraBir(secenek, d.birincil, d.haric);
    } catch (e) {
      if (i === denemeler.length - 1 || !(e instanceof GoogleHatasi) || e.durum !== 400 || !/type/i.test(e.message)) throw e;
      console.error('places-nearby tip listesi reddedildi', d.birincil ? 'includedPrimaryTypes' : 'excludedPrimaryTypes', e.message);
    }
  }
}

async function yakinAraBir(secenek: YakinSecenek, birincil: boolean, haric: string[] | undefined): Promise<YakinYer[]> {
  const cevap = await istek<{ places?: DetailsCevap[] }>('places:searchNearby', {
    govde: {
      ...(birincil ? { includedPrimaryTypes: secenek.birincilTipler } : { includedTypes: secenek.tipler }),
      // #166 incelemesi: birincil tipi `tourist_attraction` olup tipleri arasında `lodging` olan oteller de dışlansın.
      ...(haric?.length ? { excludedPrimaryTypes: haric, excludedTypes: ['lodging'] } : {}),
      maxResultCount: Math.min(Math.max(secenek.enFazla ?? 20, 1), 20),
      rankPreference: 'POPULARITY',
      languageCode: DIL,
      locationRestriction: {
        circle: { center: { latitude: secenek.merkez.lat, longitude: secenek.merkez.lng }, radius: Math.min(secenek.yaricapM, 50_000) },
      },
    },
    // `places.types` Pro alanı: puan ve "şu an açık" zaten Enterprise SKU'sunda — fiyat değişmez.
    maske: 'places.id,places.location,places.displayName,places.primaryType,places.types,places.rating,places.userRatingCount,places.currentOpeningHours.openNow',
  });
  const yerler = cevap.places ?? [];
  return (secenek.ibadetSuzgeci ? yerler.filter(turistikDegeriVar) : yerler).map((d) => ({
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    primary_type: d.primaryType ?? null,
    tz: null,
    puan: d.rating ?? null,
    puan_sayisi: d.userRatingCount ?? null,
    acik: d.currentOpeningHours?.openNow ?? null,
    ulke_kodu: null,
    tipler: d.types ?? [],
  }));
}

/** İstemciye giden biçim: tipler atılır. */
export function hafifYer({ tipler: _tipler, ...y }: YakinYer): HafifYer {
  return y;
}

// ---------------------------------------------------------------- #189 Keşfet kalitesi (sunucu süzgeci; ek Google isteği yok)

/** Eşik grubu: hızlı çipler (Turistik · Yemek · Kafe · Park · Alışveriş). */
export type KesfetGrubu = 'turistik' | 'yemek' | 'kafe' | 'park' | 'alisveris';
export type KesfetEsikleri = Record<KesfetGrubu, { yorum: number; puan: number }>;
const GRUPLAR: KesfetGrubu[] = ['turistik', 'yemek', 'kafe', 'park', 'alisveris'];

/** KK2 varsayılanları; yonetim_ayarlari.kesfet_esikleri (Ayarlar) bunları ezer. Puan 0 = puan şartı yok. */
export const VARSAYILAN_ESIKLER: KesfetEsikleri = {
  turistik: { yorum: 50, puan: 3.8 },
  yemek: { yorum: 30, puan: 3.8 },
  kafe: { yorum: 30, puan: 3.8 },
  park: { yorum: 20, puan: 0 },
  alisveris: { yorum: 30, puan: 3.8 },
};

/** Ayardaki değeri varsayılanların üstüne yazar; geçersiz alan (negatif, sayı değil, puan > 5) varsayılanda kalır. */
export function esikleriCoz(deger: unknown): KesfetEsikleri {
  const sonuc = Object.fromEntries(GRUPLAR.map((g) => [g, { ...VARSAYILAN_ESIKLER[g] }])) as KesfetEsikleri;
  if (!deger || typeof deger !== 'object') return sonuc;
  for (const grup of GRUPLAR) {
    const g = (deger as Record<string, unknown>)[grup];
    if (!g || typeof g !== 'object') continue;
    const { yorum, puan } = g as { yorum?: unknown; puan?: unknown };
    if (typeof yorum === 'number' && Number.isFinite(yorum) && yorum >= 0) sonuc[grup].yorum = Math.trunc(yorum);
    if (typeof puan === 'number' && Number.isFinite(puan) && puan >= 0 && puan <= 5) sonuc[grup].puan = puan;
  }
  return sonuc;
}

/**
 * KK1: birincil tip kümeleri (Places API (New) Table A). Nearby `includedTypes`'ı `types` listesinin herhangi birinde arar;
 * işletmeler kendine yanlış tip ekleyebildiği için gösterilecek yerin BİRİNCİL tipi çipin kümesinde olmalı. Kümeler
 * includedTypes'ın alt türlerini de kapsar (ör. `turkish_restaurant` Yemek'tir) ve istemcinin kategori eşlemesiyle
 * (pinKategorisi, Turistik izin listesi) uyumludur. #190: kategori çipleri isteği de bu kümelerle atar (`includedPrimaryTypes`,
 * küme başına en çok 50 tip); sonradan süzgeç güvenlik ağı olarak kalır.
 */
export const BIRINCIL_TIPLER: Record<KesfetGrubu, readonly string[]> = {
  turistik: [
    'tourist_attraction',
    'historical_landmark',
    'historical_place',
    'cultural_landmark',
    'monument',
    'sculpture',
    'castle',
    'museum',
    'art_museum',
    'history_museum',
    'art_gallery',
    'observation_deck',
  ],
  // Restoran alt türleri tek tek: includedPrimaryTypes alt türü kapsamaz (`restaurant` birincil tipi `turkish_restaurant` olanı getirmez).
  yemek: [
    'restaurant',
    'turkish_restaurant',
    'kebab_shop',
    'seafood_restaurant',
    'fast_food_restaurant',
    'pizza_restaurant',
    'hamburger_restaurant',
    'steak_house',
    'barbecue_restaurant',
    'breakfast_restaurant',
    'brunch_restaurant',
    'buffet_restaurant',
    'fine_dining_restaurant',
    'mediterranean_restaurant',
    'middle_eastern_restaurant',
    'lebanese_restaurant',
    'greek_restaurant',
    'italian_restaurant',
    'french_restaurant',
    'spanish_restaurant',
    'american_restaurant',
    'mexican_restaurant',
    'brazilian_restaurant',
    'chinese_restaurant',
    'japanese_restaurant',
    'sushi_restaurant',
    'ramen_restaurant',
    'korean_restaurant',
    'thai_restaurant',
    'vietnamese_restaurant',
    'indonesian_restaurant',
    'indian_restaurant',
    'asian_restaurant',
    'afghani_restaurant',
    'african_restaurant',
    'shawarma_restaurant',
    'vegan_restaurant',
    'vegetarian_restaurant',
    'diner',
    'food_court',
    'meal_takeaway',
    'deli',
    'sandwich_shop',
  ],
  kafe: ['cafe', 'coffee_shop', 'bakery', 'tea_house', 'dessert_shop', 'confectionery', 'ice_cream_shop', 'coffee_roastery', 'coffee_stand', 'cat_cafe', 'dog_cafe'],
  park: ['park', 'city_park', 'state_park', 'national_park', 'dog_park', 'garden', 'botanical_garden', 'zoo', 'hiking_area', 'wildlife_park', 'beach'],
  alisveris: ['shopping_mall', 'market', 'farmers_market', 'flea_market', 'department_store'],
};
const BIRINCIL_KUMESI = Object.fromEntries(GRUPLAR.map((g) => [g, new Set(BIRINCIL_TIPLER[g])])) as Record<KesfetGrubu, Set<string>>;

const BIRINCIL: Record<KesfetGrubu, (tip: string) => boolean> = {
  turistik: (p) => BIRINCIL_KUMESI.turistik.has(p),
  // Listede olmayan yeni bir restoran alt türü (dışlama yedeği / Tümü isteğinden gelirse) yine Yemek sayılır.
  yemek: (p) => BIRINCIL_KUMESI.yemek.has(p) || p.endsWith('_restaurant'),
  kafe: (p) => BIRINCIL_KUMESI.kafe.has(p),
  park: (p) => BIRINCIL_KUMESI.park.has(p),
  alisveris: (p) => BIRINCIL_KUMESI.alisveris.has(p),
};

/**
 * #190: isteğin `includedPrimaryTypes`'ı. Yalnız beş kategori çipi (Turistik · Yemek · Kafe · Park · Alışveriş); Tümü'nün
 * birleşik kümesi 50 tip sınırını aştığı için `includedTypes` + sonradan süzgeçle kalır, eski çipler ve `otel` de öyle.
 * Turistik istisnası (birincil tipi farklı ama `tourist_attraction` / `historical_landmark` taşıyan tarihî cami) bu istekte
 * gelmez — ölçüm PR #190'da; ikinci istek atılmaz.
 */
export function istekBirincilTipleri(cip: string): string[] | undefined {
  if ((GRUPLAR as string[]).includes(cip)) return [...BIRINCIL_TIPLER[cip as KesfetGrubu]];
  return ALT_ISTEK_TIPLERI[cip] ? [...ALT_ISTEK_TIPLERI[cip]] : undefined;
}

/** #189 Ek 2: Turistik alt isteklerinin birincil tipleri (Turistik ve Park kümelerinin alt kümeleri; süzgeçten geçerler). */
const ALT_ISTEK_TIPLERI: Record<string, readonly string[]> = {
  turistik_muze: ['museum', 'art_museum', 'history_museum', 'art_gallery'],
  turistik_tarihi: ['tourist_attraction', 'historical_landmark', 'historical_place', 'cultural_landmark', 'monument', 'sculpture', 'castle'],
  turistik_manzara: ['observation_deck', ...BIRINCIL_TIPLER.park],
};

/** #189 Ek 2: şehir listesinin yarıçapı (m): `kesfet_esikleri.sehir_yaricap_m`, varsayılan 8 km, 2–15 km arası. */
export const VARSAYILAN_SEHIR_YARICAPI_M = 8000;
export function sehirYaricapiCoz(deger: unknown): number {
  const r = deger && typeof deger === 'object' ? (deger as Record<string, unknown>).sehir_yaricap_m : undefined;
  return typeof r === 'number' && Number.isFinite(r) ? Math.min(15_000, Math.max(2000, Math.round(r))) : VARSAYILAN_SEHIR_YARICAPI_M;
}

/** KK1 istisnası (#178 mantığı): Turistik'te birincil tipi turistik olmayan ama tiplerinde bunlardan biri olan yer kalır. */
const TURISTIK_ISTISNA = ['tourist_attraction', 'historical_landmark'];

/**
 * Çipin kabul ettiği eşik grupları (sırayla denenir); `hepsi` hepsini kabul eder; `otel` ve `ibadet` süzülmez (null). Eski çipler
 * ve Turistik alt istekleri Turistik sayılır; "manzara ve park" alt isteği Park'ı da kabul eder (park kendi eşiğiyle).
 */
function cipGruplari(cip: string): readonly KesfetGrubu[] | null {
  if (cip === 'hepsi') return GRUPLAR;
  if ((GRUPLAR as string[]).includes(cip)) return [cip as KesfetGrubu];
  if (cip === 'turistik_manzara') return ['turistik', 'park'];
  if (['gezilecek', 'muze', 'manzara', 'populer', 'sanat', 'turistik_muze', 'turistik_tarihi'].includes(cip)) return ['turistik'];
  return null;
}

/** Yerin bu çipteki grubu (KK1); birincil tipi kabul edilen kümelerde değilse ve istisnaya da girmiyorsa null. */
export function yerGrubu(y: Pick<YakinYer, 'primary_type' | 'tipler'>, cip: string): KesfetGrubu | null {
  const gruplar = cipGruplari(cip);
  if (!gruplar) return null;
  const p = y.primary_type ?? '';
  const grup = gruplar.find((g) => BIRINCIL[g](p));
  if (grup) return grup;
  return gruplar.includes('turistik') && TURISTIK_ISTISNA.some((t) => y.tipler.includes(t)) ? 'turistik' : null;
}

/**
 * #189: Keşfet cevabının süzgeci — gizleme listesi (KK5), birincil tip şartı (KK1), yorum / puan alt sınırı (KK2). `otel` ve
 * `ibadet` çiplerinde yalnız gizleme listesi uygulanır. Sıra korunur (popülerlik).
 */
export function kesfetSuzgeci(yerler: YakinYer[], cip: string, esikler: KesfetEsikleri, gizli: ReadonlySet<string>): YakinYer[] {
  const suzulur = cipGruplari(cip) !== null;
  return yerler.filter((y) => {
    if (gizli.has(y.place_id)) return false;
    if (!suzulur) return true;
    const grup = yerGrubu(y, cip);
    if (!grup) return false;
    const e = esikler[grup];
    return (y.puan_sayisi ?? 0) >= e.yorum && (e.puan <= 0 || (y.puan ?? 0) >= e.puan);
  });
}

// ---------------------------------------------------------------- Tam Details (#80 mekan paneli · Genel)

/**
 * #80: panelin Genel sekmesi — fotoğraflar (≤ 10), saatler, adres, editoryal özet. Yorumlar AYRI çağrıdır (`yorumDetay`,
 * yalnız Yorumlar sekmesine dokununca). Fotoğraf adları ve saatler 24 sa bellek önbelleğinde; DB'ye yazılmaz (PRD §7).
 */
const TAM_MASKE =
  'id,displayName,location,rating,userRatingCount,currentOpeningHours,regularOpeningHours,photos,googleMapsUri,primaryType,shortFormattedAddress,formattedAddress,editorialSummary';
/** #80 KK8: yalnız yorumlar (+ puan özeti) — Yorumlar sekmesi açılınca; 24 sa önbellek, DB'ye yazılmaz. */
const YORUM_MASKE = 'id,rating,userRatingCount,reviews';

export type TamYer = {
  place_id: string;
  ad: string;
  lat: number;
  lng: number;
  primary_type: string | null;
  puan: number | null;
  puan_sayisi: number | null;
  acik: boolean | null;
  /** Bugünkü kapanış ("19:15") — currentOpeningHours.nextCloseTime'dan. */
  kapanis: string | null;
  /** #80: kapalıysa bir sonraki açılış ("yarın 09:00" için gün + saat) — currentOpeningHours.nextOpenTime'dan. */
  acilis: { gun: 'bugun' | 'yarin' | 'sonra'; saat: string } | null;
  /** Haftalık satırlar ("Pazartesi: 08:30–19:15"). */
  saatler: string[];
  /** #80 KK7 "Bugün" satırı: bugünün saat aralığı ("08:00–22:00"); bilinmiyorsa null. */
  bugun: string | null;
  /** #80 KK7: kısa adres (yoksa tam adres). */
  adres: string | null;
  /** #80 KK6 "Bilmen gerekenler": Google editoryal özeti. */
  ozet: string | null;
  /** İlk fotoğrafın çözülmüş URI'si (hemen gösterim). */
  foto_uri: string | null;
  /** #31, #55: en fazla 10 fotoğraf (Places üst sınırı) — adı (places-photo ile tembel çözülür) ve Google atfı (yazar). */
  fotolar: { ad: string; yazar: string | null }[];
  google_maps_uri: string | null;
};

/** #80 KK10: tek Google yorumu. `zaman` Google'ın göreli metni ("2 hafta önce"), `yayin` ISO (istemcide "En yeni" sırası). */
export type Yorum = { yazar: string; puan: number | null; metin: string; zaman: string; yayin: string | null };
export type YorumOzeti = { place_id: string; puan: number | null; puan_sayisi: number | null; yorumlar: Yorum[] };

type TamCevap = DetailsCevap & {
  currentOpeningHours?: { openNow?: boolean; nextCloseTime?: string; nextOpenTime?: string; weekdayDescriptions?: string[] };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
  googleMapsUri?: string;
  shortFormattedAddress?: string;
  formattedAddress?: string;
};

type YorumCevap = {
  id: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    text?: { text: string };
    originalText?: { text: string };
    authorAttribution?: { displayName?: string };
  }[];
};

/** `tz`'de yerel saat ("09:00"); bozuk tarihte null. */
function yerelSaat(iso: string, tz?: string): string | null {
  try {
    return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));
  } catch {
    return null;
  }
}

/** `tz`'de takvim günü (YYYY-MM-DD); bozuk tarihte null. */
function yerelGun(iso: string | Date, tz?: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * #80 KK7: haftalık satırlardan bugünün saat aralığı. Google satırları Pazartesi'den başlar ("Pazartesi: 08:00–22:00");
 * iki nokta sonrası alınır. Satır yoksa null.
 */
export function bugunSatiri(satirlar: string[], tz?: string, simdi = new Date()): string | null {
  if (satirlar.length !== 7) return null;
  let haftaGunu: number;
  try {
    const kisa = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(simdi);
    haftaGunu = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(kisa);
  } catch {
    return null;
  }
  if (haftaGunu < 0) return null;
  const satir = satirlar[haftaGunu];
  const i = satir.indexOf(':');
  return (i >= 0 ? satir.slice(i + 1) : satir).trim() || null;
}

/** #80: bir sonraki açılış `tz`'de bugün mü, yarın mı, daha sonra mı? */
export function acilisZamani(nextOpenTime: string | undefined, tz?: string, simdi = new Date()): TamYer['acilis'] {
  if (!nextOpenTime) return null;
  const saat = yerelSaat(nextOpenTime, tz);
  const gun = yerelGun(nextOpenTime, tz);
  const bugun = yerelGun(simdi, tz);
  if (!saat || !gun || !bugun) return null;
  const yarin = yerelGun(new Date(simdi.getTime() + 24 * 60 * 60 * 1000), tz);
  return { gun: gun === bugun ? 'bugun' : gun === yarin ? 'yarin' : 'sonra', saat };
}

/** Place Photo (New): yönlendirme atlanıp fotoğraf URI'si alınır; anahtar istemciye gitmez. Fotoğraf başına faturalanır. */
export async function fotoUri(ad: string, genislik = 800): Promise<string | null> {
  googleSay();
  const cevap = await fetch(`${KOK}/${ad}/media?maxWidthPx=${genislik}&skipHttpRedirect=true`, {
    headers: { 'x-goog-api-key': anahtar() },
  });
  if (!cevap.ok) return null;
  const j = (await cevap.json()) as { photoUri?: string };
  return j.photoUri ?? null;
}

export async function tamDetay(placeId: string, tz?: string): Promise<TamYer> {
  const d = await istek<TamCevap>(`places/${encodeURIComponent(placeId)}?languageCode=${DIL}`, { maske: TAM_MASKE });
  const foto = d.photos?.[0]?.name ? await fotoUri(d.photos[0].name) : null;
  const kapanis = d.currentOpeningHours?.nextCloseTime ? yerelSaat(d.currentOpeningHours.nextCloseTime, tz) : null;
  const saatler = d.regularOpeningHours?.weekdayDescriptions ?? d.currentOpeningHours?.weekdayDescriptions ?? [];
  return {
    place_id: d.id,
    ad: d.displayName?.text ?? '',
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    primary_type: d.primaryType ?? null,
    puan: d.rating ?? null,
    puan_sayisi: d.userRatingCount ?? null,
    acik: d.currentOpeningHours?.openNow ?? null,
    kapanis,
    acilis: d.currentOpeningHours?.openNow === false ? acilisZamani(d.currentOpeningHours?.nextOpenTime, tz) : null,
    saatler,
    bugun: bugunSatiri(saatler, tz),
    adres: d.shortFormattedAddress?.trim() || d.formattedAddress?.trim() || null,
    ozet: d.editorialSummary?.text?.trim() || null,
    foto_uri: foto,
    fotolar: (d.photos ?? []).slice(0, 10).map((f) => ({ ad: f.name, yazar: f.authorAttributions?.[0]?.displayName ?? null })),
    google_maps_uri: d.googleMapsUri ?? null,
  };
}

/** #80 KK8: yalnız yorumlar — Google en fazla 5 verir (ek sayfa yok); puan özeti dağılım yerine (Google dağılım vermez). */
export async function yorumDetay(placeId: string): Promise<YorumOzeti> {
  const d = await istek<YorumCevap>(`places/${encodeURIComponent(placeId)}?languageCode=${DIL}`, { maske: YORUM_MASKE });
  return {
    place_id: d.id,
    puan: d.rating ?? null,
    puan_sayisi: d.userRatingCount ?? null,
    yorumlar: (d.reviews ?? []).slice(0, 5).map((y) => ({
      yazar: y.authorAttribution?.displayName ?? '',
      puan: y.rating ?? null,
      metin: y.text?.text ?? y.originalText?.text ?? '',
      zaman: y.relativePublishTimeDescription ?? '',
      yayin: y.publishTime ?? null,
    })),
  };
}
