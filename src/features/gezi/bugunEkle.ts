// #308 KK5 boş gün: rehberdeki yer artıyla bugüne eklenir — önce seyahatin listesine (`useYereEkle`, yer_eklendi olayı), sonra
// bugünün sonuna durak olarak (`useDuragaAta`). Google'a istek yok; koordinat ve tür bizim içerikten.
import { useMutation } from '@tanstack/react-query';

import { useDuragaAta } from '@/features/gunler/sorgular';
import { useYereEkle } from '@/features/icerik/yerEkle';
import { supabase } from '@/lib/supabase';
import type { Durak, Mekan, Yer } from '@/lib/tipler';

export function useBugunEkle(seyahatId: string) {
  const yereEkle = useYereEkle();
  const ata = useDuragaAta(seyahatId);
  return useMutation({
    mutationFn: async ({ yer, gunId, gunDuraklari }: { yer: Yer & { place_id: string }; gunId: string; gunDuraklari: Durak[] }) => {
      await yereEkle.mutateAsync({ seyahatId, yerId: yer.id, place_id: yer.place_id, primary_type: yer.kategori, lat: yer.lat, lng: yer.lng });
      const { data, error } = await supabase.from('places').select('*').eq('trip_id', seyahatId).eq('place_id', yer.place_id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('mekan bulunamadı');
      await ata.mutateAsync({ mekan: data as Mekan, gunId, mevcut: undefined, gunDuraklari });
    },
  });
}
