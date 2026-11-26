// #405 KK1 · KK6 (UX önerileri kanvası, `Ana_v6_Kesfet` · `Ana_v6_Seyahatlerim` alt menüsü): beyaz zemin, üstte 1 px
// `#E4E7EE` çizgi, üstten 10 px; her sekmede 24 px çizgi ikon (2 px) ve 11 px yazı, aralarında 3 px. Seçili sekmede ikon
// Mandalina, yazı Gece 700; diğerleri `#8A91A3` 500. Sekmeye dokununca `sekme_acildi` olayı (meta: sekme) yazılır.
// #407 KK5 (`Ana_v6_Arkadaslar`): Keşfet · Seyahatlerim · Arkadaşlar · Profil.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { olayYaz } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { altMenuRenk, renk, yazi } from '@/theme';

/** Kanvastaki sekme renkleri (`theme.altMenuRenk`; seyahat içi menü de kullanır, #308 KK7). */
export { altMenuRenk };

export type MenuSekmesi = 'kesfet' | 'seyahatlerim' | 'arkadaslar' | 'profil';

/** Rota adı → sekme (olay meta'sı ve i18n anahtarı). */
const SEKMELER: Record<string, MenuSekmesi> = { index: 'kesfet', seyahatler: 'seyahatlerim', arkadaslar: 'arkadaslar', profil: 'profil' };

function SekmeIkonu({ sekme, renk: r }: { sekme: MenuSekmesi; renk: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={r} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {sekme === 'kesfet' ? (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
        </>
      ) : sekme === 'seyahatlerim' ? (
        <>
          <Rect x={4} y={7} width={16} height={13} rx={2} />
          <Path d="M9 7V5h6v2M4 12h16" />
        </>
      ) : sekme === 'arkadaslar' ? (
        <>
          <Circle cx={9} cy={8} r={3.5} />
          <Circle cx={17} cy={9} r={2.8} />
          <Path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M15 14.6c2.6.2 4.6 2 5.5 5.4" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </>
      )}
    </Svg>
  );
}

export function AltMenu({ state, navigation }: BottomTabBarProps) {
  const alt = useSafeAreaInsets().bottom;
  return (
    <View style={[s.menu, { paddingBottom: Math.max(alt, 8) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const sekme = SEKMELER[route.name];
        if (!sekme) return null;
        const secili = state.index === i;
        const bas = () => {
          const olay = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (secili || olay.defaultPrevented) return;
          olayYaz('sekme_acildi', null, { sekme });
          navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable key={route.key} testID={`alt-menu-${sekme}`} accessibilityRole="tab" accessibilityState={{ selected: secili }} accessibilityLabel={t(`menu.${sekme}`)} onPress={bas} style={s.sekme}>
            <SekmeIkonu sekme={sekme} renk={secili ? altMenuRenk.secili : altMenuRenk.pasif} />
            <Text style={[s.yazi, secili ? s.yaziSecili : null]}>{t(`menu.${sekme}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  menu: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: altMenuRenk.cizgi, backgroundColor: renk.zemin },
  sekme: { flex: 1, minHeight: 44, alignItems: 'center', gap: 3 },
  yazi: { fontFamily: yazi.orta, fontSize: 11, color: altMenuRenk.pasif },
  yaziSecili: { fontFamily: yazi.kalin, color: renk.metin },
});
