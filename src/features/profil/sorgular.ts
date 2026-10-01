import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { gecerliKullaniciAdi } from '@/lib/kullaniciAdi';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { HaritaGizliligi, Profil, SilmeOnizleme } from '@/lib/tipler';
import { useGecikmeli } from '@/lib/useGecikmeli';

export const profilAnahtari = (uid: string | undefined) => ['profil', uid] as const;

export function useProfil() {
  const { session, hesapli } = useOturum();
  const uid = session?.user.id;
  return useQuery({
    queryKey: profilAnahtari(uid),
    enabled: hesapli,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).maybeSingle();
      if (error) throw error;
      return data as Profil | null;
    },
  });
}

/** PRD 0.2 KK1: yazarken müsaitlik, 300 ms debounce. Yalnızca biçimi geçerli adaylar sorulur. */
export function useKullaniciAdiMusait(aday: string) {
  const gecikmis = useGecikmeli(aday, 300);
  const gecerli = gecerliKullaniciAdi(gecikmis);
  const sorgu = useQuery({
    queryKey: ['kullanici-adi', gecikmis],
    enabled: gecerli,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('username_available', { u: gecikmis });
      if (error) throw error;
      return data as boolean;
    },
  });
  // Kullanıcı hâlâ yazıyorsa (gecikmiş ≠ aday) sonuç eskidir.
  return {
    guncel: gecikmis === aday,
    gecerli,
    musait: sorgu.data,
    kontrolEdiliyor: sorgu.isFetching,
    hata: sorgu.isError,
    yenidenDene: () => sorgu.refetch(),
  };
}

export type YeniProfil = {
  name: string;
  username: string;
  map_visibility: HaritaGizliligi;
  photo_url: string | null;
};

export function useProfilOlustur() {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async (girdi: YeniProfil) => {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ id: session!.user.id, ...girdi })
        .select()
        .single();
      if (error) throw error;
      return data as Profil;
    },
    onSuccess: (profil) => qc.setQueryData(profilAnahtari(profil.id), profil),
  });
}

type ProfilDegisikligi = Partial<
  Pick<Profil, 'name' | 'username' | 'map_visibility' | 'photo_url' | 'next_trip_window' | 'onboarding_done_at'>
>;

export function useProfilGuncelle() {
  const qc = useQueryClient();
  const { session } = useOturum();
  return useMutation({
    mutationFn: async (degisiklik: ProfilDegisikligi) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(degisiklik)
        .eq('id', session!.user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Profil;
    },
    onSuccess: (profil) => qc.setQueryData(profilAnahtari(profil.id), profil),
  });
}

/** PRD 0.2 KK3: fotoğraf isteğe bağlı. Galeriden seçilir, avatars/{uid}/avatar.jpg olarak yüklenir. */
export async function fotografSecVeYukle(uid: string): Promise<string | null> {
  const secim = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (secim.canceled) return null;
  const dosya = secim.assets[0];
  const govde = await fetch(dosya.uri).then((y) => y.arrayBuffer());
  const yol = `${uid}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(yol, govde, { contentType: dosya.mimeType ?? 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(yol);
  // Aynı yol yeniden yüklenince önbellek kırılsın.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Hesap silme ekranı: sahibi olunan seyahatlerin akıbeti, silmeden önce gösterilir. */
export function useHesapSilmeOnizleme() {
  return useQuery({
    queryKey: ['hesap-silme-onizleme'],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_deletion_preview');
      if (error) throw error;
      return data as SilmeOnizleme[];
    },
  });
}

/** Avatar dosyası, sonra hesap (delete_account: devir + auth kaydı). Ardından yerel oturum kapanır. */
export async function hesabiSil(uid: string): Promise<void> {
  await supabase.storage.from('avatars').remove([`${uid}/avatar.jpg`]);
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  // Sunucuda kullanıcı artık yok; yalnızca yerel oturum temizlenir.
  await supabase.auth.signOut({ scope: 'local' });
}
