import { Stack, useLocalSearchParams } from 'expo-router';

import { useSeyahatCanli } from '@/features/mekanlar/sorgular';

// Seyahat içi yığın: sekmeler (Keşfet · Günler · Program · Grup) + mekan detayı (3.8).
// Realtime aboneliği seyahat açıkken burada yaşar (PRD §5.5).
export default function SeyahatLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useSeyahatCanli(id);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="mekan/[placeId]" />
    </Stack>
  );
}
