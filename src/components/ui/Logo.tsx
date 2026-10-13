import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { renk, yazi } from '@/theme';

/**
 * #136 KK7 (kanvas Tur 4 · 1): iki durak noktası (Mandalina + Gece) ve aralarında kesik çizgili gülümseme (rota).
 * Koyu zeminde ikinci nokta beyaz. 24 px altında çizgi kesiksiz (küçükte kesikler okunmaz).
 */
export function Logo({ boyut = 36, koyuZemin = false }: { boyut?: number; koyuZemin?: boolean }) {
  const h = (boyut * 48) / 80;
  const kesiksiz = boyut < 24;
  return (
    <Svg width={boyut} height={h} viewBox="0 0 80 48" accessibilityLabel="Tripmate">
      <Circle cx={24} cy={14} r={7} fill={renk.vurgu} />
      <Circle cx={56} cy={14} r={7} fill={koyuZemin ? renk.zemin : renk.ana} />
      <Path d="M20 30 Q40 48 60 30" stroke={renk.vurgu} strokeWidth={7} fill="none" strokeDasharray={kesiksiz ? undefined : '7 4.5'} strokeLinecap={kesiksiz ? 'round' : 'butt'} />
    </Svg>
  );
}

/** Logo + "tripmate" yazısı (Archivo, Gece; koyu zeminde beyaz). */
export function LogoYazi({ boyut = 36, koyuZemin = false }: { boyut?: number; koyuZemin?: boolean }) {
  return (
    <View style={s.satir}>
      <Logo boyut={boyut} koyuZemin={koyuZemin} />
      <Text style={[s.yazi, { fontSize: boyut * 0.6, color: koyuZemin ? renk.zemin : renk.ana }]}>tripmate</Text>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  yazi: { fontFamily: yazi.baslik, letterSpacing: -0.8 },
});
