import { Tabs } from 'expo-router';

import { SeyahatMenusu, type SeyahatSekmesi } from '@/components/ui/SeyahatMenusu';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useOkunmamis } from '@/features/sohbet/sorgular';

// #181 KK1: seyahat içi alt menü Gezi · Plan · Keşfet · Harcama · Sohbet; açılış Gezi (ana sayfa). KK2: Listem ve Rehber artık
// sekme değil, Gezi sayfasından yığına açılır. #137 KK6: Grup ayrı ekran değil, yüzlere dokununca açılan pencere (GrupPenceresi).
// #79: sekmeler arası geçişte pasif ekran pencereden AYRILMAZ (detachInactiveScreens=false) — ayrılırsa react-native-maps
// Android haritayı ve işaretçileri kendi kopyasından yeniden kurar (hayalet / kırmızı pin; yenidenKurulum.ts). Keşfet ve
// Program haritaları bağlı kalır; pasif sekme görünmez (display none) ve çizilmez. Sekmeler ilk açılışta kurulur (lazy): Gezi
// sayfasıyla açılan seyahatte harita ve Google istekleri (Keşfet, Plan) dokunulana kadar başlamaz (KK13).
// #184 KK8: Sohbet sekmesinde okunmamış mesaj rozeti (sohbet açılınca sıfırlanır).
export default function SeyahatSekmeleri() {
  const okunmamis = useOkunmamis(useSeyahatId()).data ?? 0;
  return (
    <Tabs
      initialRouteName="gezi"
      detachInactiveScreens={false}
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <SeyahatMenusu aktif={state.routes[state.index]?.name ?? 'gezi'} onSec={(ad: SeyahatSekmesi) => navigation.navigate(ad)} rozetler={{ sohbet: okunmamis }} />
      )}>
      <Tabs.Screen name="gezi" />
      <Tabs.Screen name="program" />
      <Tabs.Screen name="kesfet" />
      <Tabs.Screen name="harcama" />
      <Tabs.Screen name="sohbet" />
    </Tabs>
  );
}
