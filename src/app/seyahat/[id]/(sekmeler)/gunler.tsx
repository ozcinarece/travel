import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// İskelet: Sprint 3.
export default function Ekran() {
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('seyahat.sekme.gunler')} />
      <Text style={s.metin}>{t('seyahat.gunlerYakinda')}</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  metin: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 20 },
});
