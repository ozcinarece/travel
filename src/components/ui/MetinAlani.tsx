import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { renk, yazi } from '@/theme';

type Props = TextInputProps & {
  etiket: string;
  /** "@" gibi sabit ön ek. */
  onEk?: string;
  sagEk?: ReactNode;
  vurgulu?: boolean;
  altMetin?: string;
  altRenk?: string;
};

export function MetinAlani({ etiket, onEk, sagEk, vurgulu, altMetin, altRenk, style, ...girdi }: Props) {
  return (
    <View style={s.kap}>
      <Text style={s.etiket}>{etiket}</Text>
      <View style={[s.kutu, vurgulu && s.vurgulu]}>
        {onEk ? <Text style={s.onEk}>{onEk}</Text> : null}
        <TextInput
          accessibilityLabel={etiket}
          placeholderTextColor={renk.soluk}
          style={[s.girdi, style]}
          {...girdi}
        />
        {sagEk}
      </View>
      {altMetin ? <Text style={[s.alt, altRenk ? { color: altRenk } : null]}>{altMetin}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 6 },
  etiket: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  kutu: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: renk.yuzey,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  vurgulu: { borderColor: renk.metin },
  onEk: { fontFamily: yazi.yari, fontSize: 15, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 15, color: renk.metin, paddingVertical: 0 },
  alt: { fontFamily: yazi.yari, fontSize: 11, color: renk.ikincil },
});
