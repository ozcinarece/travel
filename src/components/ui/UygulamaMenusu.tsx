import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

const OGELER: { ad: IkonAdi; baslik: string; yol: '/(tabs)' | '/(tabs)/yeni' | '/(tabs)/profil' }[] = [
  { ad: 'seyahatler', baslik: 'sekme.seyahatler', yol: '/(tabs)' },
  { ad: 'yeni', baslik: 'sekme.yeni', yol: '/(tabs)/yeni' },
  { ad: 'profil', baslik: 'sekme.profil', yol: '/(tabs)/profil' },
];

/**
 * #45 §1: seyahat içinde de uygulama alt menüsü görünür (Seyahatler seçili); seyahat içi Keşfet · Program · Grup menüsü kalktı.
 * Öğeler uygulama sekmeleriyle birebir (Haritam v2'de eklenir, PRD §4).
 */
export function UygulamaMenusu() {
  const alt = useSafeAreaInsets().bottom;
  return (
    <View style={[s.kap, { paddingBottom: Math.max(alt, 6) }]} accessibilityRole="tablist">
      {OGELER.map((o) => {
        const secili = o.ad === 'seyahatler';
        const rengi = secili ? renk.metin : renk.soluk;
        return (
          <Pressable key={o.ad} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => router.navigate(o.yol)} style={s.oge}>
            <Ikon ad={o.ad} renk={rengi} />
            <Text style={[s.metin, { color: rengi }]}>{t(o.baslik)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: renk.ayrac, backgroundColor: renk.zemin, paddingTop: 6 },
  oge: { flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
  metin: { fontFamily: yazi.yari, fontSize: 10 },
});
