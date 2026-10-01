import { Tabs } from 'expo-router';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

// PRD §4: seyahat açıkken alt menü Keşfet · Günler · Program · Grup.
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
      <Tabs.Screen name="kesfet" options={{ title: t('seyahat.sekme.kesfet') }} />
      <Tabs.Screen name="gunler" options={{ title: t('seyahat.sekme.gunler') }} />
      <Tabs.Screen name="program" options={{ title: t('seyahat.sekme.program') }} />
      <Tabs.Screen name="grup" options={{ title: t('seyahat.sekme.grup') }} />
    </Tabs>
  );
}
