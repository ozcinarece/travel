import { Tabs } from 'expo-router';

import { UygulamaMenusu } from '@/components/ui/UygulamaMenusu';

// #45 §1: seyahat içi alt menü (Keşfet · Program · Grup) kalktı; altta uygulama menüsü (Seyahatler seçili) görünür.
// Ekranlar sekme olarak kalır (durum korunur): Keşfet'e "‹ Şehir" hapı ve haritadaki "+" ile, Grup'a avatarlarla,
// Program'a Keşfet'teki "Programa geç" ile gidilir.
export default function SeyahatSekmeleri() {
  return (
    <Tabs initialRouteName="kesfet" screenOptions={{ headerShown: false }} tabBar={() => <UygulamaMenusu />}>
      <Tabs.Screen name="kesfet" />
      <Tabs.Screen name="program" />
      <Tabs.Screen name="grup" />
    </Tabs>
  );
}
