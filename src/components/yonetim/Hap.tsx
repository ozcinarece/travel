import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { yazi } from '@/theme';

import { yRenk } from './tema';

type Tur = 'birincil' | 'vurgu' | 'ikincil';

type Props = {
  baslik: string;
  onPress: () => void;
  tur?: Tur;
  /** Satır içi (34 px, kanvas bildirimdeki "Geri al" ölçüsü). */
  kucuk?: boolean;
  yukleniyor?: boolean;
  /** Metnin solunda 14 px ikon (kanvas: Önizle). */
  ikon?: ReactNode;
};

const RENK: Record<Tur, { zemin: string; metin: string; cerceve: string }> = {
  birincil: { zemin: yRenk.ana, metin: yRenk.zemin, cerceve: yRenk.ana },
  vurgu: { zemin: yRenk.vurgu, metin: yRenk.metin, cerceve: yRenk.vurgu },
  ikincil: { zemin: yRenk.zemin, metin: yRenk.ana, cerceve: yRenk.cerceve },
};

/**
 * #155 Düğme (kanvas BO-1 üst çubuk): 40 px, 12 köşe, 800. Vurgu = Mandalina + Lacivert yazı (Yayınla, 14 px, 18 yan);
 * ikincil = beyaz + 1,5 px Çizgi çerçeve + Gece yazı (Geçmiş, 13 px, 14 yan); birincil = Gece + beyaz yazı.
 */
export function Hap({ baslik, onPress, tur = 'ikincil', kucuk, yukleniyor, ikon }: Props) {
  const r = RENK[tur];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!yukleniyor, busy: !!yukleniyor }}
      disabled={yukleniyor}
      onPress={onPress}
      style={({ pressed }) => [
        s.kap,
        kucuk ? s.kucuk : tur === 'ikincil' ? s.ikincil : s.dolu,
        { backgroundColor: r.zemin, borderColor: r.cerceve },
        (pressed || yukleniyor) && s.basili,
      ]}>
      {yukleniyor ? <ActivityIndicator size="small" color={r.metin} /> : ikon}
      <Text style={[s.metin, !kucuk && tur !== 'ikincil' && s.metinBuyuk, { color: r.metin }]}>{baslik}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { height: 40, borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ikincil: { paddingHorizontal: 14 },
  dolu: { paddingHorizontal: 18 },
  kucuk: { height: 34, paddingHorizontal: 12, borderRadius: 10 },
  basili: { opacity: 0.7 },
  metin: { fontFamily: yazi.ekstra, fontSize: 13 },
  metinBuyuk: { fontSize: 14 },
});
