import { useQuery } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';

import { GIRIS, type YonetimDurumu } from './menu';

/** #106 KK2: admin mi? Karar veritabanında (`is_admin()`: JWT e-postası + `admin_kullanicilar` + doğrulanmış e-posta). */
export function useAdmin() {
  const { session, hesapli } = useOturum();
  return useQuery({
    queryKey: ['yonetim', 'admin', session?.user.id],
    enabled: hesapli,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
  });
}

/** Kapı girdisi: oturum okundu mu, hesaplı mı, admin mi (bilinmiyorsa ya da RPC hatasında null). */
export function useYonetimDurumu(): YonetimDurumu {
  const { hazir, hesapli } = useOturum();
  const admin = useAdmin();
  return { hazir, hesapli, admin: hesapli && admin.isSuccess ? admin.data : null };
}

// Supabase → Auth → URL Configuration → Redirect URLs listesinde olmalı: {YONETIM_URL}/yonetim/giris
/** `hesapSec`: Google hesap seçicisini zorla ("Başka hesapla gir"). */
export async function yonetimGiris(secenek: { hesapSec?: boolean } = {}): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${GIRIS}`, ...(secenek.hesapSec ? { queryParams: { prompt: 'select_account' } } : {}) },
  });
  if (error) throw error;
}

export async function yonetimCikis(): Promise<void> {
  await supabase.auth.signOut();
}
