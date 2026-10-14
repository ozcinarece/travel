import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { pinGorselleriniYukle } from '@/components/harita/pinOnYukleme';
import { useSeyahatCanli } from '@/features/mekanlar/sorgular';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { kendiSildiklerim, seyahatYokMu } from '@/features/seyahatler/silme';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { supabase } from '@/lib/supabase';
import type { SeyahatOzet } from '@/lib/tipler';

// Seyahat içi yığın: sekmeler (#181: Gezi · Plan · Keşfet · Harcama · Sohbet) + Listem, Rehber, geceler, eski mekan derin linki.
// Realtime aboneliği seyahat açıkken burada yaşar (PRD §5.5).
export default function SeyahatLayout() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const kimlik = Array.isArray(id) ? id[0] : id;
  useSeyahatCanli(kimlik);
  useSilinmeBekcisi(kimlik);
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
        {/* #139 KK7: "Geceleri ayrı seç". */}
        <Stack.Screen name="geceler" />
        {/* #181 KK2: Listem ve Rehber sekme değil; Gezi sayfasından açılır. */}
        <Stack.Screen name="listem" />
        <Stack.Screen name="rehber" />
      </Stack>
    </SeyahatIdSaglayici>
  );
}

/**
 * #174 KK5: açık seyahat başka biri (sahip) tarafından silinirse çökmeden "Bu seyahat silindi" deyip Seyahatler'e döner.
 * Seyahat satırı silinince (realtime) ya da uygulama öne gelince tek seyahat sorgusu yenilenir; satır yoksa (PGRST116)
 * liste güncellenir ve dönülür. Sahibin kendi silmesinde bildirim zaten "Seyahat silindi"dir (ikinci uyarı yok).
 */
function useSilinmeBekcisi(seyahatId: string | undefined) {
  const qc = useQueryClient();
  const seyahat = useSeyahat(seyahatId);
  const dondu = useRef(false);
  useEffect(() => {
    if (!seyahatId) return;
    const yenile = () => qc.invalidateQueries({ queryKey: ['seyahat', seyahatId] });
    // Realtime DELETE olayları `filter` ile süzülemez; eski kayıt yalnız birincil anahtarı taşır — kimlikle karşılaştırılır.
    const kanal = supabase
      .channel(`seyahat-silme:${seyahatId}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trips' }, (olay) => {
        if ((olay.old as { id?: string } | undefined)?.id === seyahatId) yenile();
      })
      .subscribe();
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') yenile();
    });
    return () => {
      supabase.removeChannel(kanal);
      abonelik.remove();
    };
  }, [seyahatId, qc]);
  const silindi = !!seyahatId && seyahat.isError && seyahatYokMu(seyahat.error);
  useEffect(() => {
    if (!silindi || !seyahatId || dondu.current) return;
    dondu.current = true;
    qc.setQueryData<SeyahatOzet[]>(['seyahatler'], (eski) => eski?.filter((sy) => sy.id !== seyahatId));
    qc.invalidateQueries({ queryKey: ['seyahatler'] });
    if (kendiSildiklerim.has(seyahatId)) return;
    router.replace({ pathname: '/(tabs)/seyahatler', params: { bildirim: 'silinmis' } });
  }, [silindi, seyahatId, qc]);
}
