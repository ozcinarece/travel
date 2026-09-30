import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { minDokunma, renk, yazi } from '@/theme';

type Tur = 'birincil' | 'ikincil' | 'tehlike';

type Props = {
  baslik: string;
  onPress: () => void;
  tur?: Tur;
  pasif?: boolean;
  yukleniyor?: boolean;
  ikon?: ReactNode;
  stil?: StyleProp<ViewStyle>;
};

const ZEMIN: Record<Tur, string> = { birincil: renk.metin, ikincil: renk.yuzey, tehlike: renk.uyari };
const METIN: Record<Tur, string> = { birincil: renk.zemin, ikincil: renk.metin, tehlike: renk.zemin };

// Kanvastaki hap buton: 52 yüksek, tam yuvarlak; siyah (birincil), gri yüzey (ikincil), turuncu-kırmızı (tehlike).
export function Buton({ baslik, onPress, tur = 'birincil', pasif, yukleniyor, ikon, stil }: Props) {
  const kapali = !!pasif || !!yukleniyor;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: kapali, busy: !!yukleniyor }}
      disabled={kapali}
      onPress={onPress}
      style={({ pressed }) => [
        s.kap,
        { backgroundColor: ZEMIN[tur] },
        pasif && s.pasif,
        pressed && s.basili,
        stil,
      ]}>
      {yukleniyor ? (
        <ActivityIndicator color={METIN[tur]} />
      ) : (
        <>
          {ikon}
          <Text style={[s.metin, { color: METIN[tur] }]}>{baslik}</Text>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: {
    height: 52,
    minHeight: minDokunma,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pasif: { opacity: 0.4 },
  basili: { opacity: 0.85 },
  metin: { fontFamily: yazi.kalin, fontSize: 14 },
});
