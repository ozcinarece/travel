// #361 KK5 (`Ana_v5_Ayrinti` §3): "{Şehir} için seyahat kur ›" iğne ikonuyla, eşleşmeyen metinde "“{metin}” için seyahat kur ›"
// + ikonuyla. Zemin #F6F7FA, köşe 16, en az 52 px. #392: ortak parça.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Ikon } from '@/components/ui/Ikon';
import { anaV5, renk, yazi } from '@/theme';

export function KurSatiri({ children, ikon, onPress }: { children: ReactNode; ikon: 'sehir' | 'metin'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.kurSatiri, pressed && s.basili]}>
      {ikon === 'sehir' ? (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
          <Circle cx={12} cy={11} r={2.2} />
        </Svg>
      ) : (
        <Ikon ad="arti" boyut={20} renk={renk.ana} kalinlik={2.4} />
      )}
      <Text style={s.kurMetin} numberOfLines={2}>
        {children}
      </Text>
      <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  kurSatiri: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: anaV5.satirZemin },
  kurMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 15, color: renk.metin },
  basili: { opacity: 0.85 },
});
