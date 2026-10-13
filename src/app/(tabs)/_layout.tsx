import { Tabs } from 'expo-router';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

// PRD §4 / #97 KK1: uygulama seviyesi alt menü = Ana sayfa · Seyahatler · Yeni · Profil (Haritam v2).
export default function SekmeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // #136: seçili sekme Gece, pasif gri mavi; etiket 11 / 800.
        tabBarActiveTintColor: renk.ana,
        tabBarInactiveTintColor: renk.soluk,
        tabBarLabelStyle: { fontFamily: yazi.ekstra, fontSize: 11 },
        tabBarStyle: { borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
      }}>
      {/* #97 KK1: Ana sayfa · Seyahatler · Yeni · Profil; ilk açılış Ana sayfa. */}
      <Tabs.Screen name="index" options={{ title: t('sekme.anasayfa'), tabBarIcon: ({ color }) => <Ikon ad="ev" renk={color} /> }} />
      <Tabs.Screen name="seyahatler" options={{ title: t('sekme.seyahatler'), tabBarIcon: ({ color }) => <Ikon ad="seyahatler" renk={color} /> }} />
      {/* #98: Yeni sekmesi sihirbazdır; adımlar tam ekran (alt menü gizli), geri ile Seyahatler'e döner. */}
      <Tabs.Screen name="yeni" options={{ title: t('sekme.yeni'), tabBarIcon: ({ color }) => <Ikon ad="yeni" renk={color} />, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="profil" options={{ title: t('sekme.profil'), tabBarIcon: ({ color }) => <Ikon ad="profil" renk={color} /> }} />
    </Tabs>
  );
}
