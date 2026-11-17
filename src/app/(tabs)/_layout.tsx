import { Stack } from 'expo-router';

// #275 (#237 v2, kanvas 29a): uygulama alt menüsü kalktı. Ana ekran (Keşfet) üst çubukta Ara · ♥ Kaydettiklerim · Profil'e,
// yüzen [+ Yeni seyahat] düğmesiyle sihirbaza gider. Yığın (Stack): Android geri tuşu ve iOS kaydırma bir önceki ekrana döner,
// ana ekranda uygulamadan çıkar (KK6). Yeni seyahat sihirbazı tam ekran (#98).
export default function AnaYiginLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="seyahatler" />
      <Stack.Screen name="yeni" />
      <Stack.Screen name="kaydettiklerim" />
      <Stack.Screen name="profil" />
    </Stack>
  );
}
