// #141 KK1 (kanvas 10–13): seyahat içi alt menü — Keşfet · Program · Listem · Rehber (uygulama menüsünün yerine). 86 px beyaz,
// üstte Çizgi; seçili öğe Gece, diğerleri gri mavi. Sekmeler aynı Tabs düzeninde (durum korunur, haritalar bağlı kalır).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { Ikon, type IkonAdi } from './Ikon';

export type SeyahatSekmesi = 'kesfet' | 'program' | 'listem' | 'rehber';

const OGELER: { ad: SeyahatSekmesi; ikon: IkonAdi }[] = [
  { ad: 'kesfet', ikon: 'kesfet' },
  { ad: 'program', ikon: 'takvim' },
  { ad: 'listem', ikon: 'liste' },
  { ad: 'rehber', ikon: 'kitap' },
];

export function SeyahatMenusu({ aktif, onSec }: { aktif: string; onSec: (ad: SeyahatSekmesi) => void }) {
  const alt = useSafeAreaInsets().bottom;
  return (
    <View style={[s.kap, { paddingBottom: Math.max(alt, 8) }]} accessibilityRole="tablist">
      {OGELER.map((o) => {
        const secili = o.ad === aktif;
        const rengi = secili ? renk.ana : renk.soluk;
        return (
          <Pressable key={o.ad} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onSec(o.ad)} style={s.oge}>
            <Ikon ad={o.ikon} renk={rengi} kalinlik={secili ? 2.6 : 2.2} />
            <Text style={[s.metin, { color: rengi }]} numberOfLines={1}>
              {t(`seyahatMenusu.${o.ad}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin, paddingTop: 8, paddingHorizontal: 12 },
  oge: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 11 },
});
