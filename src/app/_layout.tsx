import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useProfil } from '@/features/profil/sorgular';
import { OturumSaglayici, useOturum } from '@/lib/oturum';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function Kok() {
  const [fontlar, fontHatasi] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const { hazir, hesapli } = useOturum();
  const profil = useProfil();

  // Açılış ekranı fontlar, oturum ve (hesaplıysa) profil okunana kadar durur.
  const yuklendi = (fontlar || !!fontHatasi) && hazir && (!hesapli || !profil.isPending);
  useEffect(() => {
    if (yuklendi) SplashScreen.hideAsync();
  }, [yuklendi]);
  if (!yuklendi) return null;

  // Hesap + profil tamamsa uygulama; değilse giriş akışı (0.1 → 0.2). 0.3 sekmelerden yönlendirilir.
  const girisTamam = hesapli && !!profil.data;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!girisTamam}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={girisTamam}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ilk-seyahat" />
        <Stack.Screen name="hesap-sil" />
        <Stack.Screen name="yeni/otel" />
        <Stack.Screen name="seyahat/[id]" />
      </Stack.Protected>
      <Stack.Screen name="r/[token]" />
    </Stack>
  );
}

export default function KokLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <OturumSaglayici>
        <Kok />
      </OturumSaglayici>
    </QueryClientProvider>
  );
}
