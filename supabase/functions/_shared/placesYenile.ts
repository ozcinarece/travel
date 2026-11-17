// #262: seyahat mekânlarının (`places`) Google koordinatı 30 günü geçmeden yenilenir (places-yenile). Saf yardımcılar
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
  /** Yazılan `places` satırı (aynı place_id birden çok seyahatte olabilir). */
  satir: number;
  /** Google 404: place_id artık yok; satıra dokunulmaz. */
  bulunamadi: number;
  hatali: number;
  /** Aylık sınır doldu, Google'a istek gitmedi. */
  durdu: boolean;
  /** Bu ay ilk durma: masaya yazılır. */
  ilk_durma: boolean;
};

export function bosSonuc(): YenilemeSonucu {
  return { aday: 0, yenilenen: 0, satir: 0, bulunamadi: 0, hatali: 0, durdu: false, ilk_durma: false };
}

/** Log ve Actions özeti için tek satır; yalnız sayı (place_id, koordinat yazılmaz). */
export function ozetSatiri(s: Partial<YenilemeSonucu>): string {
  const sayi = (v: unknown) => (Number.isInteger(v) ? String(v) : '?');
  return `aday ${sayi(s.aday)} · yenilenen ${sayi(s.yenilenen)} · satır ${sayi(s.satir)} · bulunamadı ${sayi(s.bulunamadi)} · hata ${sayi(s.hatali)}${s.durdu ? ' · AYLIK SINIR DOLDU' : ''}`;
}
