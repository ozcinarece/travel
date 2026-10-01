import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { SeyahatOzet, YeniSeyahat } from '@/lib/tipler';

/** Üyesi olunan seyahatler (RLS süzer) + üyeler + mekan sayısı. Aktif/yaklaşan/geçmiş ayrımı ekranda (3.1). */
export function useSeyahatler() {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['seyahatler'],
    enabled: hesapli,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(
          'id, city_label, start_date, end_date, tz, hotel_place_id, created_at, members(user_id, role, display_name, guest), places(count)',
        )
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SeyahatOzet[];
    },
  });
}

/**
 * PRD 3.2 KK3: seyahati oluşturur; sahip üyeliği ve günler tetikleyiciyle gelir.
 * Google'dan yalnızca place_id, konum, tz ve ülke kodu yazılır (PRD §7); şehir adı düzenlenebilir etikettir.
 */
export function useSeyahatOlustur() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (yeni: YeniSeyahat) => {
      if (!session) throw new Error('oturum yok');
      const { data, error } = await supabase
        .from('trips')
        .insert({
          owner_id: session.user.id,
          city_place_id: yeni.sehir.place_id,
          city_label: yeni.sehir.ad.slice(0, 80),
          country_code: yeni.sehir.country_code,
          lat: yeni.sehir.lat,
          lng: yeni.sehir.lng,
          tz: yeni.sehir.tz,
          start_date: yeni.start_date,
          end_date: yeni.end_date,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seyahatler'] }),
  });
}
