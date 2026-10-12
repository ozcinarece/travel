import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Kanvas (Sehir19) yer tutucu gradyanları: rolü boş şehirde 160° üç duraklı gradyan; şehir kimliğinden seçilir.
const GRADYANLAR = [
  ['#f7d9b8', '#e58a5a', '#7a3a22'],
  ['#e9e4f7', '#9b8ad3', '#3b2c6e'],
  ['#fbe7cf', '#e9a56b', '#8a4a25'],
  ['#d8f0f9', '#5cc3e5', '#0b6b8f'],
  ['#cfe7f7', '#5fa8d6', '#1b4f7a'],
  ['#e2f3d8', '#7cc27a', '#245c33'],
] as const;

export function gradyanSec(anahtar: string): readonly [string, string, string] {
  let h = 0;
  for (const c of anahtar) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADYANLAR[h % GRADYANLAR.length];
}

/** Görsel varsa görsel, yoksa gradyan; ölçü ve yarıçap `style`dan. */
export function GorselYaDaGradyan({ uri, anahtar, style, children }: { uri: string | null | undefined; anahtar: string; style: ViewStyle; children?: React.ReactNode }) {
  const [a, b, c] = gradyanSec(anahtar);
  const id = `g${anahtar.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
  return (
    <View style={[s.kap, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
          <Defs>
            <LinearGradient id={id} x1="0.33" y1="0" x2="0.67" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.55" stopColor={b} />
              <Stop offset="1" stopColor={c} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
        </Svg>
      )}
      {children}
    </View>
  );
}

/** Kanvas kart gölgesi: yukarıdan aşağı saydam (%40) → siyah `koyuluk`. */
export function AltGolge({ koyuluk = 0.55, id }: { koyuluk?: number; id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.4" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={koyuluk} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

const s = StyleSheet.create({
  kap: { overflow: 'hidden', flexShrink: 0 },
});
