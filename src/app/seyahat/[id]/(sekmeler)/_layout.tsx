import { Tabs } from 'expo-router';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

// PRD §4 (#34 ile v0.3): seyahat açıkken alt menü Keşfet · Program · Grup. Program = Harita | Çizelge görünümü.
export default function SeyahatSekmeleri() {
  return (
    <Tabs
      initialRouteName="kesfet"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: renk.metin,
        tabBarInactiveTintColor: renk.soluk,
        tabBarLabelStyle: { fontFamily: yazi.yari, fontSize: 10 },
        tabBarStyle: { borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
      }}>
      <Tabs.Screen name="kesfet" options={{ title: t('seyahat.sekme.kesfet'), tabBarIcon: ({ color }) => <Ikon ad="kesfet" renk={color} /> }} />
      <Tabs.Screen name="program" options={{ title: t('seyahat.sekme.program'), tabBarIcon: ({ color }) => <Ikon ad="program" renk={color} /> }} />
      <Tabs.Screen name="grup" options={{ title: t('seyahat.sekme.grup'), tabBarIcon: ({ color }) => <Ikon ad="grup" renk={color} /> }} />
    </Tabs>
  );
}
