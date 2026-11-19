import { Tabs } from 'expo-router/js-tabs';

import { AltMenu } from '@/components/menu/AltMenu';

// #405 KK1 (kanvas `Ana_v6_Kesfet` · `Ana_v6_Seyahatlerim` alt menüsü): Keşfet · Seyahatlerim · Profil. Arkadaşlar sekmesi
// #407 ile (26 Kasım) gelecek; o zamana kadar 3 sekme. `backBehavior="initialRoute"`: Android geri tuşu başka sekmedeyken
// Keşfet'e döner, Keşfet'te uygulamadan çıkar.
export default function MenuLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} backBehavior="initialRoute" tabBar={(props) => <AltMenu {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="seyahatler" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
