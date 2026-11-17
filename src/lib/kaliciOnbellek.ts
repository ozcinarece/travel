// #243 KK1: son görülen hal okunur kalsın — React Query önbelleğinin bir kısmı cihazda (AsyncStorage) tutulur.
// Yalnız bizim veritabanımızdaki kayıtlar saklanır: profil, seyahat listesi, seyahat, günler, duraklar ve kendi içeriğimiz
// (yerler, rehber metni). Google'dan gelen hiçbir sorgu (places-light, Details, fotoğraf, yorum) cihaza yazılmaz (PRD §7).
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
const SURUM = '1';

/**
 * Saklanan sorgu anahtarlarının başları. Her biri bizim tablolarımızdan okunur (Google içeriği yok):
 * - `profil`: `profiles` satırı; `seyahatler` / `seyahat`: `trips`; `gunler` / `duraklar`: `days` / `stops`;
 * - `icerik › yerler` ve `icerik › rehber` / `yer-rehber`: kendi içeriğimiz (OSM konumu, editör metni).
 */
const IZINLI: readonly (readonly string[])[] = [
  ['profil'],
  ['seyahatler'],
  ['seyahat'],
  ['gunler'],
  ['duraklar'],
  ['icerik', 'yerler'],
  ['icerik', 'rehber'],
  ['icerik', 'yer-rehber'],
];

/** Bu sorgu cihazda saklanabilir mi (izin listesinin bir başıyla başlıyor mu). */
export function saklanabilir(anahtar: QueryKey): boolean {
  return IZINLI.some((bas) => bas.every((parca, i) => anahtar[i] === parca));
}

/** Yalnız başarılı ve izin listesindeki sorgular cihaza yazılır. */
export function cihazaYazilsinMi(q: Query): boolean {
  return defaultShouldDehydrateQuery(q) && saklanabilir(q.queryKey);
}

/**
 * Saklanan sorgular bellekte de en az önbellek ömrü kadar kalmalı; yoksa kullanılmayan sorgu 5 dk sonra silinir ve
 * cihazdaki kopyadan da düşer. Diğer sorguların (Google dahil) bellek süresi değişmez.
 */
export function saklananlariAyarla(qc: QueryClient): void {
  for (const bas of IZINLI) qc.setQueryDefaults([...bas], { gcTime: ONBELLEK_OMRU_MS });
}

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: ONBELLEK_ANAHTARI, throttleTime: 1000 });

export const kaliciSecenekler: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: ONBELLEK_OMRU_MS,
  buster: SURUM,
  dehydrateOptions: { shouldDehydrateQuery: cihazaYazilsinMi, shouldDehydrateMutation: () => false },
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
