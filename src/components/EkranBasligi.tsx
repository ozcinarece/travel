import { StyleSheet, Text, View } from 'react-native';

import { bosluk, renk, yazi } from '@/theme';

export function EkranBasligi({ baslik, alt }: { baslik: string; alt?: string }) {
  return (
    <View style={stil.kap}>
      <Text accessibilityRole="header" style={stil.baslik}>
        {baslik}
      </Text>
      {alt ? <Text style={stil.alt}>{alt}</Text> : null}
    </View>
  );
}

const stil = StyleSheet.create({
  kap: { paddingHorizontal: bosluk.kenar, paddingTop: 12, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
});
