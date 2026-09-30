import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

type Props = { baslik: string; alt?: string; geri?: () => void; sag?: ReactNode };

export function EkranBasligi({ baslik, alt, geri, sag }: Props) {
  return (
    <View style={stil.satir}>
      {geri ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={geri} style={stil.geri}>
          <Text style={stil.geriIsaret}>‹</Text>
        </Pressable>
      ) : null}
      <View style={stil.metinler}>
        <Text accessibilityRole="header" style={stil.baslik}>
          {baslik}
        </Text>
        {alt ? <Text style={stil.alt}>{alt}</Text> : null}
      </View>
      {sag}
    </View>
  );
}

const stil = StyleSheet.create({
  satir: {
    paddingHorizontal: bosluk.kenar,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  geri: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: renk.yuzey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geriIsaret: { fontFamily: yazi.kalin, fontSize: 24, lineHeight: 26, color: renk.metin, marginTop: -2 },
  metinler: { flex: 1, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, lineHeight: 29, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
});
