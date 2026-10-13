import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { kose, renk, yazi } from '@/theme';

import { Ikon } from './Ikon';

type Props = TextInputProps & { sag?: ReactNode; stil?: StyleProp<ViewStyle>; etiket: string };

/** #136 (kanvas Temel): arama kutusu — Buz zemin, köşe 14, 52 px, solda Gece büyüteç. */
export function AramaKutusu({ sag, stil, etiket, style, ...girdi }: Props) {
  return (
    <View style={[s.kap, stil]}>
      <Ikon ad="ara" boyut={20} renk={renk.ana} kalinlik={2.4} />
      <TextInput accessibilityLabel={etiket} placeholderTextColor={renk.soluk} autoCorrect={false} returnKeyType="search" style={[s.girdi, style]} {...girdi} />
      {sag}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { height: 52, paddingHorizontal: 16, borderRadius: kose.dugme, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 15, color: renk.metin, paddingVertical: 0 },
});
