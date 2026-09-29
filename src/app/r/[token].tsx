import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// PRD 3.10 Davetle katılım — Sprint 4. Şimdilik yalnızca rota ve kod gösterimi (iskelet).
export default function DavetEkrani() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <SafeAreaView style={s.ekran}>
      <View style={s.icerik}>
        <Text style={s.baslik}>{t('davet.yakinda')}</Text>
        <Text style={s.alt}>{t('davet.token', { token: token ?? '' })}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { flex: 1, padding: bosluk.kenar, justifyContent: 'center', gap: 8 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.6, color: renk.metin, textAlign: 'center' },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, textAlign: 'center' },
});
