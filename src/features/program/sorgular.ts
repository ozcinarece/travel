// PRD 3.7 Program: yürüyüş matrisi (route-matrix), durak/gün güncellemeleri, değişiklik akışı (KK9).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Konum } from '@/components/harita/tipler';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Degisiklik } from '@/lib/tipler';
import type { YuruyusKaynagi } from '@/schedule/program';

export type MatrisNoktasi = { key: string; lat: number; lng: number };
type Bacak = { from_key: string; to_key: string; seconds: number; meters: number };

/** #33: route-legs cevabı — gerçek yol; `mode` DRIVE ise polyline araç yolu, drive_* araç süresi. */
export type RotaBacagi = {
  from_key: string;
  to_key: string;
  seconds: number;
  meters: number;
  mode: 'WALK' | 'DRIVE';
  polyline: string;
  drive_seconds: number | null;
  drive_meters: number | null;
};
export type RotaHaritasi = Record<string, RotaBacagi>;

/**
 * §5.1 / T9: gün bazlı yürüyüş matrisi. Edge Function walk_cache'ten okur, eksikleri Google'dan alır (≤ 30 gün).
 * İstemci 1 saat önbellekler; nokta kümesi değişince yalnız eksikler sorulur (sunucu tarafında).
 */
export function useYuruyusMatrisi(seyahatId: string | undefined, noktalar: MatrisNoktasi[]) {
  const { session } = useOturum();
  const sirali = [...noktalar].sort((a, b) => a.key.localeCompare(b.key));
  const anahtar = sirali.map((n) => n.key).join('|');
  const sorgu = useQuery({
    queryKey: ['yuruyus', seyahatId, anahtar],
    enabled: !!session && !!seyahatId && sirali.length >= 2,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ bacaklar: Bacak[]; eksik?: boolean }>('route-matrix', {
        body: { trip_id: seyahatId, noktalar: sirali },
      });
      if (error) throw error;
      const harita: Record<string, { sn: number; m: number }> = {};
      for (const b of data?.bacaklar ?? []) harita[`${b.from_key}>${b.to_key}`] = { sn: b.seconds, m: b.meters };
      return { harita, eksik: !!data?.eksik };
    },
  });
  const yuruyus: YuruyusKaynagi = (a, b) => sorgu.data?.harita[`${a}>${b}`] ?? null;
  return { yuruyus, yukleniyor: sorgu.isPending && sirali.length >= 2, hata: sorgu.isError, eksik: !!sorgu.data?.eksik };
}

/**
 * #33: seçili günün bacakları için gerçek yol (route-legs: computeRoutes WALK, 40 dk üstünde DRIVE).
 * `bacaklar` sırayla otel → 1 → … → otel; sunucu önbellekten (walk_cache.polyline) okur, yalnız eksikleri Google'a sorar.
 * İstemci 1 saat önbellekler; sıra değişince anahtar değişir, sunucu yalnız yeni bacakları ister.
 */
export function useRotaBacaklari(seyahatId: string | undefined, bacaklar: { from: MatrisNoktasi; to: MatrisNoktasi }[]) {
  const { session } = useOturum();
  const temiz = bacaklar.filter((b) => b.from.key !== b.to.key).slice(0, 12);
  const anahtar = temiz.map((b) => `${b.from.key}>${b.to.key}`).join('|');
  const sorgu = useQuery({
    queryKey: ['rota', seyahatId, anahtar],
    enabled: !!session && !!seyahatId && temiz.length >= 1,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ bacaklar: RotaBacagi[]; eksik?: boolean }>('route-legs', {
        body: { trip_id: seyahatId, bacaklar: temiz },
      });
      if (error) throw error;
      const harita: RotaHaritasi = {};
      for (const b of data?.bacaklar ?? []) harita[`${b.from_key}>${b.to_key}`] = b;
      return { harita, eksik: !!data?.eksik };
    },
  });
  return { rotalar: sorgu.data?.harita ?? BOS_ROTA, yukleniyor: sorgu.isPending && temiz.length >= 1, hata: sorgu.isError };
}
const BOS_ROTA: RotaHaritasi = {};

/**
 * Yürüyüş matrisi + gerçek bacaklar → programHesapla kaynağı: yürüyüş süresi matristen (yoksa bacağın kendi WALK değeri),
 * DRIVE bacağında araç süresi `taksi` olarak eklenir.
 */
export function bacakKaynagi(yuruyus: YuruyusKaynagi, rotalar: RotaHaritasi): YuruyusKaynagi {
  return (a, b) => {
    const r = rotalar[`${a}>${b}`];
    const w = yuruyus(a, b) ?? (r ? { sn: r.seconds, m: r.meters } : null);
    if (!w) return null;
    const taksi = r && r.mode === 'DRIVE' && r.drive_seconds ? { sn: r.drive_seconds, m: r.drive_meters ?? 0 } : null;
    return { sn: w.sn, m: w.m, taksi };
  };
}

/** Sıralı noktalardan bacak listesi: [p0→p1, p1→p2, …]. */
export function bacakListesi(noktalar: MatrisNoktasi[]): { from: MatrisNoktasi; to: MatrisNoktasi }[] {
  const b: { from: MatrisNoktasi; to: MatrisNoktasi }[] = [];
  for (let i = 1; i < noktalar.length; i++) b.push({ from: noktalar[i - 1], to: noktalar[i] });
  return b;
}

export function useDurakGuncelle(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...alanlar
    }: {
      id: string;
      minutes?: number;
      skipped?: boolean;
      arrived_at?: string | null;
      arrived_by?: string | null;
      completed_at?: string | null;
      completed_by?: string | null;
      auto_completed?: boolean;
      day_id?: string;
      order_key?: string;
    }) => {
      const { error } = await supabase.from('stops').update(alanlar).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
  });
}

/** Birden çok durağın sıra anahtarını tek seferde yazar (T7: otomatik sıralama ya da sürükleme). */
export function useSiraYaz(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guncellemeler: { id: string; order_key: string }[]) => {
      for (const g of guncellemeler) {
        const { error } = await supabase.from('stops').update({ order_key: g.order_key }).eq('id', g.id);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
  });
}

export function useGunGuncelle(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...alanlar }: { id: string; start_time?: string | null; end_time?: string | null; order_manual?: boolean }) => {
      const { error } = await supabase.from('days').update(alanlar).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['gunler', seyahatId] }),
  });
}

/** 3.7 KK9: son 10 değişiklik (changes tetikleyiciyle yazılır, RLS üye süzer). */
export function useDegisiklikler(seyahatId: string | undefined, etkin = true) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['degisiklikler', seyahatId],
    enabled: !!session && !!seyahatId && etkin,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changes')
        .select('id, user_id, entity, entity_id, field, old, new, at')
        .eq('trip_id', seyahatId!)
        .order('at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Degisiklik[];
    },
  });
}

/** Matris noktaları: otel ('hotel') + durakların mekanları (place_id). */
export function matrisNoktalari(otel: Konum | null, mekanlar: { place_id: string; lat: number; lng: number }[]): MatrisNoktasi[] {
  const n: MatrisNoktasi[] = otel ? [{ key: 'hotel', lat: otel.lat, lng: otel.lng }] : [];
  for (const m of mekanlar) n.push({ key: m.place_id, lat: m.lat, lng: m.lng });
  return n;
}
