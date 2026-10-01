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
  addressComponents?: { shortText?: string; types?: string[] }[];
};

export async function hafifDetay(placeId: string, secenek: { sehir?: boolean; oturum?: string }): Promise<HafifYer> {
  const parametreler = new URLSearchParams({ languageCode: DIL });
  if (secenek.oturum) parametreler.set('sessionToken', secenek.oturum);
  const d = await istek<DetailsCevap>(`places/${encodeURIComponent(placeId)}?${parametreler}`, {
    maske: secenek.sehir ? SEHIR_MASKE : HAFIF_MASKE,
  });
  const ulke = d.addressComponents?.find((b) => b.types?.includes('country'))?.shortText ?? null;
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
export const CIP_TIPLERI: Record<string, string[]> = {
  otel: ['lodging'],
  populer: ['tourist_attraction'],
  yemek: ['restaurant'],
  sanat: ['museum', 'art_gallery'],
  manzara: ['park', 'tourist_attraction'],
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
