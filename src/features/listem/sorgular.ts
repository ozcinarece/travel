// #141 Listem: oylar (KK3) ve değişiklik geri alma (KK6).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Oy } from '@/lib/tipler';

export function useOylar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['oylar', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('oylar').select('mekan, kullanici').eq('seyahat_id', seyahatId!);
      if (error) throw error;
      return data as Oy[];
    },
  });
}

/** 👍 aç / kapa — iyimser: sayı ve dolu düğme anında, sunucu yanıtıyla doğrulanır. */
export function useOyVer(seyahatId: string) {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async ({ mekan, ver }: { mekan: string; ver: boolean }) => {
      const { error } = ver
        ? await supabase.from('oylar').insert({ seyahat_id: seyahatId, mekan })
        : await supabase.from('oylar').delete().eq('mekan', mekan).eq('kullanici', session!.user.id);
      if (error) throw error;
    },
    onMutate: async ({ mekan, ver }) => {
      const ben = session?.user.id;
      if (!ben) return;
      await qc.cancelQueries({ queryKey: ['oylar', seyahatId] });
      qc.setQueryData<Oy[]>(['oylar', seyahatId], (eski = []) => (ver ? [...eski.filter((o) => !(o.mekan === mekan && o.kullanici === ben)), { mekan, kullanici: ben }] : eski.filter((o) => !(o.mekan === mekan && o.kullanici === ben))));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['oylar', seyahatId] }),
  });
}

/** KK6: Son değişiklikler · Geri al — sunucu aynı işlemdeki alanları / bağlı durakları birlikte geri yazar. */
export function useDegisikligiGeriAl(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('degisikligi_geri_al', { c: id });
      if (error) throw error;
    },
    onSettled: () =>
      Promise.all(
        ['mekanlar', 'duraklar', 'gunler', 'degisiklikler', 'oylar', 'harcamalar', 'odesmeler'].map((k) => qc.invalidateQueries({ queryKey: [k, seyahatId] })),
      ),
  });
}
