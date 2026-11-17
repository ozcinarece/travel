// #243 KK3 (kanvas 23c): bağlantı yokken Gezi sayfasının en üstündeki şerit — üstü çizili Wi-Fi, "Çevrimdışı · son güncelleme
// 08:12" ve "Plan okunur; bağlanınca kendiliğinden yenilenir". Saat seyahatin saat dilimine göre (trips.tz).
// #293 KK1: son güncelleme bugün değilse "dün 22:40" ya da "16 Kas 22:40". KK7: şerit çıkınca iOS'ta da duyurulur
// (`accessibilityLiveRegion` yalnız Android'de çalışır). KK5: sohbet ekranında da aynı şerit.
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { AYLAR_KISA } from '@/lib/takvim';
import { guncellemeGunu } from '@/lib/zaman';
import { renk, yazi } from '@/theme';

/** Şeridin başlığı. `guncellendi`: son başarılı güncellemenin anı (ms); bilinmiyorsa 0. */
export function seritBasligi(guncellendi: number, tz: string, an: Date = new Date()): string {
  if (!(guncellendi > 0)) return t('geziSayfasi.cevrimdisi.baslikSaatsiz');
  const g = guncellemeGunu(new Date(guncellendi), an, tz);
  if (g.tur === 'bugun') return t('geziSayfasi.cevrimdisi.baslik', { saat: g.saat });
  if (g.tur === 'dun') return t('geziSayfasi.cevrimdisi.baslikDun', { saat: g.saat });
  return t('geziSayfasi.cevrimdisi.baslikTarih', { gun: g.gun, ay: AYLAR_KISA[g.ay - 1], saat: g.saat });
}

export function CevrimdisiSeridi({ guncellendi, tz, style }: { guncellendi: number; tz: string; style?: StyleProp<ViewStyle> }) {
  const baslik = seritBasligi(guncellendi, tz);
  const alt = t('geziSayfasi.cevrimdisi.alt');
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${baslik}. ${alt}`);
    // Yalnız şerit çıktığında bir kez duyurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={[s.serit, style]}>
      <View style={s.ikon}>
        <Ikon ad="cevrimdisi" boyut={16} renk={renk.ana} kalinlik={2.3} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.baslik}>{baslik}</Text>
        <Text style={s.alt}>{alt}</Text>
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
