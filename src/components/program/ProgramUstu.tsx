import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

/** #42 KK2: üst satırın (geri hapı · durum hapı · avatarlar) altında gün kartları + ipucu satırı. */
export function ProgramUstu({ kartlar, ipucu }: { kartlar: ReactNode; ipucu: string }) {
  return (
    <View style={s.kap}>
      {kartlar}
      <Text style={s.ipucu} numberOfLines={1}>
        {ipucu}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 8 },
  ipucu: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil, textAlign: 'center' },
});
