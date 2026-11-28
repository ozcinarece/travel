import { Tabs } from 'expo-router/js-tabs';

import { AltMenu } from '@/components/menu/AltMenu';

// #405 KK1 (kanvas `Ana_v6_Kesfet` · `Ana_v6_Seyahatlerim` alt menüsü), #407 KK5 (`Ana_v6_Arkadaslar`): Keşfet · Seyahatlerim ·
// Arkadaşlar · Profil. `backBehavior="initialRoute"`: Android geri tuşu başka sekmedeyken
// Keşfet'e döner, Keşfet'te uygulamadan çıkar.
// #569 KK1 (`Ana_v9_*`): menüde üç sekme (Keşfet · Gezilerim · Arkadaşlar).
// #624 KK1: profil sekme değil; `(tabs)` yığınında (`(tabs)/profil.tsx`), ana sayfadaki profil yuvarlağı açar.
export default function MenuLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} backBehavior="initialRoute" tabBar={(props) => <AltMenu {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="seyahatler" />
      <Tabs.Screen name="arkadaslar" />
    </Tabs>
  );
}
