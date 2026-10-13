// #141 KK4 (kanvas 13): satırı sola kaydır → altta kırmızı "Çıkar" (92 px). Yarıdan fazla çekilirse açık kalır; dokununca
// kapanır. Dikey kaydırmayla çakışmasın diye yalnız belirgin yatay hareket yakalanır.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

const GENISLIK = 92;

export function KaydirilirSatir({ children, onCikar, etiket }: { children: ReactNode; onCikar: () => void; etiket: string }) {
  const [x] = useState(() => new Animated.Value(0));
  const acik = useRef(false);
  const yerles = (ac: boolean) => {
    acik.current = ac;
    Animated.spring(x, { toValue: ac ? -GENISLIK : 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };
  // Ref yalnız jest işleyicilerinin içinde okunur (render sırasında değil).
  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => x.setValue(Math.min(0, Math.max(-GENISLIK * 1.4, (acik.current ? -GENISLIK : 0) + g.dx))),
        onPanResponderRelease: (_e, g) => yerles((acik.current ? -GENISLIK : 0) + g.dx < -GENISLIK / 2),
        onPanResponderTerminate: () => yerles(acik.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x],
  );
  return (
    <View style={s.kap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('listem.cikar')} · ${etiket}`}
        onPress={() => {
          yerles(false);
          onCikar();
        }}
        style={s.cikar}>
        <Ikon ad="cop" boyut={18} renk={renk.zemin} kalinlik={2.4} />
        <Text style={s.cikarMetin}>{t('listem.cikar')}</Text>
      </Pressable>
      <Animated.View style={[s.on, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { borderRadius: 14, backgroundColor: renk.uyari, overflow: 'hidden' },
  cikar: { position: 'absolute', right: 0, top: 0, bottom: 0, width: GENISLIK, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cikarMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  on: { backgroundColor: renk.zemin },
});
