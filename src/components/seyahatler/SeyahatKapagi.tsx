// #405 KK2 (kanvas `Ana_v6_Seyahatlerim`): seyahatin kapağı. Seyahatin fotoğraf alanı yok; "Planlamaya devam" karosundaki
// (#361 KK3) sabit dağ çizimi kullanılır, Google fotoğrafı kullanılmaz. Büyük kapakta (190 px, köşe 16) ve 56 px karoda aynı.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { renk } from '@/theme';

export function SeyahatKapagi({ yukseklik, kose, genislik, stil }: { yukseklik: number; kose: number; genislik?: number; stil?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.kapak, { height: yukseklik, borderRadius: kose }, genislik ? { width: genislik } : null, stil]} accessible={false}>
      <Svg width="100%" height="100%" viewBox="0 0 48 48" preserveAspectRatio="none">
        <Path d="M0 48 L0 30 L12 21 L23 31 L35 14 L48 25 L48 48 Z" fill={renk.vurgu} />
        <Path d="M0 48 L0 40 Q24 34 48 40 L48 48 Z" fill={renk.ana} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  kapak: { overflow: 'hidden', backgroundColor: '#FFE2CC' },
});
