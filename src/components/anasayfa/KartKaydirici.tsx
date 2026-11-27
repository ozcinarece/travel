// #569 KK2 (kanvas `Ana_v9_GeziOncesi`): yaklaşan ve süren seyahatler yana kayar — kartlar arası 10, kenar 16, kart kart
// durur; birden çok kartta altında sayfa noktaları (üstten 10; görünen 18×6 Gece, diğerleri 6×6 #C8CDD9, aralık 6).
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { gorunenKart, KART_ARALIK } from '@/features/anasayfa/v9';
import { t } from '@/i18n';
import { renk } from '@/theme';

const NOKTA_PASIF = '#C8CDD9';

export function KartKaydirici({ genislik, children }: { genislik: number; children: ReactNode[] }) {
  const adet = children.length;
  const [gorunen, setGorunen] = useState(0);
  const kaydi = (e: NativeSyntheticEvent<NativeScrollEvent>) => setGorunen(gorunenKart(e.nativeEvent.contentOffset.x, genislik, adet));
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.kartlar}
        decelerationRate="fast"
        snapToInterval={genislik + KART_ARALIK}
        disableIntervalMomentum
        scrollEnabled={adet > 1}
        onScroll={kaydi}
        scrollEventThrottle={32}
        testID="seyahat-kartlari"
      >
        {children}
      </ScrollView>
      {adet > 1 ? (
        <View style={s.noktalar} accessible accessibilityLabel={t('anasayfa.v9.sayfa', { i: gorunen + 1, n: adet })} testID="sayfa-noktalari">
          {children.map((_, i) => (
            <View key={i} style={[s.nokta, i === gorunen ? s.noktaSecili : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kartlar: { paddingHorizontal: 16, gap: KART_ARALIK },
  noktalar: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: NOKTA_PASIF },
  noktaSecili: { width: 18, backgroundColor: renk.metin },
});
