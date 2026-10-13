// #172 KK7–KK8: kendi içeriğimizdeki mekanlar (şehir rehberi, gezi yazısı) — ad, kategori, konum ve bizim fotoğrafımız
// DB'den (`icerik_mekan_bilgileri`: yayınlı yerler + yayınlı içeriğin açtığı taslak yer satırları). Ekran açılırken
// places-light çağrılmaz; Google'a yalnız bizim fotoğrafımız olmayan kartların fotoğrafı için gidilir (Pro foto maskesi,
// kimlik başına bir kez).
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useYerFotolari } from '@/features/yerler/api';
import { icerikFotoUrl } from '@/lib/markdown';
import { supabase } from '@/lib/supabase';

export type IcerikMekani = { place_id: string; ad: string; kategori: string | null; lat: number; lng: number; foto: string | null };
/** BO taslağının bildiği mekanlar (yayından önce; editörün seçtiği ad, kategori, konum). */
export type BilinenMekanlar = Record<string, { ad: string; kategori?: string | null; lat: number; lng: number }>;

type Satir = { place_id: string; ad: string; kategori: string | null; lat: number; lng: number; kapak_url: string | null; foto_yol: string | null };

const GUN_MS = 24 * 60 * 60 * 1000;

export function useIcerikMekanlari(ids: string[], secenek: { kartlar?: string[]; bilinen?: BilinenMekanlar } = {}) {
  const sirali = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const db = useQuery({
    queryKey: ['icerik-mekan', sirali],
    enabled: sirali.length > 0,
    placeholderData: (onceki) => onceki,
    staleTime: GUN_MS,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('icerik_mekan_bilgileri', { p_place_ids: sirali });
      if (error) throw error;
      return new Map(
        ((data ?? []) as Satir[]).map((r) => [
          r.place_id,
          { place_id: r.place_id, ad: r.ad, kategori: r.kategori, lat: r.lat, lng: r.lng, foto: r.kapak_url ?? (r.foto_yol ? icerikFotoUrl(r.foto_yol) : null) } satisfies IcerikMekani,
        ]),
      );
    },
  });
  const { kartlar, bilinen } = secenek;
  const mekanlar = useMemo(() => {
    const m = new Map(db.data ?? []);
    for (const [id, b] of Object.entries(bilinen ?? {})) {
      if (!m.has(id)) m.set(id, { place_id: id, ad: b.ad, kategori: b.kategori ?? null, lat: b.lat, lng: b.lng, foto: null });
    }
    return m;
  }, [db.data, bilinen]);
  // Google fotoğrafı yalnız çizilen kartlar için ve bizimki yoksa; DB cevabı gelmeden istenmez (bizim fotoğrafımız olabilir).
  const hazir = sirali.length === 0 || (db.isFetched && !db.isPlaceholderData);
  const fotoIdleri = useMemo(() => (hazir ? (kartlar ?? []).filter((id) => mekanlar.has(id) && !mekanlar.get(id)!.foto) : []), [hazir, kartlar, mekanlar]);
  const google = useYerFotolari(fotoIdleri);
  return {
    mekan: (id: string) => mekanlar.get(id),
    foto: (id: string) => mekanlar.get(id)?.foto ?? google.data?.get(id) ?? null,
    yukleniyor: sirali.length > 0 && db.isPending,
  };
}
