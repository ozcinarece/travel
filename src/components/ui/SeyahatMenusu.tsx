// #181 KK1 (kanvas 23 · 27): seyahat içi alt menü — Gezi · Plan · Keşfet · Harcama · Sohbet (uygulama menüsünün yerine). 86 px
// beyaz, üstte Çizgi; seçili öğe Gece (çizgi 2,4 + %18 dolgu), diğerleri gri mavi. Sekmeler aynı Tabs düzeninde (durum korunur,
// haritalar bağlı kalır). Sohbet'in okunmamış rozeti D (#184) ile gelir (`rozetler`).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

import { Ikon, type IkonAdi } from './Ikon';

export type SeyahatSekmesi = 'gezi' | 'program' | 'kesfet' | 'harcama' | 'sohbet';

const OGELER: { ad: SeyahatSekmesi; ikon: IkonAdi }[] = [
  { ad: 'gezi', ikon: 'gezi' },
  { ad: 'program', ikon: 'takvim' },
  { ad: 'kesfet', ikon: 'pusulaCizgi' },
  { ad: 'harcama', ikon: 'cuzdan' },
  { ad: 'sohbet', ikon: 'sohbet' },
];

export function SeyahatMenusu({ aktif, onSec, rozetler }: { aktif: string; onSec: (ad: SeyahatSekmesi) => void; rozetler?: Partial<Record<SeyahatSekmesi, number>> }) {
  const alt = useSafeAreaInsets().bottom;
  return (
    <View style={[s.kap, { paddingBottom: Math.max(alt, 8) }]} accessibilityRole="tablist">
      {OGELER.map((o) => {
        const secili = o.ad === aktif;
        const rengi = secili ? renk.ana : renk.soluk;
        const rozet = rozetler?.[o.ad] ?? 0;
        return (
          <Pressable key={o.ad} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onSec(o.ad)} style={s.oge}>
            <View>
              <Ikon ad={o.ikon} renk={rengi} kalinlik={secili ? 2.4 : 2.2} dolgu={secili} />
              {rozet > 0 ? (
                <View style={s.rozet}>
                  <Text style={s.rozetMetin}>{rozet > 99 ? '99+' : rozet}</Text>
                </View>
              ) : null}
            </View>
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
  kap: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin, paddingTop: 8, paddingHorizontal: 8 },
  oge: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 11 },
  rozet: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: renk.vurgu,
    borderWidth: 2,
    borderColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.metin, lineHeight: 13 },
});
