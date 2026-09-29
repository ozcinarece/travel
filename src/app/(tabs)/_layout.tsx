import { Tabs } from 'expo-router';

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
      <Tabs.Screen name="index" options={{ title: t('sekme.seyahatler') }} />
      <Tabs.Screen name="yeni" options={{ title: t('sekme.yeni') }} />
      <Tabs.Screen name="profil" options={{ title: t('sekme.profil') }} />
    </Tabs>
  );
}
