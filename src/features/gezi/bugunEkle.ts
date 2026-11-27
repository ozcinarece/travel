// #308 KK5 boş gün + #532 KK2–KK4: bir yer artıyla bir günün sonuna eklenir. Listede olmayan (rehber ya da il listesi) yer
// önce seyahatin listesine (`useYereEkle`, yer_eklendi olayı), sonra günün sonuna durak olarak (`useDuragaAta`); listede olan
// yer doğrudan durak olur. Google'a istek yok; koordinat ve tür bizim içerikten ya da listeden.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDuragaAta } from '@/features/gunler/sorgular';
import { useYereEkle } from '@/features/icerik/yerEkle';
import { supabase } from '@/lib/supabase';
import type { Durak, Mekan } from '@/lib/tipler';

/** Listede olmayan yer: içerikten (rehber `yerId` ile, il listesi `yerId` null). */
export type IcerikYeri = { place_id: string; yerId: string | null; primary_type: string | null; lat: number; lng: number };

export async function listedekiMekan(seyahatId: string, placeId: string): Promise<Mekan> {
  const { data, error } = await supabase.from('places').select('*').eq('trip_id', seyahatId).eq('place_id', placeId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('mekan bulunamadı');
  return data as Mekan;
}

export function useGuneEkle(seyahatId: string) {
  const yereEkle = useYereEkle();
  const ata = useDuragaAta(seyahatId);
  return useMutation({
    mutationFn: async ({ mekan, yer, gunId, gunDuraklari }: { mekan?: Mekan; yer?: IcerikYeri; gunId: string; gunDuraklari: Durak[] }) => {
      let hedef = mekan;
      if (!hedef) {
        if (!yer) throw new Error('yer yok');
        await yereEkle.mutateAsync({ seyahatId, yerId: yer.yerId, place_id: yer.place_id, primary_type: yer.primary_type, lat: yer.lat, lng: yer.lng });
        hedef = await listedekiMekan(seyahatId, yer.place_id);
      }
      await ata.mutateAsync({ mekan: hedef, gunId, mevcut: undefined, gunDuraklari });
    },
  });
}

/** #579 KK3: "Geri al"ın geri aldığı ekleme — eklenen durak ve mekan satırı bu eylemle mi oluştu. */
export type GunEklemesi = { mekanId: string; gunId: string; orderKey: string; yeniMekan: boolean };

/**
 * #579 KK3 · inceleme 1: Yer ekle'de bugüne eklemenin geri alınması. Yalnız bu eylemin oluşturduğu durak silinir; mekan satırı
 * ancak bu eylem eklediyse (başkasının eklediği yer ve onun durakları kalır).
 */
export function useGunEklemesiniGeriAl(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: GunEklemesi) => {
      const durak = await supabase.from('stops').delete().eq('trip_id', seyahatId).eq('day_id', e.gunId).eq('place_ref', e.mekanId).eq('order_key', e.orderKey);
      if (durak.error) throw durak.error;
      if (!e.yeniMekan) return;
      const mekan = await supabase.from('places').delete().eq('id', e.mekanId);
      if (mekan.error) throw mekan.error;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] });
      void qc.invalidateQueries({ queryKey: ['mekanlar', seyahatId] });
    },
  });
}
