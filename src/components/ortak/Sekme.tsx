// #361 KK6 → #395 (UX önerileri kanvası, `Ana_v5_Var` · `Sayfa_v5_Kaydettiklerim`): altı çizili sekmeler. Seçili 700 Lacivert
// ve 2 px alt çizgi; değilse 500 ikincil. Satırın altında 1 px ince çizgi. Ana sayfada 14 px / 20 aralık, Kaydettiklerim'de
// 15 px / 24 aralık (kanvas). Dokunma alanı 44 px.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { anaV5, minDokunma, renk, yazi } from '@/theme';

type Props = {
  baslik: string;
  /** Ekran okuyucu için uzun ad (#386 onay notu 1). */
  etiket?: string;
  secili: boolean;
  onPress: () => void;
  /** Yazı boyutu (px); varsayılan 14 (ana sayfa). */
  boyut?: number;
};

export function Sekme({ baslik, etiket, secili, onPress, boyut = 14 }: Props) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={etiket ?? baslik} accessibilityState={{ selected: secili }} onPress={onPress} style={[s.sekme, secili && s.sekmeSecili]}>
      <Text style={[s.metin, { fontSize: boyut }, secili && s.metinSecili]} numberOfLines={1}>
        {baslik}
      </Text>
    </Pressable>
  );
}

/** Sekmelerin satırı: 16 px kenar, altında 1 px çizgi. */
export function SekmeSatiri({ children, aralik = 20 }: { children: ReactNode; aralik?: number }) {
  return (
    <View style={[s.satir, { gap: aralik }]} accessibilityRole="tablist">
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { paddingHorizontal: 16, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  sekme: { height: minDokunma, minWidth: 44, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexShrink: 1 },
  sekmeSecili: { borderBottomColor: renk.metin },
  metin: { fontFamily: yazi.orta, color: anaV5.ikincil },
  metinSecili: { fontFamily: yazi.kalin, color: renk.metin },
});
