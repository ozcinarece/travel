// #388: ekleme sonucunun tek satırı. Hata: bugünkü hata satırı (uyarı rengi); bilgi (KK3): ikincil metin `#5B6178`.
// Bağlantı hatasında yanında "Tekrar dene" (KK1; Seyahatime al'daki "Tekrar dene" bağlantısıyla aynı görünüş).
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { EklemeDurumu } from '@/features/ekleme/eklemeDurumu';
import { t } from '@/i18n';
import { anaV5, renk, yazi } from '@/theme';

export function EklemeDurumSatiri({ durum, metinStili }: { durum: EklemeDurumu; metinStili?: TextStyle }) {
  const metin = (
    <Text style={[durum.tur === 'bilgi' ? s.bilgi : s.hata, metinStili, durum.tur === 'bilgi' && { color: anaV5.ikincil }, durum.tekrar && { flex: 1 }]} accessibilityLiveRegion="polite">
      {durum.metin}
    </Text>
  );
  if (!durum.tekrar) return metin;
  return (
    <View style={s.satir}>
      {metin}
      <Pressable accessibilityRole="button" onPress={durum.tekrar} hitSlop={8}>
        <Text style={s.tekrar}>{t('ekleme.tekrarDene')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
  bilgi: { fontFamily: yazi.yari, fontSize: 12, color: anaV5.ikincil },
  tekrar: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
});
