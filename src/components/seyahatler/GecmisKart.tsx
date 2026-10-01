import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { ayYil } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

type Props = { seyahat: SeyahatOzet; sira: number; onPress: () => void };

// Kanvastaki soluk zeminler; şehir fotoğrafı yok (Google fotoğrafı saklanmaz, PRD §7).
const ZEMINLER = ['#dfe6e2', '#efe3d3', '#e4e1ea', '#e6e9dc'];

// PRD 3.1 KK3: geçmiş kartı — şehir, ay-yıl, mekan sayısı.
export function GecmisKart({ seyahat, sira, onPress }: Props) {
  const mekan = seyahat.places[0]?.count ?? 0;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.kap, pressed && { opacity: 0.8 }]}>
      <View style={[s.kutu, { backgroundColor: ZEMINLER[sira % ZEMINLER.length] }]}>
        <Text style={s.sehir} numberOfLines={2}>
          {seyahat.city_label}
        </Text>
      </View>
      <Text style={s.alt} numberOfLines={1}>
        {seyahat.end_date ? ayYil(seyahat.end_date) : t('seyahatler.tarihsiz')} · {t('seyahatler.mekan', { n: mekan })}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { width: 120, gap: 6 },
  kutu: { height: 96, borderRadius: 16, padding: 10, justifyContent: 'flex-end' },
  sehir: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.5, lineHeight: 20, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
});
