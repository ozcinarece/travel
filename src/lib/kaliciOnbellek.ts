// #243 KK1: son görülen hal okunur kalsın — React Query önbelleğinin bir kısmı cihazda (AsyncStorage) tutulur.
// Yalnız bizim veritabanımızdaki kayıtlar saklanır: profil, seyahat listesi, seyahat, günler, duraklar (ve durakların mekan
// satırları) ve kendi içeriğimiz (yerler, rehber metni, mekan adları). Google'dan gelen hiçbir sorgu (places-light, Details, fotoğraf, yorum) cihaza yazılmaz (PRD §7).
// Saklanacak anahtarlar izin listesiyle seçilir: listede olmayan yeni bir sorgu kendiliğinden saklanmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type Query, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/** AsyncStorage anahtarı. */
export const ONBELLEK_ANAHTARI = 'tripmate-sorgu-onbellegi';
/** Önbelleğin ömrü en çok 7 gün (KK1). */
export const ONBELLEK_OMRU_MS = 7 * 24 * 60 * 60 * 1000;
/** Kayıt biçimi değişirse eski önbellek okunmaz. */
const SURUM = '2';

/**
 * Saklanan sorgu anahtarlarının başları. Her biri bizim tablolarımızdan okunur (Google içeriği yok):
 * - `profil`: `profiles` satırı; `seyahatler` / `seyahat`: `trips`; `gunler` / `duraklar`: `days` / `stops`;
 * - `mekanlar`: durakların mekan satırları (`places`: `place_id`, konum, `primary_type`; PRD §7'nin izin verdiği alanlar,
 *   ad yok). Gezi sayfası bunlarsız açılamaz.
 * - `icerik › yerler` ve `icerik › rehber` / `yer-rehber`: kendi içeriğimiz (OSM konumu, editör metni);
 * - `icerik-mekan`: kendi içeriğimizdeki mekan adı ve kategorisi (`icerik_mekan_bilgileri`); çevrimdışı durak adı buradan (KK5).
 *
 * Bilerek dışarıda: `konaklamalar` (`stays.label`'da eski Google adları olabilir, #250), sohbet, harcama, üyeler.
 */
const IZINLI: readonly (readonly string[])[] = [
  ['profil'],
  ['seyahatler'],
  ['seyahat'],
  ['gunler'],
  ['duraklar'],
  ['mekanlar'],
  ['icerik-mekan'],
  ['icerik', 'yerler'],
  ['icerik', 'rehber'],
  ['icerik', 'yer-rehber'],
];

/** Bu sorgu cihazda saklanabilir mi (izin listesinin bir başıyla başlıyor mu). */
export function saklanabilir(anahtar: QueryKey): boolean {
  return IZINLI.some((bas) => bas.every((parca, i) => anahtar[i] === parca));
}

/**
 * Yalnız başarılı ve izin listesindeki sorgular cihaza yazılır. #293 KK8: sorgunun verisi son 7 gün içinde sunucudan gelmiş
 * olmalı. Önbellek her yazımda yenilendiği için `maxAge` tek başına yetmez: uzun süre yenilenmeyen bir sorgu (ör. Google
 * konumu taşıyan `mekanlar`) cihazda 30 günü aşabilirdi.
 */
export function cihazaYazilsinMi(q: Query, an: number = Date.now()): boolean {
  return defaultShouldDehydrateQuery(q) && saklanabilir(q.queryKey) && an - q.state.dataUpdatedAt <= ONBELLEK_OMRU_MS;
}

/**
 * Saklanan sorgular bellekte de en az önbellek ömrü kadar kalmalı; yoksa kullanılmayan sorgu 5 dk sonra silinir ve
 * cihazdaki kopyadan da düşer. Diğer sorguların (Google dahil) bellek süresi değişmez.
 */
export function saklananlariAyarla(qc: QueryClient): void {
  for (const bas of IZINLI) qc.setQueryDefaults([...bas], { gcTime: ONBELLEK_OMRU_MS });
}

// `icerik-mekan` bir Map döndürür; düz JSON Map'i boş nesneye çevirir. Map'ler `{ __map: [[k, v], …] }` olarak yazılır.
export function seriyeCevir(veri: unknown): string {
  return JSON.stringify(veri, (_k, v: unknown) => (v instanceof Map ? { __map: [...v.entries()] } : v));
}
export function seridenCoz(ham: string): unknown {
  return JSON.parse(ham, (_k, v: unknown) => (v && typeof v === 'object' && Array.isArray((v as { __map?: unknown }).__map) ? new Map((v as { __map: [unknown, unknown][] }).__map) : v));
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: ONBELLEK_ANAHTARI,
  throttleTime: 1000,
  serialize: seriyeCevir,
  deserialize: seridenCoz as (ham: string) => ReturnType<typeof JSON.parse>,
});

export const kaliciSecenekler: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: ONBELLEK_OMRU_MS,
  buster: SURUM,
  dehydrateOptions: { shouldDehydrateQuery: (q) => cihazaYazilsinMi(q), shouldDehydrateMutation: () => false },
};

/** Çıkışta (ya da başka kullanıcıya geçişte) cihazdaki kopya silinir (KK1). */
export async function kaliciOnbellegiSil(): Promise<void> {
  try {
    await persister.removeClient();
  } catch {
    // Silinemezse bir sonraki yazımda boş önbellek üzerine yazılır.
  }
}

/**
 * #243 KK2: tam ekran "Profilin hazırlanamadı" yalnız profil hiç yokken (ne sunucudan ne cihazdaki önbellekten) ya da
 * oluşturulamadıysa. Önbellekte profil varken okuma hatası (ör. bağlantısız açılış) uygulamayı kilitlemez.
 */
export function profilKilitli(d: { hata: boolean; profil: unknown; olusturulamadi: boolean }): boolean {
  return (d.hata && d.profil === undefined) || d.olusturulamadi;
}
