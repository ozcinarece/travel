import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/**
 * #275 (kanvas 29d · 21): "‹ Keşfet" hapı — 40 px, tam yuvarlak, Buz zemin, Archivo 15. Yığında önceki ekran varsa ona,
 * yoksa (derin bağlantı) ana ekrana döner.
 */
export function KesfetHapi() {
  const don = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  return (
    <Pressable accessibilityRole="button" onPress={don} hitSlop={4} style={({ pressed }) => [s.hap, pressed && { opacity: 0.8 }]}>
      <Ikon ad="geri" boyut={20} renk={renk.ana} kalinlik={2.6} />
      <Text style={s.metin}>{t('profil.kesfet')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hap: { alignSelf: 'flex-start', height: 40, paddingLeft: 8, paddingRight: 14, borderRadius: 999, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metin: { fontFamily: yazi.baslik, fontSize: 15, color: renk.metin },
});
