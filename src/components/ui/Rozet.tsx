import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { kose, renk, yazi } from '@/theme';

/** #136 (kanvas Temel): rozet 26 px, köşe 8, 12 px / 800 — vurgu Mandalina · buz · başarı · gece. `buyukHarf` etiket dili. */
type Tur = 'vurgu' | 'buz' | 'basari' | 'gece';

const ZEMIN: Record<Tur, string> = { vurgu: renk.vurgu, buz: renk.yuzey, basari: renk.basariZemin, gece: renk.ana };
const METIN: Record<Tur, string> = { vurgu: renk.metin, buz: renk.ana, basari: renk.basariMetin, gece: renk.zemin };

export function Rozet({ metin, tur = 'buz', buyukHarf, stil }: { metin: string; tur?: Tur; buyukHarf?: boolean; stil?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.kap, { backgroundColor: ZEMIN[tur] }, stil]}>
      <Text style={[s.metin, { color: METIN[tur] }, buyukHarf && s.buyuk]} numberOfLines={1}>
        {buyukHarf ? metin.toLocaleUpperCase('tr') : metin}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { height: 26, paddingHorizontal: 10, borderRadius: kose.rozet, alignSelf: 'flex-start', justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 12 },
  buyuk: { letterSpacing: 0.5 },
});
