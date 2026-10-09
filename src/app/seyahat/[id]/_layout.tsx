import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { pinGorselleriniYukle } from '@/components/harita/pinOnYukleme';
import { useSeyahatCanli } from '@/features/mekanlar/sorgular';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';

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
        {/* #80: mekan detayı sayfa değil panel (Keşfet / Program içinde); bu rota yalnız eski derin linki yönlendirir. */}
        <Stack.Screen name="mekan/[placeId]" />
      </Stack>
    </SeyahatIdSaglayici>
  );
}
