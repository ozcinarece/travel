import { Stack } from 'expo-router';

import { useOturum } from '@/lib/oturum';

// Oturum yoksa 0.1 karşılama; oturum var ama profil yoksa 0.2 profil kurulumu.
export default function GirisLayout() {
  const { hesapli } = useOturum();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hesapli}>
        <Stack.Screen name="giris" />
      </Stack.Protected>
      <Stack.Protected guard={hesapli}>
        <Stack.Screen name="profil-kur" />
      </Stack.Protected>
    </Stack>
  );
}
