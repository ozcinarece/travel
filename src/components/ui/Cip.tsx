import { Pressable, StyleSheet, Text } from 'react-native';

import { kose, renk, yazi } from '@/theme';

type Props = { baslik: string; secili: boolean; onPress: () => void; kucuk?: boolean };

/** #136 (kanvas Temel): çip tam yuvarlak 36 px — seçili Gece dolu, diğerleri beyaz + 1,5 px Çizgi kenar. */
export function Cip({ baslik, secili, onPress, kucuk }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} hitSlop={6} style={[s.kap, kucuk && s.kucuk, secili && s.secili]}>
      <Text style={[s.metin, kucuk && { fontSize: 12 }, secili && s.seciliMetin]}>{baslik}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { height: 36, paddingHorizontal: 14, borderRadius: kose.cip, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.ayrac, justifyContent: 'center' },
  kucuk: { height: 30, paddingHorizontal: 11 },
  secili: { backgroundColor: renk.ana, borderColor: renk.ana },
  metin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  seciliMetin: { color: renk.zemin },
});
