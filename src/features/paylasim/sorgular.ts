// #432 2/3 (KK2, KK3, KK8): "Geziyi paylaş" çekmecesinin verisi. Link `gezi_paylasim` satırıdır (1/3); RLS yalnız oluşturanın
// kendi linkini gösterir. Kişi başına seyahat başına tek açık link: "Linki gönder" açık link varsa aynısını gönderir.
// Token, sayaç ve oluşturan alanını istemci yazamaz; yalnız `acik` değişir (#510: kişi adları anahtarı kalktı, adlar hep gizli).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform, Share } from 'react-native';

import { olayYaz } from '@/features/icerik/sorgular';
import { davetLinki } from '@/lib/davetLinki';
import { supabase } from '@/lib/supabase';

export type GeziPaylasimi = { id: string; token: string; acilma_sayisi: number };

const anahtar = (tripId: string) => ['gezi_paylasim', tripId] as const;

/** Seyahatte benim açık linkim (yoksa null). */
export function useAcikPaylasim(tripId: string, etkin: boolean) {
  return useQuery({
    queryKey: anahtar(tripId),
    enabled: etkin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gezi_paylasim')
        .select('id, token, acilma_sayisi')
        .eq('trip_id', tripId)
        .eq('acik', true)
        .maybeSingle();
      if (error) throw error;
      return (data as GeziPaylasimi | null) ?? null;
    },
  });
}

/** #517 KK8: paylaşımın açıldığı yer (olay `meta.kaynak`). */
export type PaylasimKaynagi = 'siradaki_adim' | 'menu';

/** Açık link yoksa oluşturur (olay: paylasim_olustu, `meta.kaynak`), varsa döndürür. */
export function usePaylasimOlustur(tripId: string, kaynak: PaylasimKaynagi = 'menu') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GeziPaylasimi> => {
      const { data, error } = await supabase
        .from('gezi_paylasim')
        .insert({ trip_id: tripId })
        .select('id, token, acilma_sayisi')
        .single();
      if (error) throw error;
      const yeni = data as GeziPaylasimi;
      void olayYaz('paylasim_olustu', yeni.id, { kaynak });
      return yeni;
    },
    onSuccess: (yeni) => qc.setQueryData(anahtar(tripId), yeni),
  });
}

/** "Paylaşımı kapat" (kapalı link yeniden açılmaz). */
export function usePaylasimGuncelle(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, degisiklik }: { id: string; degisiklik: { acik: false } }) => {
      const { error } = await supabase.from('gezi_paylasim').update(degisiklik).eq('id', id);
      if (error) throw error;
      return degisiklik;
    },
    onSuccess: () => qc.setQueryData(anahtar(tripId), null),
  });
}

/** https://{alan adı}/r/g/{token} (1/3, Ürün kararı 1). */
export function paylasimLinki(token: string, alanAdi?: string): string {
  return davetLinki(`g/${token}`, alanAdi);
}

/** Sistem paylaşım sayfası (WhatsApp ilk sırada telefonun kendi düzeninde). Web'de navigator.share, yoksa panoya kopyalar. */
export async function linkiGonder(metin: string, link: string): Promise<'paylasildi' | 'kopyalandi' | 'vazgecildi'> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: metin });
        return 'paylasildi';
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(link);
        return 'kopyalandi';
      }
      return 'vazgecildi';
    }
    const r = await Share.share({ message: metin });
    return r.action === Share.dismissedAction ? 'vazgecildi' : 'paylasildi';
  } catch {
    return 'vazgecildi';
  }
}
