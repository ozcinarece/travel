import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/**
 * PRD §7: Google verisi içeren her kartta atıf. Harita dışındaki yüzeyde metin biçimi (#342, kanvas 9b/9c): "Google Maps"
 * (çevrilmez, harfi değişmez, tek satır), 12 px, ağırlık 400, #5E5E5E, sağa hizalı. Metin `yerler.atif`'ten gelir; değeri
 * Google'ın koşulu gereği her dilde "Google Maps" kalır.
 */
export function GoogleAtfi({ stil }: { stil?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.kap, stil]}>
      <Text style={s.metin} numberOfLines={1} {...({ translate: 'no' } as object)}>
        {t('yerler.atif')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'flex-end', paddingTop: 6 },
  metin: { fontFamily: yazi.normal, fontSize: 12, color: renk.atif },
});
