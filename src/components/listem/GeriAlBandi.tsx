// #141 KK4 → #387 KK1 · KK4 (kanvas 21, Listem "Çıkar · Geri al"): ekranın altında Gece bant; metin ve Mandalina "Geri al".
// `onGeriAl` yoksa yalnız bilgi bandı (dokunulmaz). Ekran okuyucu: iki platformda da `announceForAccessibility` (#387 inceleme:
// Android'de `accessibilityLiveRegion` yeni açılan görünümde çoğu zaman okunmuyordu; çift okunmasın diye canlı bölge kalktı).
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = { metin: string; onGeriAl?: () => void; alt?: number };

export function GeriAlBandi({ metin, onGeriAl, alt = 16 }: Props) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(onGeriAl ? `${metin}. ${t('listem.geriAl')}` : metin);
  }, [metin, onGeriAl]);
  return (
    <View style={[s.bant, { bottom: alt }]} pointerEvents={onGeriAl ? 'auto' : 'none'} testID="geri-al-bandi">
      <Text style={s.metin} numberOfLines={onGeriAl ? 1 : undefined}>
        {metin}
      </Text>
      {onGeriAl ? (
        <Pressable accessibilityRole="button" onPress={onGeriAl} hitSlop={8} style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('listem.geriAl')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bant: { position: 'absolute', left: 16, right: 16, minHeight: 48, paddingLeft: 16, paddingRight: 8, borderRadius: 14, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: renk.metin, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  metin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, paddingVertical: 12 },
  dugme: { height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: renk.vurgu, justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
});
