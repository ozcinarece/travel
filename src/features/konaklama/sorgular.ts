// #56: seyahatin otelleri (stays) ve günlerin başlangıç/bitiş oteli yazımı.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Gun, OtelSecimi } from '@/lib/tipler';

import { otelPlani, ucNoktalari, type GunUcNoktalari, type Konaklama, type OtelKapsami } from './plan';

export function useKonaklamalar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['konaklamalar', seyahatId],
    enabled: !!session && !!seyahatId,
    queryFn: async () => {
      const { data, error } = await supabase.from('stays').select('id, trip_id, place_id, lat, lng, label').eq('trip_id', seyahatId!).order('created_at');
      if (error) throw error;
      return data as Konaklama[];
    },
  });
}

/** Seçim → stays.id: daha önce kullanılan otel (aynı place_id ya da aynı konum) yeniden kullanılır, yoksa eklenir. */
async function konaklamaKimligi(seyahatId: string, secim: OtelSecimi | { stayId: string }, mevcut: Konaklama[]): Promise<string> {
  if ('stayId' in secim) return secim.stayId;
  const ayni = mevcut.find((k) => (secim.place_id && k.place_id === secim.place_id) || (k.lat === secim.lat && k.lng === secim.lng));
  if (ayni) return ayni.id;
  const { data, error } = await supabase
    .from('stays')
    .insert({
      trip_id: seyahatId,
      place_id: secim.place_id,
      lat: secim.lat,
      lng: secim.lng,
      label: secim.ad.slice(0, 80) || null,
      google_fetched_at: secim.place_id ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export type OtelSecimiVeyaKayitli = OtelSecimi | { stayId: string } | null;

/**
 * #56 alt sayfa "Kaydet": günün oteli (ve taşınmada bitiş oteli) — kapsam "yalnız bu gün" / "bu gün ve sonrası".
 * Günler otelPlani ile hesaplanır, yalnız değişenler yazılır.
 */
export function useGunOteliKaydet(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: { gunler: Gun[]; konaklamalar: Konaklama[]; gunId: string; kapsam: OtelKapsami; otel: OtelSecimiVeyaKayitli; bitis?: OtelSecimiVeyaKayitli }) => {
      const otelId = g.otel ? await konaklamaKimligi(seyahatId, g.otel, g.konaklamalar) : null;
      const bitisId = g.bitis === undefined ? undefined : g.bitis ? await konaklamaKimligi(seyahatId, g.bitis, g.konaklamalar) : null;
      for (const u of otelPlani(g.gunler, g.gunId, g.kapsam, otelId, bitisId)) {
        const { error } = await supabase.from('days').update({ start_stay_id: u.start_stay_id, end_stay_id: u.end_stay_id }).eq('id', u.id);
        if (error) throw error;
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['gunler', seyahatId] });
      qc.invalidateQueries({ queryKey: ['konaklamalar', seyahatId] });
    },
  });
}

/** 3.3 Otel ekranı: seçilen otel (ya da otel yok) tüm günlere uygulanır. */
export async function tumGunlereOtel(seyahatId: string, otel: OtelSecimi | null) {
  const [{ data: mevcut, error: e1 }, { data: gunler, error: e2 }] = await Promise.all([
    supabase.from('stays').select('id, trip_id, place_id, lat, lng, label').eq('trip_id', seyahatId),
    supabase.from('days').select('id').eq('trip_id', seyahatId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const id = otel ? await konaklamaKimligi(seyahatId, otel, (mevcut ?? []) as Konaklama[]) : null;
  if ((gunler ?? []).length === 0) return;
  const { error } = await supabase.from('days').update({ start_stay_id: id, end_stay_id: id }).eq('trip_id', seyahatId);
  if (error) throw error;
}

/** #56: tek günün başlangıç / bitiş noktaları (anasayfa "Sıradaki", mekan detayı). */
export function useGunUclari(seyahatId: string | undefined, gun: Gun | undefined): GunUcNoktalari {
  const konaklamalar = useKonaklamalar(seyahatId);
  return useMemo(() => ucNoktalari(gun, new Map((konaklamalar.data ?? []).map((k) => [k.id, k]))), [gun, konaklamalar.data]);
}

/** Matris için uç noktalar listesi (yoksa boş). */
export function ucListesi(u: GunUcNoktalari): { key: string; lat: number; lng: number }[] {
  return [u.baslangic, u.bitis].filter((x): x is NonNullable<typeof x> => !!x);
}
