import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { yazi } from '@/theme';

import { yRenk } from './tema';

type Tur = 'birincil' | 'ikincil';

type Props = {
  baslik: string;
  onPress: () => void;
  tur?: Tur;
  yukleniyor?: boolean;
};

// Kanvastaki üst çubuk hapı: 34 yüksek, 14 yan boşluk, tam yuvarlak, 1,5 çerçeve, 12,5 px 800.
// Birincil siyah (Yayınla, + Yeni gezi), ikincil beyaz + #d9d9d4 çerçeve (Önizle, Son 30 gün).
export function Hap({ baslik, onPress, tur = 'ikincil', yukleniyor }: Props) {
  const birincil = tur === 'birincil';
  const metinRengi = birincil ? yRenk.zemin : yRenk.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!yukleniyor, busy: !!yukleniyor }}
      disabled={yukleniyor}
      onPress={onPress}
      style={({ pressed }) => [s.kap, birincil ? s.birincil : s.ikincil, (pressed || yukleniyor) && s.basili]}>
      {yukleniyor ? <ActivityIndicator size="small" color={metinRengi} /> : null}
      <Text style={[s.metin, { color: metinRengi }]}>{baslik}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  birincil: { backgroundColor: yRenk.metin, borderColor: yRenk.metin },
  ikincil: { backgroundColor: yRenk.zemin, borderColor: yRenk.cerceve },
  basili: { opacity: 0.7 },
  metin: { fontFamily: yazi.ekstra, fontSize: 12.5 },
});
