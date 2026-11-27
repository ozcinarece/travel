import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

/**
 * #578 KK2: üçüncü taraf verilerin lisansları (Ayarlar › Lisanslar). Profil haritasındaki 81 il yolu turkey-map-react
 * paketinin MIT lisanslı verisidir; paket eklenmedi, yalnız yollar `src/assets/turkiye-iller.json`'da. Kanvasta bu ekranın
 * çizimi yok (tasarım bekliyor): mevcut ekran başlığı ve metin stilleriyle.
 */
export default function LisanslarEkrani() {
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <EkranBasligi baslik={t('lisanslar.baslik')} geri={() => router.back()} />
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.blok}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('lisanslar.haritaBaslik')}
          </Text>
          <Text style={s.kaynak}>{t('lisanslar.haritaKaynak')}</Text>
          <Text style={s.metin} selectable>
            {t('lisanslar.haritaMetin')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 16, paddingBottom: 32, gap: 18 },
  blok: { gap: 6 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  kaynak: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  metin: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, color: renk.ikincil },
});
