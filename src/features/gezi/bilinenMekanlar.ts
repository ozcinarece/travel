// #181 KK13: Gezi sayfasında mekan adı ve fotoğrafı İSTEK ATILMADAN — önce bizim içeriğimiz (`icerik_mekan_bilgileri`, DB),
// sonra oturumda başka ekranın (Plan, Keşfet, Listem) zaten aldığı places-light önbelleği. İkisinde de yoksa ad yerine kategori
// gösterilir (geziOzeti.mekanAdi); Google'a gidilmez. Sekmeye her dönüşte önbellek yeniden okunur (Plan'dan gelince adlar dolar).
import { useFocusEffect } from 'expo-router';
import { useCallback, useReducer } from 'react';

import { useIcerikMekanDb } from '@/features/icerik/mekanBilgileri';
import { hafifOnbellek } from '@/features/yerler/api';

import type { AdKaynagi } from './geziOzeti';

export function useBilinenMekanlar(placeIds: string[]) {
  const db = useIcerikMekanDb(placeIds);
  const [, yenile] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(useCallback(() => yenile(), []));
  const ad: AdKaynagi = (m) => db.data?.get(m.place_id)?.ad ?? hafifOnbellek.oku(m.place_id)?.ad ?? null;
  const foto = (placeId: string): string | null => db.data?.get(placeId)?.foto ?? hafifOnbellek.oku(placeId, ['foto'])?.foto_uri ?? null;
  return { ad, foto, yukleniyor: db.isPending && placeIds.length > 0 };
}
