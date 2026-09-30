import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  baslik: string;
  onPress: () => void;
  tur?: 'birincil' | 'ikincil';
  pasif?: boolean;
  yukleniyor?: boolean;
  ikon?: ReactNode;
  stil?: StyleProp<ViewStyle>;
};

// Kanvastaki hap buton: 52 yüksek, tam yuvarlak; siyah (birincil) ya da gri yüzey (ikincil).
export function Buton({ baslik, onPress, tur = 'birincil', pasif, yukleniyor, ikon, stil }: Props) {
  const birincil = tur === 'birincil';
  const kapali = !!pasif || !!yukleniyor;
  const metinRengi = birincil ? renk.zemin : renk.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: kapali, busy: !!yukleniyor }}
      disabled={kapali}
      onPress={onPress}
      style={({ pressed }) => [
        s.kap,
        birincil ? s.birincil : s.ikincil,
        pasif && s.pasif,
        pressed && s.basili,
        stil,
      ]}>
      {yukleniyor ? (
        <ActivityIndicator color={metinRengi} />
      ) : (
        <>
          {ikon}
          <Text style={[s.metin, { color: metinRengi }]}>{baslik}</Text>
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
  birincil: { backgroundColor: renk.metin },
  ikincil: { backgroundColor: renk.yuzey },
  pasif: { opacity: 0.4 },
  basili: { opacity: 0.85 },
  metin: { fontFamily: yazi.kalin, fontSize: 14 },
});
