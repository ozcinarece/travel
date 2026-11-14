// #141 Listem: oylar (KK3) ve değişiklik geri alma (KK6).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Durak, Mekan, Oy } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import { dagitimYazimi, type DagitimSecenegi } from './sigmayanlar';

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
        ['mekanlar', 'duraklar', 'gunler', 'degisiklikler', 'sohbet-degisiklikler', 'oylar', 'harcamalar', 'odesmeler'].map((k) => qc.invalidateQueries({ queryKey: [k, seyahatId] })),
      ),
  });
}

/**
 * #200 KK5: Günlere dağıt — seçilen yol (kısalt / uzat / listede kalsın) tek işlemde yazılır ve değişiklik geçmişinde tek kayıttır
 * (gunlere_dagit); "Geri al" hepsini birlikte döndürür. Yeni duraklar günün sonuna, planKur'un gezme sırasıyla eklenir.
 */
export function useGunlereDagit(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ secenek, mekanlar, duraklar }: { secenek: DagitimSecenegi; mekanlar: Mekan[]; duraklar: Durak[] }) => {
      const y = dagitimYazimi(secenek, mekanlar);
      const anahtarlar = new Map<string, string[]>();
      const yeni = y.yeni.map((d) => {
        const onceki = anahtarlar.get(d.gunId) ?? duraklar.filter((x) => x.day_id === d.gunId).map((x) => x.order_key);
        const order_key = sonAnahtar(onceki);
        anahtarlar.set(d.gunId, [...onceki, order_key]);
        return { day_id: d.gunId, place_ref: d.mekanId, order_key, minutes: d.dakika };
      });
      const { error } = await supabase.rpc('gunlere_dagit', {
        p_trip: seyahatId,
        p_duraklar: yeni,
        p_sureler: y.sureler.map((x) => ({ id: x.durakId, minutes: x.dakika })),
        p_bitisler: y.bitisler.map((x) => ({ id: x.gunId, end_time: x.bitis })),
      });
      if (error) throw error;
      return secenek;
    },
    onSettled: () => Promise.all(['duraklar', 'gunler', 'degisiklikler', 'sohbet-degisiklikler'].map((k) => qc.invalidateQueries({ queryKey: [k, seyahatId] }))),
  });
}
