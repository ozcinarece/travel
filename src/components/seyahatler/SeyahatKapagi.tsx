// #405 KK2 · inceleme 2 (kanvas `Ana_v6_Seyahatlerim`): seyahatin kapağı. Seyahatin fotoğraf alanı yok; kanvastaki yer tutucu
// çizilir: üstte %45 düz gökyüzü, altında toprak geçişi, ortada 22 px gri kamera çizgisi. Ton satır başına değişir (kanvastaki
// 4 ton); seyahat kimliğinden seçilir, böylece bir seyahat her açılışta aynı tonda kalır. Google fotoğrafı kullanılmaz.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FotoKutusu } from '@/components/gezi/GeziParcalari';
import { Ikon } from '@/components/ui/Ikon';

/** Kanvastaki tonlar: [gökyüzü, toprak başı, toprak sonu]. */
export const KAPAK_TONLARI: readonly (readonly [string, string, string])[] = [
  ['#CFE0F2', '#E8D3BC', '#D9B894'],
  ['#D6E2F0', '#B9C7D9', '#8EA2BC'],
  ['#D8E7F3', '#C9DDC2', '#9FC08F'],
  ['#F3D9C4', '#E7B892', '#C98A5E'],
];

/** Kimlikten kararlı ton sırası. */
export function kapakTonu(kimlik: string): number {
  let h = 0;
  for (let i = 0; i < kimlik.length; i++) h = (h * 31 + kimlik.charCodeAt(i)) >>> 0;
  return h % KAPAK_TONLARI.length;
}

export function SeyahatKapagi({ kimlik, yukseklik, kose, genislik, stil }: { kimlik: string; yukseklik: number; kose: number; genislik?: number; stil?: StyleProp<ViewStyle> }) {
  const ton = kapakTonu(kimlik);
  const [gok, toprak1, toprak2] = KAPAK_TONLARI[ton];
  const id = `kapak${ton}`;
  return (
    <View accessible={false} testID="seyahat-kapagi" style={[{ height: yukseklik }, genislik ? { width: genislik } : null, stil]}>
      <FotoKutusu
        uri={null}
        tip={null}
        kose={kose}
        stil={[s.kutu, { backgroundColor: gok }]}
        yerTutucu={
          <>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0.45" x2="0" y2="1">
                  <Stop offset="0" stopColor={toprak1} />
                  <Stop offset="1" stopColor={toprak2} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="45" fill={gok} />
              <Rect x="0" y="45" width="100" height="55" fill={`url(#${id})`} />
            </Svg>
            <View style={s.ikon} pointerEvents="none">
              <Ikon ad="kamera" boyut={22} renk="#9AA1B2" kalinlik={1.8} />
            </View>
          </>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  kutu: { flex: 1 },
  ikon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
