// #407 Arkadaşlar sekmesi (kanvas `Ana_v6_Arkadaslar`): kişi satırı (birlikte gezdiklerin), açık paylaşımların akışı ve ♥.
// Okuma yalnız sunucudaki `security definer` fonksiyonlarla (KK3); token akışta yok, kart alıcı ekranını kimlikle açar.
// Google'a istek yok.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { KisiKipi } from '@/features/paylasim/baslik';
import { supabase } from '@/lib/supabase';

export type Arkadas = { user_id: string; ad: string; foto: string | null };

export type ArkadasPaylasimi = {
  id: string;
  paylasan: string;
  paylasan_ad: string | null;
  sehir: string;
  ad: string | null;
  olusturuldu: string;
  gun_sayisi: number;
  durak_sayisi: number;
  kisi_sayisi: number;
  kisi_kip: KisiKipi;
  begeni_sayisi: number;
  begendim: boolean;
};

const KISILER = ['arkadaslarim'] as const;
const AKIS = ['arkadas_paylasimlari'] as const;

export function useArkadaslarim(etkin = true) {
  return useQuery({
    queryKey: KISILER,
    enabled: etkin,
    queryFn: async (): Promise<Arkadas[]> => {
      const { data, error } = await supabase.rpc('arkadaslarim');
      if (error) throw error;
      return (data as Arkadas[] | null) ?? [];
    },
  });
}

export function useArkadasPaylasimlari(etkin = true) {
  return useQuery({
    queryKey: AKIS,
    enabled: etkin,
    queryFn: async (): Promise<ArkadasPaylasimi[]> => {
      const { data, error } = await supabase.rpc('arkadas_paylasimlari');
      if (error) throw error;
      return (data as ArkadasPaylasimi[] | null) ?? [];
    },
  });
}

/** KK3b: ♥ kişi başına bir kez; ikinci dokunuş geri alır. Önbellek hemen güncellenir, hata olursa geri döner. */
export function useBegeni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, begen }: { id: string; begen: boolean }) => {
      const { error } = begen
        ? await supabase.from('paylasim_begeni').insert({ paylasim_id: id })
        : await supabase.from('paylasim_begeni').delete().eq('paylasim_id', id);
      // 23505: zaten beğenilmiş (başka cihazdan) — sonuç aynı.
      if (error && error.code !== '23505') throw error;
    },
    onMutate: async ({ id, begen }) => {
      await qc.cancelQueries({ queryKey: AKIS });
      const onceki = qc.getQueryData<ArkadasPaylasimi[]>(AKIS);
      qc.setQueryData<ArkadasPaylasimi[]>(AKIS, (liste) =>
        liste?.map((p) => (p.id === id && p.begendim !== begen ? { ...p, begendim: begen, begeni_sayisi: Math.max(0, p.begeni_sayisi + (begen ? 1 : -1)) } : p)),
      );
      return { onceki };
    },
    onError: (_e, _d, baglam) => {
      if (baglam?.onceki) qc.setQueryData(AKIS, baglam.onceki);
    },
  });
}
