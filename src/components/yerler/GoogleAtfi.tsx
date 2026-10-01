import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** PRD §7: Google verisi içeren her kartta atıf. Harita dışındaki listelerde metin biçimi. */
export function GoogleAtfi() {
  return (
    <View style={s.kap}>
      <Text style={s.metin}>{t('yerler.atif')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'flex-end', paddingTop: 6 },
  metin: { fontFamily: yazi.yari, fontSize: 11, color: renk.soluk },
});
