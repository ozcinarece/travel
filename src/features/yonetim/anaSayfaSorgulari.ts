// #109 ana sayfa düzeni — taslak bölümler (admin), son yayın, yayınla. Her düzenleme anında taslağa yazılır; uygulama
// yalnız "Yayınla" sonrası görür.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useKesfetAkisi } from '@/features/icerik/kesfetAkisi';
import { supabase } from '@/lib/supabase';

import { yayindakiGeziler, type TaslakBolum } from './anaSayfa';
import { hataVer, useYonetimGezileri, useYonetimSehirleri } from './geziSorgulari';

const TASLAK = ['yonetim', 'ana-sayfa', 'taslak'] as const;
const YAYIN = ['yonetim', 'ana-sayfa', 'yayin'] as const;

export function useTaslakBolumler() {
  return useQuery({
    queryKey: TASLAK,
    queryFn: async () => {
      const { data, error } = await supabase.from('ana_sayfa_bolumleri').select('id, tur, baslik, sira, acik, kaynak, icerik, baslangic_at, bitis_at').order('sira');
      if (error) throw error;
      return data as TaslakBolum[];
    },
  });
}

export type Yayin = { yayinlandi_at: string; bolumler: Record<string, unknown>[] };

export function useSonYayin() {
  return useQuery({
    queryKey: YAYIN,
    queryFn: async () => {
      const { data, error } = await supabase.from('ana_sayfa_yayini').select('yayinlandi_at, bolumler').order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as Yayin | null) ?? null;
    },
  });
}

/** Önizleme: otomatik "Öne çıkan gezi" (görünümle aynı fonksiyon). */
export function useEnCokAlinan() {
  return useQuery({
    queryKey: ['yonetim', 'ana-sayfa', 'en-cok-alinan'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ana_sayfa_en_cok_alinan');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

export function useBolumIslemleri() {
  const qc = useQueryClient();
  const yap = useCallback(
    async <T,>(is: () => Promise<T>): Promise<T> => {
      try {
        return await is();
      } finally {
        await Promise.all([qc.invalidateQueries({ queryKey: TASLAK }), qc.invalidateQueries({ queryKey: YAYIN })]);
      }
    },
    [qc],
  );
  return {
    ekle: (b: Omit<TaslakBolum, 'id'>) => yap(async () => (await hataVer(supabase.from('ana_sayfa_bolumleri').insert(b).select('id').single())) as { id: string }),
    guncelle: (id: string, alanlar: Partial<Omit<TaslakBolum, 'id'>>) => yap(() => hataVer(supabase.from('ana_sayfa_bolumleri').update(alanlar).eq('id', id))),
    sil: (id: string) => yap(() => hataVer(supabase.from('ana_sayfa_bolumleri').delete().eq('id', id))),
    /** KK3 sürükle = sıra: tek upsert deyimi (sıra tekilliği deyim sonunda denetlenir). */
    sirala: (bolumler: TaslakBolum[]) => yap(() => hataVer(supabase.from('ana_sayfa_bolumleri').upsert(bolumler.map((b, i) => ({ ...b, sira: i + 1 }))))),
    /** KK5: taslağı canlıya çıkarır. */
    yayinla: () => yap(async () => (await hataVer(supabase.rpc('ana_sayfa_yayinla'))) as string),
  };
}

/**
 * #438 inceleme 1 ve 6: uygulamanın Keşfet akışı, panelde de yalnız yayındaki gezilerle. Panelde admin taslak gezileri de
 * okur (`geziler_admin`); uygulama yalnız yayındakileri görür (`geziler_select`). Akış yayın durumuna göre süzülür.
 */
export function useYayindakiAkis() {
  const akis = useKesfetAkisi();
  const geziler = useYonetimGezileri();
  const sehirler = useYonetimSehirleri();
  const data = useMemo(
    () => (akis.data && geziler.data && sehirler.data ? yayindakiGeziler(akis.data, geziler.data, sehirler.data) : undefined),
    [akis.data, geziler.data, sehirler.data],
  );
  return {
    data,
    isPending: akis.isPending || geziler.isPending || sehirler.isPending,
    isError: akis.isError || geziler.isError || sehirler.isError,
  };
}
