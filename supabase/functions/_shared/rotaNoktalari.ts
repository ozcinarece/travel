// #246 KK1: Routes fonksiyonları (route-matrix, route-legs) istemciden yalnız nokta ANAHTARI alır; koordinat DB'den okunur.
// Geçerli anahtar: bu seyahatin bir `places.place_id`'si, `stay:<stays.id>` ya da `hotel` (trips.hotel_lat/lng; eski tek otel).
// Gövdedeki lat/lng yok sayılır (eski istemciler göndermeye devam edebilir). Seyahatte olmayan anahtar → 400, Google'a gidilmez.
// Bu modül içe aktarım yapmaz: saf çözümleme (`noktalariCoz`) Jest'te birim testlenir; DB okuması `noktalariOku`'da.

export type Nokta = { key: string; lat: number; lng: number };

/** Seyahatin DB'deki noktaları: mekanlar (place_id), konaklamalar (stays.id) ve eski tek otel. */
export type SeyahatNoktalari = {
  mekanlar: { place_id: string; lat: number; lng: number }[];
  konaklamalar: { id: string; lat: number; lng: number }[];
  otel: { lat: number; lng: number } | null;
};

export const KONAKLAMA_ONEKI = 'stay:';
export const OTEL_ANAHTARI = 'hotel';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** İstek gövdesindeki bir öğeden anahtarı alır (`{key}` nesnesi ya da düz metin); geçersizse null. */
export function anahtarAl(oge: unknown): string | null {
  const k = typeof oge === 'string' ? oge : (oge as { key?: unknown } | null)?.key;
  return typeof k === 'string' && k.length > 0 && k.length <= 300 ? k : null;
}

/** DB sorgusu için anahtarları türüne göre ayırır. */
export function anahtarlariAyir(anahtarlar: string[]): { placeIdler: string[]; konaklamaIdler: string[]; otel: boolean } {
  const placeIdler: string[] = [];
  const konaklamaIdler: string[] = [];
  let otel = false;
  for (const k of new Set(anahtarlar)) {
    if (k === OTEL_ANAHTARI) otel = true;
    else if (k.startsWith(KONAKLAMA_ONEKI)) {
      const id = k.slice(KONAKLAMA_ONEKI.length);
      if (UUID.test(id)) konaklamaIdler.push(id);
    } else placeIdler.push(k);
  }
  return { placeIdler, konaklamaIdler, otel };
}

/**
 * Anahtarları seyahatin DB noktalarıyla eşler. Hepsi bulunursa `{ noktalar }` (anahtar → DB koordinatı), biri bile
 * bulunmazsa `{ bilinmeyen }` döner (çağıran 400 verir; Google'a gidilmez).
 */
export function noktalariCoz(anahtarlar: string[], db: SeyahatNoktalari): { noktalar: Map<string, Nokta> } | { bilinmeyen: string[] } {
  const mekan = new Map(db.mekanlar.map((m) => [m.place_id, m]));
  const konaklama = new Map(db.konaklamalar.map((k) => [k.id.toLowerCase(), k]));
  const noktalar = new Map<string, Nokta>();
  const bilinmeyen: string[] = [];
  for (const k of new Set(anahtarlar)) {
    const yer =
      k === OTEL_ANAHTARI
        ? db.otel
        : k.startsWith(KONAKLAMA_ONEKI)
          ? konaklama.get(k.slice(KONAKLAMA_ONEKI.length).toLowerCase())
          : mekan.get(k);
    if (yer && Number.isFinite(yer.lat) && Number.isFinite(yer.lng)) noktalar.set(k, { key: k, lat: yer.lat, lng: yer.lng });
    else bilinmeyen.push(k);
  }
  return bilinmeyen.length > 0 ? { bilinmeyen } : { noktalar };
}

type Sorgulayici = {
  // deno-lint-ignore no-explicit-any
  from: (tablo: string) => any;
};

/** Seyahatin yalnız istenen anahtarlara ait noktalarını service_role ile okur (üyelik çağırandan önce doğrulanmış olmalı). */
export async function noktalariOku(servis: Sorgulayici, tripId: string, anahtarlar: string[]): Promise<SeyahatNoktalari> {
  const { placeIdler, konaklamaIdler, otel } = anahtarlariAyir(anahtarlar);
  const [m, k, t] = await Promise.all([
    placeIdler.length > 0
      ? servis.from('places').select('place_id, lat, lng').eq('trip_id', tripId).in('place_id', placeIdler)
      : { data: [], error: null },
    konaklamaIdler.length > 0
      ? servis.from('stays').select('id, lat, lng').eq('trip_id', tripId).in('id', konaklamaIdler)
      : { data: [], error: null },
    otel ? servis.from('trips').select('hotel_lat, hotel_lng').eq('id', tripId).maybeSingle() : { data: null, error: null },
  ]);
  if (m.error || k.error || t.error) throw new Error('rota noktalari okunamadi');
  const o = t.data as { hotel_lat: number | null; hotel_lng: number | null } | null;
  return {
    mekanlar: (m.data ?? []) as SeyahatNoktalari['mekanlar'],
    konaklamalar: (k.data ?? []) as SeyahatNoktalari['konaklamalar'],
    otel: o && o.hotel_lat !== null && o.hotel_lng !== null ? { lat: o.hotel_lat, lng: o.hotel_lng } : null,
  };
}
