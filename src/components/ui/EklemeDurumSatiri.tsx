// #388: ekleme sonucunun tek satırı. Hata: bugünkü hata satırı (uyarı rengi); bilgi (KK3): ikincil metin `#5B6178`.
// Bağlantı hatasında yanında "Tekrar dene" (KK1; Seyahatime al'daki "Tekrar dene" bağlantısıyla aynı görünüş).
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { EklemeDurumu } from '@/features/ekleme/eklemeDurumu';
import { t } from '@/i18n';
import { anaV5, renk, yazi } from '@/theme';

/** #388 inceleme: "Tekrar dene"nin dokunma alanı en az 44 pt (görünüş aynı; 12 pt metin + dikey hitSlop). */
export const TEKRAR_HIT_SLOP = { top: 14, bottom: 14, left: 10, right: 10 };

/** #388 inceleme: iOS'ta `accessibilityLiveRegion` çalışmaz; metin değişince bir kez duyurulur (`baglanti.ts` kalıbı). */
export function useIosDuyuru(metin: string | null | undefined) {
  useEffect(() => {
    if (metin && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(metin);
  }, [metin]);
}

/**
 * `yeniden`: "Tekrar dene" satırı gösteren bileşenin kendi deneme yolundan geçsin (#388 inceleme; bekleme kilidi atlanmaz).
 * `pasif`: yeniden deneme sürerken "Tekrar dene" basılamaz (#411 inceleme; art arda basılmasın).
 */
export function EklemeDurumSatiri({ durum, metinStili, yeniden, pasif }: { durum: EklemeDurumu; metinStili?: TextStyle; yeniden?: () => void; pasif?: boolean }) {
  useIosDuyuru(durum.metin);
  const metin = (
    <Text style={[durum.tur === 'bilgi' ? s.bilgi : s.hata, metinStili, durum.tur === 'bilgi' && { color: anaV5.ikincil }, durum.tekrar && { flex: 1 }]} accessibilityLiveRegion="polite">
      {durum.metin}
    </Text>
  );
  if (!durum.tekrar) return metin;
  return (
    <View style={s.satir}>
      {metin}
      <Pressable accessibilityRole="button" onPress={yeniden ?? durum.tekrar} disabled={pasif} accessibilityState={pasif ? { disabled: true } : undefined} hitSlop={TEKRAR_HIT_SLOP} style={pasif ? { opacity: 0.4 } : undefined}>
        <Text style={s.tekrar}>{t('ekleme.tekrarDene')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  bilgi: { fontFamily: yazi.yari, fontSize: 12, color: anaV5.ikincil },
  tekrar: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
