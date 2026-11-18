// #262 / #318: Google koordinatı 30 günü geçip yenilenemezse `places`, `stays` ve `trips` satırında lat/lng boşalır (null).
// Satır kalır (listede görünür); haritada pin, çizgi ve mesafe hesabına girmez. (0,0) sayılmaz.

export type KonumNoktasi = { lat: number; lng: number };

/** Koordinatı olan (ikisi de sonlu sayı) nokta. */
export function konumVar<T extends { lat: number | null | undefined; lng: number | null | undefined }>(
  x: T | null | undefined,
): x is T & KonumNoktasi {
  return !!x && typeof x.lat === 'number' && typeof x.lng === 'number' && Number.isFinite(x.lat) && Number.isFinite(x.lng);
}

/** Satırdan `{ lat, lng }`; koordinat yoksa null. */
export function konumu(x: { lat: number | null | undefined; lng: number | null | undefined } | null | undefined): KonumNoktasi | null {
  return konumVar(x) ? { lat: x.lat, lng: x.lng } : null;
}

/** Arama yanlılığı için seyahat merkezi; koordinat boşaldıysa undefined (arama yanlılıksız yapılır). */
export function aramaMerkezi(x: { lat: number | null; lng: number | null }, yaricapM: number): (KonumNoktasi & { yaricapM: number }) | undefined {
  const k = konumu(x);
  return k ? { ...k, yaricapM } : undefined;
}

/** Hiç koordinat kalmadıysa haritanın açılacağı yer (Türkiye ortası); `sigdir` varsa harita noktalara oturur. */
export const YEDEK_MERKEZ: KonumNoktasi = { lat: 39.0, lng: 35.0 };

/** #318 inceleme 4: yedek merkez kullanılırsa ülke ölçeği (tek bir semte yakın açılıp boş görünmesin). */
export const YEDEK_ZOOM = 5;

/** Merkez yedek merkez mi (hiç koordinat bulunamadı). */
export const yedekMerkezMi = (k: KonumNoktasi) => k.lat === YEDEK_MERKEZ.lat && k.lng === YEDEK_MERKEZ.lng;

/** Haritanın merkezi: verilen adaylardan ilk koordinatlısı; hiçbiri yoksa `YEDEK_MERKEZ`. */
export function haritaMerkezi(...adaylar: ({ lat: number | null; lng: number | null } | null | undefined)[]): KonumNoktasi {
  for (const a of adaylar) {
    const k = konumu(a);
    if (k) return k;
  }
  return YEDEK_MERKEZ;
}

/**
 * Google Haritalar yol tarifi `destination` değeri: koordinat varsa "lat,lng"; boşaldıysa yer adı (place_id ayrıca
 * `destination_place_id` ile gider, hedefi o belirler).
 */
export function yolTarifiHedefi(konum: { lat: number | null; lng: number | null } | null | undefined, ad: string): string {
  const k = konumu(konum);
  return k ? `${k.lat},${k.lng}` : encodeURIComponent(ad || '-');
}
