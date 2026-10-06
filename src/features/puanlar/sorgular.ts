// #45: tamamlanan durak puanları (stop_ratings). #47: gezgin ipuçları ve hızlı etiketler kaldırıldı.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';

export const PUAN_ETIKETLERI = ['sakin', 'sabah', 'kalabalik', 'fotograf', 'tekrar'] as const;
export type PuanEtiketi = (typeof PUAN_ETIKETLERI)[number];

export type Puan = {
  id: string;
  trip_id: string;
  place_ref: string;
  user_id: string;
  stars: number;
  tags: PuanEtiketi[];
  note: string | null;
  created_at: string;
};

/** Seyahatin tüm puanları (RLS üye süzer); kendi puanını bulmak için place_ref + user_id. */
export function usePuanlar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['puanlar', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('stop_ratings').select('*').eq('trip_id', seyahatId!);
      if (error) throw error;
      return data as Puan[];
    },
  });
}

/** Üye başına mekan başına tek kayıt: (place_ref, user_id) üzerinde upsert. */
export function usePuanKaydet(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    // #47 E15: hızlı etiketler UI'dan çıktı; tags sütunu boş yazılır.
    mutationFn: async (p: { place_ref: string; stars: number; note: string | null }) => {
      const { error } = await supabase
        .from('stop_ratings')
        .upsert({ trip_id: seyahatId, ...p, tags: [], note: p.note?.trim() || null }, { onConflict: 'place_ref,user_id' });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['puanlar', seyahatId] }),
  });
}


/** Google'da yorum yazma derin linki. */
export function googleYorumLinki(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
