// #137 Davetle katılma: özet (anon), katılım, web → uygulama karşılaması, bekleyen davet ve profil onayı (cihazda).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { olayYaz } from '@/features/icerik/sorgular';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { DavetKarsilama, DavetKatilim, DavetOzeti } from '@/lib/tipler';

export type DavetKanali = 'web' | 'app';
export const DAVET_KANALI: DavetKanali = Platform.OS === 'web' ? 'web' : 'app';

const BEKLEYEN = 'davet:bekleyen';
const PROFIL_ONAYI = 'davet:profil-onayi:';

/** /r/{token} özeti — giriş gerektirmez; token bilinmiyorsa null. */
export function useDavetOzeti(token: string | undefined) {
  return useQuery({
    queryKey: ['davet-ozeti', token],
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('davet_ozeti', { token: token! });
      if (error) throw error;
      return (data as DavetOzeti | null) ?? null;
    },
  });
}

/** Katılım: üyelik yazılır (zaten üyeyse dokunulmaz); `davet_katildi` olayı (kanal). Seyahat listesi yenilenir. */
export function useDavetleKatil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('davetle_katil', { token, kanal: DAVET_KANALI });
      if (error) throw error;
      const sonuc = data as DavetKatilim;
      if (!sonuc.zaten_uye) await olayYaz('davet_katildi', sonuc.trip_id, { kanal: DAVET_KANALI });
      return sonuc;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['davet-ozeti'] });
    },
  });
}

/** KK2: web'de katılıp uygulamayı ilk kez açan kişi — düşülecek seyahat (yoksa null). Yalnız hesaplıyken sorulur. */
export function useDavetKarsilama(etkin: boolean) {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['davet-karsilama'],
    enabled: hesapli && etkin && Platform.OS !== 'web',
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('davet_karsilama');
      if (error) throw error;
      return (data as DavetKarsilama | null) ?? null;
    },
  });
}

/** Karşılama bir kez: damga yazılır ve önbellekteki karşılama boşaltılır (ana sayfa yeniden açılınca tekrar yönlendirmez). */
export function useDavetKarsilandi() {
  const qc = useQueryClient();
  return useCallback(
    async (tripId: string): Promise<void> => {
      await supabase.rpc('davet_karsilandi', { t: tripId }).then(
        () => undefined,
        () => undefined,
      );
      qc.setQueryData(['davet-karsilama'], null);
    },
    [qc],
  );
}

/** Üye kendisi ayrılır (RLS: sahip ayrılamaz). */
export function useSeyahattenAyril() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      if (!session) throw new Error('oturum yok');
      const { error } = await supabase.from('members').delete().eq('trip_id', tripId).eq('user_id', session.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seyahatler'] }),
  });
}

// ---------------------------------------------------------------- cihazda tutulanlar

/** Giriş öncesi görülen davet: giriş/profil tamamlanınca ana sayfa buraya döner. */
export async function bekleyenDavetiYaz(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BEKLEYEN, token);
  } catch {
    // depolama yoksa akış yine /r sayfasından devam eder
  }
}
export async function bekleyenDavetiOku(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BEKLEYEN);
  } catch {
    return null;
  }
}
export async function bekleyenDavetiSil(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BEKLEYEN);
  } catch {
    // sessiz
  }
}

/** KK5: "Arkadaşların seni böyle görecek" hesap başına bir kez (aynı cihazdaki ikinci hesap da görür). */
export async function profilOnayiVerildiMi(kullaniciId: string | undefined): Promise<boolean> {
  if (!kullaniciId) return false;
  try {
    return (await AsyncStorage.getItem(PROFIL_ONAYI + kullaniciId)) === '1';
  } catch {
    return true;
  }
}
export async function profilOnayiniYaz(kullaniciId: string | undefined): Promise<void> {
  if (!kullaniciId) return;
  try {
    await AsyncStorage.setItem(PROFIL_ONAYI + kullaniciId, '1');
  } catch {
    // sessiz
  }
}
