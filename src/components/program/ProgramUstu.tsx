import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

/** #42 KK2: üst satırın (geri hapı · durum hapı · avatarlar) altında gün kartları + ipucu satırı. */
export function ProgramUstu({ kartlar, ipucu }: { kartlar: ReactNode; ipucu: string }) {
  return (
    <View style={s.kap}>
      {kartlar}
      {/* #47 C11: ipucu gün kartlarının altında, beyaz yarı saydam hap; boşsa gösterilmez. */}
      {ipucu ? (
        <View style={s.hap} pointerEvents="none">
          <Text style={s.ipucu} numberOfLines={1}>
            {ipucu}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 8 },
  hap: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)' },
  ipucu: { fontFamily: yazi.yari, fontSize: 11, color: renk.ikincil, textAlign: 'center' },
});
