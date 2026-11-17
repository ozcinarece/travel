// #243 KK3 (kanvas 23c): bağlantı yokken Gezi sayfasının en üstündeki şerit — üstü çizili Wi-Fi, "Çevrimdışı · son güncelleme
// 08:12" ve "Plan okunur; bağlanınca kendiliğinden yenilenir". Saat seyahatin saat dilimine göre (trips.tz).
import { StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** `saat`: son başarılı güncellemenin saati ("08:12"); bilinmiyorsa null. */
export function CevrimdisiSeridi({ saat }: { saat: string | null }) {
  return (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={s.serit}>
      <View style={s.ikon}>
        <Ikon ad="cevrimdisi" boyut={16} renk={renk.ana} kalinlik={2.3} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.baslik}>{saat ? t('geziSayfasi.cevrimdisi.baslik', { saat }) : t('geziSayfasi.cevrimdisi.baslikSaatsiz')}</Text>
        <Text style={s.alt}>{t('geziSayfasi.cevrimdisi.alt')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  serit: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: renk.zemin, borderWidth: 1, borderColor: renk.ayrac },
  ikon: { width: 30, height: 30, borderRadius: 9, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
