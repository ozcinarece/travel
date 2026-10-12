// #110 genel bakış — `yonetim_ozet` (admin; KK5 10 dk önbellek) ve Sentry özeti (`sentry-ozet` Edge Function).
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { Ozet } from './genelBakis';

const ON_DAKIKA = 10 * 60 * 1000;

export function useGenelBakis(gun: number) {
  return useQuery({
    queryKey: ['yonetim', 'genel', gun],
    staleTime: ON_DAKIKA,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('yonetim_ozet', { p_gun: gun });
      if (error) throw error;
      return data as Ozet;
    },
  });
}

export type SentryOzeti = { bagli: false } | { bagli: true; hata: number };

/** KK4: son 24 saatteki Sentry hata sayısı; secret'lar yoksa `bagli: false`. */
export function useSentryOzeti() {
  return useQuery({
    queryKey: ['yonetim', 'genel', 'sentry'],
    staleTime: ON_DAKIKA,
    retry: false,
    queryFn: async (): Promise<SentryOzeti> => {
      const { data, error } = await supabase.functions.invoke<SentryOzeti>('sentry-ozet', { body: {} });
      if (error) throw error;
      return data ?? { bagli: false };
    },
  });
}
