import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// Seyahat içi (PRD §4: Keşfet · Günler · Program · Grup) — Sprint 2'de dolar; şimdilik giriş noktası.
export default function SeyahatEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seyahatler = useSeyahatler();
  const seyahat = seyahatler.data?.find((s) => s.id === id);
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={seyahat?.city_label ?? ''} geri={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
      <View style={s.icerik}>
        <Text style={s.metin}>{t('seyahat.yakinda')}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 20 },
  metin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: renk.ikincil },
});
