import { Stack } from 'expo-router';

import { useOturum } from '@/lib/oturum';

// Oturum yoksa 0.1 karşılama. #138: profil kurulum ekranı kalktı (profil sunucuda kendiliğinden oluşur, kök düzen bekler).
export default function GirisLayout() {
  const { hesapli } = useOturum();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hesapli}>
        <Stack.Screen name="giris" />
      </Stack.Protected>
    </Stack>
  );
}
