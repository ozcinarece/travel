import { Redirect, Slot } from 'expo-router';
import { Platform } from 'react-native';

import { Kabuk } from '@/components/yonetim/Kabuk';
import { useAdmin } from '@/features/yonetim/admin';
import { kullaniciEtiketi } from '@/features/yonetim/menu';
import { useOturum } from '@/lib/oturum';

// #106 Backoffice: yalnız web (KK1). Mobil paket bu grubu hiç görmez (metro.config.js); bu koruma ikinci kat.
export default function YonetimLayout() {
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  return <YonetimKabugu />;
}

// KK4: tüm panel sayfaları (giriş ve "Yetkin yok" dahil) aynı kabukta; kullanıcı satırı yalnız admin için.
function YonetimKabugu() {
  const { session, hesapli } = useOturum();
  const admin = useAdmin();
  const kullanici =
    hesapli && admin.data === true
      ? kullaniciEtiketi(session?.user.user_metadata?.full_name as string | undefined, session?.user.email)
      : null;
  return (
    <Kabuk kullanici={kullanici}>
      <Slot />
    </Kabuk>
  );
}
