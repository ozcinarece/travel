// #181 KK1 (kanvas 23 · 27): seyahat içi alt menü — Gezi · Plan · Yer ekle (#274, kanvas 29e; rota adı `kesfet`) · Harcama · Sohbet (uygulama menüsünün yerine). 86 px
// beyaz, üstte Çizgi; seçili öğe Gece (çizgi 2,4 + %18 dolgu), diğerleri gri mavi. Sekmeler aynı Tabs düzeninde (durum korunur,
// haritalar bağlı kalır). Sohbet'in okunmamış rozeti D (#184) ile gelir (`rozetler`).
// #308 KK7 (kanvas `Sayfa_v7_Seyahat_*`): ana sayfa alt menüsüyle (#405, `AltMenu`) aynı biçim — beyaz, üstte 1 px `#E4E7EE`,
// üstten 10 px; 23 px çizgi ikon (2 px) ve 11 px yazı, arada 3 px. Seçili sekmede ikon Mandalina, yazı Gece 700; diğerleri
// `#8A91A3` 500. Rozet ikonun sağ üstünde Mandalina, üstünde Lacivert 11/800.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { altMenuRenk, renk, yazi } from '@/theme';

export type SeyahatSekmesi = 'gezi' | 'program' | 'kesfet' | 'harcama' | 'sohbet';

const OGELER: SeyahatSekmesi[] = ['gezi', 'program', 'kesfet', 'harcama', 'sohbet'];

function SekmeIkonu({ sekme, renk: r }: { sekme: SeyahatSekmesi; renk: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={r} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {sekme === 'gezi' ? (
        <Path d="M3 11l9-7 9 7v9H3z" />
      ) : sekme === 'program' ? (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={2} />
          <Path d="M4 10h16M9 3v4M15 3v4" />
        </>
      ) : sekme === 'kesfet' ? (
        <>
          <Circle cx={12} cy={10} r={3} />
          <Path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
        </>
      ) : sekme === 'harcama' ? (
        <>
          <Rect x={3} y={6} width={18} height={13} rx={2} />
          <Path d="M3 10h18" />
        </>
      ) : (
        <Path d="M4 5h16v11H9l-5 4z" />
      )}
    </Svg>
  );
}

export function SeyahatMenusu({ aktif, onSec, rozetler }: { aktif: string; onSec: (ad: SeyahatSekmesi) => void; rozetler?: Partial<Record<SeyahatSekmesi, number>> }) {
  const alt = useSafeAreaInsets().bottom;
  return (
    <View style={[s.kap, { paddingBottom: Math.max(alt, 8) }]} accessibilityRole="tablist">
      {OGELER.map((ad) => {
        const secili = ad === aktif;
        const rozet = rozetler?.[ad] ?? 0;
        return (
          <Pressable key={ad} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onSec(ad)} style={s.oge}>
            <View>
              <SekmeIkonu sekme={ad} renk={secili ? altMenuRenk.secili : altMenuRenk.pasif} />
              {rozet > 0 ? (
                <View style={s.rozet}>
                  <Text style={s.rozetMetin}>{rozet > 99 ? '99+' : rozet}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.metin, secili && s.metinSecili]} numberOfLines={1}>
              {t(`seyahatMenusu.${ad}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: altMenuRenk.cizgi, backgroundColor: renk.zemin, paddingTop: 10 },
  oge: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  metin: { fontFamily: yazi.orta, fontSize: 11, color: altMenuRenk.pasif },
  metinSecili: { fontFamily: yazi.kalin, color: renk.metin },
  rozet: {
    position: 'absolute',
    top: -4,
    left: 17,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: renk.vurgu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.metin, lineHeight: 13 },
});
