import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { renk } from '@/theme';

type Props = {
  listede: boolean;
  onPress: () => void;
  mesgul?: boolean;
  /** Varsayılan 38 px kare (kanvas Temel); dar yerlerde 32. */
  boyut?: number;
  pasif?: boolean;
};

/**
 * #136 KK5 (kanvas Temel): "Listeye ekle / Listende" her ekranda TEK bileşen — 38 px kare, köşe 11:
 * turuncu + (Mandalina, Lacivert çizgi 3) ↔ açık yeşil ✓ (Başarı zemini, koyu yeşil çizgi 3,2; dokununca listeden çıkar).
 */
export function EkleDugmesi({ listede, onPress, mesgul, boyut = 38, pasif }: Props) {
  const r = Math.round(boyut * 0.29);
  const glif = Math.round(boyut * 0.42);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listede ? t('ui.ekle.listede') : t('ui.ekle.ekle')}
      accessibilityState={{ selected: listede, busy: !!mesgul, disabled: !!pasif }}
      disabled={!!mesgul || !!pasif}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.kap, { width: boyut, height: boyut, borderRadius: r, backgroundColor: listede ? renk.basariZemin : renk.vurgu }, pressed && { opacity: 0.8 }, pasif && { opacity: 0.4 }]}>
      {mesgul ? (
        <ActivityIndicator color={listede ? renk.basariMetin : renk.metin} />
      ) : (
        <Svg width={glif} height={glif} viewBox="0 0 24 24" fill="none">
          {listede ? (
            <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={renk.basariMetin} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <Path d="M12 5v14M5 12h14" stroke={renk.metin} strokeWidth={3} strokeLinecap="round" />
          )}
        </Svg>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'center', justifyContent: 'center' },
});
