// #138 KK6 (kanvas 3 · 22): uygulama alt menüsü — Ana sayfa · Seyahatler · [Yeni] · Kaydettiklerim · Profil.
// Yeni ortada 56 px Mandalina kare (köşe 18), menünün üstüne taşar. Seçili öğe Gece (dolu ikon), diğerleri gri mavi.
// Hem (tabs) düzeninin `tabBar`'ı hem seyahat içindeki UygulamaMenusu bunu kullanır.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { Ikon, type IkonAdi } from './Ikon';

export type AltMenuOgesi = 'index' | 'seyahatler' | 'yeni' | 'kaydettiklerim' | 'profil';

const OGELER: { ad: Exclude<AltMenuOgesi, 'yeni'>; ikon: IkonAdi; ikonSecili: IkonAdi; baslik: string; yol: '/(tabs)' | '/(tabs)/seyahatler' | '/(tabs)/kaydettiklerim' | '/(tabs)/profil' }[] = [
  { ad: 'index', ikon: 'ev', ikonSecili: 'ev', baslik: 'sekme.anasayfa', yol: '/(tabs)' },
  { ad: 'seyahatler', ikon: 'seyahatler', ikonSecili: 'seyahatler', baslik: 'sekme.seyahatler', yol: '/(tabs)/seyahatler' },
  { ad: 'kaydettiklerim', ikon: 'kalp', ikonSecili: 'kalpDolu', baslik: 'sekme.kaydettiklerim', yol: '/(tabs)/kaydettiklerim' },
  { ad: 'profil', ikon: 'profil', ikonSecili: 'profil', baslik: 'sekme.profil', yol: '/(tabs)/profil' },
];

export function AltMenu({ aktif }: { aktif: AltMenuOgesi | null }) {
  const alt = useSafeAreaInsets().bottom;
  const oge = (o: (typeof OGELER)[number]) => {
    const secili = o.ad === aktif;
    const rengi = secili ? renk.ana : renk.soluk;
    return (
      <Pressable key={o.ad} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => router.navigate(o.yol)} style={s.oge}>
        <Ikon ad={secili ? o.ikonSecili : o.ikon} renk={rengi} kalinlik={secili ? 2.6 : 2.2} />
        <Text style={[s.metin, { color: rengi }]} numberOfLines={1}>
          {t(o.baslik)}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.kap, { paddingBottom: Math.max(alt, 8) }]} accessibilityRole="tablist">
      {OGELER.slice(0, 2).map(oge)}
      <View style={s.ortaYuva}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('sekme.yeniEtiket')} onPress={() => router.navigate('/(tabs)/yeni')} style={({ pressed }) => [s.yeni, pressed && { opacity: 0.85 }]}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={renk.metin} strokeWidth={3} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
      {OGELER.slice(2).map(oge)}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin, paddingTop: 8, paddingHorizontal: 8 },
  oge: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 11 },
  ortaYuva: { flex: 1, alignItems: 'center' },
  yeni: { width: 56, height: 56, borderRadius: 18, marginTop: -26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
});
