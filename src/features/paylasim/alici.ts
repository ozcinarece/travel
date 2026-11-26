// #432 2/3b (KK5, KK6, KK8): linki açan arkadaşın ekranı (`/r/g/{token}`, kanvas `Sos_v6_Alici` · `Sos_v6_Kapali`).
// Veri girişsiz `paylasim_ozeti` RPC'sinden (1/3); Places isteği yok (Ürün kararı 2b): durak adı yalnız bizim içeriğimizden,
// yoksa "Durak 3" + tür adı. Özet açılış sayacını artırdığı için aynı oturumda bir kez çağrılır (Ürün kararı 3): sorgu
// bayatlamaz, odaklanınca ya da bağlantı gelince yeniden çekilmez, cihazdaki önbelleğe yazılmaz (izinli anahtar değil).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { supabase } from '@/lib/supabase';

export type PaylasimDuragi = { ad: string | null; tur: string | null; dakika: number | null; lat: number | null; lng: number | null };
export type PaylasimGunu = { gun: number; duraklar: PaylasimDuragi[] };
export type AcikPaylasimOzeti = {
  kapali: false;
  id: string;
  paylasan: string | null;
  ad: string | null;
  sehir: string;
  gun_sayisi: number;
  durak_sayisi: number;
  kisi_sayisi: number;
  /** #517 KK3: tarihsiz ya da başlamamış "gidiyor", sürüyor "geziyor", bitmiş "gezdi" (sunucu `trips.tz` ile hesaplar). */
  kisi_kip?: 'gidiyor' | 'geziyor' | 'gezdi';
  gunler: PaylasimGunu[];
};
/**
 * null: bilinmeyen link ("Bu link açılmıyor"); `kapali`: "Bu paylaşım kapatıldı". Akıştan (kimlikle) açılan kapalı paylaşımda
 * `paylasan` ilk adı gelir: "{ad} bu paylaşımı kapattı." (#533 incelemesi 4).
 */
export type PaylasimOzeti = AcikPaylasimOzeti | { kapali: true; paylasan?: string | null } | null;

export const TOKEN_BICIMI = /^[A-Za-z0-9_-]{24}$/;
/** #407 KK3: Arkadaşlar akışındaki kart alıcı ekranını paylaşımın kimliğiyle açar (`/r/g/{uuid}`); token istemciye gelmez. */
export const KIMLIK_BICIMI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const kimlikMi = (anahtar: string) => KIMLIK_BICIMI.test(anahtar);

export function usePaylasimOzeti(token: string | undefined, hesapli: boolean, oturumHazir = true) {
  return useQuery({
    queryKey: ['paylasim_ozeti', token, hesapli],
    // Kimlikli linkte oturum yüklenene kadar beklenir (yoksa "açılmıyor" bir an görünür).
    enabled: oturumHazir || !token || !kimlikMi(token),
    // Biçimi bozuk token sunucuya gitmez; doğrudan "Bu link açılmıyor". Kimlikli link (`/r/g/{uuid}`) yalnız akıştan, girişli
    // kişiye açılır; oturumsuz ya da misafirken sunucuya gitmez (#533 incelemesi 9).
    queryFn: async (): Promise<PaylasimOzeti> => {
      if (!token || (!TOKEN_BICIMI.test(token) && !kimlikMi(token))) return null;
      if (kimlikMi(token) && !hesapli) return null;
      const { data, error } = kimlikMi(token)
        ? await supabase.rpc('paylasim_ozeti_kimlik', { p_id: token })
        : await supabase.rpc('paylasim_ozeti', { p_token: token });
      if (error) throw error;
      return (data as PaylasimOzeti) ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });
}

/** "Haritada gör": günlük 200 yükleme sınırı sunucuda (Ürün kararı 2). false → gri satır, harita yüklenmez. */
export async function haritaIzniAl(token: string): Promise<boolean> {
  const { data, error } = kimlikMi(token)
    ? await supabase.rpc('paylasim_harita_izni_kimlik', { p_id: token })
    : await supabase.rpc('paylasim_harita_izni', { p_token: token });
  if (error) return false;
  return data === true;
}

/** "Seyahatime al" (KK6): tarihsiz yeni seyahat kurar, kimliğini döndürür. P0002: link bu arada kapandı. */
export function usePaylasimdanAl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = kimlikMi(token)
        ? await supabase.rpc('paylasimdan_al_kimlik', { p_id: token })
        : await supabase.rpc('paylasimdan_al', { p_token: token });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seyahatler'] }),
  });
}

export { aliciBasligi } from './baslik';

/** Durak satırı (Ürün kararı 9): adı varsa "Ad" / "Müze · 45 dk"; yoksa "Durak 3" / "Kafe". */
export function durakSatiri(d: PaylasimDuragi, sira: number): { ust: string; alt: string } {
  const tur = kategoriEtiketi(d.tur);
  if (d.ad) return { ust: d.ad, alt: d.dakika ? `${tur} · ${sureMetni(d.dakika)}` : tur };
  return { ust: t('paylasim.durakNo', { n: sira }), alt: tur };
}

// ---------------------------------------------------------------- giriş sonrası dönüş

const BEKLEYEN = 'paylasim:bekleyen';

/** Girişsiz "Seyahatime al": giriş tamamlanınca ana sayfa bu linke döner ("Giriş yapınca bu geziye geri dönersin"). */
export async function bekleyenPaylasimiYaz(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BEKLEYEN, token);
  } catch {
    // depolama yoksa kullanıcı linki yeniden açar
  }
}
export async function bekleyenPaylasimiOku(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BEKLEYEN);
  } catch {
    return null;
  }
}
export async function bekleyenPaylasimiSil(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BEKLEYEN);
  } catch {
    // sessiz
  }
}
