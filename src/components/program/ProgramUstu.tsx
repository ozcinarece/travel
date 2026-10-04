import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

/**
 * #39 KK1–4: Program sekmesinin iki görünümde aynı olan üst bloğu — görünüm anahtarı, gün kartları, ipucu satırı.
 * Geri hapı + avatarlar çağıranda (HaritaEkrani kabuğu ya da Çizelge'nin kendi satırı).
 */
export function ProgramUstu({ anahtar, kartlar, ipucu }: { anahtar: ReactNode; kartlar: ReactNode; ipucu: string }) {
  return (
    <View style={s.kap}>
      {anahtar}
      {kartlar}
      <Text style={s.ipucu} numberOfLines={1}>
        {ipucu}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 10 },
  ipucu: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil, textAlign: 'center' },
});
