// #97 A KK6: tek yer "+" → yaklaşan (ya da aktif) seyahatin listesine; birden çok aday varsa ekran seçtirir.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import { varsayilanDakika } from '@/lib/kategori';
import type { SeyahatOzet } from '@/lib/tipler';

import { olayYaz } from './sorgular';

/** Hedef adayları: aktif + yaklaşan (tarih sırası). */
export function hedefSeyahatler(liste: SeyahatOzet[] | undefined): SeyahatOzet[] {
  if (!liste) return [];
  const { aktif, yaklasan } = siniflandir(liste);
  return [...aktif, ...yaklasan];
}

export type YerEklemeIstegi = { seyahatId: string; yerId: string | null; place_id: string; primary_type: string | null; lat: number; lng: number };

export function useYereEkle() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (y: YerEklemeIstegi) => {
      if (!session) throw new Error('oturum yok');
      const { error } = await supabase.from('places').insert({ trip_id: y.seyahatId, place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng, default_minutes: varsayilanDakika(y.primary_type), added_by: session.user.id });
      if (error && error.code !== '23505') throw error;
      await olayYaz('yer_eklendi', y.yerId, { seyahat: y.seyahatId, place_id: y.place_id });
    },
    onSuccess: (_d, y) => {
      qc.invalidateQueries({ queryKey: ['mekanlar', y.seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
    },
  });
}
