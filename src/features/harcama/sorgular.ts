// #183 Harcamalar: Supabase sorguları — harcamalar (payları ile), ödeşmeler, IBAN, fiş. Hepsi bizim veritabanımız; Google yok.
// Canlılık: harcama / pay / ödeşme değişiklikleri seyahat kanalından (useSeyahatCanli) bu sorguları yeniler.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { useOturum } from '@/lib/oturum';

import type { Harcama, HarcamaKategorisi, Odesme } from './hesap';

export const harcamaAnahtari = (seyahatId: string | undefined) => ['harcamalar', seyahatId] as const;
export const odesmeAnahtari = (seyahatId: string | undefined) => ['odesmeler', seyahatId] as const;

export function useHarcamalar(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: harcamaAnahtari(seyahatId),
    enabled: !!session && !!seyahatId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('harcamalar')
        .select('*, harcama_paylari(user_id, pay_kurus)')
        .eq('trip_id', seyahatId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Harcama[];
    },
  });
}

export function useOdesmeler(seyahatId: string | undefined) {
  const { session } = useOturum();
  return useQuery({
    queryKey: odesmeAnahtari(seyahatId),
    enabled: !!session && !!seyahatId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('odesmeler').select('*').eq('trip_id', seyahatId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Odesme[];
    },
  });
}

export type HarcamaKaydi = {
  id: string | null;
  aciklama: string;
  tutar_kurus: number;
  para_birimi: string;
  tl_kurus: number;
  kategori: HarcamaKategorisi;
  odeyen_id: string;
  stop_id: string | null;
  fis_yolu: string | null;
  /** ₺ kuruş; toplamı tl_kurus. */
  paylar: { user_id: string; pay_kurus: number }[];
};

/** KK4: harcama ve payları tek işlemde (harcama_kaydet). */
export function useHarcamaKaydet(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (k: HarcamaKaydi) => {
      const { data, error } = await supabase.rpc('harcama_kaydet', {
        p_trip_id: seyahatId,
        p_id: k.id,
        p_aciklama: k.aciklama,
        p_tutar_kurus: k.tutar_kurus,
        p_para_birimi: k.para_birimi,
        p_tl_kurus: k.tl_kurus,
        p_kategori: k.kategori,
        p_odeyen: k.odeyen_id,
        p_stop_id: k.stop_id,
        p_fis_yolu: k.fis_yolu,
        p_paylar: k.paylar,
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: harcamaAnahtari(seyahatId) });
      qc.invalidateQueries({ queryKey: ['degisiklikler', seyahatId] });
    },
  });
}

/** Harcama silinince fiş dosyası da silinir (fişte kart bilgisi olabilir); geri alınan harcama fişsiz döner. */
export function useHarcamaSil(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fisYolu }: { id: string; fisYolu: string | null }) => {
      const { error } = await supabase.from('harcamalar').delete().eq('id', id);
      if (error) throw error;
      if (fisYolu) await fisSil(fisYolu);
    },
    onMutate: ({ id }) => qc.setQueryData<Harcama[]>(harcamaAnahtari(seyahatId), (eski) => eski?.filter((h) => h.id !== id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: harcamaAnahtari(seyahatId) });
      qc.invalidateQueries({ queryKey: ['degisiklikler', seyahatId] });
    },
  });
}

/** KK6 "Ödendi işaretle" (alan) / "Ödedim" (veren). */
export function useOdesmeEkle(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: { kimden: string; kime: string; tl_kurus: number }) => {
      const { error } = await supabase.from('odesmeler').insert({ trip_id: seyahatId, ...o });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: odesmeAnahtari(seyahatId) });
      qc.invalidateQueries({ queryKey: ['degisiklikler', seyahatId] });
    },
  });
}

export function useOdesmeSil(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('odesmeler').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => qc.setQueryData<Odesme[]>(odesmeAnahtari(seyahatId), (eski) => eski?.filter((o) => o.id !== id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: odesmeAnahtari(seyahatId) });
      qc.invalidateQueries({ queryKey: ['degisiklikler', seyahatId] });
    },
  });
}

/** KK7: IBAN'lar — RLS yalnız kişinin kendisini ve seyahat arkadaşlarını döndürür. */
export function useIbanlar(kisiler: string[]) {
  const { session } = useOturum();
  const sirali = [...new Set(kisiler)].sort();
  return useQuery({
    queryKey: ['ibanlar', sirali],
    enabled: !!session && sirali.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('odeme_bilgileri').select('user_id, iban').in('user_id', sirali);
      if (error) throw error;
      return new Map(((data ?? []) as { user_id: string; iban: string }[]).map((r) => [r.user_id, r.iban]));
    },
  });
}

export function useIbanKaydet() {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async (iban: string | null) => {
      const uid = session!.user.id;
      const { error } = iban
        ? await supabase.from('odeme_bilgileri').upsert({ user_id: uid, iban, updated_at: new Date().toISOString() })
        : await supabase.from('odeme_bilgileri').delete().eq('user_id', uid);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ibanlar'] }),
  });
}

/**
 * KK4 fiş fotoğrafı: galeriden seçilir → fisler/{seyahat}/{zaman-rastgele}.jpg. Vazgeçilirse null. Kamera, app.config'te
 * kamera izni metni (cameraPermission) ister — yerel ayar, yeni build gerektirir; o gelene kadar yalnız galeri.
 */
export async function fisSecVeYukle(seyahatId: string): Promise<string | null> {
  const secim = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (secim.canceled) return null;
  const dosya = secim.assets[0];
  const govde = await fetch(dosya.uri).then((y) => y.arrayBuffer());
  const yol = `${seyahatId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('fisler').upload(yol, govde, { contentType: dosya.mimeType ?? 'image/jpeg', upsert: false });
  if (error) throw error;
  return yol;
}

/** Fiş dosyasını siler (yükleyen ya da seyahat sahibi; olmazsa sessiz geçer — kayıt zaten bağlı değil). */
export async function fisSil(yol: string): Promise<void> {
  try {
    await supabase.storage.from('fisler').remove([yol]);
  } catch {
    // dosya silinemedi: harcama kaydı fişe bağlı değil, akış sürer
  }
}

/** Özel kovadaki fiş için kısa ömürlü imzalı adres (yalnız üyeler alabilir). */
export function useFisAdresi(yol: string | null | undefined) {
  return useQuery({
    queryKey: ['fis', yol],
    enabled: !!yol,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('fisler').createSignedUrl(yol!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
