// #157 genel bakış — `yonetim_genel` (admin; 10 dk önbellek). Olay yoksa parça `olay_var: false` (panel "veri bekleniyor").
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { Donem, Genel } from './genelBakis';

const ON_DAKIKA = 10 * 60 * 1000;

export function useGenelBakis(donem: Donem) {
  return useQuery({
    queryKey: ['yonetim', 'genel', donem],
    staleTime: ON_DAKIKA,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('yonetim_genel', { p_gun: donem });
      if (error) throw error;
      return data as Genel;
    },
  });
}
