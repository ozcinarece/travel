// #262: kullanıcı tablolarının (places, trips, stays) Google koordinatı 30 günü geçmeden yenilenir; yenilenemeyen 30. günde
// boşaltılır (places-yenile). Saf yardımcılar
// burada (Jest de sınar); Google ve veritabanı çağrıları fonksiyonda.

/** Aylık üst sınır: bu kadar Essentials isteğinden sonra iş durur ve masaya bir kez yazılır (ücretsiz kota 10.000/ay). */
export const AYLIK_SINIR = 8000;

/** Bir turda en çok bu kadar place_id yenilenir (günlük iş; aylık sınırın altında kalır: 30 × 250 = 7.500). */
export const TUR_BASINA = 250;

/** Place Details Essentials: yalnız `location` istenir (ad, puan, saat gelmez; PRD §7). */
export const KONUM_MASKESI = 'location';

/** Places API (New) place_id biçimi: harf, rakam, `_` ve `-`; yol olarak kullanılacağı için başka karakter kabul edilmez. */
export function placeIdGecerli(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 300 && /^[A-Za-z0-9_-]+$/.test(id);
}

/** Google cevabından koordinat; eksik ya da aralık dışıysa null. */
export function konumAyikla(cevap: unknown): { lat: number; lng: number } | null {
  const konum = (cevap as { location?: { latitude?: unknown; longitude?: unknown } } | null)?.location;
  const lat = konum?.latitude;
  const lng = konum?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export type YenilemeSonucu = {
  /** Yenileme yaşındaki place_id (bu tur alınan). */
  aday: number;
  /** Koordinatı yazılan place_id. */
  yenilenen: number;
  /** Yazılan satır (places, trips, stays; aynı place_id birden çok yerde olabilir). */
  satir: number;
  /** Google 404: place_id artık yok; koordinatı hemen boşaltılır (satır silinmez). */
  bulunamadi: number;
  /** Turun sonunda boşaltılan koordinat (404 + 30 günü geçen); satır silinmez. */
  bosaltilan: number;
  hatali: number;
  /** Aylık sınır doldu, Google'a istek gitmedi. */
  durdu: boolean;
  /** Bu ay ilk durma: masaya yazılır. */
  ilk_durma: boolean;
};

export function bosSonuc(): YenilemeSonucu {
  return { aday: 0, yenilenen: 0, satir: 0, bulunamadi: 0, bosaltilan: 0, hatali: 0, durdu: false, ilk_durma: false };
}

/** `places_koordinat_bosalt` cevabındaki dört sayının toplamı; bozuk cevapta 0. */
export function bosaltilanToplami(satirlar: unknown): number {
  const satir = Array.isArray(satirlar) ? satirlar[0] : satirlar;
  if (!satir || typeof satir !== 'object') return 0;
  return ['yer', 'seyahat', 'otel', 'konaklama'].reduce((t, k) => {
    const v = (satir as Record<string, unknown>)[k];
    return t + (Number.isInteger(v) && (v as number) > 0 ? (v as number) : 0);
  }, 0);
}

/** Log ve Actions özeti için tek satır; yalnız sayı (place_id, koordinat yazılmaz). */
export function ozetSatiri(s: Partial<YenilemeSonucu>): string {
  const sayi = (v: unknown) => (Number.isInteger(v) ? String(v) : '?');
  return `aday ${sayi(s.aday)} · yenilenen ${sayi(s.yenilenen)} · satır ${sayi(s.satir)} · bulunamadı ${sayi(s.bulunamadi)} · boşaltılan ${sayi(s.bosaltilan)} · hata ${sayi(s.hatali)}${s.durdu ? ' · AYLIK SINIR DOLDU' : ''}`;
}
