import { Pressable, StyleSheet, Text } from 'react-native';

import { renk, yazi } from '@/theme';

type Props = { baslik: string; secili: boolean; onPress: () => void };

// Tekli seçim hapı: seçili siyah, diğerleri gri yüzey.
export function Cip({ baslik, secili, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: secili }}
      onPress={onPress}
      hitSlop={6}
      style={[s.kap, secili && s.secili]}>
      <Text style={[s.metin, secili && s.seciliMetin]}>{baslik}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: renk.yuzey },
  secili: { backgroundColor: renk.metin },
  metin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  seciliMetin: { color: renk.zemin },
});
