// #368: içerik hattının şehir kimliği (place_id, saat dilimi, ülke kodu) — `icerik-google` `islem: 'sehir'`.
// Hat service_role ile çağırır; `places-*` fonksiyonlarının kullanıcı yetkisine dokunulmaz. Saf mantık: Google çağrıları
// dışarıdan verilir (test edilebilir). Şehir başına en çok 1 kimlik isteği (Text Search IDs Only, ücretsiz) ve 1 Details
// (şehir maskesi). Cevap yalnız çağırana döner; DB'ye ve loga yazılmaz (PRD §7).

export type SehirIstegi = { ad: string; merkez: { lat: number; lng: number }; place_id: string | null };
export type SehirYeri = { place_id: string; lat: number; lng: number; tz: string | null; ulke_kodu: string | null };

const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/;
const ANAHTARLAR = new Set(['islem', 'ad', 'merkez', 'place_id']);
/** Kimlik aramasının yarıçapı: şehir merkezimize yanlı, hat ayrıca ≤ 50 km denetler (`sehirKimligi`). */
export const SEHIR_ARAMA_YARICAP_M = 50_000;

const gecerliKonum = (lat: unknown, lng: unknown) => typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** İstek gövdesini denetler; geçersizse hata metni döner. Başka alan (maske, alan listesi) kabul edilmez. */
export function sehirIstegiAl(g: Record<string, unknown>): SehirIstegi | string {
  if (Object.keys(g).some((k) => !ANAHTARLAR.has(k))) return 'sehir yalnız ad, merkez ve place_id alır';
  const ad = typeof g.ad === 'string' ? g.ad.trim() : '';
  if (!ad || ad.length > 100) return 'ad gerekli (en çok 100 karakter)';
  const m = g.merkez as { lat?: unknown; lng?: unknown } | undefined;
  if (!m || !gecerliKonum(m.lat, m.lng)) return 'merkez geçersiz';
  const id = g.place_id ?? null;
  if (id !== null && (typeof id !== 'string' || !PLACE_ID.test(id))) return 'geçersiz place_id';
  return { ad, merkez: { lat: m.lat as number, lng: m.lng as number }, place_id: id as string | null };
}

/**
 * place_id biliniyorsa yalnız Details; yoksa önce kimlik araması (şehirler, merkeze yanlı, ilk sonuç). Eşleşme yoksa null.
 * `kimlikAdet`: yapılan ücretsiz kimlik isteği (0 ya da 1) — çağıran ayrı sayaca yazar.
 */
export async function sehirYeriBul(
  istek: SehirIstegi,
  google: {
    kimlik: (metin: string, merkez: { lat: number; lng: number }, yaricapM: number) => Promise<string[]>;
    detay: (placeId: string) => Promise<SehirYeri>;
  },
): Promise<{ yer: SehirYeri | null; kimlikAdet: number }> {
  let id = istek.place_id;
  let kimlikAdet = 0;
  if (!id) {
    kimlikAdet = 1;
    id = (await google.kimlik(istek.ad, istek.merkez, SEHIR_ARAMA_YARICAP_M))[0] ?? null;
    if (!id || !PLACE_ID.test(id)) return { yer: null, kimlikAdet };
  }
  return { yer: await google.detay(id), kimlikAdet };
}
