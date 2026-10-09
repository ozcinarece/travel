import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { varsayilanDakika } from '@/lib/kategori';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Mekan, Uye } from '@/lib/tipler';

/** Seyahatin mekan havuzu (places). Ad/puan canlı: useHafifYerler. */
export function useMekanlar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['mekanlar', seyahatId],
    enabled: !!session && !!seyahatId,
    queryFn: async () => {
      const { data, error } = await supabase.from('places').select('*').eq('trip_id', seyahatId!).order('created_at');
      if (error) throw error;
      return data as Mekan[];
    },
  });
}

export function useUyeler(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['uyeler', seyahatId],
    enabled: !!session && !!seyahatId,
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('*').eq('trip_id', seyahatId!).order('joined_at');
      if (error) throw error;
      return data as Uye[];
    },
  });
}

/** #80 KK7: `default_minutes` verilirse (panelde ayarlanan süre) §6 varsayılanı yerine o yazılır. */
export type YeniMekan = { place_id: string; primary_type: string | null; lat: number; lng: number; default_minutes?: number };

/**
 * PRD 3.4 KK5/KK7: havuza ekler; ekleyen = oturum kullanıcısı, süre §6 varsayılanı.
 * Aynı mekan ikinci kez eklenirse (23505) sessizce mevcut sayılır.
 */
export function useMekanEkle(seyahatId: string) {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (yeni: YeniMekan) => {
      if (!session) throw new Error('oturum yok');
      const { error } = await supabase.from('places').insert({
        trip_id: seyahatId,
        place_id: yeni.place_id,
        primary_type: yeni.primary_type,
        lat: yeni.lat,
        lng: yeni.lng,
        default_minutes: yeni.default_minutes ?? varsayilanDakika(yeni.primary_type),
        added_by: session.user.id,
      });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mekanlar', seyahatId] }),
  });
}

export function useMekanGuncelle(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...alanlar }: { id: string; note?: string | null; default_minutes?: number }) => {
      const { error } = await supabase.from('places').update(alanlar).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mekanlar', seyahatId] }),
  });
}

export function useMekanSil(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('places').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mekanlar', seyahatId] }),
  });
}

/**
 * PRD §5.5 / 3.4 KK8: seyahat açıkken places, stops, days, members Realtime aboneliği;
 * her değişiklikte ilgili sorgu yenilenir (2 sn içinde ekran güncellenir).
 */
export function useSeyahatCanli(seyahatId: string | undefined) {
  const qc = useQueryClient();
  const { session } = useOturum();
  useEffect(() => {
    if (!seyahatId || !session) return;
    const kanal = supabase
      .channel(`seyahat:${seyahatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `trip_id=eq.${seyahatId}` }, () =>
        qc.invalidateQueries({ queryKey: ['mekanlar', seyahatId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops', filter: `trip_id=eq.${seyahatId}` }, () =>
        qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'days', filter: `trip_id=eq.${seyahatId}` }, () =>
        qc.invalidateQueries({ queryKey: ['gunler', seyahatId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stays', filter: `trip_id=eq.${seyahatId}` }, () =>
        qc.invalidateQueries({ queryKey: ['konaklamalar', seyahatId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${seyahatId}` }, () =>
        qc.invalidateQueries({ queryKey: ['uyeler', seyahatId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(kanal);
    };
  }, [seyahatId, session, qc]);
}
