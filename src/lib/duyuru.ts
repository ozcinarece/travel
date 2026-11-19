// #410 inceleme: bant ve bildirim duyurusu. İki platformda da `announceForAccessibility` (Android'de `accessibilityLiveRegion`
// koşullu yeni açılan görünümde okunmuyor, #387). Duyuru metne değil olaya bağlı: aynı metin art arda iki kez gelirse
// (ör. iki kaldırma) `olay` değiştiği için ikisi de duyurulur.
import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo } from 'react-native';

/** `olay` her değiştiğinde (ilk açılış dahil) `metin` boş değilse bir kez duyurulur. `olay` verilmezse metin değişimi olaydır. */
export function useOlayDuyurusu(metin: string | null | undefined, olay?: unknown) {
  const duyur = useEffectEvent(() => {
    if (metin) AccessibilityInfo.announceForAccessibility(metin);
  });
  const anahtar = olay === undefined ? metin : olay;
  useEffect(() => duyur(), [anahtar]);
}
