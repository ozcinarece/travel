import { Tabs } from 'expo-router';

import { AltMenu, type AltMenuOgesi } from '@/components/ui/AltMenu';

// #138 KK6: uygulama alt menüsü 5 öğe — Ana sayfa · Seyahatler · [Yeni] · Kaydettiklerim · Profil (Yeni ortada, Mandalina).
// #98: Yeni sekmesi sihirbazdır; adımlar tam ekran (alt menü gizli).
export default function SekmeLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        const aktif = state.routes[state.index]?.name as AltMenuOgesi | undefined;
        return aktif === 'yeni' ? null : <AltMenu aktif={aktif ?? null} />;
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="seyahatler" />
      <Tabs.Screen name="yeni" />
      <Tabs.Screen name="kaydettiklerim" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
