import { Tabs } from 'expo-router';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

// PRD §4: uygulama seviyesi alt menü v1 = Seyahatler · Yeni · Profil (Haritam v2).
export default function SekmeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: renk.metin,
        tabBarInactiveTintColor: renk.soluk,
        tabBarLabelStyle: { fontFamily: yazi.yari, fontSize: 10 },
        tabBarStyle: { borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
      }}>
      <Tabs.Screen name="index" options={{ title: t('sekme.seyahatler'), tabBarIcon: ({ color }) => <Ikon ad="seyahatler" renk={color} /> }} />
      <Tabs.Screen name="yeni" options={{ title: t('sekme.yeni'), tabBarIcon: ({ color }) => <Ikon ad="yeni" renk={color} /> }} />
      <Tabs.Screen name="profil" options={{ title: t('sekme.profil'), tabBarIcon: ({ color }) => <Ikon ad="profil" renk={color} /> }} />
    </Tabs>
  );
}
