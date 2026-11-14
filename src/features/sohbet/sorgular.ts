// #184 Sohbet: Supabase sorguları — mesajlar, oylamalar (seçenek + oylarıyla), okuma durumu, okunmamış sayısı, sohbete düşen
// değişiklikler; mesaj / oy / oylama / fotoğraf yazma. Canlılık: seyahat kanalı (useSeyahatCanli) bu sorguları yeniler.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { useOturum } from '@/lib/oturum';
import type { Degisiklik } from '@/lib/tipler';

import type { Mesaj, MesajOkuma, Oylama } from './sohbet';

/** Sohbet en son bu kadar mesajı ve değişikliği gösterir (eskiler v2'de sayfalanır). */
export const MESAJ_SINIRI = 200;
export const DEGISIKLIK_SINIRI = 100;

export function useMesajlar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['mesajlar', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mesajlar').select('*').eq('trip_id', seyahatId!).order('created_at', { ascending: false }).limit(MESAJ_SINIRI);
      if (error) throw error;
      return (data ?? []) as Mesaj[];
    },
  });
}

export function useOylamalar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['oylamalar', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oylamalar')
        .select('*, oylama_secenekleri(*), oylama_oylari(secenek_id, user_id)')
        .eq('trip_id', seyahatId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Oylama[];
    },
  });
}

export function useMesajOkumalari(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['mesaj-okuma', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mesaj_okuma').select('user_id, son_okunan_at').eq('trip_id', seyahatId!);
      if (error) throw error;
      return (data ?? []) as MesajOkuma[];
    },
  });
}

/** KK8: başkalarının okunmamış mesaj sayısı (alt menü rozeti, Gezi kartı). */
export function useOkunmamis(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['sohbet-okunmamis', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sohbet_okunmamis', { p_trip_id: seyahatId });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
  });
}

/** KK4: sohbete düşen değişiklikler (harcama payları harcamanın satırıyla anlatılır). */
export function useSohbetDegisiklikleri(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['sohbet-degisiklikler', seyahatId],
    enabled: !!session && !!seyahatId,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changes')
        .select('id, user_id, entity, entity_id, field, old, new, at')
        .eq('trip_id', seyahatId!)
        .neq('entity', 'harcama_paylari')
        // #200: Günlere dağıt tek sistem satırı (işlemin satırları kayda bağlı).
        .is('grup', null)
        .order('at', { ascending: false })
        .limit(DEGISIKLIK_SINIRI);
      if (error) throw error;
      return (data ?? []) as Degisiklik[];
    },
  });
}

export function useSohbetOkundu(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('sohbet_okundu', { p_trip_id: seyahatId });
      if (error) throw error;
    },
    onSuccess: async () => {
      // Okumadan önce başlamış bir sayım eski sayıyı geri yazmasın: önce iptal, sonra 0.
      await qc.cancelQueries({ queryKey: ['sohbet-okunmamis', seyahatId] });
      qc.setQueryData(['sohbet-okunmamis', seyahatId], 0);
      qc.invalidateQueries({ queryKey: ['mesaj-okuma', seyahatId] });
    },
  });
}

const yenile = (qc: ReturnType<typeof useQueryClient>, seyahatId: string) => {
  qc.invalidateQueries({ queryKey: ['mesajlar', seyahatId] });
  qc.invalidateQueries({ queryKey: ['oylamalar', seyahatId] });
};

export type YeniMesaj = { tur: 'metin'; metin: string } | { tur: 'mekan'; place_id: string; metin?: string } | { tur: 'foto'; foto_yolu: string; metin?: string };

export function useMesajGonder(seyahatId: string) {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async (m: YeniMesaj) => {
      const { error } = await supabase.from('mesajlar').insert({ trip_id: seyahatId, ...m });
      if (error) throw error;
    },
    // İyimser: mesaj hemen balonda görünür, sunucu yanıtıyla gerçeği gelir.
    onMutate: (m) => {
      const gecici: Mesaj = {
        id: `gecici-${Date.now()}`,
        trip_id: seyahatId,
        user_id: session?.user.id ?? null,
        tur: m.tur,
        metin: m.metin ?? '',
        place_id: m.tur === 'mekan' ? m.place_id : null,
        oylama_id: null,
        foto_yolu: m.tur === 'foto' ? m.foto_yolu : null,
        created_at: new Date().toISOString(),
        silindi_at: null,
      };
      qc.setQueryData<Mesaj[]>(['mesajlar', seyahatId], (eski) => [gecici, ...(eski ?? [])]);
    },
    onSettled: () => yenile(qc, seyahatId),
  });
}

export function useMesajSil(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    // silindi_at'in değerini sunucu yazar (istemci saati yok sayılır); fotoğraflı mesajın dosyası da kovadan silinir.
    mutationFn: async ({ id, fotoYolu }: { id: string; fotoYolu?: string | null }) => {
      const { error } = await supabase.from('mesajlar').update({ silindi_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      if (fotoYolu) await sohbetFotoSil(fotoYolu);
    },
    onSettled: () => yenile(qc, seyahatId),
  });
}

/** KK3: oy ver / değiştir (oylama başına tek oy). */
export function useOylamaOyu(seyahatId: string) {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async ({ oylamaId, secenekId }: { oylamaId: string; secenekId: string }) => {
      const { error } = await supabase
        .from('oylama_oylari')
        .upsert({ oylama_id: oylamaId, trip_id: seyahatId, secenek_id: secenekId, user_id: session!.user.id }, { onConflict: 'oylama_id,user_id' });
      if (error) throw error;
    },
    onMutate: ({ oylamaId, secenekId }) => {
      const ben = session?.user.id;
      if (!ben) return;
      qc.setQueryData<Oylama[]>(['oylamalar', seyahatId], (eski) =>
        eski?.map((o) => (o.id === oylamaId ? { ...o, oylama_oylari: [...o.oylama_oylari.filter((v) => v.user_id !== ben), { secenek_id: secenekId, user_id: ben }] } : o)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['oylamalar', seyahatId] }),
  });
}

export type YeniOylama = { soru: string; secenekler: { metin: string; place_id: string | null }[]; kapanis: string | null; metin: string };

export function useOylamaOlustur(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: YeniOylama) => {
      const { error } = await supabase.rpc('oylama_olustur', { p_trip_id: seyahatId, p_soru: o.soru, p_secenekler: o.secenekler, p_kapanis: o.kapanis, p_metin: o.metin });
      if (error) throw error;
    },
    onSettled: () => yenile(qc, seyahatId),
  });
}

/** KK6: tek fotoğraf, galeriden (kamera izni metni app.config'te yok — yeni build ister) → sohbet/{seyahat}/…jpg. */
export async function sohbetFotoSecVeYukle(seyahatId: string): Promise<string | null> {
  const secim = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (secim.canceled) return null;
  const dosya = secim.assets[0];
  const govde = await fetch(dosya.uri).then((y) => y.arrayBuffer());
  const yol = `${seyahatId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('sohbet').upload(yol, govde, { contentType: dosya.mimeType ?? 'image/jpeg', upsert: false });
  if (error) throw error;
  return yol;
}

/** Kovadan fotoğraf siler (silinen mesaj ya da gönderilemeyen yükleme); silinemezse akış sürer. */
export async function sohbetFotoSil(yol: string): Promise<void> {
  try {
    await supabase.storage.from('sohbet').remove([yol]);
  } catch {
    // dosya silinemedi: mesaj zaten fotoğrafa bağlı değil
  }
}

export function useSohbetFotoAdresi(yol: string | null | undefined) {
  return useQuery({
    queryKey: ['sohbet-foto', yol],
    enabled: !!yol,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('sohbet').createSignedUrl(yol!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
