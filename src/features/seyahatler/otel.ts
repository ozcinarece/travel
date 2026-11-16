import type { OtelSecimi } from '@/lib/tipler';

/** `trips` satırının otel alanları (#56 sonrası yalnız eski derlemeler için yazılır; asıl kayıt `stays`). */
export type OtelAlanlari = {
  hotel_place_id: string | null;
  hotel_lat: number | null;
  hotel_lng: number | null;
  hotel_label: string | null;
  hotel_fetched_at: string | null;
};

/**
 * #268 KK1: `place_id` doluysa ad Google'dan gelmiştir, `hotel_label`'a yazılmaz (PRD §7).
 * `place_id`'siz (yalnız koordinat) seçimde kullanıcının adı kalır. null → otel yok.
 */
export function otelAlanlari(otel: OtelSecimi | null, simdi: Date): OtelAlanlari {
  if (!otel) return { hotel_place_id: null, hotel_lat: null, hotel_lng: null, hotel_label: null, hotel_fetched_at: null };
  return {
    hotel_place_id: otel.place_id,
    hotel_lat: otel.lat,
    hotel_lng: otel.lng,
    hotel_label: otel.place_id ? null : otel.ad.slice(0, 80) || null,
    hotel_fetched_at: simdi.toISOString(),
  };
}
