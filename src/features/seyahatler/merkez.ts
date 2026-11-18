// #318 inceleme 4: seyahat merkezi (trips.lat/lng) 30 günde yenilenemeyip boşaldıysa harita Türkiye ortasında açılmasın.
// Merkez boşsa `city_place_id` ile places-light (`sehir: true`) bir kez sorulur ve konum yalnız bellekte kullanılır: DB'ye
// yazılmaz, cihazdaki kalıcı önbelleğe de girmez (anahtar `kaliciOnbellek` izin listesinde değil). Google'a etki: yalnız
// merkezi boşalmış seyahatte, ekran oturumu başına 1 Place Details (Pro, şehir maskesi); merkez doluysa 0.
import { useQuery } from '@tanstack/react-query';

import { birKezDene, hafifYerler } from '@/features/yerler/api';
import { konumu, type KonumNoktasi } from '@/lib/konum';

type MerkezKaynagi = { lat: number | null; lng: number | null; city_place_id?: string | null };

/** Saf seçim: kayıtlı merkez varsa o; yoksa canlı şehir konumu; o da yoksa null. */
export function seyahatMerkeziSec(seyahat: MerkezKaynagi, canli: { lat: number | null; lng: number | null } | null | undefined): KonumNoktasi | null {
  return konumu(seyahat) ?? konumu(canli);
}

/** Canlı şehir konumu gerekiyor mu (merkez boş, şehir kimliği var). */
export const canliMerkezGerekli = (seyahat: MerkezKaynagi) => !konumu(seyahat) && !!seyahat.city_place_id;

/** Seyahat merkezi: kayıtlıysa o (istek yok); boşsa şehir kimliğinden anlık konum. Gelene kadar null. */
export function useSeyahatMerkezi(seyahat: MerkezKaynagi): KonumNoktasi | null {
  const gerekli = canliMerkezGerekli(seyahat);
  const canli = useQuery({
    queryKey: ['seyahat-merkezi', seyahat.city_place_id],
    enabled: gerekli,
    staleTime: Infinity,
    retry: birKezDene,
    queryFn: async () => {
      const [yer] = await hafifYerler([seyahat.city_place_id!], { sehir: true });
      return yer ? { lat: yer.lat, lng: yer.lng } : null;
    },
  });
  return seyahatMerkeziSec(seyahat, gerekli ? canli.data : null);
}
