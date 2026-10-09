// Google Places API (New) çağrıları. Anahtar YALNIZCA burada okunur
// (Supabase secret GOOGLE_SERVER_KEY); istemci paketine asla girmez (PRD §7, teknik not §3).

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

async function istek<T>(yol: string, secenek: { govde?: unknown; maske?: string }): Promise<T> {
  const basliklar: Record<string, string> = {
    'content-type': 'application/json',
    'x-goog-api-key': anahtar(),
  };
  if (secenek.maske) basliklar['x-goog-fieldmask'] = secenek.maske;
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

export async function hafifDetay(placeId: string, secenek: { sehir?: boolean; oturum?: string; saatler?: boolean; foto?: boolean; ozet?: boolean }): Promise<HafifYer> {
  const parametreler = new URLSearchParams({ languageCode: DIL });
  if (secenek.oturum) parametreler.set('sessionToken', secenek.oturum);
  const d = await istek<DetailsCevap>(`places/${encodeURIComponent(placeId)}?${parametreler}`, {
    maske: secenek.sehir ? SEHIR_MASKE : secenek.saatler ? SAATLI_MASKE : secenek.foto ? (secenek.ozet ? OZETLI_MASKE : FOTOLU_MASKE) : HAFIF_MASKE,
  });
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
  ...KATEGORI_TIPLERI,
  // Eski istemciler (#69 öncesi çipler) bir sürüm daha kabul edilir; OTA'yı almamış istemci 400 almasın.
  populer: ['tourist_attraction'],
  sanat: ['museum', 'art_gallery'],
};

export async function yakinAra(secenek: {
  merkez: { lat: number; lng: number };
  yaricapM: number;
  tipler: string[];
  enFazla?: number;
}): Promise<HafifYer[]> {
  const cevap = await istek<{ places?: DetailsCevap[] }>('places:searchNearby', {
    govde: {
      includedTypes: secenek.tipler,
      maxResultCount: Math.min(Math.max(secenek.enFazla ?? 20, 1), 20),
      rankPreference: 'POPULARITY',
      languageCode: DIL,
      locationRestriction: {
        circle: { center: { latitude: secenek.merkez.lat, longitude: secenek.merkez.lng }, radius: Math.min(secenek.yaricapM, 50_000) },
      },
    },
    maske: 'places.id,places.location,places.displayName,places.primaryType,places.rating,places.userRatingCount,places.currentOpeningHours.openNow',
  });
  return (cevap.places ?? []).map((d) => ({
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
  }));
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
