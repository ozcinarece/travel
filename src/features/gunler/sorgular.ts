// PRD 3.5 Günlere dağıt: days + stops sorgu ve mutasyonları. Yazmalar satır bazlı, son yazan kazanır (§5.5).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import { tarihEkle } from '@/lib/takvim';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { arasindaAnahtar, sonAnahtar } from '@/schedule/sira';

export function useGunler(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['gunler', seyahatId],
    enabled: !!session && !!seyahatId,
    queryFn: async () => {
      const { data, error } = await supabase.from('days').select('*').eq('trip_id', seyahatId!).order('index');
      if (error) throw error;
      return data as Gun[];
    },
  });
}

export function useDuraklar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['duraklar', seyahatId],
    enabled: !!session && !!seyahatId,
    queryFn: async () => {
      const { data, error } = await supabase.from('stops').select('*').eq('trip_id', seyahatId!).order('order_key');
      if (error) throw error;
      return data as Durak[];
    },
  });
}

/**
 * 3.5 KK2: mekanı güne atar. Zaten başka güne atanmışsa günü değiştirir (place_ref tekil);
 * süre mekanın §6 varsayılanı. Sıra: günün sonuna; `ekleIndeksi` verilirse (T7, elle sıralanmış gün) o noktaya.
 */
export function useDuragaAta(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      mekan,
      gunId,
      mevcut,
      gunDuraklari,
      ekleIndeksi,
    }: {
      mekan: Mekan;
      gunId: string;
      mevcut: Durak | undefined;
      gunDuraklari: Durak[];
      ekleIndeksi?: number;
    }) => {
      const sirali = [...gunDuraklari].sort((a, b) => (a.order_key < b.order_key ? -1 : 1));
      const order_key =
        ekleIndeksi === undefined ? sonAnahtar(sirali.map((d) => d.order_key)) : arasindaAnahtar(sirali[ekleIndeksi - 1]?.order_key, sirali[ekleIndeksi]?.order_key);
      if (mevcut) {
        const { error } = await supabase.from('stops').update({ day_id: gunId, order_key }).eq('id', mevcut.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('stops').insert({
        trip_id: seyahatId,
        day_id: gunId,
        place_ref: mekan.id,
        order_key,
        minutes: mekan.default_minutes,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
  });
}

/** 3.5 KK2: aynı pine tekrar dokununca atama kalkar ("?"). */
export function useDurakKaldir(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (durakId: string) => {
      const { error } = await supabase.from('stops').delete().eq('id', durakId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
  });
}

/** 3.5 KK7: gün ekle — index = son + 1; tarihli seyahatte tarih sırayı izler. */
export function useGunEkle(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gunler, startDate }: { gunler: Gun[]; startDate: string | null }) => {
      const index = (gunler[gunler.length - 1]?.index ?? 0) + 1;
      const { error } = await supabase.from('days').insert({
        trip_id: seyahatId,
        index,
        date: startDate ? tarihEkle(startDate, index - 1) : null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['gunler', seyahatId] }),
  });
}

/**
 * 3.5 KK7: gün sil — durakları boşa düşer (stops cascade), sonraki günlerin index'i bir geri kayar
 * (unique (trip_id, index) ertelenmiş; tek istek içinde sıra değişimi güvenli değil, bu yüzden büyükten küçüğe).
 */
export function useGunSil(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gun, gunler, startDate }: { gun: Gun; gunler: Gun[]; startDate: string | null }) => {
      const { error } = await supabase.from('days').delete().eq('id', gun.id);
      if (error) throw error;
      const sonrakiler = gunler.filter((g) => g.index > gun.index).sort((a, b) => a.index - b.index);
      for (const g of sonrakiler) {
        const yeni = g.index - 1;
        const { error: e2 } = await supabase
          .from('days')
          .update({ index: yeni, date: startDate ? tarihEkle(startDate, yeni - 1) : null })
          .eq('id', g.id);
        if (e2) throw e2;
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['gunler', seyahatId] });
      qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] });
    },
  });
}
