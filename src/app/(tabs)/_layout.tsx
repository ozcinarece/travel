import { Stack } from 'expo-router';

// #275 → #405 (UX önerileri kanvası, `Ana_v6_Kesfet` · `Ana_v6_Seyahatlerim`): uygulama alt menüsü geri geldi. Yığının
// ilk ekranı `(menu)` sekmeleri (Keşfet · Seyahatlerim · Profil); sihirbaz ve Kaydettiklerim sekmelerin üstüne açılır, alt menü
// orada görünmez. Seyahatin içi (kök yığındaki `seyahat/[id]`) kendi 5 sekmesiyle açılır (KK1). Android geri tuşu ve iOS
// kaydırma bir önceki ekrana döner. Yeni seyahat sihirbazı tam ekran (#98).
// #624 KK1–KK3 (kanvas `Profil_v12_Kendi`): kendi profilin de bu yığında; alt menü yok, iOS kenardan kaydırma ve Android geri
// tuşu açıldığı ekrana döner (sağ üstteki yuvarlaktan Keşfet'e, seyahatin içinden seyahate).
export default function AnaYiginLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(menu)" />
      <Stack.Screen name="yeni" />
      <Stack.Screen name="kaydettiklerim" />
      <Stack.Screen name="profil" />
    </Stack>
  );
}
