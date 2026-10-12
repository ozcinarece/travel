import { Redirect, Slot, usePathname } from 'expo-router';
import { Platform } from 'react-native';

import { Kabuk } from '@/components/yonetim/Kabuk';
import { useAdmin } from '@/features/yonetim/admin';
import { GIRIS, kullaniciEtiketi, YETKIN_YOK } from '@/features/yonetim/menu';
import { useOturum } from '@/lib/oturum';

// #106 Backoffice: yalnız web (KK1). Mobil paket bu grubu hiç görmez (metro.config.js); bu koruma ikinci kat.
export default function YonetimLayout() {
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  return <YonetimKabugu />;
}

// KK4: panel sayfaları kabukta; kullanıcı satırı yalnız admin için. Giriş ve "Yetkin yok" kabuksuz, ortada kart
// (kanvas BekleyenTasarim21 ekran 1–2). Slot ağaçta kalır (yönlendirmede grup gezgini sökülmez).
function YonetimKabugu() {
  const { session, hesapli } = useOturum();
  const admin = useAdmin();
  const yol = usePathname();
  if (yol === GIRIS || yol === YETKIN_YOK) return <Slot />;
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
