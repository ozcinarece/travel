// #361 KK3 (UX önerileri kanvası, `Ana_v5_Var`): "Planlamaya devam" — bitmemiş en yakın seyahatin tek satırı. Soldan sağa
// 56 px kapak (köşe 12), ad, turuncu "Sıradaki adım: …" (adım yoksa tarih satırı), "N gün kaldı · kişiler", en sağda ›.
// Seyahat ile hazır gezi arasında bağ olmadığından kapak her zaman sabit zemin (29b şeridindeki dağ çizimi); Google
// fotoğrafı kullanılmaz.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { anaV5, renk, yazi } from '@/theme';

type Props = {
  ad: string;
  /** "Sıradaki adım: …" (turuncu) ya da adım yoksa tarih satırı (ikincil). */
  adim: { metin: string; turuncu: boolean } | null;
  /** "4 gün kaldı · Ece, Mert, Ayşe". */
  alt: string;
  onAc: () => void;
};

export function PlanlamayaDevam({ ad, adim, alt, onAc }: Props) {
  return (
    <Pressable
      testID="planlamaya-devam"
      accessibilityRole="button"
      accessibilityLabel={[ad, adim?.metin, alt].filter(Boolean).join(', ')}
      onPress={onAc}
      style={({ pressed }) => [s.satir, pressed && s.basili]}
    >
      <View style={s.kapak} accessible={false}>
        <Svg width={56} height={56} viewBox="0 0 48 48">
          <Path d="M0 48 L0 30 L12 21 L23 31 L35 14 L48 25 L48 48 Z" fill={renk.vurgu} />
          <Path d="M0 48 L0 40 Q24 34 48 40 L48 48 Z" fill={renk.ana} />
        </Svg>
      </View>
      <View style={s.metinler}>
        <Text style={s.ad} numberOfLines={1}>
          {ad}
        </Text>
        {adim ? (
          <Text style={adim.turuncu ? s.adim : s.alt} numberOfLines={1}>
            {adim.metin}
          </Text>
        ) : null}
        <Text style={s.alt} numberOfLines={1}>
          {alt}
        </Text>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={anaV5.ok} strokeWidth={2.4} strokeLinecap="round">
        <Path d="M9 6l6 6-6 6" />
      </Svg>
    </Pressable>
  );
}

const s = StyleSheet.create({
  satir: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: anaV5.satirZemin },
  basili: { opacity: 0.85 },
  kapak: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFE2CC' },
  metinler: { flex: 1, minWidth: 0, gap: 1 },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  adim: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.adim },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
});
