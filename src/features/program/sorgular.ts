// PRD 3.7 Program: yürüyüş matrisi (route-matrix), durak/gün güncellemeleri, değişiklik akışı (KK9).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Degisiklik } from '@/lib/tipler';
import type { YuruyusKaynagi } from '@/schedule/program';
import type { BacakSecimi } from '@/schedule/tempo';

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
  /** #101: araba yolu (kodlu); `polyline` her zaman yürüme yolu. */
  drive_polyline?: string | null;
};
export type RotaHaritasi = Record<string, RotaBacagi>;

/** #101 KK1: bacak çifti → elle seçim. Anahtar `from>to` (matris anahtarları: place_id | stay:<id>). */
export type BacakModlari = Map<string, BacakSecimi>;
export const bacakAnahtari = (fromKey: string, toKey: string) => `${fromKey}>${toKey}`;

/**
 * §5.1 / T9: gün bazlı yürüyüş matrisi. Edge Function walk_cache'ten okur, eksikleri Google'dan alır (≤ 30 gün).
 * İstemci 1 saat önbellekler; nokta kümesi değişince yalnız eksikler sorulur (sunucu tarafında).
 */
export function useYuruyusMatrisi(seyahatId: string | undefined, noktalar: MatrisNoktasi[], ag = true) {
  const { session } = useOturum();
  const sirali = [...noktalar].sort((a, b) => a.key.localeCompare(b.key));
  const anahtar = sirali.map((n) => n.key).join('|');
  const sorgu = useQuery({
    queryKey: ['yuruyus', seyahatId, anahtar],
    // #181 KK13: `ag` kapalıysa yalnız önbellekteki matris okunur (istek yok; Gezi sayfası).
    enabled: ag && !!session && !!seyahatId && sirali.length >= 2,
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
  return { yuruyus, yukleniyor: ag && sorgu.isPending && sirali.length >= 2, hata: sorgu.isError, eksik: !!sorgu.data?.eksik };
}

/**
 * #33: seçili günün bacakları için gerçek yol (route-legs: computeRoutes WALK, 40 dk üstünde DRIVE).
 * `bacaklar` sırayla otel → 1 → … → otel; sunucu önbellekten (walk_cache.polyline) okur, yalnız eksikleri Google'a sorar.
 * İstemci 1 saat önbellekler; sıra değişince anahtar değişir, sunucu yalnız yeni bacakları ister.
 */
export function useRotaBacaklari(seyahatId: string | undefined, bacaklar: { from: MatrisNoktasi; to: MatrisNoktasi }[], arac = false, ag = true) {
  const { session } = useOturum();
  const temiz = bacaklar.filter((b) => b.from.key !== b.to.key).slice(0, 12);
  const anahtar = temiz.map((b) => `${b.from.key}>${b.to.key}`).join('|');
  const sorgu = useQuery({
    // #101 KK4: `arac` = tek bacak için araba yolu da (seçici açılınca; 24 sa önbellek). #181 KK13: `ag` kapalı → yalnız önbellek.
    queryKey: ['rota', seyahatId, anahtar, arac ? 'arac' : ''],
    enabled: ag && !!session && !!seyahatId && temiz.length >= 1,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ bacaklar: RotaBacagi[]; eksik?: boolean }>('route-legs', {
        body: { trip_id: seyahatId, bacaklar: temiz, ...(arac ? { arac: true } : {}) },
      });
      if (error) throw error;
      const harita: RotaHaritasi = {};
      for (const b of data?.bacaklar ?? []) harita[`${b.from_key}>${b.to_key}`] = b;
      return { harita, eksik: !!data?.eksik };
    },
  });
  return { rotalar: sorgu.data?.harita ?? BOS_ROTA, yukleniyor: ag && sorgu.isPending && temiz.length >= 1, hata: sorgu.isError };
}
const BOS_ROTA: RotaHaritasi = {};

/**
 * Yürüyüş matrisi + gerçek bacaklar → programHesapla kaynağı: yürüyüş süresi matristen (yoksa bacağın kendi WALK değeri),
 * araç süresi varsa `taksi` (otomatik > 40 dk, istenmiş ya da seçilmiş bacak); #101: elle seçim `secim` ile taşınır.
 */
export function bacakKaynagi(yuruyus: YuruyusKaynagi, rotalar: RotaHaritasi, modlar?: BacakModlari): YuruyusKaynagi {
  return (a, b) => {
    const cift = bacakAnahtari(a, b);
    const r = rotalar[cift];
    const w = yuruyus(a, b) ?? (r ? { sn: r.seconds, m: r.meters } : null);
    const secim = modlar?.get(cift) ?? null;
    if (!w) return null;
    const taksi = r && r.drive_seconds ? { sn: r.drive_seconds, m: r.drive_meters ?? 0 } : null;
    return { sn: w.sn, m: w.m, taksi, secim };
  };
}

/** #101 KK6: seyahatin bacak seçimleri (çift bazlı). */
export function useBacakModlari(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['bacak-modlari', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BacakModlari> => {
      const { data, error } = await supabase.from('bacak_modlari').select('from_key, to_key, mod').eq('trip_id', seyahatId!);
      if (error) throw error;
      return new Map((data as { from_key: string; to_key: string; mod: BacakSecimi }[]).map((x) => [bacakAnahtari(x.from_key, x.to_key), x.mod]));
    },
  });
}

/** #101: bacak seçimini yaz — `otomatik` satırı siler; iyimser; rota sorgusu yenilenir (araba yolu sunucudan gelir). */
export function useBacakModuKaydet(seyahatId: string) {
  const qc = useQueryClient();
  const anahtar = ['bacak-modlari', seyahatId];
  return useMutation({
    mutationFn: async ({ from, to, mod }: { from: string; to: string; mod: BacakSecimi | 'otomatik' }) => {
      const { error } =
        mod === 'otomatik'
          ? await supabase.from('bacak_modlari').delete().match({ trip_id: seyahatId, from_key: from, to_key: to })
          : await supabase.from('bacak_modlari').upsert({ trip_id: seyahatId, from_key: from, to_key: to, mod }, { onConflict: 'trip_id,from_key,to_key' });
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: anahtar });
      const onceki = qc.getQueryData<BacakModlari>(anahtar) ?? new Map();
      const yeni = new Map(onceki);
      if (v.mod === 'otomatik') yeni.delete(bacakAnahtari(v.from, v.to));
      else yeni.set(bacakAnahtari(v.from, v.to), v.mod);
      qc.setQueryData(anahtar, yeni);
      return { onceki };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(anahtar, ctx.onceki);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: anahtar });
      qc.invalidateQueries({ queryKey: ['rota', seyahatId] });
    },
  });
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

/** Matris noktaları: günlerin otelleri (stay:<id>, #56) + durakların mekanları (place_id). */
export function matrisNoktalari(oteller: MatrisNoktasi[], mekanlar: { place_id: string; lat: number; lng: number }[]): MatrisNoktasi[] {
  const n: MatrisNoktasi[] = [];
  for (const o of oteller) if (!n.some((x) => x.key === o.key)) n.push({ key: o.key, lat: o.lat, lng: o.lng });
  for (const m of mekanlar) n.push({ key: m.place_id, lat: m.lat, lng: m.lng });
  return n;
}

/**
 * #140 KK9: konumla yazılan varışlar gezi bitince silinir (migration 20261025: günlük zamanlayıcı). Zamanlayıcı yoksa ya da
 * henüz çalışmadıysa bitmiş seyahatin Program'ı açılınca o seyahat için bir kez istenir; hata sessiz.
 */
export async function varislariTemizle(seyahatId: string): Promise<number> {
  const { data, error } = await supabase.rpc('gecmis_varislari_temizle', { t: seyahatId });
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}
