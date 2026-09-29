import { useQuery } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { SeyahatOzet } from '@/lib/tipler';

/** Üyesi olunan seyahatler (RLS süzer). Sıralama 3.1 KK1–KK3'te ekranda yapılır. */
export function useSeyahatler() {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['seyahatler'],
    enabled: hesapli,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, city_label, start_date, end_date, tz')
        .order('start_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as SeyahatOzet[];
    },
  });
}
