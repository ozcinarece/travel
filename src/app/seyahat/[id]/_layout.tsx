import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { pinGorselleriniYukle } from '@/components/harita/pinOnYukleme';
import { useSeyahatCanli } from '@/features/mekanlar/sorgular';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { renk } from '@/theme';

// Seyahat içi yığın: sekmeler (Keşfet · Günler · Program · Grup) + mekan detayı (3.8).
// Realtime aboneliği seyahat açıkken burada yaşar (PRD §5.5).
export default function SeyahatLayout() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const kimlik = Array.isArray(id) ? id[0] : id;
  useSeyahatCanli(kimlik);
  // #61 §6: pin PNG'leri sekmeye girmeden belleğe alınır; harita açıldığında bekleme olmaz.
  useEffect(() => {
    pinGorselleriniYukle();
  }, []);
  return (
    <SeyahatIdSaglayici id={kimlik}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(sekmeler)" />
        {/* #79: Android'de mekan detayı saydam modal olarak açılır — react-native-screens altta kalan sekme ekranını
            pencereden AYIRMAZ (yalnız opak ekranlar altını ayırır); harita bağlı kalır, react-native-maps işaretçileri
            kendi kopyasından yeniden kurmaz (kırmızı varsayılan iğne / hayalet pin / dokunulmayan pin). Detay ekranı opak,
            sağdan kayarak gelir; geri aynı. iOS'ta yığın ekranı ayırmaz, kart kalır. */}
        <Stack.Screen
          name="mekan/[placeId]"
          options={{
            presentation: Platform.OS === 'android' ? 'transparentModal' : 'card',
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: renk.zemin },
          }}
        />
      </Stack>
    </SeyahatIdSaglayici>
  );
}
