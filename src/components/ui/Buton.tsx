import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { kose, minDokunma, renk, yazi } from '@/theme';

/** #136 (kanvas Temel): birincil Gece · vurgu Mandalina (üstünde Lacivert) · ikincil Buz · çerçeveli beyaz · tehlike. */
type Tur = 'birincil' | 'vurgu' | 'ikincil' | 'cerceveli' | 'tehlike';

type Props = {
  baslik: string;
  onPress: () => void;
  tur?: Tur;
  pasif?: boolean;
  yukleniyor?: boolean;
  ikon?: ReactNode;
  stil?: StyleProp<ViewStyle>;
  /** Büyük CTA (54 px) ya da satır içi (46 px); varsayılan 52. */
  boy?: 'buyuk' | 'normal' | 'kucuk';
};

const ZEMIN: Record<Tur, string> = { birincil: renk.ana, vurgu: renk.vurgu, ikincil: renk.yuzey, cerceveli: renk.zemin, tehlike: renk.uyari };
const METIN: Record<Tur, string> = { birincil: renk.zemin, vurgu: renk.metin, ikincil: renk.ana, cerceveli: renk.metin, tehlike: renk.zemin };
const BOY = { buyuk: 54, normal: 52, kucuk: 46 } as const;

export function Buton({ baslik, onPress, tur = 'birincil', pasif, yukleniyor, ikon, stil, boy = 'normal' }: Props) {
  const kapali = !!pasif || !!yukleniyor;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: kapali, busy: !!yukleniyor }}
      disabled={kapali}
      onPress={onPress}
      style={({ pressed }) => [s.kap, { backgroundColor: ZEMIN[tur], height: BOY[boy] }, tur === 'cerceveli' && s.cerceve, pasif && s.pasif, pressed && s.basili, stil]}>
      {yukleniyor ? (
        <ActivityIndicator color={METIN[tur]} />
      ) : (
        <>
          {ikon}
          <Text style={[s.metin, { color: METIN[tur] }, boy === 'kucuk' && { fontSize: 14 }]}>{baslik}</Text>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { minHeight: minDokunma, paddingHorizontal: 20, borderRadius: kose.dugme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cerceve: { borderWidth: 1.5, borderColor: renk.ayrac },
  pasif: { opacity: 0.4 },
  basili: { opacity: 0.85 },
  metin: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.zemin },
});
