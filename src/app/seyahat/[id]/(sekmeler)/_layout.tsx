import { Tabs } from 'expo-router';

import { SeyahatMenusu, type SeyahatSekmesi } from '@/components/ui/SeyahatMenusu';

// #141 KK1: seyahat içi alt menü Keşfet · Program · Listem · Rehber (uygulama menüsünün yerine); sol üstte her ekranda
// "‹ {seyahat adı}" → ana sayfa. #137 KK6: Grup ayrı ekran değil, yüzlere dokununca açılan pencere (GrupPenceresi).
// #79: sekmeler arası geçişte pasif ekran pencereden AYRILMAZ (detachInactiveScreens=false) — ayrılırsa react-native-maps
// Android haritayı ve işaretçileri kendi kopyasından yeniden kurar (hayalet / kırmızı pin; yenidenKurulum.ts). Keşfet ve
// Program haritaları bağlı kalır; pasif sekme görünmez (display none) ve çizilmez.
export default function SeyahatSekmeleri() {
  return (
    <Tabs
      initialRouteName="kesfet"
      detachInactiveScreens={false}
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => <SeyahatMenusu aktif={state.routes[state.index]?.name ?? 'kesfet'} onSec={(ad: SeyahatSekmesi) => navigation.navigate(ad)} />}>
      <Tabs.Screen name="kesfet" />
      <Tabs.Screen name="program" />
      <Tabs.Screen name="listem" />
      <Tabs.Screen name="rehber" />
    </Tabs>
  );
}
