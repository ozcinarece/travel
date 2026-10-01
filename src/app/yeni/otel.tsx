import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Buton } from '@/components/ui/Buton';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// PRD 3.3 Otel — iskelet. 3.2'de oluşan seyahat `trip` parametresiyle gelir; içerik bir sonraki PR'da.
export default function OtelEkrani() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('otel.baslik')} alt={t('otel.alt')} geri={() => router.back()} />
      <View style={s.icerik}>
        <Text style={s.metin}>{t('otel.yakinda')}</Text>
      </View>
      <View style={s.altKisim}>
        <Buton
          baslik={t('otel.seyahatlere')}
          onPress={() => (trip ? router.replace({ pathname: '/seyahat/[id]', params: { id: trip } }) : router.replace('/(tabs)'))}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 20 },
  metin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 16 },
});
